import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.env.SMOKE_URL || 'http://127.0.0.1:42061';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let failures = 0;
let checks = 0;
const assert = (condition, name, details) => {
  checks++;
  if (condition) return;
  failures++;
  console.error('FAIL', name, details ? JSON.stringify(details) : '');
};
const measure = async (page) => page.evaluate(() => {
  const rect = name => {
    const element = document.querySelector(name);
    if (!element) return null;
    const r = element.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
  };
  const root = document.documentElement;
  const textFields = Array.from(document.querySelectorAll('input, textarea, select'))
    .filter(el => !['hidden','checkbox','radio','range','color'].includes(el.type) && el.getClientRects().length)
    .map(el => ({ id: el.id, type: el.type, fontSize: Number.parseFloat(getComputedStyle(el).fontSize) }));
  return {
    stage: rect('.workspace-stage'),
    body: rect('.content-main'),
    shell: rect('.app-shell'),
    rail: rect('.studio-rail'),
    layer: rect('.share-layer'),
    dialog: rect('.share-dialog'),
    scroll: rect('.share-body > .scroll-view__viewport'),
    docHeight: root.scrollHeight,
    docWidth: root.scrollWidth,
    innerWidth, innerHeight, scrollY,
    viewportScale: window.visualViewport?.scale ?? 1,
    viewportMeta: document.querySelector('meta[name="viewport"]')?.content ?? '',
    stageParent: document.querySelector('.share-layer')?.parentElement?.className,
    textFields,
  };
});
const inside = (a, b, epsilon=2) => Boolean(a && b && a.x >= b.x - epsilon &&
  a.right <= b.right + epsilon && a.y >= b.y - epsilon && a.bottom <= b.bottom + epsilon);

try {
  for (const viewport of [
    { width: 320, height: 568 }, { width: 375, height: 667 },
    { width: 390, height: 844 }, { width: 430, height: 932 },
    { width: 667, height: 375 }, { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    const mobile = viewport.width <= 760;
    const page = await browser.newPage({
      viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1,
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base + '/tools/thca-percentage', { waitUntil: 'networkidle' });
      const before = await measure(page);
      const tag = viewport.width + 'x' + viewport.height;
      assert(before.shell && Math.abs(before.shell.height - before.innerHeight) < 2,
        tag + ': app fills the real layout viewport', before);
      assert(before.rail && before.stage && before.stage.x >= before.rail.right - 1,
        tag + ': persistent rail remains outside stage', before);
      assert(before.docWidth <= before.innerWidth + 1 && before.scrollY === 0,
        tag + ': no root horizontal overflow or body scroll', before);
      assert(/maximum-scale=1/.test(before.viewportMeta) && /user-scalable=no/.test(before.viewportMeta),
        tag + ': UI scaling is explicitly disabled', before);
      assert(before.textFields.every(field => !mobile || field.fontSize >= 16),
        tag + ': numeric and editable fields avoid Safari focus magnification', before.textFields);

      await page.getByRole('button', {name: 'Share', exact: true}).click();
      const dialog = page.getByRole('dialog', {name: 'Share calculation'});
      await dialog.waitFor();
      const opened = await measure(page);
      assert(inside(opened.dialog, opened.stage) && opened.dialog.y >= opened.body.y - 1 &&
        opened.dialog.bottom <= opened.body.bottom + 1,
        tag + ': share card contained by workspace body', opened);
      assert(opened.stageParent?.includes('workspace-stage'),
        tag + ': share card portaled out of clipped calculator ScrollView', opened);
      assert(mobile ? opened.textFields.every(field => field.fontSize >= 16) : true,
        tag + ': share link never autozooms on focus', opened.textFields);
      await dialog.locator('#share-url-field').focus();
      const focused = await measure(page);
      assert(focused.viewportScale === 1 && Math.abs(focused.shell.height - before.shell.height) < 2,
        tag + ': focusing share field preserves viewport geometry', focused);
      assert(inside(focused.dialog, focused.stage), tag + ': focused share card stays contained', focused);
      if (tag === '390x844') {
        mkdirSync('artifacts', {recursive: true});
        await page.screenshot({path: 'artifacts/mobile-share-regression.png'});
      }
      await page.locator('.workspace-stage').evaluate((stage) => {
        stage.style.setProperty('--dialog-visual-bottom-inset', Math.max(240, stage.clientHeight - 260) + 'px');
      });
      const cramped = await measure(page);
      assert(cramped.dialog && cramped.layer && inside(cramped.dialog, cramped.layer),
        tag + ': keyboard-sized visual region contains the share card', cramped);
      const scroller = page.locator('.share-body > .scroll-view__viewport');
      const scrollable = await scroller.evaluate(el => ({
        scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
        overflow: getComputedStyle(el).overflowY,
      }));
      assert(scrollable.overflow === 'auto' && scrollable.scrollHeight > scrollable.clientHeight,
        tag + ': share details independently scroll under keyboard', scrollable);
      await page.locator('.workspace-stage').evaluate(stage => stage.style.removeProperty('--dialog-visual-bottom-inset'));
      await page.getByRole('button', {name: 'Close sharing panel'}).last().click();
      assert(await dialog.count() === 0, tag + ': share card closes');
      const closed = await measure(page);
      assert(Math.abs(closed.shell.height - before.shell.height) < 2 && closed.scrollY === 0,
        tag + ': closing share does not leave shrunken workspace', closed);

      if (mobile) {
        await page.getByRole('button', {name:'Search calculators'}).last().click();
        const search = page.getByRole('dialog',{name:'Find a calculator'});
        await search.waitFor();
        const inputSize = await search.getByRole('searchbox').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
        assert(inputSize >= 16, tag + ': command search input does not invoke Safari focus zoom', inputSize);
        await search.getByRole('button',{name:'Close search'}).click();
      }
      assert(errors.length === 0, tag + ': no client errors', errors);
    } catch (error) {
      failures++;
      console.error('ERROR', viewport, error.message);
    } finally { await page.close(); }
  }

  // Stateless calculators share input snapshots. The persistent tracker instead owns
  // an on-device session archive; never imply its IndexedDB record is a portable link.
  const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const routes = [
    '/tools/thca-to-thc', '/tools/thc-to-thca', '/tools/batch-yield',
    '/tools/thca-percentage', '/tools/edible-dosage', '/tools/max-pressure',
    '/tools/cartridge-formulation',
  ];
  for (const route of routes) {
    try {
      await page.goto(base + route, {waitUntil:'networkidle'});
      const trigger = page.getByRole('button',{name:'Share',exact:true}).first();
      assert(await trigger.isEnabled(), route + ': share action available');
      await trigger.click();
      const bounds = await measure(page);
      assert(inside(bounds.dialog,bounds.stage) && bounds.dialog.y >= bounds.body.y - 1 &&
        bounds.dialog.bottom <= bounds.body.bottom + 1, route + ': route share contained', bounds);
      await page.getByRole('button',{name:'Close sharing panel'}).last().click();
    } catch (error) { failures++; console.error('ERROR', route, error.message); }
  }
  await page.goto(base + '/tools/decarb-tracker', {waitUntil:'networkidle'});
  assert(await page.getByRole('button',{name:/Sessions \(/}).count() > 0,
    'Tracker has a session archive instead of a misleading share-snapshot URL');
  assert(await page.getByRole('button',{name:'Share',exact:true}).count() === 0,
    'Tracker must not present an incomplete on-device session as a portable share link');
  await page.close();
} finally {
  await browser.close();
}
console.log('Mobile overlay/viewport QA: ' + (checks - failures) + '/' + checks + ' checks passed.');
if (failures) process.exit(1);
