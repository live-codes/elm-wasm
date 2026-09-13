/**
 * Automatic import handling: no package list is provided — the tooling reads
 * the `import` lines, resolves them via the module index, and installs what is
 * missing.
 *
 *   node scripts/test-imports.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElmCompiler } from '../src/compiler.js';
import { autoInstallImports, detectImports } from '../src/imports.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetsDir = path.join(root, 'public', 'assets');
const load = (name) => readFile(path.join(assetsDir, name));

// Note: no package list anywhere. The imports are the only hint.
const source = `module Main exposing (main)

import Element as E
import Html exposing (Html)
import Html.Attributes
import Maybe.Extra


main : Html msg
main =
    E.layout []
        (E.text (Maybe.Extra.unwrap "no value" String.fromInt (Just 42)))
`;

console.log('Imports detected:', detectImports(source).join(', '));

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

const { installed, unresolved } = await autoInstallImports(compiler, source, {
  index,
  log: (msg) => console.log('  ' + msg),
});
console.log('Auto-installed:', installed.join(', ') || '(none)');
console.log('Unresolved:', unresolved.join(', ') || '(none)');

const result = await compiler.compile(source);
console.log('result.type =', result.type);
if (result.type === 'success') {
  console.log(`SUCCESS: ${result.name}, ${result.js.length} bytes of JS`);
} else {
  console.log(JSON.stringify(result, null, 2).slice(0, 3000));
  process.exitCode = 1;
}
