/**
 * Compiles an Elm module with the published package API, in Node.
 *
 *   node scripts/test-compile.mjs [file.elm]
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createCompiler } from '../packages/elm-wasm/src/index.js';
import { localCompilerOptions } from './_assets.mjs';

const source =
  process.argv[2] !== undefined && !process.argv[2].startsWith('-')
    ? await readFile(path.resolve(process.argv[2]), 'utf8')
    : `module Main exposing (main)

import Html exposing (text)

main =
    text "Hello from Elm, compiled in the browser!"
`;

const log = process.env.VERBOSE ? console.log : undefined;

console.log('Loading compiler assets...');
const started = performance.now();
const compiler = await createCompiler(await localCompilerOptions({ autoInstall: false, onLog: log }));
console.log(`Compiler ready in ${(performance.now() - started).toFixed(0)} ms`);

const t0 = performance.now();
const { js, name, map } = await compiler.compile(source);
console.log(`compile() took ${(performance.now() - t0).toFixed(0)} ms`);
console.log(`module: ${name}`);
console.log(`output: ${js.length} bytes of JavaScript, source map: ${map ?? 'none (Elm 0.19 has none)'}`);
console.log('--- first 400 chars ---');
console.log(js.slice(0, 400));
