/**
 * Import maps through the package API: point a module at a specific URL.
 *
 * The strongest proof that the override is actually used: we replace
 * `Maybe.Extra` with a copy that exposes an extra `sentinel` value, then
 * compile a program that references it. Without the override that value does
 * not exist, so the compile would fail.
 *
 *   node scripts/test-importmap.mjs
 */
import { createCompiler, parseImportMap } from '../packages/elm-wasm/src/index.js';
import { localCompilerOptions } from './_assets.mjs';

const SENTINEL = 'OVERRIDE_SENTINEL_12345';
const ORIGINAL_URL =
  'https://cdn.jsdelivr.net/gh/elm-community/maybe-extra@5.3.0/src/Maybe/Extra.elm';

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

const compiler = await createCompiler(
  await localCompilerOptions({ onLog: (m) => console.log('  ' + m.replace(/data:[^ ]+/g, '<data-url>')) }),
);

const app = `module Main exposing (main)

import Html exposing (text)
import Maybe.Extra

main =
    text Maybe.Extra.sentinel
`;

const { js } = await compiler.compile(app, { importMap });
const used = js.includes(SENTINEL);
console.log(`override used in output: ${used}`);
console.log(used ? 'SUCCESS: import map overrode the module' : 'FAILURE: original module was used');
if (!used) process.exitCode = 1;
