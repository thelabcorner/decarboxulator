import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Separate release target: never reuse the historical GitHub Pages mount for Cloudflare.
const env = {
  ...process.env,
  VITE_BASE_PATH: '/',
  VITE_SITE_URL: 'https://dcxr.thedabcorner.site/',
};
const run = (args) => execFileSync(process.execPath, args, { env, stdio: 'inherit' });
run(['scripts/render-assets.mjs']);
run(['node_modules/vite/bin/vite.js', 'build']);
run(['node_modules/typescript/bin/tsc', '-b']);
run(['scripts/generate-legacy-redirects.mjs']);
run(['scripts/generate-seo.mjs']);
run(['scripts/generate-offline.mjs']);
run(['scripts/verify-seo.mjs']);
run(['scripts/verify-seo-links.mjs']);
run(['scripts/verify-faq-parity.mjs']);

const output = join(process.cwd(), 'dist', 'client');
const legacy = JSON.parse(readFileSync(new URL('./legacy-redirects.json', import.meta.url), 'utf8'));
const lines = [
  '# Cloudflare Pages root-domain migration; maintain exact legacy URL equivalence.',
  '# No /tools catch-all: prerendered calculator pages must remain HTTP 200.',
  '# Conversion endpoint preserves #backward via its HTML JavaScript redirect.',
];
const seen = new Set();
const add = (source, destination) => {
  if (seen.has(source)) throw new Error('Duplicate redirect source: ' + source);
  seen.add(source);
  lines.push(`${source} ${destination} 301`);
};
for (const { legacy: path, target, reverseHash } of legacy) {
  // URI fragments are not sent to the server. Keep conversion hash handling on the
  // prerendered fallback page so #backward continues to mean THC -> THCa.
  if (reverseHash) continue;
  add('/' + path, target);
  if (!path.endsWith('/index.html')) {
    add('/' + path.replace(/\.html$/, ''), target);
    add('/' + path.replace(/\.html$/, '/'), target);
  }
}
writeFileSync(join(output, '_redirects'), lines.join('\n') + '\n');
const rootHtml = readFileSync(join(output, 'index.html'), 'utf8');
if (!rootHtml.includes('https://dcxr.thedabcorner.site/') ||
    rootHtml.includes('https://thelabcorner.github.io/decarboxulator/')) {
  throw new Error('Cloudflare HTML contains an incorrect canonical URL');
}
for (const required of ['tools/thca-to-thc/index.html','faq/index.html','og/faq.png','sitemap.xml']) {
  if (!existsSync(join(output,required))) throw new Error('Missing deployment asset: '+required);
}
console.log(`Cloudflare Pages release prepared: ${seen.size} server-side redirects, canonical hostname dcxr.thedabcorner.site.`);
