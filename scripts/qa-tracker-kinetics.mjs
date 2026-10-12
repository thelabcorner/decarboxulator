import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const base=process.env.SMOKE_URL||'http://127.0.0.1:43291';
const browser=await chromium.launch({channel:'chrome',headless:true});
mkdirSync('artifacts',{recursive:true});
const mass=[23.82,23.61,23.39,23.16,22.65,22.2,22.015,21.83,21.74,21.64,21.625,21.56,21.555];
const mins=[0,1.4646,6.5666,11.44,15.885,20.11,22.91,26.045,29.496,32.816,35.307,37.245,39.385];
let checks=0;
const verify=(ok,label,details)=>{if(!ok)throw new Error(label+' '+JSON.stringify(details));console.log('PASS '+label);checks++};
try{
  for(const width of [320,375,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:width<760?800:900},deviceScaleFactor:1});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/tools/decarb-tracker/',{waitUntil:'networkidle'});
    await page.locator('.tracker-save-label[data-state="saved"]').waitFor({timeout:10000});
    const first=Date.UTC(2025,10,1,23,55,11,285);
    await page.evaluate(async({mass,mins,first})=>{
      const db=await new Promise((resolve,reject)=>{
        const req=indexedDB.open('decarboxulator-v4-tracker',1);
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(['sessions','meta'],'readwrite');
        const store=tx.objectStore('sessions');
        const req=store.getAll();
        req.onsuccess=()=>{
          const s=req.result[0];if(!s){tx.abort();return;}
          s.createdAt=first;s.startedAt=first;s.updatedAt=Date.now();
          s.status='paused';s.completedAt=null;s.title='Historical November 2025 kinetic QA';
          s.fields={...s.fields,tare:'101.06',thca:'18.92',other:'4.9',scaleResolution:'.005'};
          s.readings=mass.map((content,i)=>({timestamp:first+Math.round(mins[i]*60000),
            weightG:101.06+content}));
          store.put(s);tx.objectStore('meta').put({key:'activeId',value:s.id});
        };
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });
      db.close();
    },{mass,mins,first});
    await page.reload({waitUntil:'networkidle'});
    const plot=page.locator('.kinetic-chart-compact');
    await plot.waitFor({state:'visible'});
    verify(await plot.locator('.kinetic-measured-dot').count()===13,width+' raw measurements rendered');
    verify(await plot.locator('.kinetic-fitted-path').count()===1,width+' empirical fit shown');
    const w=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,
      chart:document.querySelector('.kinetic-chart-compact')?.getBoundingClientRect().width}));
    verify(w.scroll<=width+1,width+' no horizontal overflow',w);
    const completionText=await page.locator('.tracker-hero-number').innerText();
    verify(Number.parseFloat(completionText)>97&&Number.parseFloat(completionText)<98,
      width+' historical mass reconciles',completionText);
    verify(await page.locator('.kinetic-monitor-outlook').isVisible(),width+' kinetic glance row shown');
    if(width===390)await page.screenshot({path:'artifacts/tracker-kinetics-monitor-mobile.png',fullPage:true});
    await page.getByRole('tab',{name:'Analysis'}).click();
    verify(await page.locator('.kinetic-fit-stats').isVisible(),width+' detailed statistics shown');
    verify(await page.locator('.tracker-analysis-view .kinetic-chart-svg').isVisible(),width+' full analysis plot');
    await page.locator('.tracker-analysis-view .kinetic-chart-svg').focus();
    await page.keyboard.press('End');
    verify((await page.locator('.tracker-analysis-view .kinetic-chart-footer').innerText()).includes('Reading 13'),
      width+' chart keyboard inspection');
    if(width===390)await page.screenshot({path:'artifacts/tracker-kinetics-analysis-mobile.png',fullPage:true});
    await page.emulateMedia({reducedMotion:'reduce'});
    verify(await page.locator('.tracker-analysis-view .kinetic-fitted-path').evaluate(node=>
      getComputedStyle(node).animationName)==='none',width+' reduced-motion supported');
    verify(errors.length===0,width+' no javascript errors',errors);
    await context.close();
  }
  // Instrument data integrity: a measured mass outside the model's ideal
  // domain must remain auditable and must not become "100% conversion".
  const context=await browser.newContext({viewport:{width:375,height:812},acceptDownloads:true});
  const page=await context.newPage();
  await page.goto(base+'/tools/decarb-tracker/',{waitUntil:'networkidle'});
  await page.locator('.tracker-save-label[data-state="saved"]').waitFor();
  await page.getByRole('button',{name:'Start recording'}).click();
  await page.locator('#tracker-measurement').fill('33.100');
  verify(await page.getByRole('button',{name:'Record',exact:true}).isEnabled(),
    'out-of-model gross mass remains recordable');
  await page.getByRole('button',{name:'Record',exact:true}).click();
  await page.locator('.tracker-save-label[data-state="saved"]').waitFor();
  await page.getByRole('tab',{name:/Log/}).click();
  verify(await page.locator('.readings-table tr[data-flagged="true"]').count()===1,
    'out-of-model raw observation flagged in audit table');
  verify(Number.parseFloat(await page.locator('.readings-table tbody tr td').nth(2).innerText())===33.1,
    'true observed mass retained without invented conversion');
  await page.reload({waitUntil:'networkidle'});
  await page.locator('.tracker-save-label[data-state="saved"]').waitFor();
  await page.getByRole('tab',{name:/Log/}).click();
  verify(await page.locator('.readings-table tr[data-flagged="true"]').count()===1,
    'flagged observation persists through IndexedDB reload');
  await page.getByRole('tab',{name:'Analysis'}).click();
  verify(await page.locator('.tracker-analysis-view .kinetic-flagged-dot').count()===1,
    'out-of-range marker visualized independently of modeled curve');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export CSV'}).click();
  const download=await downloadPromise;
  const {readFileSync}=await import('node:fs');
  const csv=readFileSync(await download.path(),'utf8');
  verify(csv.includes('outside_CO2_model')&&csv.includes('33.1'),
    'CSV export preserves raw flagged measurement with explicit status');
  await context.close();
}finally{await browser.close();}
console.log('Kinetic graph QA passed: '+checks+' checks.');
