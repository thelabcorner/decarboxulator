import { chromium, webkit } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';

const snapshot = process.env.SMOKE_URL ? null
  : await startQASnapshot({ snapshotName: 'qa-calculators-' + process.pid });
const base = process.env.SMOKE_URL || snapshot.base;
const fixtures = [
  {route:'/tools/thca-to-thc/',field:'#convert-amount', next:'20'},
  {route:'/tools/thc-to-thca/',field:'#convert-amount', next:'20'},
  {route:'/tools/batch-yield/',field:'#batch-mass',next:'200'},
  {route:'/tools/thca-percentage/',field:'#analyzer-start',next:'52'},
  {route:'/tools/edible-dosage/',field:'#edible-servings',next:'20'},
  {route:'/tools/cartridge-formulation/',field:'#cart-count',next:'20'},
  {route:'/tools/extract-formulation/',field:'#cart-count',next:'20'},
];
const browsers = [['Chromium',chromium],['WebKit',webkit]];
const viewports = [
  {width:320,height:700},{width:390,height:844},
  {width:768,height:1024},{width:1440,height:900},
];
let passed=0;
function check(ok,message,details) {
  if (!ok) throw new Error(message + (details===undefined?'':JSON.stringify(details)));
  passed++;
}
try {
  for (const [name,engine] of browsers) {
    const browser = await engine.launch(name==='Chromium' ? {channel:'chrome',headless:true} : {headless:true});
    try {
      for (const viewport of viewports) {
        const context = await browser.newContext({viewport,colorScheme:'dark'});
        const page = await context.newPage();
        const errors=[];
        page.on('pageerror',err=>errors.push(err.message));
        for (const fixture of fixtures) {
          const label=name+' '+viewport.width+' '+fixture.route;
          const response=await page.goto(base+fixture.route,{waitUntil:'networkidle',timeout:30000});
          check(response?.status()===200,label+' loads');
          const studio=page.locator('.calculator-studio');
          await studio.waitFor();
          // Network-idle can precede React hydration in slow WebKit runs.
          // Never type before the event handlers have had time to attach.
          await page.waitForTimeout(130);
          if (fixture.route.includes('cartridge-formulation')||fixture.route.includes('extract-formulation')) {
            const target=studio.getByRole('button',{name:'Required input'});
            if(await target.getAttribute('aria-pressed')!=='true')await target.click();
            // Both routes intentionally share the saved recipe; normalize just
            // the QA baseline before testing 0% -> nonzero transfer loss.
            if(await page.locator('#cart-transfer-loss').inputValue()!=='0')
              await page.locator('#cart-transfer-loss').fill('0');
          }
          const nav=studio.getByRole('tablist');
          const calculate=nav.getByRole('tab',{name:'Calculator'});
          const breakdown=nav.getByRole('tab',{name:'Breakdown'});
          check(await calculate.getAttribute('aria-selected')==='true',label+' starts on calculator');
          const first=await studio.locator('.calculator-app-kpi-value').innerText();
          const geometry=await page.evaluate(()=>{
            const root=document.documentElement;
            const shell=document.querySelector('.calculator-studio')?.getBoundingClientRect();
            const stage=document.querySelector('.workspace-stage')?.getBoundingClientRect();
            const rail=document.querySelector('.studio-rail')?.getBoundingClientRect();
            return {total:root.scrollWidth,width:innerWidth,shellLeft:shell?.left,
              shellRight:shell?.right,stageLeft:stage?.left,stageRight:stage?.right,
              railRight:rail?.right};
          });
          check(geometry.total<=geometry.width+1
              && geometry.shellLeft>=geometry.stageLeft-1
              && geometry.shellRight<=geometry.stageRight+1
              && geometry.stageLeft>=geometry.railRight-1,
            label+' workspace and sidebar geometry',geometry);
          const beforeInput = await page.locator(fixture.field).inputValue();
          const next = beforeInput === fixture.next ? String(Number(beforeInput) + 1) : fixture.next;
          await page.locator(fixture.field).fill(next);
          try {
            await page.waitForFunction(before => {
              const text = document.querySelector('.calculator-app-kpi-value')?.innerText;
              return typeof text === 'string' && text !== before;
            }, first, {timeout:8000});
          } catch {
            const actual=await studio.locator('.calculator-app-kpi-value').innerText();
            const input=await page.locator(fixture.field).inputValue();
            throw new Error(label+' did not recompute after input edit: '+JSON.stringify({
              first,beforeInput,next,input,actual,errors,
            }));
          }
          const changed=await studio.locator('.calculator-app-kpi-value').innerText();
          check(changed!==first,label+' live summary recomputes after input edit',{first,changed});
          await breakdown.click();
          check(await breakdown.getAttribute('aria-selected')==='true'
            && await studio.locator('.primary-result').count()===1,
            label+' shows full calculation breakdown');
          await calculate.click();
          check(await page.locator(fixture.field).inputValue()===next
            && (await studio.locator('.calculator-app-kpi-value').innerText())===changed,
            label+' tab switching preserves inputs and calculated output');
          const inputFont=await page.locator(fixture.field).evaluate(el=>getComputedStyle(el).fontSize);
          check(viewport.width>760 || parseFloat(inputFont)>=16,label+' no mobile Safari input zoom');
          if (fixture.route==='/tools/cartridge-formulation/'||fixture.route==='/tools/extract-formulation/') {
            const isExtract=fixture.route.includes('/extract-');
            const companion=page.locator('.conversion-companion a');
            check(await companion.count()===1,label+' has a counterpart route link');
            check((await companion.getAttribute('href'))?.includes(isExtract?'cartridge-formulation':'extract-formulation'),
              label+' counterpart route resolves to the correct formulation mode');
            check(await page.locator('h1').innerText()=== (isExtract?'Extract formulation':'Cartridge formulation'),
              label+' mode-specific page heading');
            check(await page.locator('#cart-transfer-loss').inputValue()==='0',label+' transfer-loss field supports zero baseline');
            // Exercise a real multi-component input bill of materials, not merely its math helper.
            await studio.getByRole('button',{name:'Mixed cannabinoids'}).click();
            const weighOut=studio.locator('.calculator-app-overview .cartridge-bom');
            check(await weighOut.count()===1,label+' weigh-out visible on calculator tab');
            const startingLabels=await weighOut.locator('.cartridge-bom-row dt').allInnerTexts();
            for (const ingredient of ['THCA','CBD','Terpenes']) {
              check(startingLabels.some(text=>text.split('\n')[0]===ingredient),
                label+' starting batch includes '+ingredient,startingLabels);
            }
            const before=await weighOut.evaluate(root=>{
              const number=text=>Number((text||'').replace(/[^0-9.-]/g,''));
              const masses=[...root.querySelectorAll('.cartridge-bom-row dd')].map(el=>number(el.textContent));
              return {masses,sum:masses.reduce((a,b)=>a+b,0),
                total:number(root.querySelector('.cartridge-bom-total strong')?.textContent)};
            });
            check(before.masses.length===4&&Math.abs(before.sum-before.total)<0.003,
              label+' batch masses reconcile to the starting total',before);
            const summary=await weighOut.evaluate(root=>{
              const value=stage=>Number(root.querySelector('[data-stage="'+stage+'"] strong')?.textContent.replace(/[^0-9.-]/g,''));
              return {cannabinoids:value('cannabinoids'),beforeTerpenes:value('pre-terpene-start'),
                terpenes:value('terpenes'),gross:value('gross-start')};
            });
            check(Math.abs(summary.cannabinoids-summary.beforeTerpenes)<0.001
              &&Math.abs(summary.beforeTerpenes+summary.terpenes-summary.gross)<0.002,
              label+' pre-terpene charge plus terpene addition equals gross starting weight',summary);
            const liveMetrics=await studio.locator('.calculator-app-stats').innerText();
            check(liveMetrics.includes('Starting without terpenes')
              &&liveMetrics.includes('Terpenes to add'),label+' stage totals visible without switching tabs');
            const fromCalculator=await weighOut.locator('.cartridge-bom-row dd').allTextContents();
            await breakdown.click();
            const detail=studio.locator('.calculator-app-details .cartridge-bom');
            check(await detail.count()===1,label+' weigh-out visible on breakdown tab');
            const fromDetail=await detail.locator('.cartridge-bom-row dd').allTextContents();
            check(JSON.stringify(fromDetail)===JSON.stringify(fromCalculator),
              label+' both tabs use identical starting quantities');
            const staged=await detail.evaluate(root=>{
              const value=stage=>{
                const node=root.querySelector('[data-stage="'+stage+'"]');
                const text=node?.querySelector('strong,dd')?.textContent||'';
                return Number(text.replace(/[^0-9.-]/g,''));
              };
              return {gross:value('gross-start'),before:value('pre-terpene-start'),
                terp:value('terpenes'),loss:value('co2'),
                after:value('pre-terpene-finished'),final:value('final')};
            });
            check(Math.abs(staged.before-staged.loss-staged.after)<0.003
              &&Math.abs(staged.after+staged.terp-staged.final)<0.003,
              label+' theoretical staged mass balance closes within display rounding',staged);
            const compactGeometry=await page.evaluate(()=>({
              scroll:document.documentElement.scrollWidth,width:innerWidth,
            }));
            check(compactGeometry.scroll<=compactGeometry.width+1,
              label+' staged breakdown avoids horizontal overflow',compactGeometry);
            const finishedHeader=await studio.locator('.formula-box .small-label').textContent();
            check(finishedHeader?.includes('Gross finished batch total'),
              label+' starting and finished batch totals are explicitly distinguished',finishedHeader);
            await calculate.click();
            const initialStarting=Number((await studio.locator('.calculator-app-kpi-value').innerText()).replace(/[^0-9.-]/g,''));
            await page.locator('#cart-transfer-loss').fill('7.5');
            await page.waitForFunction(before=>{
              const text=document.querySelector('.calculator-app-kpi-value')?.textContent||'';
              return Number(text.replace(/[^0-9.-]/g,''))>before+0.001;
            },initialStarting,{timeout:8000});
            check(Number((await studio.locator('.calculator-app-kpi-value').innerText()).replace(/[^0-9.-]/g,''))>initialStarting,
              label+' transfer loss increases required starting mass');
            await breakdown.click();
            const lossSummary=await studio.locator('.calculator-app-details .cartridge-bom').evaluate(root=>{
              const value=stage=>Number((root.querySelector('[data-stage="'+stage+'"] strong,[data-stage="'+stage+'"] dd')?.textContent||'').replace(/[^0-9.-]/g,''));
              return {gross:value('final'),loss:value('transfer-loss'),recovered:value('recoverable')};
            });
            check(Math.abs(lossSummary.gross-lossSummary.loss-lossSummary.recovered)<0.003&&lossSummary.loss>0,
              label+' transfer loss reconciles pre-transfer gross and recoverable net',lossSummary);
            await calculate.click();
            await studio.getByRole('button',{name:'Available batch'}).click();
            check(await studio.locator('.calculator-app-overview .cartridge-bom').count()===1,
              label+' available-batch mode retains weigh-out table');
            await breakdown.click();
            check(await studio.locator('.calculator-app-details .cartridge-bom').count()===1,
              label+' available-batch mode retains breakdown weigh-out');
            check(await studio.locator('.calculator-app-details [data-stage="pre-terpene-finished"]').count()===1,
              label+' available-batch mode retains post-decarb pre-terpene subtotal');
            await companion.click();
            await page.waitForFunction(target=>location.pathname.includes(target),
              isExtract?'cartridge-formulation':'extract-formulation',{timeout:8000});
            await page.waitForFunction(expected=>document.querySelector('h1')?.textContent?.trim()===expected,
              isExtract?'Cartridge formulation':'Extract formulation',{timeout:8000});
            check(await page.locator('h1').innerText()===(isExtract?'Cartridge formulation':'Extract formulation'),
              label+' counterpart route is navigable without a duplicate calculator engine');
            await page.waitForFunction(()=>document.querySelector('#cart-transfer-loss')?.value==='7.5',
              null,{timeout:8000});
            check(await page.locator('#cart-transfer-loss').inputValue()==='7.5',
              label+' both formulation entry routes preserve the same saved transfer-loss assumptions');
          }
          if(fixture.route==='/tools/max-pressure/') {
            await nav.getByRole('tab',{name:'Heatmap'}).click();
            check(await studio.locator('.heatmap-table').count()===1,
              label+' heatmap accessible via dedicated tab');
          }
        }
        // Pressure has a purpose-built interactive landscape rather than the
        // standard calculator tabs; verify its entire live model separately.
        const pressureLabel = name+' '+viewport.width+' /tools/max-pressure/';
        const pressureResponse=await page.goto(base+'/tools/max-pressure/',{waitUntil:'networkidle',timeout:30000});
        check(pressureResponse?.status()===200,pressureLabel+' loads');
        const pressure=page.locator('.pressure-workbench');
        await pressure.waitFor();
        const gauge=pressure.locator('.pressure-kpi-primary strong');
        const initialGauge=await gauge.innerText();
        await page.waitForTimeout(130);
        const pressureWeight=page.locator('#pressure-weight');
        const currentWeight=await pressureWeight.inputValue();
        const nextWeight=currentWeight==='30'?'31':'30';
        await pressureWeight.fill(nextWeight);
        await page.waitForFunction(before => {
          const content=document.querySelector('.pressure-kpi-primary strong')?.textContent;
          return typeof content==='string'&&content!==before;
        },initialGauge,{timeout:8000});
        check((await gauge.innerText())!==initialGauge,pressureLabel+' edits recompute gauge PSI');
        const cells=pressure.locator('.pressure-map-cell:visible');
        check(await cells.count()>=25,pressureLabel+' renders operable heatmap');
        const cell=pressure.locator('.pressure-map-cell:visible:not([data-current="true"])').first();
        await cell.click();
        check(await cell.getAttribute('aria-pressed')==='true'
          && await pressure.getByRole('button',{name:'Use this scenario'}).isEnabled(),
          pressureLabel+' selection enables scenario inspection');
        const selected=await cell.getAttribute('id');
        await cell.press('ArrowRight');
        const keyboardMoved=(await pressure.locator('.pressure-map-cell[data-selected="true"]').getAttribute('id'))!==selected;
        check(keyboardMoved,pressureLabel+' arrow keys move between pressure cells');
        const oldTemp=await page.locator('#pressure-temp').inputValue();
        const oldVol=await page.locator('#pressure-vol').inputValue();
        await pressure.getByRole('button',{name:'Use this scenario'}).click();
        const newTemp=await page.locator('#pressure-temp').inputValue();
        const newVol=await page.locator('#pressure-vol').inputValue();
        check(oldTemp!==newTemp||oldVol!==newVol,
          pressureLabel+' selected scenario updates actual calculator fields');
        // Vacuum and atmospheric baselines must be discoverable without opening
        // the advanced assumptions disclosure. The field must propagate to the
        // gauge KPI and all 49 independent pressure scenario evaluations.
        const startPressure=pressure.locator('#pressure-start-pressure');
        const ambientPressure=pressure.locator('#pressure-ambient');
        const startPresets=pressure.getByRole('group',{name:'Initial pressure examples'});
        const atmPreset=startPresets.getByRole('button',{name:'At ambient'});
        const vacuumPreset=startPresets.getByRole('button',{name:/50% ambient/});
        check(await startPressure.isVisible()&&await ambientPressure.isVisible(),
          pressureLabel+' initial PSIA and reference ambient are top-level editable fields');
        await atmPreset.click();
        const ambientValue=Number(await ambientPressure.inputValue());
        const atmosphereGauge=Number((await gauge.innerText()).replace(/[^0-9.-]/g,''));
        const initialCo2=await pressure.locator('.pressure-kpi-secondary>div').nth(1).innerText();
        check(Math.abs(Number(await startPressure.inputValue())-ambientValue)<0.0001,
          pressureLabel+' atmospheric preset matches current ambient');
        await vacuumPreset.click();
        const vacuumGauge=Number((await gauge.innerText()).replace(/[^0-9.-]/g,''));
        const vacuumValue=Number(await startPressure.inputValue());
        check(Math.abs(vacuumValue-ambientValue/2)<0.0001&&vacuumGauge<atmosphereGauge,
          pressureLabel+' vacuum preset lowers trapped-gas and total pressure',
          {vacuumValue,ambientValue,vacuumGauge,atmosphereGauge});
        check(await pressure.locator('.pressure-starting-heading [data-condition="vacuum"]').count()===1,
          pressureLabel+' explains selected initial condition as vacuum');
        check(await pressure.locator('.pressure-kpi-secondary>div').nth(1).innerText()===initialCo2,
          pressureLabel+' initial vacuum does not change stoichiometric CO2 pressure');
        check(await pressure.locator('.pressure-starting-readout').innerText()!=='' &&
          await pressure.locator('.pressure-map-cell').count()===49,
          pressureLabel+' vacuum model retains 49 calculated cells and dual pressure readout');
        await pressure.getByRole('group',{name:'Initial pressure units'})
          .getByRole('button',{name:/Gauge \/ vacuum/}).click();
        const signedGauge=Number(await startPressure.inputValue());
        check(Math.abs(signedGauge-(vacuumValue-ambientValue))<0.0001&&signedGauge<0,
          pressureLabel+' unit switch preserves physical pressure as negative PSIG',
          {vacuumValue,signedGauge,ambientValue});
        check(Math.abs(Number((await gauge.innerText()).replace(/[^0-9.-]/g,''))-vacuumGauge)<0.11,
          pressureLabel+' absolute/gauge input conversion preserves modeled output');
        await startPressure.fill(String(-ambientValue-1));
        check(await startPressure.getAttribute('aria-invalid')==='true'&&
          await pressure.locator('.pressure-field-empty').count()===1,
          pressureLabel+' rejects negative absolute pressure rather than drawing invalid cells');
        await atmPreset.click();
        check(await startPressure.getAttribute('aria-invalid')==='false'&&
          await pressure.locator('.pressure-map-cell').count()===49,
          pressureLabel+' atmospheric shortcut recovers from invalid vacuum entry');
        const pressureGeometry=await page.evaluate(()=>{
          const stage=document.querySelector('.workspace-stage')?.getBoundingClientRect();
          const panel=document.querySelector('.pressure-workbench')?.getBoundingClientRect();
          return {scroll:document.documentElement.scrollWidth,width:innerWidth,
            stageLeft:stage?.left,stageRight:stage?.right,panelLeft:panel?.left,panelRight:panel?.right};
        });
        check(pressureGeometry.scroll<=pressureGeometry.width+1
          && pressureGeometry.panelLeft>=pressureGeometry.stageLeft-1
          && pressureGeometry.panelRight<=pressureGeometry.stageRight+1,
          pressureLabel+' landscape stays within workspace',pressureGeometry);
        check(errors.length===0,name+' '+viewport.width+' no page errors',errors);
        await context.close();
      }
    } finally {await browser.close();}
  }
} finally {
  await snapshot?.close();
}
console.log('Premium calculator studio QA passed: '+passed+' checks.');
