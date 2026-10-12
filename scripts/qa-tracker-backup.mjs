import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';

const snapshot = process.env.SMOKE_URL ? null : await startQASnapshot({ snapshotName:'qa-snapshot-tracker-' + process.pid });
const base = process.env.SMOKE_URL || snapshot.base;
const browser = await chromium.launch({channel:'chrome',headless:true});
let checks = 0;
function verify(value, label, details) {
  if (!value) throw new Error(label + (details === undefined ? '' : ': ' + JSON.stringify(details)));
  checks++;
  console.log('PASS ' + label);
}
function sessionButton(page) { return page.getByRole('button',{name:/Sessions \(\d+\)/}); }
function sessionRows(page) { return page.locator('.tracker-session-row'); }
async function waitSaved(page) {
  await page.locator('.tracker-save-label[data-state="saved"]').waitFor({timeout:15000});
}
try {
  const sourceContext=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const source=await sourceContext.newPage();
  const errors=[];
  source.on('pageerror',error=>errors.push(error.message));
  await source.goto(base+'/tools/decarb-tracker/',{waitUntil:'networkidle'});
  await waitSaved(source);
  await source.getByRole('button',{name:'New run'}).click();
  const setupTab=source.getByRole('tab',{name:'Setup'});
  await source.waitForFunction(() => document.querySelector('#tracker-tab-setup')?.getAttribute('aria-selected')==='true',null,{timeout:5000});
  verify(await setupTab.getAttribute('aria-selected')==='true',
    'creating a run selects the baseline Setup tab');
  await source.getByRole('textbox',{name:'Run name / batch identifier'}).fill('Imported QC reference run',{timeout:6000});
  await source.getByRole('button',{name:'Start recording'}).click();
  await source.locator('#tracker-measurement').fill('32');
  await source.locator('#tracker-observed-temp').fill('78.5');
  await source.getByRole('textbox',{name:'Reading note (optional)'}).fill('Stabilized balance reading');
  await source.getByRole('button',{name:'Record',exact:true}).click();
  await source.getByRole('button',{name:'Mark run complete'}).click();
  await waitSaved(source);
  await sessionButton(source).click();
  const library=source.getByRole('dialog',{name:'Tracker sessions'});
  await library.waitFor();
  verify(await sessionRows(source).count()===2,'source browser contains two tracker sessions');
  await library.getByRole('button',{name:'Completed',exact:true}).click();
  const subsetEvent=source.waitForEvent('download');
  await library.getByRole('button',{name:'Export shown (1)'}).click();
  const subsetDownload=await subsetEvent;
  const subset=JSON.parse(await readFile(await subsetDownload.path(),'utf8'));
  verify(subset.sessions.length===1 && subset.sessions[0].status==='completed',
    'filtered export creates a smaller independently restorable archive');
  await library.getByRole('button',{name:'All',exact:true}).click();
  const downloadEvent=source.waitForEvent('download');
  await library.getByRole('button',{name:/Export all \(2\)/}).click();
  const downloaded=await downloadEvent;
  const archive=await readFile(await downloaded.path(),'utf8');
  const payload=JSON.parse(archive);
  verify(payload.format==='decarboxulator-tracker-archive'&&payload.sessions.length===2,
    'export all produces a versioned portable archive');
  const recorded = payload.sessions.find(s=>s.title==='Imported QC reference run');
  verify(recorded?.status==='completed' && recorded.readings.length===1 &&
    recorded.readings[0].weightG===32 && recorded.readings[0].temperatureC===78.5 &&
    recorded.readings[0].note==='Stabilized balance reading',
    'archive preserves actual completed measurements, observed temperature and technician notes');
  await sourceContext.close();

  const targetContext=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const target=await targetContext.newPage();
  const targetErrors=[];
  target.on('pageerror',error=>targetErrors.push(error.message));
  await target.goto(base+'/tools/decarb-tracker/',{waitUntil:'networkidle'});
  await waitSaved(target);
  await sessionButton(target).click();
  verify(await sessionRows(target).count()===1,'new browser starts with one independent default run');
  const file=target.locator('input[aria-label="Choose tracker backup JSON"]');
  await file.setInputFiles({name:'tracker-backup.json',mimeType:'application/json',buffer:Buffer.from(archive)});
  await target.getByRole('status').filter({hasText:/2 runs restored/}).waitFor({timeout:12000});
  await waitSaved(target);
  verify(await sessionRows(target).count()===3,'archive restore merged both runs with the existing local session');
  verify(await target.locator('.tracker-session-row[data-current="true"]').count()===1,
    'import does not change the active local session');
  verify(await libraryNameVisible(target,'Imported QC reference run'),
    'imported metadata and the batch name remain visible');

  await file.setInputFiles({name:'tracker-backup.json',mimeType:'application/json',buffer:Buffer.from(archive)});
  await target.getByRole('status').filter({hasText:/Nothing changed/}).waitFor({timeout:12000});
  verify(await sessionRows(target).count()===3,'reimporting the same archive is idempotent');

  const bad=JSON.stringify({...payload,version:999});
  await file.setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(bad)});
  await target.getByRole('alert').filter({hasText:/supported tracker sessions/}).waitFor({timeout:12000});
  verify(await sessionRows(target).count()===3,'unsupported backup is rejected without modifying the library');

  await target.getByRole('button',{name:'Close sessions'}).click();
  await target.reload({waitUntil:'networkidle'});
  await waitSaved(target);
  await sessionButton(target).click();
  verify(await sessionRows(target).count()===3,'imported runs remain in IndexedDB after a full reload');
  verify(await libraryNameVisible(target,'Imported QC reference run'),'imported title survives reload');
  const restored=target.locator('.tracker-session-row').filter({hasText:'Imported QC reference run'});
  verify(await restored.getByText('COMPLETED',{exact:true}).count()===1 &&
    (await restored.innerText()).includes('1 readings'),
    'completed status and reading count survive import and reload');
  await restored.getByRole('button',{name:'Review'}).click();
  verify(await target.getByRole('tab',{name:'Monitor'}).getAttribute('aria-selected')==='true',
    'reviewing a restored run opens Monitor rather than inheriting the previous tab');
  await target.getByRole('tab',{name:/Log/}).click();
  verify((await target.locator('.tracker-note-cell').innerText())==='Stabilized balance reading' &&
    (await target.locator('.tracker-table-wrap tbody tr').innerText()).includes('78.5'),
    'restored measurement note and observed temperature render correctly in the Log');
  await sessionButton(target).click();
  const runToClone=target.locator('.tracker-session-row').filter({hasText:'Imported QC reference run'});
  await runToClone.getByRole('button',{name:'Copy setup'}).click();
  verify(await target.getByRole('tab',{name:'Setup'}).getAttribute('aria-selected')==='true' &&
    (await target.locator('.tracker-run-identity').innerText()).includes('0 readings'),
    'copying a run opens Setup with an empty measurement log');
  verify(errors.length===0&&targetErrors.length===0,'no uncaught errors in export/import browsers',{errors,targetErrors});
  await targetContext.close();
} finally {
  await browser.close();
  await snapshot?.close();
}
console.log('Tracker recovery UI QA passed: '+checks+' checks.');
async function libraryNameVisible(page,title) {
  return (await page.locator('.tracker-session-row-title').allTextContents()).some(text=>text.includes(title));
}
