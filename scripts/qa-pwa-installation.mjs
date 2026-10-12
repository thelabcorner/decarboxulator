import { chromium, webkit } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';

// Actual standalone mode is not emulatable on desktop. navigator.standalone
// faithfully models the iOS signal responsible for this cross-PWA regression.
const snapshot = process.env.SMOKE_URL ? null : await startQASnapshot({snapshotName:'qa-snapshot-pwa-identity'});
const base = process.env.SMOKE_URL || snapshot.base;
const failures = [];
let checks = 0;
const verify = (ok, label, detail) => {
  checks++;
  if (!ok) failures.push(label + (detail ? ' ' + JSON.stringify(detail) : ''));
};
const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1';

for (const [label, engine] of [['Chromium',chromium],['WebKit',webkit]]) {
  let browser;
  try {
    browser = await engine.launch(label === 'Chromium' ? {headless:true,channel:'chrome'} : {headless:true});
    for (const scenario of ['forum', 'own', 'browser', 'foreign-related', 'own-related']) {
      const context = await browser.newContext({ userAgent: iphoneUA });
      await context.addInitScript(({scenario}) => {
        if (scenario !== 'browser') Object.defineProperty(navigator, 'standalone', {
          configurable: true, get() { return true; }
        });
        if (scenario === 'foreign-related' || scenario === 'own-related')
          Object.defineProperty(navigator, 'getInstalledRelatedApps', {
            configurable: true, value: async () => [{
              platform: 'webapp',
              id: scenario === 'own-related' ? location.origin + '/' : 'https://forum.example/'
            }]
          });
      }, {scenario});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      try {
        await page.goto(base + (scenario === 'own' || scenario === 'browser' ? '/?dcxr_launch=studio-v4' : '/'), {waitUntil:'networkidle'});
        await page.getByRole('button',{name:'Install Decarboxulator app'}).click();
        const dialog = page.locator('.install-dialog');
        await dialog.waitFor();
        const title = await dialog.locator('#install-heading').innerText();
        const body = await dialog.innerText();
        const installed = scenario === 'own' || scenario === 'own-related';
        verify(title === (installed ? 'Already installed' : 'Install the app'), label+' '+scenario+' state', title);
        if (scenario === 'forum' || scenario === 'foreign-related') {
          verify(body.includes('This window may belong to another installed app'), label+' '+scenario+' app-window warning',body);
          verify(body.includes('Copy page link') && body.includes('Open Safari directly'),label+' '+scenario+' browser handoff',body);
        }
        if (scenario === 'own') {
          verify(body.includes('running in its own installed app window'),label+' own launch confirmed',body);
          await page.goto(base+'/faq/',{waitUntil:'networkidle'});
          await page.getByRole('button',{name:'Install Decarboxulator app'}).click();
          verify((await page.locator('#install-heading').innerText())==='Already installed',label+' tab-scoped own-app continuity');
        }
        if (scenario === 'browser') verify(body.includes('Tap the Share button'),label+' browser remains installable',body);
        if (scenario === 'own-related') verify(body.includes('installed on this device'),label+' exact matching app ID',body);
        verify(errors.length===0,label+' '+scenario+' runtime errors',errors);
      } catch(error) {
        failures.push(label+' '+scenario+': '+error.message);
      } finally {await context.close();}
    }
  } catch(error) { failures.push(label+' browser launch: '+error.message); }
  finally {await browser?.close();}
}
await snapshot?.close();
console.log('PWA identity browser QA: '+checks+' assertions, '+failures.length+' failures.');
for (const failure of failures) console.error('FAIL',failure);
if (failures.length) process.exitCode=1;
