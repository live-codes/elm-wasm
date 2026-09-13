/**
 * Minimal static file server for the playground.
 * Serves correct MIME types (notably application/wasm).
 *
 *   node scripts/serve.mjs [port]
 *
 * Besides `public/`, two extra roots are mounted so the package's built output
 * and its worker test can be served from the same origin:
 *
 *   /elm-wasm/       packages/elm-wasm/dist
 *   /elm-wasm-test/  packages/elm-wasm/test
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../public', import.meta.url)));
const repoRoot = path.resolve(root, '..');
const port = Number(process.argv[2] || process.env.PORT || 8080);

const MOUNTS = [
  ['/elm-wasm/', path.join(repoRoot, 'packages', 'elm-wasm', 'dist')],
  ['/elm-wasm-test/', path.join(repoRoot, 'packages', 'elm-wasm', 'test')],
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/** Map a URL path to `{ base, file }`, applying the mounts above. */
function resolvePath(urlPath) {
  for (const [prefix, dir] of MOUNTS) {
    if (urlPath === prefix.slice(0, -1) || urlPath.startsWith(prefix)) {
      return { base: dir, file: path.join(dir, urlPath.slice(prefix.length)) };
    }
  }
  return { base: root, file: path.join(root, urlPath) };
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const { base, file } = resolvePath(urlPath);
    let filePath = file;
    if (!filePath.startsWith(base)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info?.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
    });
    createReadStream(filePath).pipe(res);
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
});

server.listen(port, () => {
  console.log(`Elm-in-browser PoC running at http://localhost:${port}/`);
  console.log(`  package dist:  http://localhost:${port}/elm-wasm/`);
  console.log(`  worker test:   http://localhost:${port}/elm-wasm-test/`);
});
