import { chromium } from '@playwright/test';
const base=process.env.SMOKE_URL||'http://127.0.0.1:43291';
const browser=await chromium.launch({channel:'chrome',headless:true});
let passed=0;
function check(ok,label,details) {
  if(!ok)throw new Error(label+': '+JSON.stringify(details));
  passed++;console.log('PASS '+label);
}
try {
  for(const width of [320,375,390,768,1440]) {
    const page=await browser.newPage({viewport:{width,height:width<=390?760:900},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/tools/decarb-tracker/',{waitUntil:'networkidle'});
    await page.locator('.tracker-save-label[data-state="saved"]').waitFor({timeout:15000});
    const monitor=page.getByRole('tabpanel',{name:'Monitor'});
    check(await monitor.isVisible(),width+' monitor is the default workspace');
    if(width===390) await page.screenshot({path:'artifacts/tracker-studio-monitor.png'});
    check(await page.getByRole('tab').count()===4,width+' four compact navigation tabs');
    const geometry=await page.evaluate(()=>{
      const rail=document.querySelector('.studio-rail')?.getBoundingClientRect();
      const hero=document.querySelector('.tracker-monitor-hero')?.getBoundingClientRect();
      const workspace=document.querySelector('.workspace-stage')?.getBoundingClientRect();
      const nav=document.querySelector('.tracker-mode-bar')?.getBoundingClientRect();
      return {scroll:document.documentElement.scrollWidth,width:innerWidth,railRight:rail?.right,
        heroLeft:hero?.left,heroRight:hero?.right,workspaceRight:workspace?.right,navWidth:nav?.width};
    });
    check(geometry.scroll<=width+1&&geometry.heroLeft>=geometry.railRight-1&&
      geometry.heroRight<=geometry.workspaceRight+1,
      width+' no horizontal overflow and monitor contained within workspace',geometry);
    check(await page.locator('#tracker-tare').count()===0,width+' baseline form is not forced ahead of monitor');
    await page.getByRole('tab',{name:'Setup'}).click();
    check(await page.locator('#tracker-tare').isVisible(),width+' setup tab reveals editable baseline');
    if(width===390) await page.screenshot({path:'artifacts/tracker-studio-setup.png'});
    check(await page.getByRole('tabpanel',{name:'Monitor'}).count()===0,width+' secondary views replace rather than stack');
    const fields=await page.locator('#tracker-tare').evaluate(el=>({
      inputHeight:el.getBoundingClientRect().height,font:getComputedStyle(el).fontSize,
      boxHeight:el.closest('.number-input')?.getBoundingClientRect().height,
    }));
    check(fields.boxHeight<=42&&fields.boxHeight>=30,width+' compact lab input height',fields);
    if(width<=390) check(Number.parseFloat(fields.font)>=16,width+' 16px mobile input prevents iOS zoom',fields);
    await page.getByRole('tab',{name:'Monitor'}).click();
    await page.getByRole('button',{name:'Start recording'}).click();
    await page.locator('#tracker-measurement').fill('32.500');
    await page.getByRole('button',{name:'Record',exact:true}).click();
    await page.getByRole('tab',{name:/Log/}).click();
    check(await page.locator('table.readings-table tbody tr').count()===1,width+' measurement saved to timestamped log');
    await page.getByRole('tab',{name:'Analysis'}).click();
    check(await page.getByRole('tabpanel',{name:'Analysis'}).isVisible(),width+' analysis chart accessible');
    await page.getByRole('tab',{name:'Monitor'}).click();
    check((await page.locator('.tracker-hero-number').innerText()).includes('14.54'),
      width+' live readout responds to measured loss');
    await page.reload({waitUntil:'networkidle'});
    check(await page.locator('.tracker-hero-number').innerText() !== '—',width+' IndexedDB reading survives reload');
    check(errors.length===0,width+' no client JS errors',errors);
    await page.close();
  }
}finally {await browser.close();}
console.log('Tracker mobile studio QA passed: '+passed+' checks.');
