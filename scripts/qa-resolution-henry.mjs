import { chromium, webkit } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';
const snapshot=await startQASnapshot({snapshotName:'qa-resolution-henry-'+process.pid});
let checks=0;
function assert(ok,label,details=''){
  if(!ok)throw new Error(label+(details?' '+JSON.stringify(details):''));
  checks++;
}
function number(str){return Number(str.replaceAll(',','').match(/[+-]?(?:\d+\.?\d*|\.\d+)/)?.[0]);}
try{
for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch(engineName==='Chromium'?{channel:'chrome'}:{});
 try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:850},colorScheme:'dark',serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const go=async path=>{await page.goto(snapshot.base+path,{waitUntil:'networkidle'});
    await page.waitForTimeout(80);
    const dims=await page.evaluate(()=>({actual:document.documentElement.scrollWidth,limit:innerWidth}));
    assert(dims.actual<=dims.limit+1,engineName+' '+width+' '+path+' overflow',dims);
    assert(await page.locator('nav[aria-label="Calculator directory"] a').count()===10,
      engineName+' '+width+' '+path+' other calculator links');
  };
  await go('/tools/scale-resolution/');
  assert((await page.locator('h1').first().innerText()).includes('Scale resolution'),'scale route');
  assert(await page.locator('#resolution-sample').count()===1,'scale field');
  assert(number(await page.locator('.calculator-app-kpi-value').innerText())>0,'scale number');
  await go('/tools/gauge-resolution/');
  const b=number(await page.locator('.calculator-app-kpi-value').innerText());
  await page.getByRole('button',{name:'Vent',exact:true}).click();
  await page.locator('#resolution-vent-count').fill('2');
  const a=number(await page.locator('.calculator-app-kpi-value').innerText());
  assert(Number.isFinite(a)&&a<b,'vent gauge resolution tighter',{a,b});
  await go('/tools/max-pressure/');
  const pressure=page.locator('.pressure-workbench');
  const initialGauge=number(await pressure.locator('.pressure-kpi-primary strong').innerText());
  const editor=pressure.locator('.studio-dissolution');
  assert(await editor.getByRole('button',{name:'Off (ideal gas)'}).getAttribute('aria-pressed')==='true','dissolution default off');
  await editor.getByRole('button',{name:'On (Henry)'}).click();
  assert(await editor.getByLabel('Liquid phase volume').count()===1,'liquid field');
  await editor.getByLabel('Liquid phase volume').fill('100');
  await editor.getByLabel('Henry solubility coefficient').fill('0.035');
  const correctedGauge=number(await pressure.locator('.pressure-kpi-primary strong').innerText());
  assert(correctedGauge<initialGauge,'Henry decreases predicted gas contribution',{correctedGauge,initialGauge});
  await go('/tools/pressure-tracker/');
  const tracker=page.locator('.pressure-tracker-workbench');
  await tracker.getByLabel('Current pressure',{exact:true}).fill('20');
  const dry=number(await tracker.locator('.pressure-tracker-primary output').innerText());
  const tEditor=tracker.locator('.studio-dissolution');
  await tEditor.getByRole('button',{name:'On (Henry)'}).click();
  assert(await tEditor.getByText(/no gas analyzer required/i).count()===1,'no gas analyzer');
  assert(await tEditor.getByLabel(/CO2 partial pressure/i).count()===0,'partial pressure not requested');
  await tEditor.getByLabel('Liquid phase volume').fill('100');
  await tEditor.getByLabel('Henry solubility coefficient').fill('0.035');
  const wet=number(await tracker.locator('.pressure-tracker-primary output').innerText());
  assert(wet>dry,'seal Henry increases inferred progression',{wet,dry});
  await tracker.getByRole('button',{name:'Vent',exact:true}).click();
  await tracker.getByLabel('Identical vent cycles counted').fill('1');
  const ventProgress=number(await tracker.locator('.pressure-tracker-primary output').innerText());
  assert(Number.isFinite(ventProgress)&&ventProgress>wet,
    'vent Henry recovers released CO2 and accounts for remaining air',{ventProgress,wet});
  const target=await tracker.locator('.pressure-tracker-kpis strong').first().innerText();
  assert(!target.includes('-'),'target inferred without a CO2 analyzer',target);
  assert(!errors.length,'no page JavaScript errors',errors);
  await page.close();
 }
 }finally{await browser.close();}
}
console.log('Resolution, Henry and calculator directory browser QA: '+checks+' checks passed.');
}finally{await snapshot.close();}
