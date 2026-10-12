/**
 * Build-time crawl of every SSR page's real internal anchors.
 *
 * GitHub Pages is a path-mounted static host: the browser's root URL is NOT the
 * app mount. This check catches links that navigate outside /decarboxulator/
 * as well as dangling calculator links before an SEO-critical deployment.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/client/', import.meta.url));
const site = new URL((process.env.VITE_SITE_URL || 'https://dcxr.thedabcorner.site/').replace(/\/?$/, '/'));
const mount = site.pathname;
const failures = [];
let pageCount = 0;
let internalLinks = 0;
let externalLinks = 0;

function collect(dir, items = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // Legacy redirect pages are validated separately; they are not crawlable
    // destination pages and should never appear in the canonical sitemap.
    if (dir === root && entry.name === 'pages') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collect(full, items);
    else if (entry.name === 'index.html') items.push(full);
  }
  return items;
}
function decodeAttribute(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#39);/g, entity =>
    ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&lt;': '<', '&gt;': '>' })[entity]
  );
}
const hasFile = path => {
  const clean = path.replace(/\/+$/, '');
  const literal = join(root, clean);
  return existsSync(join(literal, 'index.html')) ||
    (existsSync(literal) && statSync(literal).isFile());
};
for (const file of collect(root)) {
  const path = relative(root, file).split(sep).join('/').replace(/index\.html$/, '');
  const html = readFileSync(file, 'utf8');
  const page = new URL(path, site);
  pageCount++;
  for (const anchor of html.matchAll(/<a\b([^>]*)>/gi)) {
    const href = anchor[1].match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!href || href.startsWith('#') || /^(mailto:|tel:|sms:)/i.test(href)) continue;
    if (/^(javascript:|data:)/i.test(href)) {
      failures.push(`${path || '/'}: unsafe link ${href.slice(0, 80)}`);
      continue;
    }
    let url;
    try { url = new URL(decodeAttribute(href), page); }
    catch { failures.push(`${path || '/'}: invalid URL ${href.slice(0, 80)}`); continue; }
    if (url.origin !== site.origin) { externalLinks++; continue; }
    internalLinks++;
    if (!url.pathname.startsWith(mount)) {
      failures.push(`${path || '/'}: out-of-mount link ${url.pathname} (expected ${mount})`);
      continue;
    }
    const destination = decodeURIComponent(url.pathname.slice(mount.length));
    if (!hasFile(destination)) {
      failures.push(`${path || '/'}: nonexistent internal link ${url.pathname}`);
    }
  }
}
if (failures.length) {
  for (const error of failures) console.error('FAIL', error);
  throw new Error(`Internal SEO crawl found ${failures.length} broken links`);
}
console.log(`Internal SEO crawl passed: ${pageCount} HTML pages, ${internalLinks} internal and ${externalLinks} external links.`);
