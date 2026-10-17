import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** No typographic em dashes in authored app copy, assets, tests, or docs. */
const distOnly = process.argv.includes('--dist');
const roots = distOnly ? ['dist/client', 'dist/server'] : ['.'];
const ignored = new Set(['.git', '.idea', '.tanstack', 'node_modules', 'dist', 'artifacts']);
const textExtensions = /\.(?:ts|tsx|js|mjs|css|html|svg|md|json|txt|xml|webmanifest)$/;
const char = String.fromCodePoint(0x2014);
const escaped = String.fromCharCode(92) + 'u' + '2014';
const entities = ['&' + 'mdash;', '&#' + '8212;', '&#' + 'x2014;'];
let checked = 0;
const violations = [];

function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { inspect(path); continue; }
    if (!entry.isFile() || !textExtensions.test(entry.name)) continue;
    const content = readFileSync(path, 'utf8');
    checked++;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if ([char, escaped, ...entities].some(token => lines[i].toLowerCase().includes(token.toLowerCase()))) {
        violations.push(path + ':' + (i + 1));
      }
    }
  }
}
for (const root of roots) inspect(root);
if (violations.length) {
  console.error('Em dashes are forbidden in application text:');
  for (const violation of violations) console.error('  ' + violation);
  process.exitCode = 1;
} else {
  console.log('No em dashes: ' + checked + (distOnly ? ' built output files' : ' authored text files') + ' checked.');
}
