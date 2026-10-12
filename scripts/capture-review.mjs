import { chromium } from '@playwright/test';
const width = Number(process.argv[2] || 375);
const height = Number(process.argv[3] || 812);
const path = process.argv[4] || '/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: {width, height}, deviceScaleFactor: 1, colorScheme: 'dark' });
await page.goto('http://127.0.0.1:42061' + path, {waitUntil:'networkidle'});
if (process.argv[5] === 'drawer') {
  await page.getByRole('button', {name: 'Browse calculators'}).click();
  await page.waitForTimeout(300);
}
const buffer = await page.screenshot({type:'jpeg',quality:60});
const status = await page.evaluate(() => ({
  title: document.title, width: innerWidth, contentWidth: document.documentElement.scrollWidth,
  sidebar: getComputedStyle(document.querySelector('.studio-sidebar')).width,
  rail: (() => {
    const rect = document.querySelector('.studio-rail').getBoundingClientRect();
    return {x:rect.x,width:rect.width};
  })(),
  expandedPane: document.querySelector('#studio-tool-pane').getBoundingClientRect().toJSON(),
  appHeight: document.querySelector('.app-shell')?.getBoundingClientRect().height,
}));
console.log('STATUS:' + JSON.stringify(status));
console.log('IMAGE:' + buffer.toString('base64'));
await browser.close();
