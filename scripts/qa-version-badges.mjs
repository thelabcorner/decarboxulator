import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

let browser;
for (const channel of ['chrome', 'msedge']) {
  try { browser = await chromium.launch({ headless: true, channel }); break; }
  catch { /* Try next available system browser. */ }
}
if (!browser) throw new Error('Chrome or Edge is required to verify calculator badges');

const base = process.env.SMOKE_URL || 'http://127.0.0.1:42061';
const sizes = [320, 375, 430, 768, 1440];
mkdirSync('artifacts', { recursive: true });

try {
  for (const width of sizes) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 812 } });
      try {
        await context.addInitScript(value => localStorage.setItem('decarboxulator-theme', value), theme);
        const page = await context.newPage();
        await page.goto(base, {waitUntil:'networkidle'});
        if (width <= 760) {
          await page.getByRole('button', {name: 'Browse calculators'}).click();
          await page.locator('#studio-tool-pane').waitFor({state:'visible'});
        }
        const state = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('.studio-tool-list .studio-nav-link')];
          const badges = rows.map(row => {
            const badge = row.querySelector('.calculator-version-badge');
            const title = row.querySelector('.studio-nav-title');
            if (!badge || !title) return null;
            const r = row.getBoundingClientRect(), b = badge.getBoundingClientRect();
            return {
              text: badge.textContent, title: badge.title,
              width: b.width, height: b.height,
              inside: b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom,
              visible: b.width > 0 && b.height > 0,
              font: getComputedStyle(badge).fontFamily,
              clippedLabel: title.scrollWidth > title.clientWidth + 1,
              label: title.textContent,
            };
          });
          return {
            badges, overviewBadge: !!document.querySelector('.studio-pane-group:first-child .calculator-version-badge'),
            referenceBadge: !!document.querySelector('.studio-pane-group:last-child .calculator-version-badge'),
            headerVersion: document.querySelector('.studio-pane-version')?.textContent,
            totalWidth: document.documentElement.scrollWidth,
          };
        });
        assert.equal(state.badges.length, 8, `Navigation tool count at ${width}/${theme}`);
        assert(state.badges.every(b => b && b.text === 'v4' && b.inside && b.visible && b.width >= 22.9 && Math.abs(b.height - 17) < 0.1),
          `Badge bounds at ${width}/${theme}: ${JSON.stringify(state.badges)}`);
        assert(state.badges.every(b => !/mono|consolas|courier/i.test(b.font)));
        assert.equal(state.headerVersion, 'v4');
        assert.equal(state.overviewBadge, false);
        assert.equal(state.referenceBadge, false);
        assert(state.totalWidth <= width + 1, `Horizontal viewport overflow at ${width}/${theme}`);
        // The badge is visual metadata, not part of the link's accessible name.
        assert.equal(await page.locator('#studio-navigation').getByRole('link', {name:'Batch yield', exact:true}).count(), 1);
        if (width === 375 && theme === 'dark') {
          await page.screenshot({path:'artifacts/qa-version-badges-mobile.png'});
        }
        if (width <= 760) await page.getByRole('button', {name:'Browse calculators'}).click();
        assert.equal(await page.locator('.workbench-tool-directory .calculator-version-badge').count(), 11);
        await page.locator('.rail-bottom [aria-label="Search calculators"]').click();
        await page.getByRole('dialog', {name:'Find a calculator'}).waitFor({state:'visible'});
        assert.equal(await page.locator('.tool-search-result .calculator-version-badge').count(), 11);
        console.log('PASS', width, theme, '8 badges in sidebar, directory and search, no overflow');
      } finally { await context.close(); }
    }
  }
} finally { await browser.close(); }