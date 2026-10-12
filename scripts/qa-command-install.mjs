import { chromium } from '@playwright/test';
import { getOgPages } from './og-registry.mjs';

const base = process.env.SMOKE_URL || 'http://127.0.0.1:42061';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let failures = 0;
const assert = (condition, message, data) => {
  if (condition) { console.log('PASS', message); return; }
  failures++;
  console.error('FAIL', message, data === undefined ? '' : JSON.stringify(data));
};
try {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(220);
    assert(await page.getByRole('dialog', { name: 'Install the app' }).count() === 0,
      `${viewport.width}: installation never opens itself`);
    const rail = await page.locator('.studio-rail').boundingBox();
    const stage = await page.locator('.workspace-stage').boundingBox();
    assert(Boolean(rail && stage && stage.x >= rail.x + rail.width - 1),
      `${viewport.width}: stage begins beyond persistent rail`, { rail, stage });
    const bodyView = page.locator('.content-main > .scroll-view__viewport');
    assert(await bodyView.count() === 1 && await bodyView.evaluate(el => getComputedStyle(el).overflowY === 'auto'),
      `${viewport.width}: workspace uses composited ScrollView`);
    await page.getByRole('button', { name: 'Search calculators' }).last().click();
    const search = page.getByRole('dialog', { name: 'Find a calculator' });
    await search.waitFor();
    const check = await page.evaluate(() => {
      const a = document.querySelector('.tool-search-dialog').getBoundingClientRect();
      const b = document.querySelector('.workspace-stage').getBoundingClientRect();
      const c = document.querySelector('.workspace-toolbar').getBoundingClientRect();
      const d = document.querySelector('.content-main').getBoundingClientRect();
      const v = document.querySelector('.tool-search-results > .scroll-view__viewport');
      return { overlay: { left: a.left, right: a.right, top: a.top, bottom: a.bottom },
        stage: { left: b.left, right: b.right },
        body: { top: c.bottom, bottom: d.bottom },
        scrolling: v && getComputedStyle(v).overflowY === 'auto',
        childCount: document.querySelectorAll('.tool-search-result').length };
    });
    assert(check.overlay.left >= check.stage.left - 1 && check.overlay.right <= check.stage.right + 1 &&
      check.overlay.top >= check.body.top - 1 && check.overlay.bottom <= check.body.bottom + 1,
      `${viewport.width}: search contained strictly in workspace body`, check);
    assert(check.scrolling && check.childCount === getOgPages().length, `${viewport.width}: search results scroll independently`, check);
    await search.getByRole('searchbox').fill('pressure');
    assert(await search.locator('.tool-search-result').count() === 1,
      `${viewport.width}: result filtering`);
    await search.getByRole('searchbox').fill('');
    await search.getByRole('searchbox').press('ArrowDown');
    const active = await page.evaluate(() => document.activeElement?.classList.contains('tool-search-result'));
    assert(active, `${viewport.width}: arrow navigation`);
    await search.getByRole('button', { name: 'Close search' }).click();
    assert(await search.count() === 0, `${viewport.width}: search closes`);
    await page.getByRole('button', { name: 'Install Decarboxulator app' }).click();
    const install = page.getByRole('dialog', { name: /Install the app|Already installed/ });
    await install.waitFor();
    const installBox = await page.locator('.install-dialog').boundingBox();
    assert(installBox && installBox.x >= check.stage.left - 1 &&
      installBox.x + installBox.width <= check.stage.right + 1 &&
      installBox.y >= check.body.top - 1 &&
      installBox.y + installBox.height <= check.body.bottom + 1,
      `${viewport.width}: install panel bounded by workspace`, { installBox, check });
    assert(await install.locator('.install-step').count() >= 2,
      `${viewport.width}: platform installation steps`);
    await install.getByRole('button', { name: 'Close install guide' }).last().click();
    assert(await install.count() === 0, `${viewport.width}: installer closes`);
    assert(errors.length === 0, `${viewport.width}: no browser errors`, errors);
    await page.close();
  }

  const ios = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1',
  });
  await ios.goto(base, { waitUntil: 'networkidle' });
  await ios.getByRole('button', { name: 'Install Decarboxulator app' }).click();
  assert((await ios.locator('.install-dialog').innerText()).includes('Tap the Share button'),
    'iOS Safari receives accurate share-sheet instructions');
  await ios.close();

  const native = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await native.goto(base, { waitUntil: 'networkidle' });
  await native.evaluate(() => {
    window.__qaPromptCalls = 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => { window.__qaPromptCalls++; },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(event);
  });
  assert(await native.getByRole('dialog', { name: 'Install the app' }).count() === 0,
    'native install availability never auto-opens the guide');
  await native.getByRole('button', { name: 'Install Decarboxulator app' }).click();
  await native.getByRole('button', { name: 'Install now' }).click();
  assert(await native.evaluate(() => window.__qaPromptCalls) === 1,
    'native install prompt called only on explicit confirmation');
  await native.close();
} finally {
  await browser.close();
}
if (failures) process.exit(1);
console.log('Command palette, ScrollView and PWA UX QA passed.');
