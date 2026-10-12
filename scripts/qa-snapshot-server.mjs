import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Snapshot the compiled, prerendered production application before browser QA.
 * Vite HMR and concurrent builds may invalidate hashed chunks while a preview
 * server is alive; a frozen copy makes regressions reproducible.
 */
export async function startQASnapshot({ port = 0, snapshotName = 'qa-snapshot-isolated' } = {}) {
  const source = resolve('dist/client');
  const snapshot = resolve('artifacts', snapshotName);
  if (!existsSync(join(source, 'index.html')) || !existsSync(join(source, 'sw.js'))) {
    throw new Error('A successful npm run build is required before production browser QA.');
  }
  rmSync(snapshot, { recursive: true, force: true });
  mkdirSync(snapshot, { recursive: true });
  cpSync(source, snapshot, { recursive: true, force: true });

  const index = readFileSync(join(snapshot, 'index.html'), 'utf8');
  // A GitHub Pages project build is mounted under /decarboxulator/, while a
  // local root build uses /. Infer the actual mount from immutable prerendered
  // asset URLs instead of assuming either environment.
  const linkedAssets = [...index.matchAll(/(?:src|href)="(\/[^"]*?assets\/[^"]+)"/g)];
  if (!linkedAssets.length) throw new Error('Incomplete snapshot: missing compiled assets');
  const basePath = linkedAssets[0][1].split('/assets/')[0];
  for (const match of linkedAssets) {
    if (match[1].split('/assets/')[0] !== basePath)
      throw new Error('Mixed asset base paths in build snapshot');
    const asset = match[1].slice(basePath.length + 1);
    if (!existsSync(join(snapshot, asset))) {
      throw new Error('Incomplete build snapshot: ' + match[1]);
    }
  }

  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
  };
  const server = createServer((req, res) => {
    let requested;
    try { requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end(); return; }
    if (basePath) {
      if (requested === basePath) requested = '/';
      else if (requested.startsWith(basePath + '/')) requested = requested.slice(basePath.length);
      else { res.writeHead(404).end('Outside the application mount'); return; }
    }
    const target = resolve(snapshot, '.' + requested);
    if (target !== snapshot && !target.startsWith(snapshot + sep)) {
      res.writeHead(403).end();
      return;
    }
    let file = target;
    if (!existsSync(file)) file = join(file, 'index.html');
    else if (statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    const ext = file.slice(file.lastIndexOf('.'));
    res.writeHead(200, {
      'content-type': mime[ext] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'service-worker-allowed': '/',
    });
    if (req.method === 'HEAD') { res.end(); return; }
    res.end(readFileSync(file));
  });

  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  const base = 'http://127.0.0.1:' + address.port + basePath;
  return {
    base,
    close: async () => {
      await new Promise((resolvePromise, reject) =>
        server.close(error => error ? reject(error) : resolvePromise()));
      rmSync(snapshot, { recursive: true, force: true });
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { base } = await startQASnapshot({ port: Number(process.env.QA_PORT ?? 42103), snapshotName: 'qa-snapshot-42103' });
  console.log('Immutable production QA snapshot listening at ' + base);
}
