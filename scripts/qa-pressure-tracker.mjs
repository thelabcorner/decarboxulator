import { chromium, webkit } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';

const snapshot=process.env.SMOKE_URL?null:await startQASnapshot({snapshotName:'qa-pressure-tracker-'+process.pid});
const base=process.env.SMOKE_URL||snapshot.base;
let checks=0;
const check=(condition,message,detail)=>{if(!condition)throw Error(message+': '+JSON.stringify(detail));checks++;};
try{
  for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
    const browser=await engine.launch(name==='Chromium'?{channel:'chrome',headless:true}:{headless:true});
    try{
      for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
        const context=await browser.newContext({viewport,colorScheme:'dark'});
        const page=await context.newPage(),errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        const tag=name+'/'+viewport.width;
        try{
          const response=await page.goto(base+'/tools/pressure-tracker/',{waitUntil:'networkidle',timeout:30000});
          check(response?.status()===200,tag+' route loads');
          const panel=page.locator('.pressure-tracker-workbench');
          await panel.waitFor();
          await page.waitForTimeout(200);
          const initial=await panel.locator('.pressure-tracker-primary output').innerText();
          check(/0\.0|^0%?$/.test(initial.trim().replace(/\s/g,'')),tag+' zero baseline',initial);
          const basis=panel.getByRole('group',{name:'Pressure reading reference'});
          await basis.getByRole('button',{name:'Gauge / vacuum'}).click();
          check(Math.abs(Number(await panel.getByLabel('Initial pressure').inputValue()))<1e-4,
            tag+' absolute to gauge basis preserves gas amount');
          await panel.getByLabel('Initial pressure').fill('-12');
          await panel.getByLabel('Current pressure').fill('-10');
          const apparent=await panel.locator('.pressure-tracker-primary output').innerText();
          check(Number.parseFloat(apparent)>0,tag+' vacuum rise estimates positive CO2 equivalent',apparent);
          await panel.getByRole('button',{name:'Record pressure snapshot'}).click();
          check((await panel.locator('.pressure-tracker-history [role="listitem"]').count())===1,
            tag+' records pressure snapshot');
          check((await panel.locator('.pressure-tracker-chart-wrap circle').count())===1,
            tag+' adds series point');
          check(await panel.getByLabel('Initial pressure').isDisabled(),tag+' locks initial calibration');
          await page.reload({waitUntil:'networkidle'});
          await page.waitForTimeout(200);
          check((await panel.locator('.pressure-tracker-history [role="listitem"]').count())===1,
            tag+' restores local history across reload');
          page.once('dialog',dialog=>dialog.accept());
          await panel.getByRole('button',{name:'Clear snapshots'}).click();
          check(await panel.getByLabel('Initial pressure').isEnabled(),tag+' unlocks baseline after clearing');
          await panel.getByRole('group',{name:'Method'}).getByRole('button',{name:'Vent · measured releases'}).click();
          await panel.getByRole('group',{name:'Vent accounting'}).getByRole('button',{name:'Measured event log'}).click();
          await panel.getByLabel('Immediately before vent').fill('2');
          await panel.getByLabel('Immediately after vent').fill('0');
          await panel.getByRole('button',{name:'Add measured vent'}).click();
          check((await panel.locator('.pressure-tracker-events>div').count())===1,
            tag+' appends measured vent event');
          const extent=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
          check(extent.scroll<=extent.width+1,tag+' no horizontal scroll',extent);
          check(errors.length===0,tag+' no hydration/runtime errors',errors);
          // Separate starting vacuum input added to existing pressure heatmap.
          await page.goto(base+'/tools/max-pressure/',{waitUntil:'networkidle',timeout:30000});
          await page.waitForTimeout(200);
          const details=page.locator('.pressure-assumptions');
          await details.locator('summary').click();
          const reference=details.getByRole('group',{name:'Initial pressure reference'});
          await reference.getByRole('button',{name:'Gauge / vacuum'}).click();
          await page.locator('#pressure-start-pressure').fill('-10');
          check((await page.locator('#pressure-start-pressure').inputValue())==='-10',
            tag+' heatmap accepts vacuum baseline');
          check(await page.locator('.pressure-map-grid').count()===1,tag+' heatmap remains rendered');
          check(errors.length===0,tag+' heatmap no runtime errors',errors);
        }finally{await context.close();}
      }
    }finally{await browser.close();}
  }
}finally{await snapshot?.close();}
console.log('Pressure tracker and vacuum heatmap QA passed: '+checks+' checks.');
