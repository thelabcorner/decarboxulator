import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';

const redirectRoot = join(process.cwd(), 'dist', 'client');
const cases = [
  ['pages/v2/thca-thc-calculator.html', '/tools/thca-to-thc/'],
  ['pages/v2/max-pressure.html', '/tools/max-pressure/'],
  ['index-old.html', '/'],
];
const origin = 'https://thelabcorner.github.io/decarboxulator/';
let checks = 0;
function assert(ok, why) { if (!ok) throw new Error(why); checks++; }
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const snapshot = await startQASnapshot({ snapshotName: 'qa-legacy-migration' });
try {
  for (const [legacy, destination] of cases) {
    const html = readFileSync(join(redirectRoot, legacy), 'utf8');
    const absolute = new URL(destination.slice(1), origin).toString();
    assert(html.includes('href="' + absolute + '"'), legacy + ': canonical changed');
    assert(html.includes('content="0;url=/decarboxulator/' + destination.slice(1) + '"'),
      legacy + ': immediate redirect missing');
    assert(html.includes('Upgrading your experience.'), legacy + ': wrong upgrade heading');
    assert(html.includes('Jackson Cummings') && html.includes('thedabcorner.site') &&
      html.includes('github.com/thelabcorner/decarboxulator'), legacy + ': missing attribution');
    // The real page redirects in zero seconds. Remove only the redirect
    // mechanisms for a visual fallback snapshot, never in production.
    const isolated = html
      .replace(/<meta http-equiv="refresh"[^>]*>/i, '')
      .replace(/<script>\(\(\)=>\{[\s\S]*?<\/script>/i, '');
    for (const dark of [false, true]) {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        colorScheme: dark ? 'dark' : 'light',
        deviceScaleFactor: 1,
      });
      await page.setContent(isolated);
      const metrics = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
        heading: document.querySelector('h1')?.textContent,
        logo: !!document.querySelector('.brand-icon svg path'),
        cta: document.querySelector('.cta')?.getAttribute('href'),
        bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
      }));
      assert(metrics.scroll <= metrics.client + 1, legacy + ': horizontal overflow');
      assert(metrics.heading === 'Upgrading your experience.', legacy + ': inaccessible fallback heading');
      assert(metrics.logo, legacy + ': brand vector missing');
      assert(metrics.cta === '/decarboxulator/' + destination.slice(1), legacy + ': fallback destination');
      assert(metrics.bg === (dark ? '#0e0e10' : '#fafafa'), legacy + ': theme mismatch');
      await page.close();
    }
    const live = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await live.goto(snapshot.base + '/' + legacy + '?source=old', { waitUntil: 'domcontentloaded' });
    await live.waitForURL(url => url.pathname.endsWith(destination) && url.search === '?source=old', { timeout: 10000 });
    assert(new URL(live.url()).pathname.endsWith(destination), legacy + ': destination failed');
    await live.close();
  }
  const reverse = await browser.newPage();
  await reverse.goto(snapshot.base + '/pages/v2/thca-thc-calculator.html#backward', { waitUntil: 'domcontentloaded' });
  await reverse.waitForURL(url => url.pathname.endsWith('/tools/thc-to-thca/'), { timeout: 10000 });
  assert(reverse.url().includes('/tools/thc-to-thca/'), 'V3 reverse conversion hash broken');
  await reverse.close();
  console.log('PASS legacy migration browser QA: ' + checks + ' checks, light/dark/mobile + real redirects');
} finally {
  await snapshot.close();
  await browser.close();
}
