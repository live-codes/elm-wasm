/**
 * Downloads the prebuilt Elm compiler assets used by the PoC.
 *
 * The Elm compiler is written in Haskell; building it to WASM by hand needs a
 * GHC WebAssembly cross-compiler plus a WASI sysroot. For a proof of concept we
 * reuse the binaries published by the elm.run project (https://github.com/marc136/elm.run),
 * which is a fork of the official compiler (BSD-3-Clause) built for this exact
 * purpose. See README.md for the licensing/integration discussion.
 */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetsDir = path.join(root, 'public', 'assets');
const base = (process.env.ELM_RUN_BASE || 'https://elm.run').replace(/\/$/, '');

const files = [
  ['ulm.wasm', `${base}/ulm.wasm`, 'the Elm compiler (WASM, ~12 MB)'],
  ['ulm.js', `${base}/ulm.js`, 'GHC JSFFI glue for the compiler'],
  ['elm-init.tar.gz', `${base}/elm-init.tar.gz`, 'Elm package sources + registry'],
  [
    'elm-all-examples-package-artifacts.tar.gz',
    `${base}/elm-all-examples-package-artifacts.tar.gz`,
    'precompiled Elm package artifacts',
  ],
];

await mkdir(assetsDir, { recursive: true });

for (const [name, url, description] of files) {
  const dest = path.join(assetsDir, name);
  const existing = await stat(dest).catch(() => null);
  if (existing && existing.size > 0 && !process.argv.includes('--force')) {
    console.log(`skip  ${name} (already present, ${existing.size} bytes)`);
    continue;
  }
  process.stdout.write(`fetch ${name} — ${description} ... `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`ok (${buf.length} bytes)`);
}

console.log(`\nAssets are in ${assetsDir}`);
