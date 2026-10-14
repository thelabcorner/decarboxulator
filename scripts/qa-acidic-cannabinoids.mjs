import { chromium, webkit } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';

const snapshot = process.env.SMOKE_URL ? null
  : await startQASnapshot({snapshotName:'qa-acidic-'+process.pid});
const base = process.env.SMOKE_URL || snapshot.base;
const cases = [
  '/tools/thca-to-thc/',
  '/tools/thc-to-thca/',
  '/tools/batch-yield/',
  '/tools/thca-percentage/',
];
let assertions=0;
function assert(ok,message,extra='') {
  if (!ok) throw new Error(message + (extra?' | '+String(extra):''));
  assertions++;
}
try {
  for (const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]) {
    const browser=await engine.launch(name==='Chromium'?{channel:'chrome',headless:true}:{headless:true});
    try {
      for (const viewport of [{width:320,height:700},{width:1280,height:850}]) {
        const context=await browser.newContext({viewport,colorScheme:'dark'});
        const page=await context.newPage();
        const errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        for (const route of cases) {
          const key=`${name} ${viewport.width} ${route}`;
          await page.goto(base+route,{waitUntil:'networkidle'});
          const select=page.locator('.studio-cannabinoid-select').first();
          await select.waitFor();
          await page.waitForTimeout(120); // hydration
          const trigger=select.getByRole('button',{name:'Acidic cannabinoid'});
          assert((await trigger.textContent())?.includes('THCa'),key+' default THCa');
          const oldLabel=await page.locator('.calculator-app-kpi-caption').innerText();
          await trigger.click();
          const choices=page.getByRole('menuitemradio');
          assert(await choices.count()===5,key+' five choices');
          assert(await page.getByRole('menuitemradio',{name:/THCa/}).getAttribute('aria-checked')==='true',
            key+' active checked state');
          // V4 context-menu contract: Escape restores focus and does not mutate state.
          await page.keyboard.press('Escape');
          assert(await trigger.evaluate(node=>node===document.activeElement),key+' restores keyboard focus');
          await trigger.click();
          await page.getByRole('menuitemradio',{name:/CBGa/}).click();
          assert((await trigger.textContent())?.includes('CBGa'),key+' selector updates');
          assert((await page.locator('.calculator-app-kpi-caption').innerText())!==oldLabel,
            key+' live output label reflects compound');
          assert((await page.locator('.calculator-app-copy strong').innerText()).includes('CBG') ||
                 route.includes('batch'),key+' workbench title reflects pair');
          const geometry=await page.evaluate(()=>({
            full:document.documentElement.scrollWidth,width:window.innerWidth,
            control:document.querySelector('.studio-cannabinoid-select')?.getBoundingClientRect().toJSON(),
          }));
          assert(geometry.full<=geometry.width+1,key+' no horizontal overflow',JSON.stringify(geometry));
          // Wait for React's persistence effect, then reload and wait for client hydration.
          const workspaceId = route.includes('batch-yield')?'batch'
            : route.includes('thca-percentage')?'analysis':'conversion';
          await page.waitForFunction(id=>{
            try{return JSON.parse(localStorage.getItem('decarboxulator-v4:workspace:'+id)||'{}').cannabinoid==='CBGa';}
            catch{return false;}
          },workspaceId,{timeout:8000});
          await page.reload({waitUntil:'networkidle'});
          await page.waitForFunction(()=>document.querySelector('.studio-cannabinoid-select button')
            ?.textContent?.includes('CBGa'),undefined,{timeout:10000});
          assert((await page.locator('.studio-cannabinoid-select button').first().textContent())?.includes('CBGa'),
            key+' persisted selection');
          const reset=page.getByRole('button',{name:/Reset/i}).first();
          if (await reset.count()) {
            await reset.click();
            assert((await page.locator('.studio-cannabinoid-select button').first().textContent())?.includes('THCa'),
              key+' reset restores THCa');
          }
        }
        assert(errors.length===0,`${name} ${viewport.width} no page errors`,errors.join(';'));
        await context.close();
      }
    } finally {await browser.close();}
  }
} finally {
  await snapshot?.close();
}
console.log(`Multi-acid V4 premium UI QA passed: ${assertions} checks.`);
