import { chromium } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';

const snapshot = process.env.SMOKE_URL ? null : await startQASnapshot();
const base = process.env.SMOKE_URL || snapshot.base;
let browser;
let failures = 0;
function verify(ok, label, detail) {
  if (ok) console.log('PASS ' + label);
  else { failures++; console.error('FAIL ' + label, detail ?? ''); }
}
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(base + '/learn/decarboxylation-math/', { waitUntil: 'networkidle' });
  const workspace = page.locator('.content-main > .scroll-view__viewport');
  const originalOffset = await workspace.evaluate(element => {
    element.scrollTop = Math.min(350, element.scrollHeight - element.clientHeight);
    element.dispatchEvent(new Event('scroll'));
    return element.scrollTop;
  });
  verify(originalOffset > 100, 'reference document has an independently scrollable body', originalOffset);

  await page.getByRole('button', { name: 'Search calculators' }).last().click();
  const search = page.getByRole('dialog', { name: 'Find a calculator' });
  await search.getByRole('searchbox').fill('batch yield');
  await search.getByRole('link', { name: /Batch yield/i }).click();
  await page.waitForURL('**/tools/batch-yield*');
  await page.waitForFunction(() => document.querySelector('.tool-heading h1')?.textContent?.toLowerCase().includes('batch'));
  const newOffset = await workspace.evaluate(element => element.scrollTop);
  verify(newOffset <= 2, 'new calculator begins at top of the workspace', newOffset);

  await page.getByRole('button', { name: 'Search calculators' }).last().click();
  await search.getByRole('searchbox').fill('The science');
  await search.getByRole('link', { name: /The science/i }).click();
  await page.waitForURL('**/learn/decarboxylation-math*');
  await page.waitForFunction(() => document.querySelector('.science-studio') &&
    document.querySelector('.tool-heading h1')?.textContent?.toLowerCase().includes('decarboxylation'));
  const restoredOffset = await workspace.evaluate(element => element.scrollTop);
  verify(Math.abs(restoredOffset - originalOffset) <= 3,
    'returning to previous route restores its exact scroll offset', { originalOffset, restoredOffset });

  await page.waitForFunction(() => navigator.serviceWorker?.controller, { timeout: 20000 });
  const cachesReady = await page.evaluate(async () => {
    const names = await caches.keys();
    return names.some(name => name.startsWith('decarboxulator:offline:'));
  });
  verify(cachesReady, 'versioned offline shell installed');
  const legacyCached = await page.evaluate(async () => {
    const names = await caches.keys();
    const cached = await Promise.all(names.filter(name => name.startsWith('decarboxulator:offline:'))
      .map(async name => (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname)));
    return cached.flat().filter(path => path.includes('/pages/'));
  });
  verify(legacyCached.length === 0, 'historical redirects never contaminate the offline calculator precache', legacyCached);

  await context.setOffline(true);
  const scopedCalculator = new URL(base).pathname.replace(/\/$/, '') + '/tools/thca-to-thc/?qa=offline';
  const offlineFetch = await page.evaluate(async url => {
    try { return (await fetch(url)).status; }
    catch (error) { return String(error); }
  }, scopedCalculator);
  verify(offlineFetch === 200, 'controlled app can read cached calculator while network is offline', offlineFetch);
  await page.goto(base + '/tools/thca-to-thc/?qa=offline', { waitUntil: 'domcontentloaded' });
  verify(await page.locator('.content-main h1').count() === 1,
    'calculator route loads offline with its prerendered shell');
  verify(await page.locator('.number-input input').count() > 0,
    'calculator controls hydrate while offline');
  verify(await page.getByRole('dialog', { name: 'Install the app' }).count() === 0,
    'offline capability never auto-opens installation UI');
  verify(pageErrors.length === 0, 'no JavaScript errors after route navigation and offline load', pageErrors);
  await context.close();
} finally {
  await browser?.close();
  await snapshot?.close();
}
if (failures) process.exit(1);
console.log('Route scroll restoration and offline PWA QA passed.');
