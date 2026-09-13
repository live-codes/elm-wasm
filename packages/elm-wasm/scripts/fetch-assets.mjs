/**
 * Puts the assets this package ships into `assets/`:
 *
 *   ulm.wasm                                     the compiler (WASM)
 *   ulm.js                                       GHC JSFFI glue (bundled into dist/index.js)
 *   elm-init.tar.gz                              package sources + registry
 *   elm-all-examples-package-artifacts.tar.gz    precompiled package artifacts
 *   elm-modules-index.json                       module -> package index (optional)
 *
 * Assets are taken from the repo's `public/assets/` when present (fast path),
 * otherwise downloaded. `npm run build:compiler` / `npm run build:index` in the
 * repo root produce them.
 *
 *   node scripts/fetch-assets.mjs [--force]
 */
import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetsDir = path.join(root, 'assets');
const repoAssets = path.resolve(root, '..', '..', 'public', 'assets');
const force = process.argv.includes('--force');
const remoteBase = (process.env.ELM_ASSETS_BASE || 'https://elm.run').replace(/\/$/, '');

const files = [
  { name: 'ulm.wasm', remote: true, required: true },
  { name: 'ulm.js', remote: true, required: true },
  { name: 'elm-init.tar.gz', remote: true, required: false },
  { name: 'elm-all-examples-package-artifacts.tar.gz', remote: true, required: false },
  { name: 'elm-modules-index.json', remote: false, required: false },
];

await mkdir(assetsDir, { recursive: true });

for (const file of files) {
  const dest = path.join(assetsDir, file.name);
  const existing = await stat(dest).catch(() => null);
  if (existing?.size > 0 && !force) {
    console.log(`skip  ${file.name} (${existing.size} bytes)`);
    continue;
  }

  const local = path.join(repoAssets, file.name);
  const haveLocal = (await stat(local).catch(() => null))?.size > 0;

  if (haveLocal) {
    await copyFile(local, dest);
    console.log(`copy  ${file.name} ← ${path.relative(root, local)}`);
    continue;
  }

  if (!file.remote) {
    const note = file.required ? ' (required)' : ' (optional)';
    console.log(`skip  ${file.name} — not found locally${note}; run \`npm run build:index\` in the repo root`);
    continue;
  }

  process.stdout.write(`fetch ${file.name} ← ${remoteBase} ... `);
  const res = await fetch(`${remoteBase}/${file.name}`);
  if (!res.ok) {
    if (file.required) throw new Error(`Failed to download ${file.name}: HTTP ${res.status}`);
    console.log(`skipped (HTTP ${res.status})`);
    continue;
  }
  const { writeFile } = await import('node:fs/promises');
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`ok (${buf.length} bytes)`);
}

// The glue's top-level await would make an IIFE build impossible.
const { patchGlueFile } = await import('./patch-glue.mjs');
if (await patchGlueFile(path.join(assetsDir, 'ulm.js'))) {
  console.log('patched ulm.js (no top-level await)');
}
