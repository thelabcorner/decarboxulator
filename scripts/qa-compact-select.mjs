import { chromium, webkit } from '@playwright/test';

let browser;
for (const channel of ['chrome', 'msedge']) {
  try { browser = await chromium.launch({headless:true, channel}); break; }
  catch { /* Try the other installed desktop Chromium. */ }
}
if (!browser) throw new Error('Chrome or Edge is required for studio select-menu QA.');
const base = process.env.SMOKE_URL || 'http://127.0.0.1:42061';
const widths = [320, 375, 768, 1440];
let checks = 0;

async function visibleMenu(page, name) {
  const m = page.getByRole('menu', {name});
  await m.waitFor({state:'visible'});
  const {rect, viewport, font} = await m.evaluate(el => {
    const r = el.getBoundingClientRect();
    return {rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},
      viewport:{width:window.innerWidth,height:window.innerHeight},
      font:getComputedStyle(el).fontFamily};
  });
  if (rect.left < 0 || rect.right > viewport.width + 1 ||
      rect.top < 0 || rect.bottom > viewport.height + 1)
    throw new Error('Menu is clipped by viewport: ' + JSON.stringify({name,rect,viewport}));
  if (/monospace|consolas|courier/i.test(font)) throw new Error('Monospace menu font: '+font);
  checks++;
  return m;
}
try {
  for (const width of widths) {
    const page = await browser.newPage({viewport:{width,height:width===1440?900:760}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base+'/tools/edible-dosage',{waitUntil:'networkidle'});
    if (await page.locator('select').count()) throw new Error('Native selects remain on edible page');
    const compound = page.locator('#edible-type-0');
    await compound.click();
    let menu = await visibleMenu(page,'Compound');
    await menu.getByRole('menuitemradio',{name:'CBD',exact:true}).click();
    if (!(await compound.innerText()).includes('CBD')) throw new Error('Edible compound choice not persisted');
    checks++;
    await compound.focus();
    await page.keyboard.press('ArrowDown');
    menu = await visibleMenu(page,'Compound');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    if (!(await compound.innerText()).includes('Other')) throw new Error('End+Enter keyboard choice did not commit');
    checks++;
    await compound.click();
    menu = await visibleMenu(page,'Compound');
    await page.keyboard.press('Escape');
    if (await menu.isVisible().catch(()=>false)) throw new Error('Escape did not dismiss menu');
    if (!await compound.evaluate(el=>document.activeElement===el)) throw new Error('Escape did not restore trigger focus');
    checks++;
    await compound.click();
    menu = await visibleMenu(page,'Compound');
    await page.keyboard.press('Tab');
    if (await menu.isVisible().catch(()=>false)) throw new Error('Tab did not dismiss menu');
    if (!await page.locator('#edible-mass-0').evaluate(el=>document.activeElement===el))
      throw new Error('Tab did not proceed to following ingredient input');
    checks++;
    await page.locator('.segmented-control').first().getByRole('button',{name:'Measured mass'}).click();
    const unit = page.locator('#edible-unit-0');
    await unit.click();
    menu = await visibleMenu(page,'Mass unit');
    await menu.getByRole('menuitemradio',{name:'mg',exact:true}).click();
    if (!(await unit.innerText()).includes('mg')) throw new Error('Edible unit choice did not commit');
    checks++;

    await page.goto(base+'/tools/cartridge-formulation',{waitUntil:'networkidle'});
    if (await page.locator('select').count()) throw new Error('Native selects remain on cartridge page');
    const cart = page.locator('#cart-type-0');
    await cart.click();
    menu = await visibleMenu(page,'Compound');
    await menu.getByRole('menuitemradio',{name:'THCa',exact:true}).click();
    if (!(await cart.innerText()).includes('THCa')) throw new Error('Cartridge compound did not commit');
    checks++;

    await page.goto(base+'/tools/batch-yield',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Saved calculations'}).first().click();
    const library = page.getByRole('dialog',{name:'Saved calculations'});
    await library.waitFor({state:'visible'});
    const sort = library.getByRole('button',{name:'Sort calculations'});
    await sort.click();
    menu = await visibleMenu(page,'Sort calculations');
    await menu.getByRole('menuitemradio',{name:'Oldest'}).click();
    if (!(await sort.innerText()).includes('Oldest')) throw new Error('Saved library sort was not committed');
    checks++;
    await sort.click();
    menu = await visibleMenu(page,'Sort calculations');
    await page.keyboard.press('Escape');
    if (!await library.isVisible()) throw new Error('Escape closed parent library instead of select menu');
    checks++;
    await library.getByRole('button',{name:'Filter by calculator'}).click();
    menu = await visibleMenu(page,'Filter by calculator');
    await page.keyboard.press('Escape');
    checks++;
    if (errors.length) throw new Error('Client errors '+JSON.stringify(errors));
    console.log('PASS studio select menus at '+width+'px');
    await page.close();
  }
  console.log('PASS '+checks+' Task-inspired select menu placement and interaction checks');
} finally {
  await browser.close();
}

// iOS Safari uses WebKit. Exercise the portaled menu with touch emulation, not
// only a narrow Chromium viewport (the full WebKit layout suite runs separately).
const ios = await webkit.launch({headless:true});
try {
  for (const width of [320,390]) {
    const page = await ios.newPage({viewport:{width,height:780},isMobile:true,hasTouch:true,
      deviceScaleFactor:3,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1'});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/tools/edible-dosage',{waitUntil:'networkidle'});
    const target=page.locator('#edible-type-0');
    await target.tap();
    const popup=await visibleMenu(page,'Compound');
    await popup.getByRole('menuitemradio',{name:'CBG',exact:true}).tap();
    if (!(await target.innerText()).includes('CBG')) throw new Error('WebKit touch selection failed');
    await target.tap();
    await visibleMenu(page,'Compound');
    await page.keyboard.press('Escape');
    if (!await target.evaluate(el=>document.activeElement===el)) throw new Error('WebKit Escape did not restore trigger focus');
    if (errors.length) throw new Error('WebKit page errors: '+errors.join('; '));
    console.log('PASS WebKit iOS select menus at '+width+'px');
    await page.close();
  }
} finally {await ios.close();}
