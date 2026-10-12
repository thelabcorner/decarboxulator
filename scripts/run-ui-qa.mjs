import { spawn } from 'node:child_process';
import { startQASnapshot } from './qa-snapshot-server.mjs';

/**
 * Run browser QA against a frozen production build so parallel HMR/builds
 * cannot mix different content-hashed client chunks.
 */
const snapshot = process.env.SMOKE_URL ? null : await startQASnapshot({ snapshotName: 'qa-snapshot-ui-' + process.pid });
const base = process.env.SMOKE_URL || snapshot.base;

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      stdio: 'inherit',
      env: { ...process.env, SMOKE_URL: base },
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) =>
      code === 0 ? resolve() : reject(new Error(script + ' failed (' + (signal || code) + ')')));
  });
}

try {
  await run('scripts/smoke-ui.mjs');
  await run('scripts/qa-command-install.mjs');
  await run('scripts/qa-mobile-viewport.mjs');
  await run('scripts/qa-scrollview.mjs');
  await run('scripts/qa-version-badges.mjs');
  await run('scripts/qa-webkit-mobile.mjs');
  await run('scripts/qa-compact-select.mjs');
  await run('scripts/qa-calculator-studio.mjs');
  await run('scripts/qa-tracker-backup.mjs');
  await run('scripts/qa-tracker-studio.mjs');
  console.log('Production-snapshot Chromium/WebKit responsive, command, installation, mobile, and scrolling QA passed.');
} finally {
  await snapshot?.close();
}
