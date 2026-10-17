import { chromium, webkit } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';

const snapshot=await startQASnapshot({snapshotName:'qa-resolution-slider-'+process.pid});
let checks=0;
function assert(ok,label,meta){ if(!ok)throw Error(label+' '+JSON.stringify(meta??{}));checks++; }
try {
  for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]) {
    const browser=await engine.launch(engineName==='Chromium'?{channel:'chrome'}:{});
    try{
      for(const width of [320,390,768,1440]){
        const page=await browser.newPage({viewport:{width,height:850},serviceWorkers:'block'});
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        for(const [path,unit] of [['/tools/scale-resolution/','g'],['/tools/gauge-resolution/','PSI']]){
          await page.goto(snapshot.base+path,{waitUntil:'networkidle'});
          await page.waitForTimeout(320);
          assert(await page.locator('.resolution-slider-track').count()>=4,'slider-first controls',{engineName,width,path});
          assert(await page.locator('#resolution-sample').count()===1,'editable sample mass',{engineName,width,path});
          const summary=page.locator('.instrument-live-status');
          assert(await summary.count()===1,'visible threshold status',{engineName,width,path});
          const initialMargin=await summary.locator('.instrument-live-line strong').innerText();
          await page.locator('#resolution-sample').fill('0.001');
          await page.waitForTimeout(150);
          const statusAfterFill=await summary.getAttribute('data-status');
          assert(statusAfterFill==='below','below range',{engineName,width,path,statusAfterFill,sample:await page.locator('#resolution-sample').inputValue(),visible:await summary.innerText()});
          await summary.getByRole('button',{name:'Try this mass'}).last().click();
          const observed=Number(await page.locator('#resolution-sample').inputValue());
          assert(observed>0.001,'threshold shortcut changes mass',{engineName,width,path,observed});
          assert(await summary.getAttribute('data-status')==='clear','clear range after threshold shortcut',{engineName,width,path});
          const selectedIncrement=await page.locator('#resolution-readability').inputValue();
          const range=page.locator('#resolution-readability-slider');
          await range.focus();
          await page.keyboard.press('ArrowRight');
          const newIncrement=await page.locator('#resolution-readability').inputValue();
          assert(newIncrement!==selectedIncrement,'keyboard slider live update',{engineName,width,path,selectedIncrement,newIncrement});
          const sizes=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:window.innerWidth}));
          assert(sizes.page<=sizes.viewport+1,'no horizontal overflow',{engineName,width,path,sizes});
          assert(!errors.length,'browser errors absent',{engineName,width,path,errors,initialMargin,unit});
        }
        await page.close();
      }
    }finally{await browser.close();}
  }
  console.log('Readability sliders: '+checks+' responsive and interactive browser checks passed.');
}finally{await snapshot.close();}
