/**
 * Downloads (or copies) the assets the PoC needs into public/assets.
 *
 * The compiler binaries (`ulm.wasm`, `ulm.js`) are built by `compiler/` — see
 * compiler/README.md. This script picks them up from, in order:
 *
 *   1. a local build in compiler/out/           (--local)
 *   2. a base URL, e.g. a release or CDN        (--base <url>, or ELM_ASSETS_BASE)
 *   3. the elm.run fallback                     (https://elm.run)
 *
 * The two package-data tarballs are always URLs (they are not compiler
 * binaries); they use the same base/fallback chain.
 *
 *   node scripts/fetch-assets.mjs [--force] [--local] [--base <url>]
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetsDir = path.join(root, 'public', 'assets');
const localDir = path.join(root, 'compiler', 'out');

const args = process.argv.slice(2);
const force = args.includes('--force');
const useLocal = args.includes('--local');
const baseArg = args.indexOf('--base');
const base = ((baseArg === -1 ? process.env.ELM_ASSETS_BASE : args[baseArg + 1]) || '').replace(/\/$/, '');
const fallbackBase = (process.env.ELM_RUN_BASE || 'https://elm.run').replace(/\/$/, '');

const files = [
  { name: 'ulm.wasm', local: true, description: 'the Elm compiler (WASM, ~12 MB)' },
  { name: 'ulm.js', local: true, description: 'GHC JSFFI glue for the compiler' },
  { name: 'elm-init.tar.gz', description: 'Elm package sources + registry' },
  {
    name: 'elm-all-examples-package-artifacts.tar.gz',
    description: 'precompiled Elm package artifacts',
  },
];

/** Where an asset can come from, best first. */
function candidates(file) {
  const list = [];
  if (useLocal && file.local) list.push({ from: path.join(localDir, file.name), kind: 'file' });
  if (base) list.push({ from: `${base}/${file.name}`, kind: 'url' });
  list.push({ from: `${fallbackBase}/${file.name}`, kind: 'url' });
  return list;
}

async function read(from, kind) {
  if (kind === 'file') {
    const info = await stat(from);
    if (!info.isFile()) throw new Error('not a file');
    return readFile(from);
  }
  const res = await fetch(from);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

await mkdir(assetsDir, { recursive: true });

for (const file of files) {
  const dest = path.join(assetsDir, file.name);
  const existing = await stat(dest).catch(() => null);
  if (existing?.size > 0 && !force) {
    console.log(`skip  ${file.name} (already present, ${existing.size} bytes)`);
    continue;
  }

  let written = null;
  const errors = [];
  for (const { from, kind } of candidates(file)) {
    try {
      const buf = await read(from, kind);
      await writeFile(dest, buf);
      written = { from, size: buf.length };
      break;
    } catch (err) {
      errors.push(`${from}: ${err.message}`);
    }
  }

  if (!written) throw new Error(`Could not obtain ${file.name}\n  ${errors.join('\n  ')}`);
  console.log(`fetch ${file.name} (${file.description})`);
  console.log(`      ← ${written.from} (${written.size} bytes)`);
}

console.log(`\nAssets are in ${assetsDir}`);
