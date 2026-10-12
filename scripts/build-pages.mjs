import { execFileSync } from 'node:child_process';

const env = {
  ...process.env,
  VITE_BASE_PATH: '/decarboxulator/',
  VITE_SITE_URL: 'https://thelabcorner.github.io/decarboxulator/',
};
execFileSync(process.execPath, ['scripts/render-assets.mjs'], {env,stdio:'inherit'});
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js','build'], {env,stdio:'inherit'});
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc','-b'], {env,stdio:'inherit'});
execFileSync(process.execPath, ['scripts/generate-legacy-redirects.mjs'], {env,stdio:'inherit'});
execFileSync(process.execPath, ['scripts/generate-seo.mjs'], {env,stdio:'inherit'});
execFileSync(process.execPath, ['scripts/generate-offline.mjs'], {env,stdio:'inherit'});
execFileSync(process.execPath, ['scripts/verify-seo.mjs'], {env,stdio:'inherit'});
execFileSync(process.execPath, ['scripts/verify-seo-links.mjs'], {env,stdio:'inherit'});
execFileSync(process.execPath, ['scripts/verify-faq-parity.mjs'], {env,stdio:'inherit'});
