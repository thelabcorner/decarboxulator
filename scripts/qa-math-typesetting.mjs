import { chromium, webkit } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';

const snapshot = await startQASnapshot({snapshotName:'qa-math-'+process.pid});
const routes=[
  '/tools/thca-to-thc/','/tools/thc-to-thca/','/tools/batch-yield/',
  '/tools/thca-percentage/','/tools/edible-dosage/','/tools/max-pressure/',
  '/tools/decarb-tracker/','/tools/pressure-tracker/','/tools/scale-resolution/',
  '/tools/gauge-resolution/','/tools/cartridge-formulation/',
  '/learn/decarboxylation-math/',
];
const failures=[];
let checks=0;
try {
 for(const [browserName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
  const browser=await engine.launch(browserName==='Chromium'?{channel:'chrome'}:{});
  try {
   for(const [width,colorScheme] of [[320,'dark'],[390,'light'],[1440,'dark']]){
    const page=await browser.newPage({viewport:{width,height:875},colorScheme,serviceWorkers:'block'});
    page.on('pageerror',e=>failures.push(browserName+' '+width+' JS '+e.message));
    for(const path of routes){
     const label=browserName+' '+width+' '+path;
     const response=await page.goto(snapshot.base+path,{waitUntil:'networkidle',timeout:50000});
     if(response?.status()!==200){failures.push(label+' HTTP '+response?.status());continue}
     const reference=page.locator('details#tool-reference');
     if(await reference.count())await reference.evaluate(el=>{el.open=true});
     const formulas=page.locator('details.formula-disclosure');
     for(const f of await formulas.all())await f.evaluate(el=>{el.open=true});
     const count=await page.locator('.studio-math-viewport').count();
     if(count===0){failures.push(label+' missing rendered KaTeX');continue}
     checks++;
     const data=await page.evaluate(()=>{
       const elements=[...document.querySelectorAll('.studio-math-viewport')];
       return {
         width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
         rendered:elements.length,
         mathml:document.querySelectorAll('.studio-math-viewport math').length,
         semantic:document.querySelectorAll('.studio-math-viewport .katex-mathml').length,
         mathCss:elements[0]?getComputedStyle(elements[0].querySelector('.katex')??elements[0]).fontFamily:'',
         wrongBounds:elements.map(e=>({rect:e.getBoundingClientRect(),x:e.scrollWidth,c:e.clientWidth}))
           .filter(({rect})=>rect.left<-2||rect.right>innerWidth+2).length,
       };
     });
     if(data.scrollWidth>width+1)failures.push(label+' page horizontal overflow '+JSON.stringify(data));
     if(data.mathml!==data.rendered||data.semantic!==data.rendered)failures.push(label+' MathML missing '+JSON.stringify(data));
     if(data.wrongBounds)failures.push(label+' clipped equation viewport '+JSON.stringify(data));
     checks+=4;
     if(browserName==='WebKit'&&width===390&&
       ['/tools/thca-to-thc/','/tools/pressure-tracker/','/tools/max-pressure/','/learn/decarboxylation-math/'].includes(path))
       await page.screenshot({path:'artifacts/qa-math-'+path.replaceAll('/','-').replace(/^-|-$/g,'')+'.png',fullPage:false});
    }
    await page.close();
   }
  }finally{await browser.close()}
 }
 console.log(JSON.stringify({checks,failures},null,2));
 if(failures.length)process.exitCode=1;
}finally{await snapshot.close()}
