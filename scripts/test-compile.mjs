/**
 * Compiles an Elm module with the same code path the browser uses, but in Node.
 * This is the fastest way to sanity-check the WASM compiler + virtual FS setup.
 *
 *   node scripts/test-compile.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElmCompiler } from '../src/compiler.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetsDir = path.join(root, 'public', 'assets');
const load = (name) => readFile(path.join(assetsDir, name));

const source =
  process.argv[2] !== undefined && !process.argv[2].startsWith('-')
    ? await readFile(path.resolve(process.argv[2]), 'utf8')
    : `module Main exposing (main)

import Html exposing (text)

main =
    text "Hello from Elm, compiled in the browser!"
`;

console.log('Loading compiler assets...');
const [wasmBytes, artifactsTarGz, elmInitTarGz] = await Promise.all([
  load('ulm.wasm'),
  load('elm-all-examples-package-artifacts.tar.gz'),
  load('elm-init.tar.gz'),
]);
const jsffi = (await import(pathToFileURL(path.join(assetsDir, 'ulm.js')).href)).default;

const started = performance.now();
const compiler = await createElmCompiler({
  wasmBytes,
  jsffi,
  artifactsTarGz,
  elmInitTarGz,
  log: process.env.VERBOSE ? console.log : () => {},
});
console.log(`Compiler ready in ${(performance.now() - started).toFixed(0)} ms`);

const t0 = performance.now();
const result = await compiler.compile(source);
console.log(`compile() took ${(performance.now() - t0).toFixed(0)} ms -> ${result.type}`);

if (result.type === 'success') {
  console.log(`module: ${result.name}`);
  console.log(`output: ${result.file} (${result.js.length} bytes of JavaScript)`);
  console.log('--- first 500 chars ---');
  console.log(result.js.slice(0, 500));
} else {
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
