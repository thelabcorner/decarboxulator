import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const base=process.env.SMOKE_URL??'http://127.0.0.1:42061';
const browser=await chromium.launch({headless:true,channel:'chrome'});
mkdirSync('artifacts',{recursive:true});
let fails=0;
const near=(a,b,tolerance=.06)=>Math.abs(a-b)<=tolerance;
for(const width of [320,375,430,768,1024,1440]){
  for(const theme of ['light','dark']){
    const page=await browser.newPage({viewport:{width,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.goto(base+'/tools/max-pressure',{waitUntil:'networkidle',timeout:25000});
      await page.evaluate(theme=>{
        localStorage.setItem('decarboxulator-theme',theme);
      },theme);
      await page.reload({waitUntil:'networkidle'});
      const cells=page.locator('.pressure-map-cell');
      const actual=Number.parseFloat(await page.locator('.pressure-kpi-primary strong').innerText());
      const center=Number.parseFloat(await cells.filter({has:page.locator('.pressure-cell-crosshair')}).innerText());
      const visible=await cells.evaluateAll(els=>els.filter(el=>getComputedStyle(el).display!=='none').length);
      const overflow=await page.evaluate(()=>{
        const p=document.querySelector('.pressure-workbench').getBoundingClientRect();
        const c=document.querySelector('.content-main').getBoundingClientRect();
        const grid=document.querySelector('.pressure-map-grid').getBoundingClientRect();
        return {workbenchWidth:p.width,containerWidth:c.width,gridWidth:grid.width,
          documentScrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,
          mapOverflow:grid.right>c.right+1,workbenchOverflow:p.right>c.right+1};
      });
      const expected=width<=680?25:49;
      if(!near(actual,center)||visible!==expected||errors.length||overflow.mapOverflow||overflow.workbenchOverflow)
        throw Error(JSON.stringify({actual,center,visible,expected,errors,overflow}));
      if([320,430,1440].includes(width)&&theme==='dark')
        await page.screenshot({path:`artifacts/pressure-v4-${width}-dark.png`});
      if(width===1440&&theme==='light')
        await page.screenshot({path:'artifacts/pressure-v4-1440-light.png'});
      if(width<=680){
        const edit=page.getByRole('button',{name:'Edit pressure model inputs'});
        if(!(await edit.isVisible()))throw Error('Mobile input shortcut missing');
        await edit.click();
        await page.waitForFunction(()=>{
          const target=document.getElementById('pressure-parameters');
          const scroller=document.querySelector('.content-main');
          return target&&scroller&&target.getBoundingClientRect().top<
            scroller.getBoundingClientRect().bottom-60;
        });
        if(width===320&&theme==='dark')
          await page.screenshot({path:'artifacts/pressure-v4-320-inputs-dark.png'});
        const map=page.getByRole('button',{name:'View map'});
        if(!(await map.isVisible()))throw Error('Mobile return-to-map shortcut missing');
        await map.click();
      }
      await page.locator('.pressure-map-cell[data-current="true"]').focus();
      await page.keyboard.press('ArrowRight');
      const selected=page.locator('.pressure-map-cell[data-selected="true"]');
      if(await selected.getAttribute('data-current')==='true')throw Error('arrow key did not select scenario');
      await page.getByRole('button',{name:'Use this scenario'}).click();
      if(await page.locator('.pressure-map-cell[data-selected="true"]').getAttribute('data-current')!=='true')
        throw Error('Applying a scenario must recenter the inspector');
      const newTemp=Number(await page.locator('#pressure-temp').inputValue());
      const changed=Number.parseFloat(await page.locator('.pressure-kpi-primary strong').innerText());
      if(!(newTemp>240)||!(changed>actual))throw Error('apply scenario did not update live model');
      await page.getByRole('button',{name:'°C'}).click();
      const tC=Number(await page.locator('#pressure-temp').inputValue());
      if(!near(tC,(newTemp-32)*5/9,.01))throw Error('temperature unit conversion corrupted scenario');
      const afterC=Number.parseFloat(await page.locator('.pressure-kpi-primary strong').innerText());
      if(!near(afterC,changed,.2))throw Error('changing temperature units changed pressure');
      const summary=`${width} ${theme} PASS ${visible} visible cells; center ${center} PSI; keys, apply, and unit conversion`;
      console.log(summary);
    }catch(e){fails++;console.error(`FAIL ${width} ${theme}: ${e.message}`);}
    finally{await page.close();}
  }
}
await browser.close();
if(fails)process.exit(1);
