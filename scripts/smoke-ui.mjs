import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { getOgPages } from './og-registry.mjs';

let browser;
for (const channel of ['chrome', 'msedge']) {
  try { browser = await chromium.launch({ headless: true, channel }); break; }
  catch (error) { console.warn('Cannot launch', channel, error.message.split('\n')[0]); }
}
if (!browser) throw new Error('Chrome or Edge is required to validate the responsive UI');

const base = process.env.SMOKE_URL || 'http://127.0.0.1:42061';
const routes = getOgPages().map(page => page.path);
const sizes = [
  { width: 320, height: 700 }, { width: 375, height: 812 },
  { width: 430, height: 932 }, { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
let failed = 0;
mkdirSync(resolve('artifacts'), { recursive: true });

for (const viewport of sizes) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const route of routes) {
    try {
      errors.length = 0;
      const response = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 20000 });
      const check = await page.evaluate(() => {
        const root = document.documentElement;
        const main = document.querySelector('.content-main');
        const input = document.querySelector('.number-input input');
        const output = document.querySelector('.calculator-app-kpi-value');
        const pane = document.querySelector('.studio-sidebar');
        return {
          width: innerWidth, scrollWidth: root.scrollWidth,
          h1: document.querySelectorAll('h1').length,
          title: document.title,
          workspace: Boolean(document.querySelector('.workspace-toolbar') && main && pane),
          rail: (() => {
            const rail = document.querySelector('.studio-rail');
            const stage = document.querySelector('.workspace-stage');
            if (!rail || !stage) return null;
            const bounds = rail.getBoundingClientRect();
            const stageBounds = stage.getBoundingClientRect();
            return { left: bounds.left, width: bounds.width, stageLeft: stageBounds.left };
          })(),
          calcFont: input ? getComputedStyle(input).fontFamily : null,
          outputFont: output ? getComputedStyle(output).fontFamily : null,
          accent: getComputedStyle(root).getPropertyValue('--accent').trim(),
        };
      });
      const usesMonospace = [check.calcFont, check.outputFont].filter(Boolean).some(font => /mono|consolas|courier/i.test(font));
      const hasMobileRail = viewport.width > 760 || (check.rail &&
        Math.abs(check.rail.left) <= 1 && Math.abs(check.rail.width - 52) <= 1 &&
        check.rail.stageLeft >= 51);
      const bad = errors.length > 0 || !response?.ok() || check.scrollWidth > check.width + 1 ||
        check.h1 !== 1 || !check.workspace || !['#aaff00', '#af0'].includes(check.accent.toLowerCase()) || usesMonospace ||
        !hasMobileRail;
      if (bad) {
        failed++;
        console.error('FAIL', viewport.width, route, JSON.stringify({ status: response?.status(), ...check, errors }));
      } else console.log('PASS', viewport.width, route, 'sans-serif calculator and no overflow');
      if (viewport.width === 375 && route === '/') await page.screenshot({ path: 'artifacts/mobile-home.png' });
      if (viewport.width === 1440 && route === '/') await page.screenshot({ path: 'artifacts/desktop-home.png' });
      if (viewport.width === 375 && route === '/tools/thca-to-thc') await page.screenshot({ path: 'artifacts/mobile-conversion.png' });
    } catch (error) { failed++; console.error('ERROR', viewport.width, route, error.message); }
  }
  if (viewport.width === 375) {
    try {
      await page.goto(base + '/tools/thca-to-thc', { waitUntil: 'networkidle' });
      await page.locator('#convert-amount').fill('25');
      const result = await page.locator('.calculator-app-kpi-value').innerText();
      if (!result.includes('21.93')) { failed++; console.error('FAIL conversion interaction:', result); }
       else console.log('PASS conversion input and live output', result.replace(/\n/g, ' '));
        await page.locator('.segmented-control').first().getByRole('button',{name:'THC → THCa'}).click();
        await page.waitForURL('**/tools/thc-to-thca?*');
        await page.waitForFunction(expected => {
          const actual = Number.parseFloat((document.querySelector('.calculator-app-kpi-value')?.textContent || '').replace(/,/g,''));
          return document.querySelector('#convert-amount')?.value === '25' && Math.abs(actual - expected) < .001;
        }, 25*358.47/314.46, {timeout: 4000}).catch(() => {});
       const reverseAmount=await page.locator('#convert-amount').inputValue();
       const reverseOutput=await page.locator('.calculator-app-kpi-value').innerText();
       const selectedReverse=await page.locator('.studio-tool-list a[href$="/tools/thc-to-thca"]').getAttribute('data-active');
       if(reverseAmount!=='25'||Math.abs(Number.parseFloat(reverseOutput.replace(/,/g,''))-25*358.47/314.46)>0.001||selectedReverse!=='true'){
         failed++;console.error('FAIL conversion reverse mode and sidebar sync',{reverseAmount,reverseOutput,selectedReverse});
       } else console.log('PASS conversion mode changes route, preserves mass and activates reverse nav');
       await page.reload({waitUntil:'networkidle'});
       if(!(await page.locator('.calculator-app-kpi-caption').innerText()).includes('Equivalent starting THCa')){
         failed++;console.error('FAIL reverse direction after reload');
       } else console.log('PASS reverse deep-link refresh');
       await page.goto(base+'/tools/thca-to-thc',{waitUntil:'networkidle'});
        if(!(await page.locator('.calculator-app-kpi-caption').innerText()).includes('Theoretical THC produced')){
          failed++;console.error('FAIL forward entry ignores saved reverse direction');
        } else console.log('PASS forward direction selected by entry link');
        await page.locator('#convert-amount').fill('33');
        await page.getByRole('button', {name:'Share', exact:true}).click();
        const shareDialog = page.getByRole('dialog', {name:'Share calculation'});
        await shareDialog.waitFor({state:'visible'});
        const sharedLink = await page.locator('#share-url-field').inputValue();
        if(!sharedLink.includes('/tools/thca-to-thc') || !sharedLink.includes('amount=33') ||
          !sharedLink.includes('v=1')) {failed++;console.error('FAIL share snapshot URL',sharedLink);}
        else console.log('PASS exact versioned calculation share link');
        await shareDialog.getByRole('button',{name:'Close sharing panel'}).click();
        await page.locator('#convert-amount').fill('5');
        await page.goto(sharedLink,{waitUntil:'networkidle'});
        const sharedAmount=await page.locator('#convert-amount').inputValue();
        if(sharedAmount!=='33'){failed++;console.error('FAIL shared link restores exact values',sharedAmount);}
        else console.log('PASS shared calculation restores inputs independently of local edits');

       const browse = page.getByRole('button', { name: 'Browse calculators' });
       const initialPaneHidden = !(await page.locator('#studio-tool-pane').isVisible());
       await browse.click();
       const drawer = page.locator('#studio-tool-pane');
       await page.waitForFunction(() => {
         const pane = document.querySelector('#studio-tool-pane');
         return pane && Math.abs(pane.getBoundingClientRect().left - 52) < 1;
       }, null, { timeout: 3000 });
       const visible = await drawer.isVisible();
       const paneLocation = await drawer.evaluate(el => el.getBoundingClientRect().left);
       const railStillVisible = await page.locator('.studio-rail').isVisible();
       if (!initialPaneHidden || !visible || paneLocation < 51 || paneLocation > 54 || !railStillVisible) {
         failed++;
         console.error('FAIL persistent rail and adjacent overlay panel', JSON.stringify({
           initialPaneHidden, visible, paneLocation, railStillVisible,
         }));
       } else console.log('PASS persistent mobile rail and adjacent tool pane');
       const theme = page.getByRole('button', { name: /Switch to (dark|light) theme/ });
      const before = await page.locator('html').evaluate(element => element.classList.contains('dark'));
      await theme.click();
      const after = await page.locator('html').evaluate(element => element.classList.contains('dark'));
      await page.reload({ waitUntil: 'networkidle' });
      const persisted = await page.locator('html').evaluate(element => element.classList.contains('dark'));
      if (before === after || after !== persisted) { failed++; console.error('FAIL theme toggle and persistence'); }
      else console.log('PASS theme toggle and persistence');

       await browse.click();
       await page.locator('#studio-navigation').getByRole('link', { name: 'Batch yield', exact: true }).click();
       await page.waitForFunction(() =>
         location.pathname.includes('/tools/batch-yield') &&
         document.querySelector('.app-shell')?.getAttribute('data-mobile-open') === 'false',
         null, { timeout: 3000 }).catch(() => {});
       const arrived = new URL(page.url()).pathname.includes('/tools/batch-yield');
       const closed = await page.locator('.app-shell').getAttribute('data-mobile-open') === 'false';
       if (!visible || !arrived || !closed) { failed++; console.error('FAIL mobile drawer navigation', { visible, arrived, closed }); }
      else console.log('PASS mobile drawer navigation');

      await page.locator('#batch-mass').fill('100');
      await page.locator('#batch-percent').fill('85');
      const batchResult = await page.locator('.calculator-app-kpi-value').innerText();
      if (!batchResult.includes('74.56')) { failed++; console.error('FAIL batch calculation', batchResult); }
       else console.log('PASS batch calculation', batchResult.replace(/\n/g, ' '));

       await page.getByRole('button', {name: 'Save calculation'}).click();
       await page.locator('.workspace-toolbar').getByRole('button', {name: 'Saved calculations'}).click();
       await page.locator('.saved-library-dialog').waitFor({state:'visible'});
       const libraryCount = await page.locator('.saved-library-row').count();
       if (!libraryCount) {failed++; console.error('FAIL saved library did not show the calculation');}
       else console.log('PASS saved calculation appears in local library');
       await page.locator('.saved-library-row-main').first().click();
       const inspectorVisible = await page.locator('.saved-library-inspector').isVisible();
       if (!inspectorVisible) {failed++;console.error('FAIL mobile saved record inspector');}
       else console.log('PASS saved calculation drilldown');
       await page.locator('.saved-library-inspector').getByRole('button',{name:'Edit'}).click();
       await page.locator('#library-record-name').fill('Mobile QA batch');
       await page.getByRole('button',{name:'Save changes'}).click();
       const renamed = await page.locator('.saved-library-record-heading h3').textContent();
       if (renamed !== 'Mobile QA batch') {failed++;console.error('FAIL saved calculation rename',renamed);}
       else console.log('PASS saved calculation rename');
       await page.getByRole('link',{name:/Load in calculator/}).click();
       const loaded=await page.locator('#batch-mass').inputValue();
       if (loaded !== '100') {failed++;console.error('FAIL saved calculation restored inputs',loaded);}
       else console.log('PASS saved calculation restored original input snapshot');

       await page.goto(base+'/tools/thca-to-thc',{waitUntil:'networkidle'});
       const method = page.locator('#tool-reference');
       if (await method.evaluate(el=>el.open)) {failed++;console.error('FAIL method disclosure should start collapsed');}
       await page.locator('.tool-heading-reference').click();
       if (!await method.evaluate(el=>el.open)) {failed++;console.error('FAIL method link does not open reference');}
       else console.log('PASS collapsible SEO reference');
     } catch (error) { failed++; console.error('ERROR mobile interactions', error.message); }
  }
  await page.close();
}
await browser.close();
if (failed) process.exit(1);
console.log('All responsive smoke checks passed.');
