import { chromium, webkit } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { startQASnapshot } from './qa-snapshot-server.mjs';
const snapshot=await startQASnapshot({snapshotName:'qa-unified-library-'+process.pid});
let checks=0;
function ok(value,label,details=''){
  if(!value)throw Error(label+(details?' '+JSON.stringify(details):''));
  checks++;
}
for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
  const browser=await engine.launch(engineName==='Chromium'?{channel:'chrome'}:{});
  try{
    for(const width of [390,1440]){
      const context=await browser.newContext({viewport:{width,height:820},
        acceptDownloads:true,serviceWorkers:'block'});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      try{
        await page.addInitScript(()=>{
          const key='decarboxulator-v4:saved-calculations';
          if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({
            format:'decarboxulator-calculations',version:2,entries:[{
              id:'legacy-calc',tool:'Batch yield',result:'1.2 g',
              url:'/tools/batch-yield?sample=30',
              savedAt:Date.now()-5000,updatedAt:Date.now()-5000,
              name:'Migrated calculation',note:'Original saved value',
              tags:['legacy'],favorite:true,
            }],
          }));
        });
        await page.goto(snapshot.base+'/tools/batch-yield/',{waitUntil:'networkidle'});
        await page.getByRole('button',{name:'Saved library'}).first().click();
        const drawer=page.getByRole('dialog',{name:'Saved library'});
        await drawer.getByText('Migrated calculation').waitFor({timeout:15000});
        ok((await drawer.innerText()).includes('25,565'),'shared count displayed',{engineName,width});
        ok((await drawer.getByRole('button',{name:'All records'}).getAttribute('aria-pressed'))==='true',
          'shared scope default',{engineName,width});
        await drawer.getByRole('button',{name:'Close saved library'}).click();
        await page.goto(snapshot.base+'/tools/decarb-tracker/',{waitUntil:'networkidle'});
        await page.locator('.tracker-save-label[data-state="saved"]').waitFor({timeout:15000});
        await page.getByRole('button',{name:/Library \(2\)/}).click();
        const unified=page.getByRole('dialog',{name:'Saved library'});
        await unified.getByRole('button',{name:'Tracker runs'}).click();
        const runRows=unified.getByRole('button',{name:/Inspect tracker run/});
        await runRows.first().waitFor({timeout:13000}).catch(()=>{});
        ok(await runRows.count()===1,
          'tracker visible in unified drawer',{engineName,width,content:(await unified.innerText()).slice(0,800)});
        await unified.getByRole('button',{name:/Inspect tracker run/}).click();
        const link=unified.getByRole('link',{name:/Open in tracker/});
        const href=await link.getAttribute('href');
        ok(href?.includes('session='),'tracker link selects exact record',{engineName,width,href});
        await unified.getByRole('button',{name:'Library',exact:true}).click();
        await unified.getByRole('button',{name:'All records'}).click();
        ok(await unified.getByText('Migrated calculation').count()>=1,
          'calculation and run coexist',{engineName,width});
        const downloadPromise=page.waitForEvent('download');
        await unified.getByRole('button',{name:'Export all'}).click();
        const download=await downloadPromise;
        const backup=JSON.parse(readFileSync(await download.path(),'utf8'));
        ok(backup.format==='decarboxulator-unified-library','unified backup format',{engineName,width});
        ok(backup.sessions.length===1&&backup.calculations.length===1,
          'unified backup includes both record types',{engineName,width,run:backup.sessions.length,calc:backup.calculations.length});
        await unified.getByRole('button',{name:'Close saved library'}).click();
        await page.reload({waitUntil:'networkidle'});
        await page.getByRole('button',{name:/Library \(2\)/}).click();
        await page.getByRole('dialog',{name:'Saved library'}).getByText('Migrated calculation').waitFor({timeout:15000});
        ok(true,'record persists after reload',{engineName,width});
        const dimensions=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
        ok(dimensions.width<=dimensions.viewport+1,'no horizontal overflow',{engineName,width,dimensions});
        ok(!errors.length,'no runtime errors',{engineName,width,errors});
      }finally{await context.close();}
    }
  }finally{await browser.close();}
}
await snapshot.close();
console.log('Unified library E2E: '+checks+' checks passed across Chromium/WebKit and desktop/mobile.');
