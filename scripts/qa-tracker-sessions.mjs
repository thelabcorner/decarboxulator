import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const base = process.env.SMOKE_URL || 'http://127.0.0.1:42061';
let browser;
for (const channel of ['chrome','msedge']) {
  try { browser=await chromium.launch({headless:true,channel});break; }
  catch { /* Try the next locally installed browser. */ }
}
if (!browser) throw new Error('QA requires installed Chrome or Edge');
mkdirSync('artifacts',{recursive:true});
const context=await browser.newContext({viewport:{width:375,height:812},acceptDownloads:true});
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));

async function assertSaved(p) {
  await p.locator('.tracker-save-label[data-state="saved"]').waitFor({timeout:15000});
}
async function getRecords(p) {
  return p.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{
      const r=indexedDB.open('decarboxulator-v4-tracker');
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['sessions','meta'],'readonly');
      const records=tx.objectStore('sessions').getAll();
      const active=tx.objectStore('meta').get('activeId');
      tx.oncomplete=()=>{db.close();resolve({sessions:records.result,activeId:active.result?.value});};
      tx.onerror=()=>reject(tx.error);
    });
  });
}
try {
  const response=await page.goto(base+'/tools/decarb-tracker',{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  await assertSaved(page);
  assert.equal((await getRecords(page)).sessions.length,1);
  assert.match(await page.locator('.tracker-run-copy').innerText(),/draft/i);
  await page.getByRole('tab',{name:'Setup'}).click();
  await page.locator('.tracker-text-field input').first().fill('Batch Alpha · pilot');
  await page.locator('.tracker-text-field textarea').fill('Tare stable; analytical reference needed.');
  await assertSaved(page);
  await page.getByRole('button',{name:'Start recording'}).click();
  await page.locator('#tracker-measurement').fill('40');
  assert.equal(await page.getByRole('button',{name:'Record',exact:true}).isDisabled(),true,
    'impossible loss / excess mass must not be recorded');
  await page.locator('#tracker-measurement').fill('32');
  await page.locator('#tracker-observed-temp').fill('115.5');
  await page.locator('.tracker-reading-context .tracker-text-field input').fill('Stirred and stabilized');
  await page.getByRole('button',{name:'Record',exact:true}).click();
  await assertSaved(page);
  let records=await getRecords(page);
  assert.equal(records.sessions[0].readings.length,1);
  assert.equal(records.sessions[0].readings[0].weightG,32);
  assert.equal(records.sessions[0].readings[0].temperatureC,115.5);
  assert.equal(records.sessions[0].readings[0].note,'Stirred and stabilized');
  const alphaId=records.activeId;
  await page.reload({waitUntil:'networkidle'});
  await assertSaved(page);
  assert.match(await page.locator('.tracker-run-copy').innerText(),/Batch Alpha/);
  await page.getByRole('tab',{name:/Log/}).click();
  assert.match(await page.locator('.readings-table').innerText(),/32/);
  await page.getByRole('tab',{name:'Monitor'}).click();
  await page.getByRole('button',{name:'Mark run complete'}).click();
  await assertSaved(page);
  records=await getRecords(page);
  assert.equal(records.sessions[0].status,'completed');
  assert.ok(records.sessions[0].completedAt);
  assert.equal(await page.getByRole('button',{name:'Reopen run'}).isVisible(),true);
  await page.getByRole('button',{name:'New run'}).click();
  await assertSaved(page);
  records=await getRecords(page);
  assert.equal(records.sessions.length,2);
  assert.notEqual(records.activeId,alphaId);
  await page.getByRole('button',{name:/Sessions \(2\)/}).click();
  assert.equal(await page.locator('.tracker-session-row').count(),2);
  const oldRow=page.locator('.tracker-session-row').filter({hasText:'Batch Alpha'});
  const downloadPromise=page.waitForEvent('download');
  await oldRow.getByRole('button',{name:'JSON'}).click();
  const download=await downloadPromise;
  const backup=JSON.parse(readFileSync(await download.path(),'utf8'));
  assert.equal(backup.session.id,alphaId);
  assert.equal(backup.session.readings[0].weightG,32);
  assert.equal(backup.session.readings[0].note,'Stirred and stabilized');
  await oldRow.getByRole('button',{name:'Reopen'}).click();
  await oldRow.getByRole('button',{name:'Review'}).click();
  await assertSaved(page);
  assert.match(await page.locator('.tracker-run-copy').innerText(),/paused/i);
  await page.getByRole('button',{name:'Resume recording'}).click();
  await page.locator('#tracker-measurement').fill('31.5');
  await page.getByRole('button',{name:'Record',exact:true}).click();
  await assertSaved(page);
  records=await getRecords(page);
  assert.equal(records.sessions.find(s=>s.id===alphaId).readings.length,2);
  await page.screenshot({path:'artifacts/tracker-mobile-sessions.png'});

  // Verify one-time recovery of the legacy localStorage workspace on a virgin origin.
  const migratedContext=await browser.newContext({viewport:{width:1440,height:900}});
  const migrated=await migratedContext.newPage();
  await migrated.goto(base+'/',{waitUntil:'domcontentloaded'});
  const ts=Date.now()-60000;
  await migrated.evaluate(({ts})=>localStorage.setItem('decarboxulator-v4:workspace:tracker',
    JSON.stringify({tare:'3',thca:'10',other:'0',trackerMode:'manual',tracking:'no',
      startedAt:String(ts),readings:JSON.stringify([{weightG:12.7,timestamp:ts+30000}])})),{ts});
  await migrated.goto(base+'/tools/decarb-tracker',{waitUntil:'networkidle'});
  await assertSaved(migrated);
  const imported=await getRecords(migrated);
  assert.equal(imported.sessions.length,1);
  assert.equal(imported.sessions[0].title,'Recovered v4 tracker run');
  assert.equal(imported.sessions[0].fields.tare,'3');
  assert.equal(imported.sessions[0].readings.length,1);
  await migrated.reload({waitUntil:'networkidle'});
  assert.equal((await getRecords(migrated)).sessions.length,1,'migration must not duplicate on reload');
  await migrated.screenshot({path:'artifacts/tracker-desktop-sessions.png'});
  await migratedContext.close();

  // Damaged/unsupported IndexedDB rows must never be silently discarded,
  // migrated away, or overwritten by a newly initialized draft.
  const damagedContext=await browser.newContext();
  const damaged=await damagedContext.newPage();
  await damaged.goto(base+'/',{waitUntil:'domcontentloaded'});
  await damaged.evaluate(()=>new Promise((resolve,reject)=>{
    const req=indexedDB.open('decarboxulator-v4-tracker',1);
    req.onupgradeneeded=()=>{
      req.result.createObjectStore('sessions',{keyPath:'id'});
      req.result.createObjectStore('meta',{keyPath:'key'});
    };
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>{
      const db=req.result;
      const tx=db.transaction(['sessions'],'readwrite');
      tx.objectStore('sessions').put({id:'unsupported-record',schemaVersion:999});
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>reject(tx.error);
    };
  }));
  await damaged.goto(base+'/tools/decarb-tracker',{waitUntil:'networkidle'});
  await damaged.locator('.tracker-save-label[data-state="error"]').waitFor();
  assert.match(await damaged.locator('.tracker-warning-compact').innerText(),/preserved|unsupported|damaged/i);
  const damagedData=await getRecords(damaged);
  assert.equal(damagedData.sessions.length,1);
  assert.equal(damagedData.sessions[0].id,'unsupported-record');
  await damagedContext.close();
  assert.deepEqual(pageErrors,[]);
  console.log('PASS: IndexedDB create/edit/autosave/reload, invalid mass, complete/reopen, JSON backup,');
  console.log('      multi-session switching, measurement retention, legacy migration, mobile/desktop rendering.');
} finally {
  await context.close();await browser.close();
}