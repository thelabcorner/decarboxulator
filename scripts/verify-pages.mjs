import { chromium } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';

// Verify the exact generated asset mount before asking the browser to hydrate.
// A root build is not a GitHub Pages build, even if its canonical tags match.
const snapshot = await startQASnapshot({snapshotName: 'qa-snapshot-pages'});
if (!snapshot.base.endsWith('/decarboxulator')) {
  const actual = snapshot.base;
  await snapshot.close();
  throw new Error('Expected the /decarboxulator/ production mount; got ' + actual + '. Run npm run build:pages first.');
}
const base = snapshot.base + '/';
let browser;
let failures=0;
try {
  for (const channel of ['chrome','msedge']) {
    try {browser=await chromium.launch({channel,headless:true});break;} catch {/* try next channel */}
  }
  if(!browser) throw new Error('Chrome or Edge is required to test the static deploy');
  const page=await browser.newPage({viewport:{width:375,height:812}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{
    if(response.status()>=400) errors.push(`${response.status()} ${response.url()}`);
  });
   const routes=[
     '', 'tools/thca-to-thc/', 'tools/thc-to-thca/', 'tools/batch-yield/',
     'tools/thca-percentage/', 'tools/edible-dosage/', 'tools/max-pressure/',
     'tools/decarb-tracker/', 'tools/cartridge-formulation/', 'learn/decarboxylation-math/',
   ];
  for(const route of routes) {
    const response=await page.goto(base+route,{waitUntil:'networkidle'});
    const info=await page.evaluate(()=>({
      title:document.title,
      main:!!document.querySelector('h1'),
      accent:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      width:document.documentElement.scrollWidth,
      viewport:innerWidth,
    }));
    if(response?.status()!==200||!info.main||!['#aaff00','#af0'].includes(info.accent)||info.width>info.viewport+1||errors.length) {
      failures++;console.error('FAIL deployed',route,JSON.stringify({info,errors}));
    } else console.log('PASS deployed','/decarboxulator/'+route);
  }
  // Old indexed URLs must work after replacing the legacy static site.
  for (const [legacy, target] of [
    ['pages/v2/index.html', ''],
    ['pages/v2/thca-thc-calculator.html', 'tools/thca-to-thc/'],
    ['pages/v2/thca-thc-calculator/', 'tools/thca-to-thc/'],
    ['pages/v2/thca-thc-calculator.html#backward', 'tools/thc-to-thca/'],
    ['pages/v2/thca-thc-calculator/#backward', 'tools/thc-to-thca/'],
    ['pages/v2/edible-calculator.html', 'tools/edible-dosage/'],
    ['pages/v2/edible-calculator/', 'tools/edible-dosage/'],
    ['pages/v2/decarboxylation-faq.html', 'learn/decarboxylation-math/'],
    ['pages/progress-tracker.html', 'tools/decarb-tracker/'],
    ['pages/input-finder.html', 'tools/thc-to-thca/'],
    ['pages/input-finder/', 'tools/thc-to-thca/'],
    ['pages/rosin-thca-finder.html', 'tools/thca-percentage/'],
    ['pages/rosin-thca-finder/', 'tools/thca-percentage/'],
  ]) {
    await page.goto(base + legacy, {waitUntil:'networkidle'});
    if (!page.url().startsWith(base + target)) {
      failures++; console.error('FAIL historic URL redirect', legacy, page.url());
    } else console.log('PASS historic URL redirect', legacy, '→', target);
  }
  for (const old of ['pages/time-predictor.html', 'pages/time-predictor/']) {
    const response=await page.goto(base+old,{waitUntil:'networkidle'});
    const retired=await page.locator('main').innerText();
    const robots=await page.locator('meta[name="robots"]').getAttribute('content');
    if(response?.status()!==200 || !retired.includes('not a working calculator') ||
      !retired.includes('progress tracker') || robots!=='noindex,follow') {
      failures++;console.error('FAIL retired predictor notice',old);
    } else console.log('PASS retired predictor notice',old);
  }
   await page.goto(base+'tools/thca-to-thc/',{waitUntil:'networkidle'});
  await page.locator('#convert-amount').fill('25');
  const result=await page.locator('.calculator-app-kpi-value').innerText();
  if(!result.includes('21.931')) {failures++;console.error('FAIL deployed interaction',result);}
  else console.log('PASS deployed input interaction',result.replace(/\n/g,' '));

  // The persistent mobile left rail exposes a compact adjacent tool pane.
  await page.locator('#convert-amount').evaluate(input => input.blur());
  await page.getByRole('button',{name:'Browse calculators'}).click();
  await page.locator('.studio-tool-list a[href*="batch-yield"]').click();
  if(!page.url().includes('/decarboxulator/tools/batch-yield')) {
    failures++;console.error('FAIL deployed client navigation',page.url());
  } else console.log('PASS deployed client navigation');
  await page.close();
} finally {
  await browser?.close();
    await snapshot.close();
}
if(failures) process.exit(1);
console.log('GitHub Pages base-path static hosting checks passed.');
