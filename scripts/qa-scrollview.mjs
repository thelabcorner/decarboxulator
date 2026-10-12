import { chromium } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';

const snapshot = process.env.SMOKE_URL ? null : await startQASnapshot({snapshotName:'qa-snapshot-scrollview-'+process.pid});
const base = process.env.SMOKE_URL || snapshot.base;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let checks = 0;
let failures = 0;
function check(ok, message, data) {
  checks++;
  if (!ok) { failures++; console.error('FAIL', message, data); }
}
async function state(page, selector) {
  return page.locator(selector).evaluate(viewport => {
    const thumb = viewport.parentElement?.querySelector('.scroll-view__thumb');
    const style = thumb?.style.transform ?? '';
    const match = /translate[XY]\(([-\d.]+)px\)/.exec(style);
    return {
      top: viewport.scrollTop, left: viewport.scrollLeft,
      height: viewport.clientHeight, width: viewport.clientWidth,
      scrollHeight: viewport.scrollHeight, scrollWidth: viewport.scrollWidth,
      thumbOffset: match ? Number(match[1]) : null,
      thumbSize: thumb?.getBoundingClientRect().height,
      opacity: thumb ? Number(getComputedStyle(thumb).opacity) : null,
      pointerEvents: thumb ? getComputedStyle(thumb).pointerEvents : null,
    };
  });
}
try {
  for (const [width,height] of [[320,568], [375,812], [667,375], [1440,900]]) {
    const page = await browser.newPage({ viewport: {width,height} });
    await page.goto(base + '/learn/decarboxylation-math', {waitUntil:'networkidle'});
    const viewport = '.content-main > .scroll-view__viewport';
    await page.waitForTimeout(80);
    const start = await state(page, viewport);
    const max = start.scrollHeight - start.height;
    check(max > 50 && start.thumbOffset !== null, width + ': scrollbar measured correctly', start);
    if (max > 50) {
      await page.locator(viewport).evaluate(v => {v.scrollTop = (v.scrollHeight - v.clientHeight)/2;});
      await page.waitForTimeout(90);
      const middle = await state(page, viewport);
      check(middle.top > 0 && middle.thumbOffset > start.thumbOffset + 5,
        width + ': scroll thumb moves down with native scroll', {start,middle});
      const distance = start.height - 16 - (start.thumbSize ?? 0);
      const expected = 8 + (middle.top / max) * distance;
      check(Math.abs(middle.thumbOffset - expected) < 3,
        width + ': thumb follows proportional scroll position', {expected,middle});
      await page.locator(viewport).evaluate(v => { v.scrollTop = v.scrollHeight - v.clientHeight; });
      await page.waitForTimeout(90);
      const end = await state(page, viewport);
      check(end.thumbOffset > middle.thumbOffset + 5,
        width + ': scroll thumb reaches bottom', {middle,end});
      await page.locator(viewport).evaluate(v=>{v.scrollTop=0;});
      await page.waitForTimeout(90);
      const back = await state(page, viewport);
      check(Math.abs(back.thumbOffset - start.thumbOffset) < 2,
        width + ': scroll thumb returns to top', {start,back});
      const root = await page.locator('.content-main').boundingBox();
      if (root) {
        await page.mouse.move(root.x + root.width - 7, root.y + Math.min(root.height / 3, 85));
        await page.waitForTimeout(80);
        const active = await state(page, viewport);
        check(active.pointerEvents === 'auto' && active.opacity > 0,
          width + ': scrollbar is accessible to pointer while hovered', active);
        const thumbBox = await page.locator('.content-main > .scroll-view__thumb').boundingBox();
        if (thumbBox) {
          const x = thumbBox.x + thumbBox.width / 2;
          const y = thumbBox.y + Math.min(16, thumbBox.height / 2);
          const travel = Math.max(10, Math.min(54, start.height - 16 - thumbBox.height - 10));
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x, y + travel, {steps:5});
          await page.mouse.up();
          await page.waitForTimeout(90);
          const moved = await state(page, viewport);
          check(moved.top > 10 && moved.thumbOffset > start.thumbOffset + 5,
            width + ': dragging scrollbar thumb scrolls content', {start,moved});
        }
      }
    }
    await page.close();
  }
  // The V4 pressure landscape is a fully operable CSS grid instead of an
  // overflowing data table. It must remain inside the workspace on mobile.
  const page = await browser.newPage({viewport: {width:375,height:812}});
  await page.goto(base + '/tools/max-pressure', {waitUntil:'networkidle'});
  const field = page.locator('.pressure-map-grid');
  const grid = await field.evaluate(el => ({
    columns:getComputedStyle(el).gridTemplateColumns.split(' ').length,
    width:el.getBoundingClientRect().width,
    viewportWidth:innerWidth,
    docWidth:document.documentElement.scrollWidth,
  }));
  check(grid.columns===6 && grid.docWidth<=grid.viewportWidth+1,
    'pressure: mobile 5-column landscape replaces overflowing horizontal table',grid);
  check(await page.locator('.pressure-map-cell:visible').count()===25,
    'pressure: 25 mobile cells remain operable without horizontal scrolling');
  await page.close();
  // The progress tracker's measurement log must use the same horizontal
  // ScrollView instead of a second, browser-native scrollbar.
  const tracker = await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
  await tracker.goto(base + '/tools/decarb-tracker',{waitUntil:'networkidle'});
  await tracker.getByRole('button',{name:'Start recording'}).click();
  await tracker.locator('#tracker-measurement').fill('32');
  // Mimic a user's upward swipe: mobile input focus can scroll the field to
  // the bottom edge, leaving the adjacent action beneath the visible fold.
  await tracker.locator('.content-main > .scroll-view__viewport').evaluate(v=>{v.scrollTop+=180;});
  await tracker.getByRole('button',{name:'Record',exact:true}).click();
  await tracker.getByRole('tab',{name:/Log/}).click();
  check(await tracker.locator('.tracker-table-wrap tbody tr').count()===1,
    'tracker: Record is pointer-clickable after scrolling in the workspace');
  const log = '.tracker-table-wrap > .scroll-view__viewport';
  await tracker.locator(log).waitFor();
  await tracker.waitForTimeout(90);
  const logStart = await state(tracker,log);
  check(logStart.scrollWidth > logStart.width + 30 && logStart.thumbOffset !== null,
    'tracker: measurement log uses horizontal ScrollView with a thumb',logStart);
  await tracker.locator(log).evaluate(v=>{v.scrollLeft=v.scrollWidth-v.clientWidth;});
  await tracker.waitForTimeout(120);
  const logEnd = await state(tracker,log);
  check(logEnd.left > 30 && logEnd.thumbOffset > (logStart.thumbOffset ?? 0) + 5,
    'tracker: measurement log thumb tracks horizontal scrolling',{logStart,logEnd});
  const logWidth = await tracker.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  check(logWidth<=1,'tracker: horizontal table never expands document width',logWidth);
  tracker.once('dialog',async dialog=>dialog.accept());
  await tracker.getByRole('button',{name:'Remove reading 1'}).click();
  check(await tracker.locator('.tracker-table-wrap').count()===0,
    'tracker: scroller does not interfere with row actions');
  await tracker.close();
} finally {
  await browser.close();
  await snapshot?.close();
}
console.log('ScrollView position regression: '+(checks-failures)+'/'+checks+' passed');
if (failures) process.exit(1);
