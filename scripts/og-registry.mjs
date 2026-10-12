/**
 * One filesystem-backed source of truth for social preview routes.
 * Curated content lives in og-pages.json. New static routes receive a
 * usable fallback automatically; old manifest entries fail fast.
 *
 * No runtime server, external image API, AI imagery, or client-side capture.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../src/routes/', import.meta.url));
const OVERRIDES = JSON.parse(readFileSync(new URL('./og-pages.json', import.meta.url), 'utf8'));

function discover(dir = ROOT, paths = new Set()) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      discover(full, paths);
      continue;
    }
    if (!entry.name.endsWith('.tsx') || entry.name.startsWith('__')) continue;
    const source = readFileSync(full, 'utf8');
    const match = source.match(/createFileRoute\(\s*['"]([^'"]+)['"]\s*\)/);
    if (!match) continue;
    const path = match[1].replace(/\/+$/, '') || '/';
    if (path.includes('$') || path.includes('*')) {
      throw new Error('Dynamic social preview route needs an explicit finite path inventory: ' + path);
    }
    if (paths.has(path)) throw new Error('Duplicate social preview route: ' + path);
    paths.add(path);
  }
  return paths;
}

function humanize(path) {
  return path.split('/').filter(Boolean).at(-1)
    .split('-').map(part => part === 'thca' ? 'THCa' :
      part === 'thc' ? 'THC' : part === 'co2' ? 'CO2' :
      part[0].toUpperCase() + part.slice(1)).join(' ');
}

function fallback(path) {
  const isTool = path.startsWith('/tools/');
  const name = humanize(path);
  return {
    path,
    section: isTool ? 'Calculator / Workbench' : 'Reference / Knowledge base',
    title: [name, isTool ? 'calculator' : 'reference'],
    description: isTool
      ? 'Explore ' + name + ' in the Decarboxulator calculation studio.'
      : 'Explore scientific background, methods, assumptions and supporting references.',
    value: 'v4',
    valueLabel: 'DECARBOXULATOR STUDIO',
    input: isTool ? 'Input parameters' : 'Research questions',
    output: isTool ? 'Calculation results' : 'Evidence-based reference',
    detail: 'MODEL / REFERENCE',
  };
}

export function getOgPages() {
  const known = discover();
  const seen = new Set();
  for (const page of OVERRIDES) {
    if (seen.has(page.path)) throw new Error('Duplicate curated OG path: ' + page.path);
    seen.add(page.path);
    if (!known.has(page.path)) throw new Error('Orphan OG content (no matching route): ' + page.path);
    if (!Array.isArray(page.title) || !page.title.length || !page.title.every(Boolean)) {
      throw new Error('OG title lines missing: ' + page.path);
    }
  }
  const pages = OVERRIDES.concat([...known].filter(path => !seen.has(path))
    .sort().map(fallback));
  if (!pages.some(page => page.path === '/')) throw new Error('Missing landing page in OG registry');
  return pages;
}
