import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Only the intentionally isolated GitHub Pages preview is network-first.
// The actual product retains its content-addressed offline application shell.
if (process.env.VITE_PREVIEW_MODE !== 'true') {
  throw new Error('Refusing to prepare a non-preview deployment.');
}
const output=join('dist','client','sw.js');
if (!existsSync(output)) throw new Error('Expected compiled service worker after npm run build.');

// Replace the previously deployed cache-first service worker with a migration
// worker. Existing preview installations receive this update, including when
// they are controlled by an older offline worker. It claims waiting clients,
// removes only this preview scope's cache namespace, then unregisters itself.
// New preview builds no longer register a service worker at all.
const code=[
  "'use strict';",
  'self.addEventListener("install", event => {',
  '  event.waitUntil(self.skipWaiting());',
  '});',
  'self.addEventListener("activate", event => {',
  '  event.waitUntil((async () => {',
  '    const prefix = "decarboxulator:offline:" + encodeURIComponent(new URL(self.registration.scope).pathname) + ":";',
  '    const names = await caches.keys();',
  '    await Promise.all(names.filter(name => name.startsWith(prefix)).map(name => caches.delete(name)));',
  '    await self.clients.claim();',
  '    await self.registration.unregister();',
  '  })());',
  '});',
  '',
].join('\n');
writeFileSync(output,code,'utf8');
console.log('Preview migration worker: cleared scope-specific offline caches; future visits use network assets.');
