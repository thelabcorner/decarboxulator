// Run manually after a deployment: node scripts/qa-ga4-network.mjs
// Requires Playwright and an installed Chromium-compatible browser.
import { chromium } from 'playwright';

const id = 'G-LK9VC1VS8P';
const url = process.env.GA4_TEST_URL || 'https://thelabcorner.github.io/decarboxulator/';
const launch = process.env.CHROME_EXECUTABLE
  ? { headless: true, executablePath: process.env.CHROME_EXECUTABLE }
  : { headless: true, channel: 'chrome' };
const browser = await chromium.launch(launch);
try {
  const page = await browser.newPage();
  const collected = [];
  const errors = [];
  page.on('request', request => {
    const parsed = new URL(request.url());
    if (parsed.hostname.endsWith('google-analytics.com') && parsed.pathname.endsWith('/collect')) {
      collected.push({
        host: parsed.hostname,
        measurementId: parsed.searchParams.get('tid'),
        event: parsed.searchParams.get('en'),
        page: parsed.searchParams.get('dl'),
      });
    }
  });
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text().slice(0, 160));
  });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => Boolean(window.gtag), { timeout: 10000 });
  await page.waitForTimeout(3500);
  const state = await page.evaluate(() => ({
    tagInstalled: typeof window.gtag === 'function',
    commands: (window.dataLayer || []).slice(0, 4).map(value => ({
      type: Object.prototype.toString.call(value),
      command: value[0],
    })),
  }));
  console.log(JSON.stringify({ httpStatus: response?.status(), url, state, collected, errors }, null, 2));
  const validPageView = collected.some(event => event.measurementId === id && event.event === 'page_view');
  if (!validPageView) process.exitCode = 1;
} finally {
  await browser.close();
}
