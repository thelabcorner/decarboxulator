import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const base = join(process.cwd(), 'dist', 'client');
const siteUrl = (process.env.VITE_SITE_URL || 'https://dcxr.thedabcorner.site/').replace(/\/?$/, '/');

function collectPages(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !(directory === base && entry.name === 'pages')) collectPages(join(directory, entry.name), files);
    else if (entry.name === 'index.html') files.push(join(directory, entry.name));
  }
  return files;
}

const escapeXml = value => value.replace(/[<>&"']/g, character => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
})[character]);

if (!existsSync(join(base, 'index.html'))) {
  throw new Error('SEO build is missing the prerendered root index.html');
}
const routeFiles = collectPages(base).sort();
const seen = new Set();

const canonicals = routeFiles.map(path => {
  const file = relative(base, path).split(sep).join('/');
  const route = file.replace(/index\.html$/, '');
  const expected = new URL(route, siteUrl).toString();
  const html = readFileSync(path, 'utf8');
  const values = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)];
  if (values.length !== 1 || values[0][1] !== expected) {
    throw new Error(`Canonical mismatch in ${file}: expected ${expected}, found ${values.map(item => item[1]).join(', ') || 'none'}`);
  }
  if (seen.has(expected)) throw new Error(`Duplicate canonical: ${expected}`);
  seen.add(expected);
  if (!/<h1\b[^>]*>/i.test(html)) throw new Error(`Prerendered ${file} has no static H1`);
  if (!/<meta\b[^>]*name="description"/i.test(html)) throw new Error(`Prerendered ${file} has no description`);
  return expected;
});

const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  canonicals.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n') +
  '\n</urlset>\n';
writeFileSync(join(base, 'sitemap.xml'), sitemap);
// Preserve the sitemap URL published in V3 and potentially registered in
// Search Console. Both locations must advertise the SAME current canonicals,
// never stale historical routes.
const historicalSitemap = join(base, 'resources', 'assets', 'sitemap.xml');
mkdirSync(join(base, 'resources', 'assets'), { recursive: true });
writeFileSync(historicalSitemap, sitemap);
writeFileSync(join(base, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`);
console.log(`Generated sitemap and robots from ${canonicals.length} distinct, prerendered routes.`);
