import { chromium, webkit } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';

const snapshot=await startQASnapshot({snapshotName:'qa-headspace-'+process.pid});
const failures=[],viewports=[320,390,768,1440];
let checks=0;
function check(value,message,context=''){
  if(!value)throw new Error(message+(context?' '+JSON.stringify(context):''));
  checks++;
}
async function waitForHydrate(page){await page.waitForTimeout(180);}
async function geometry(page,label){
  const box=await page.evaluate(()=>{
    const stage=document.querySelector('.workspace-stage')?.getBoundingClientRect();
    const main=document.querySelector('.content-main')?.getBoundingClientRect();
    const doc=document.documentElement;
    const clipped=[...document.querySelectorAll('.pressure-tracker-workbench, .pressure-workbench, .headspace-editor')]
      .map(e=>{const r=e.getBoundingClientRect();return [r.left,r.right];});
    return {left:stage?.left,right:stage?.right,mainRight:main?.right,windowWidth:innerWidth,
      scrollWidth:doc.scrollWidth,clipped};
  });
  check(box.scrollWidth<=box.windowWidth+1,label+' document overflow',box);
  check(box.clipped.every(([l,r])=>l>=box.left-1 && r<=box.right+1),label+' clipped workspace',box);
}
try{
  for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
    const browser=await engine.launch(name==='Chromium'?{channel:'chrome'}:{});
    try{
      for(const width of viewports){
        const page=await browser.newPage({viewport:{width,height:844},colorScheme:'dark',serviceWorkers:'block'});
        page.on('pageerror',e=>failures.push(name+' '+width+' '+e.message));
        const label=name+' '+width;
        await page.goto(snapshot.base+'/tools/thca-to-thc/',{waitUntil:'networkidle'});
        await waitForHydrate(page);
        check((await page.locator('.tool-heading h1').innerText())==='THCa → THC',label+' forward route name');
        check(await page.getByRole('button',{name:/THC → THCa.*Starting mass needed/}).count()===1,
          label+' inverse tab identity and objective');
        await page.goto(snapshot.base+'/tools/thc-to-thca/',{waitUntil:'networkidle'});
        await waitForHydrate(page);
        check((await page.locator('.tool-heading h1').innerText())==='THC → THCa',label+' inverse route name');
        const nav=page.locator('.studio-nav-title');
        check(await nav.filter({hasText:'THC → THCa'}).count()===1,label+' sidebar uses chemical names');

        await page.goto(snapshot.base+'/tools/pressure-tracker/',{waitUntil:'networkidle'});
        await waitForHydrate(page);
        await geometry(page,label+' tracker');
        const tracker=page.locator('.pressure-tracker-workbench');
        const current=tracker.getByLabel('Current pressure',{exact:true});
        await current.fill('24');
        const before=await tracker.locator('.pressure-tracker-primary output').innerText();
        check(before!=='-',label+' tracker valid reading',before);
        const editor=tracker.locator('.headspace-editor');
        await editor.getByRole('button',{name:'Estimate',exact:true}).click();
        check(await editor.getByLabel('Internal vessel capacity').count()===1,label+' exposes vessel capacity');
        await editor.getByRole('button',{name:'mL',exact:true}).click();
        await editor.getByLabel('Internal vessel capacity').fill('250');
        await editor.getByLabel('Material volume displaced').fill('50');
        const estimated=await editor.locator('.headspace-editor-result').innerText();
        check(estimated.includes('200')&&estimated.includes('6.76'),label+' computes gas space from displaced contents',estimated);
        const after=await tracker.locator('.pressure-tracker-primary output').innerText();
        check(after!==before,label+' live estimate propagates into tracker progress',{before,after});
        await editor.getByLabel('Material volume displaced').fill('260');
        check(await editor.locator('.headspace-editor-error').count()===1,label+' invalid displacement error shown');
        check((await tracker.locator('.pressure-tracker-primary output').innerText()).includes('-'),label+' impossible volume refuses result');
        await editor.getByRole('button',{name:'Mass ÷ density'}).click();
        await editor.getByLabel('Material density').fill('1');
        check(await editor.locator('.headspace-editor-result').count()===1,label+' density path recovers');
        await editor.getByRole('button',{name:'Known',exact:true}).click();
        check(await editor.getByLabel('Measured free gas volume').inputValue()==='16',label+' manual value preserved');
        await editor.getByRole('button',{name:'Estimate',exact:true}).click();
        await geometry(page,label+' estimated tracker');
        if(name==='WebKit' && width===390)
          await page.screenshot({path:'artifacts/qa-pressure-tracker-390.png',fullPage:false});

        await page.goto(snapshot.base+'/tools/max-pressure/',{waitUntil:'networkidle'});
        await waitForHydrate(page);
        await geometry(page,label+' pressure heatmap');
        const pressure=page.locator('.pressure-workbench');
        const gauge=await pressure.locator('.pressure-kpi-primary strong').innerText();
        const pressureEditor=pressure.locator('.headspace-editor');
        await pressureEditor.getByRole('button',{name:'Estimate',exact:true}).click();
        await pressureEditor.getByRole('button',{name:'mL',exact:true}).click();
        await pressureEditor.getByLabel('Internal vessel capacity').fill('250');
        await pressureEditor.getByLabel('Material volume displaced').fill('50');
        const newGauge=await pressure.locator('.pressure-kpi-primary strong').innerText();
        check(gauge!==newGauge,label+' pressure field recomputes with estimated gas volume',{gauge,newGauge});
        check(await pressure.locator('.pressure-map-cell').count()>=40,label+' pressure grid still rendered');
        await pressure.locator('.pressure-map-cell:visible:not([data-current="true"])').first().click();
        await pressure.getByRole('button',{name:'Use this scenario'}).click();
        check(await pressureEditor.getByRole('button',{name:'Known',exact:true}).getAttribute('aria-pressed')==='true',
          label+' heatmap scenario switches to explicit headspace');
        await geometry(page,label+' estimated pressure');
        if(name==='WebKit' && width===390)
          await page.screenshot({path:'artifacts/qa-vessel-pressure-390.png',fullPage:false});
        await page.close();
      }
    }finally{await browser.close();}
  }
  check(!failures.length,'no JS errors',failures);
  console.log('Pressure/headspace interactive UI QA: '+checks+' checks passed.');
}finally{await snapshot.close();}
