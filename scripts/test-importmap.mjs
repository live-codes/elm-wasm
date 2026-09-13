/**
 * Import maps: point a module at a specific URL.
 *
 * The strongest proof that the override is actually used: we replace
 * `Maybe.Extra` with a copy that exposes an extra `sentinel` value, then
 * compile a program that references it. Without the override that value does
 * not exist, so the compile would fail.
 *
 *   node scripts/test-importmap.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElmCompiler } from '../src/compiler.js';
import { installFromImportMap, parseImportMap } from '../src/importmap.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetsDir = path.join(root, 'public', 'assets');
const load = (name) => readFile(path.join(assetsDir, name));

const SENTINEL = 'OVERRIDE_SENTINEL_12345';
const ORIGINAL_URL = 'https://cdn.jsdelivr.net/gh/elm-community/maybe-extra@5.3.0/src/Maybe/Extra.elm';

const original = await (await fetch(ORIGINAL_URL)).text();

// Add a `sentinel` value to the module *and* to its explicit exposing list, so
// we can both compile against it and find it in the generated JavaScript.
const marker = ', andMap, next, prev\n    )';
if (!original.includes(marker)) throw new Error('could not find the exposing list to patch');
const patched = original
  .replace(marker, ', andMap, next, prev\n    , sentinel\n    )')
  .concat(`\n\nsentinel : String\nsentinel =\n    "${SENTINEL}"\n`);
const dataUrl = `data:text/plain;base64,${Buffer.from(patched, 'utf8').toString('base64')}`;

const importMap = {
  imports: {
    'Maybe.Extra': dataUrl, // no package in the URL -> resolved via the module index
  },
};
console.log('parsed import map:', parseImportMap(importMap).map((e) => e.module).join(', '));

const [wasmBytes, artifactsTarGz, elmInitTarGz] = await Promise.all([
  load('ulm.wasm'),
  load('elm-all-examples-package-artifacts.tar.gz'),
  load('elm-init.tar.gz'),
]);
const index = JSON.parse(await readFile(path.join(assetsDir, 'elm-modules-index.json'), 'utf8')).modules;
const jsffi = (await import(pathToFileURL(path.join(assetsDir, 'ulm.js')).href)).default;

const compiler = await createElmCompiler({
  wasmBytes,
  jsffi,
  artifactsTarGz,
  elmInitTarGz,
  log: process.env.VERBOSE ? console.log : () => {},
});

const applied = await installFromImportMap(compiler, importMap, {
  index,
  log: (msg) => console.log('  ' + msg.replace(/data:[^ ]+/g, '<data-url>')),
});
console.log('installed:', applied.installed, '| overridden:', applied.overridden, '| unresolved:', applied.unresolved);

const app = `module Main exposing (main)

import Html exposing (text)
import Maybe.Extra

main =
    text Maybe.Extra.sentinel
`;
const result = await compiler.compile(app);
console.log('result.type =', result.type);
if (result.type !== 'success') {
  console.log(JSON.stringify(result).slice(0, 800));
  process.exitCode = 1;
} else {
  const used = result.js.includes(SENTINEL);
  console.log(`override used in output: ${used}`);
  console.log(used ? 'SUCCESS: import map overrode the module' : 'FAILURE: original module was used');
  if (!used) process.exitCode = 1;
}
