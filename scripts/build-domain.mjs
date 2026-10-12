import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

// Custom-domain GitHub Pages releases are mounted at '/', NOT /decarboxulator/.
const hostname='dcxr.thedabcorner.site';
const env={...process.env,VITE_BASE_PATH:'/',VITE_SITE_URL:'https://'+hostname+'/'};
for(const args of [
  ['scripts/render-assets.mjs'],
  ['node_modules/vite/bin/vite.js','build'],
  ['node_modules/typescript/bin/tsc','-b'],
  ['scripts/generate-legacy-redirects.mjs'],
  ['scripts/generate-seo.mjs'],
  ['scripts/generate-offline.mjs'],
  ['scripts/verify-seo.mjs'],
  ['scripts/verify-seo-links.mjs'],
  ['scripts/verify-faq-parity.mjs'],
])execFileSync(process.execPath,args,{env,stdio:'inherit'});
const dist=join(process.cwd(),'dist','client');
if(!existsSync(join(dist,'index.html')))throw new Error('Missing prerendered application shell');
const html=readFileSync(join(dist,'index.html'),'utf8');
if(!html.includes('https://'+hostname+'/')||html.includes('thelabcorner.github.io/decarboxulator'))
  throw new Error('Custom domain canonical build is contaminated by the old project path');
writeFileSync(join(dist,'CNAME'),hostname+'\n');
console.log('Prepared custom-domain GitHub Pages artifact for '+hostname+'.');
