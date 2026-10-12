import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { getOgPages } from './og-registry.mjs';

/**
 * Generate an atomic, versioned offline shell from the actual prerender output.
 * Keep this independent of Vite internals and deployment origin: the worker
 * resolves every path against its own registration scope (/, /decarboxulator/, etc).
 */
const root = join(process.cwd(), 'dist', 'client');
if (!existsSync(join(root, 'index.html'))) throw new Error('Build the prerendered site before generating offline assets');

// Give each deployment a stable, origin-specific PWA identity. Historically the
// computed app ID came from the start_url (with no query string). Preserve that
// identity as start_url gains its own launch marker. Chromium can then check
// this exact installed PWA via getInstalledRelatedApps on supported platforms.
const deployment = new URL(process.env.VITE_SITE_URL || 'https://dcxr.thedabcorner.site/');
const manifestPath = join(root, 'site.webmanifest');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.id = deployment.pathname;
// Keep both current and pre-migration manifest URLs discoverable. Chrome's
// identity-aware related-app check can match either existing installation.
manifest.related_applications = [
  { platform: 'webapp', url: './site.webmanifest?v=pwa-identity-2', id: deployment.href },
  { platform: 'webapp', url: './site.webmanifest?v=lime-chrome-1', id: deployment.href },
];
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

function walk(directory, files = []) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, item.name);
    if (item.isDirectory()) walk(full, files);
    else if (item.isFile()) files.push(relative(root, full).split(sep).join('/'));
  }
  return files;
}

const output = walk(root).sort();
// Legacy redirect pages are intentionally excluded: they are historical
// navigation shims, not offline-capable calculator documents. Precache only
// canonical application pages, consistently with SEO's route inventory.
const pages = output.filter(file => file.endsWith('index.html') && !file.startsWith('pages/'));
const routes = pages.map(file => file.slice(0, -'index.html'.length));
const assets = output.filter(file => {
  if (file.endsWith('index.html') || file === 'sw.js') return false;
  // OG images are search/social resources, not required for calculation offline.
  if (file === 'og-image.png' || file.startsWith('og/') || file === 'og-card.svg') return false;
  return /\.(?:js|css|woff2?|png|svg|webmanifest|ico)$/i.test(file);
});
const expectedRoutes = getOgPages().map(page => page.path === '/' ? '' : page.path.slice(1) + '/');
if (routes.length !== expectedRoutes.length || expectedRoutes.some(route => !routes.includes(route))) {
  throw new Error('Prerendered offline routes must match the Satori route registry exactly. Missing: ' +
    expectedRoutes.filter(route => !routes.includes(route)).join(', '));
}

const precache = [...new Set([...routes, ...assets])];
const digest = createHash('sha256');
for (const file of [...pages, ...assets].sort()) {
  digest.update(file);
  digest.update('\0');
  digest.update(readFileSync(join(root, file)));
}
const version = digest.digest('hex').slice(0, 20);
const worker = [
  '/* Generated build artifact; edit scripts/generate-offline.mjs, not sw.js. */',
  "'use strict';",
  'const VERSION = ' + JSON.stringify(version) + ';',
  'const PREFIX = "decarboxulator:offline:" + encodeURIComponent(new URL(self.registration.scope).pathname) + ":";',
  'const CACHE = PREFIX + VERSION;',
  'const ROUTES = ' + JSON.stringify(routes) + ';',
  'const FILES = ' + JSON.stringify(precache) + ';',
  'const scope = new URL(self.registration.scope);',
  'const scopedURL = path => new URL(path, scope).href;',
  'const routePaths = new Set(ROUTES.map(route => new URL(route, scope).pathname));',
  'const assetPaths = new Set(FILES.map(file => new URL(file, scope).pathname));',
  '',
  'self.addEventListener("install", event => {',
  '  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(scopedURL))));',
  '});',
  '',
  'self.addEventListener("activate", event => {',
  '  event.waitUntil((async () => {',
  '    const names = await caches.keys();',
  '    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));',
  '    await self.clients.claim();',
  '  })());',
  '});',
  '',
  'self.addEventListener("fetch", event => {',
  '  if (event.request.method !== "GET") return;',
  '  const url = new URL(event.request.url);',
  '  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;',
  '  let key;',
  '  if (event.request.mode === "navigate") {',
  '    // URL snapshots are path-canonical: query values must never become cache keys.',
  '    const path = routePaths.has(url.pathname) ? url.pathname : url.pathname + "/";',
  '    if (!routePaths.has(path)) return; // Unknown routes retain their real 404 semantics.',
  '    key = new URL(path, scope.origin).href;',
  '  } else {',
  '    if (!assetPaths.has(url.pathname)) return;',
  '    key = new URL(url.pathname, scope.origin).href;',
  '  }',
  '  // An immutable build shell avoids stale HTML referring to uncached, newly deployed chunks.',
  '  // A future worker precaches its entire replacement before taking control.',
  '  event.respondWith(caches.open(CACHE).then(cache =>',
  '    cache.match(key, {ignoreSearch: true}).then(response => response || fetch(event.request))',
  '  ));',
  '});',
  '',
].join('\n');
writeFileSync(join(root, 'sw.js'), worker);
console.log('Offline shell ' + version + ': ' + routes.length + ' prerendered routes, ' + assets.length + ' bundled assets.');
