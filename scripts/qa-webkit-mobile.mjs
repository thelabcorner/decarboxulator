import { webkit } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';

// WebKit catches CSS/viewport defects that Chromium's iPhone emulation can miss.
// This does not replace final verification on a physical iPhone.
const snapshot = process.env.SMOKE_URL ? null : await startQASnapshot({snapshotName:'qa-snapshot-webkit'});
const base = process.env.SMOKE_URL || snapshot.base;
const errors = [];
let checks = 0;
const assert = (ok, label, info) => {
  checks++;
  if (!ok) errors.push(label + (info ? ' ' + JSON.stringify(info) : ''));
};
const viewportSizes = [[320,568],[390,844],[667,375],[768,1024],[1440,900]];
let browser;
try {
  browser = await webkit.launch({headless:true});
  for (const [width,height] of viewportSizes) {
    const mobile = width <= 760;
    const page = await browser.newPage({
      viewport:{width,height}, isMobile:mobile, hasTouch:mobile, deviceScaleFactor:mobile?3:1,
      userAgent:mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1' : undefined,
    });
    const browserErrors = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    try {
      await page.goto(base + '/tools/decarb-tracker', {waitUntil:'networkidle'});
      await page.locator('.tracker-save-label[data-state="saved"]').waitFor({timeout:15000});
      const initial = await page.evaluate(() => {
        const rect = selector => {
          const e = document.querySelector(selector);
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};
        };
        return {shell:rect('.app-shell'), rail:rect('.studio-rail'),
          stage:rect('.workspace-stage'), scrollY, docWidth:document.documentElement.scrollWidth,
          innerWidth, innerHeight, install:!!document.querySelector('.install-dialog'),
          overflow:getComputedStyle(document.querySelector('.content-main > .scroll-view__viewport')).overflowY};
      });
      assert(initial.stage && initial.rail && initial.stage.left >= initial.rail.right-1, width+': rail/stage separation',initial);
      assert(initial.shell && Math.abs(initial.shell.bottom-initial.shell.top-height)<3 &&
        initial.docWidth <= initial.innerWidth+1 && initial.scrollY===0, width+': no page overflow',initial);
      assert(initial.overflow==='auto',width+': native ScrollView viewport');
      assert(!initial.install,width+': install guide requires click');
      if (mobile) {
        const bodyHeight=await page.locator('.content-main').evaluate(el=>el.getBoundingClientRect().height);
        await page.getByRole('tab',{name:'Setup'}).click();
        // The setup supports manual-mass and assay-percentage modes.
        // Choose the former deliberately before testing focus geometry.
        await page.getByRole('button',{name:'Masses',exact:true}).click();
        await page.locator('#tracker-thca').focus();
        const focusedHeight=await page.locator('.content-main').evaluate(el=>el.getBoundingClientRect().height);
        await page.locator('#tracker-thca').evaluate(el=>el.blur());
        const blurred=await page.evaluate(()=>({
          bodyHeight:document.querySelector('.content-main').getBoundingClientRect().height,
          footer:getComputedStyle(document.querySelector('.studio-statusbar')).display
        }));
        assert(blurred.footer==='none' && Math.abs(bodyHeight-focusedHeight)<2 &&
          Math.abs(bodyHeight-blurred.bodyHeight)<2,width+': focus never shifts mobile footer geometry',
          {bodyHeight,focusedHeight,blurred});
        await page.getByRole('button',{name:'Start recording'}).click();
        await page.locator('#tracker-measurement').fill('32');
        await page.locator('.content-main > .scroll-view__viewport').evaluate(el=>{el.scrollTop+=180;});
        await page.getByRole('button',{name:'Record',exact:true}).click();
        await page.getByRole('tab',{name:/Log/}).click();
        assert(await page.locator('.tracker-table-wrap > .scroll-view__viewport').count()===1,
          width+': real WebKit tap records measurement and reveals ScrollView');
      }
      await page.getByRole('button',{name:'Search calculators'}).last().click();
      const search = page.getByRole('dialog',{name:'Find a calculator'});
      await search.waitFor();
      const geometry = await page.evaluate(() => {
        const rect = selector => {const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
        return {dialog:rect('.tool-search-dialog'),stage:rect('.workspace-stage'),
          toolbar:rect('.workspace-toolbar'),body:rect('.content-main'),
          overflow:getComputedStyle(document.querySelector('.tool-search-results > .scroll-view__viewport')).overflowY,
          fontSize:parseFloat(getComputedStyle(document.querySelector('.tool-search-input-row input')).fontSize)};
      });
      assert(geometry.dialog.left>=geometry.stage.left-2 && geometry.dialog.right<=geometry.stage.right+2 &&
        geometry.dialog.top>=geometry.toolbar.bottom-2 && geometry.dialog.bottom<=geometry.body.bottom+2,
        width+': search strictly inside body',geometry);
      assert(geometry.overflow==='auto',width+': results ScrollView');
      if (mobile) {
        assert(geometry.fontSize>=16,width+': no iOS input magnification',geometry);
        // Emulate the keyboard reducing visualViewport.height. Desktop WebKit
        // does not display a real software keyboard during automation.
        const keyboard = await page.evaluate(() => {
          const stage=document.querySelector('.workspace-stage');
          const inset=Math.max(120,stage.clientHeight-260);
          stage.style.setProperty('--dialog-visual-bottom-inset',inset+'px');
          const dialog=document.querySelector('.tool-search-dialog').getBoundingClientRect();
          const layer=document.querySelector('.tool-search-layer').getBoundingClientRect();
          const viewport=document.querySelector('.tool-search-results > .scroll-view__viewport');
          const result={fits:dialog.top>=layer.top-2 && dialog.bottom<=layer.bottom+2,
            resultsScrollable:getComputedStyle(viewport).overflowY==='auto',
            bounds:[dialog.top,dialog.bottom,layer.top,layer.bottom]};
          stage.style.removeProperty('--dialog-visual-bottom-inset');
          return result;
        });
        assert(keyboard.fits && keyboard.resultsScrollable,width+': command palette fits reduced keyboard viewport',keyboard);
      }
      await search.getByRole('searchbox').fill('pressure');
      assert(await search.locator('.tool-search-result').count()===1,width+': filtering');
      await search.getByRole('searchbox').press('ArrowDown');
      assert(await page.evaluate(() => document.activeElement?.classList.contains('tool-search-result')),
        width+': keyboard navigation');
      await search.getByRole('button',{name:'Close search'}).click();
      const railInstall = await page.evaluate(() => {
        const node = document.querySelector('button[aria-label="Install Decarboxulator app"]');
        const box = node?.getBoundingClientRect();
        const x = box && (box.left+box.right)/2;
        const y = box && (box.top+box.bottom)/2;
        const target = x != null && y != null ? document.elementFromPoint(x,y) : null;
        return {
          box:box&&{x:box.x,y:box.y,width:box.width,height:box.height},
          hittable:!!node&&!!target&&node.contains(target),
          hidden:node?getComputedStyle(node).visibility:null,
          stableHeight:document.documentElement.clientHeight,
        };
      });
      assert(railInstall.hittable && railInstall.hidden==='visible',
        width+': rail install control remains the topmost pointer target',railInstall);
      await page.getByRole('button',{name:'Install Decarboxulator app'}).click({timeout:12000});
      const install=page.getByRole('dialog',{name:/Install the app|Already installed/});
      await install.waitFor();
      const installFit=await page.evaluate(()=>{
        const r=s=>document.querySelector(s).getBoundingClientRect();
        const d=r('.install-dialog'),s=r('.workspace-stage'),t=r('.workspace-toolbar'),b=r('.content-main');
        return {fit:d.left>=s.left-2&&d.right<=s.right+2&&d.top>=t.bottom-2&&d.bottom<=b.bottom+2,
          dialog:[d.left,d.right,d.top,d.bottom],stage:[s.left,s.right,t.bottom,b.bottom]};
      });
      assert(installFit.fit,width+': install strictly inside body',installFit);
      if(mobile) assert((await install.innerText()).includes('Tap the Share button'),width+': Safari install guide');
      await install.getByRole('button',{name:'Close install guide'}).last().click();
      assert(await install.count()===0,width+': closed installer');
      assert(!browserErrors.length,width+': zero JS errors',browserErrors);
    } catch(error) { errors.push(width+': '+error.message); }
    finally {await page.close();}
  }
} finally {
  await browser?.close();
  await snapshot?.close();
}
console.log('WebKit mobile/desktop QA: '+(checks-errors.length)+'/'+checks+' checks passed.');
for(const error of errors) console.error('FAIL',error);
if(errors.length) process.exitCode=1;
