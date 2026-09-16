/**
 * Smoke test for the *built* package (dist/), run in Node.
 *
 * Node has no DOM, and the default asset loading goes through the `file:`
 * fallback, so this also checks that the bundle is not accidentally
 * browser-only.
 *
 *   node scripts/test-package.mjs
 */
import { createCompiler, compile, formatError } from '../dist/index.js';

const log = process.env.VERBOSE ? (m) => console.log('  ' + m) : () => {};

console.log('Loading the compiler from dist/ ...');
const started = performance.now();
const compiler = await createCompiler({ onLog: log });
console.log(`ready in ${(performance.now() - started).toFixed(0)} ms`);

const plain = `module Main exposing (main)

import Html exposing (text)

main =
    text "hello from the package"
`;
let t0 = performance.now();
const a = await compiler.compile(plain);
console.log(`compile #1: ${a.name}, ${a.js.length} bytes of JS (${(performance.now() - t0).toFixed(0)} ms)`);
if (typeof a.map !== 'undefined') throw new Error('expected map to be undefined');
if (!a.js.includes('hello from the package')) throw new Error('compiled JS does not contain the program text');
console.log('  js contains the program text ✓  map is undefined ✓');

// Second compile on the same instance: exercises the warm instance path.
t0 = performance.now();
const b = await compiler.compile(plain.replace('hello', 'hi'));
console.log(`compile #2: ${(performance.now() - t0).toFixed(0)} ms`);

// An import that is not bundled with the compiler: exercises import detection,
// the module index and the CDN package installer.
console.log('\nCompiling with a third-party import (auto-install)…');
const withImport = `module Main exposing (main)

import Html exposing (text)
import Maybe.Extra

main =
    text (Maybe.Extra.unwrap "nothing" String.fromInt (Just 42))
`;
try {
  const c = await compiler.compile(withImport, { onLog: log });
  console.log(`compiled with import: ${c.js.length} bytes ✓`);
} catch (err) {
  console.log(`skipped (offline?): ${err.name}: ${err.message}`);
}

// A package the compiler ships precompiled artifacts for: it must be enabled
// without downloading anything (it only has to be declared in `elm.json`).
console.log('\nCompiling with a bundled import (no download)…');
const installLog = [];
const bundledSource = `module Main exposing (main)

import Html exposing (text)
import Random

main =
    text (String.fromInt (Tuple.first (Random.step (Random.int 1 6) (Random.initialSeed 42))))
`;
const bundled = await compiler.compile(bundledSource, { onLog: (m) => installLog.push(m) });
const downloads = installLog.filter((m) => m.startsWith('Installing'));
if (downloads.length) throw new Error(`expected no downloads, got: ${downloads.join(', ')}`);
console.log(`compiled with bundled import: ${bundled.js.length} bytes, no downloads ✓`);

// Errors are thrown, with the structured problems attached.
console.log('\nChecking the error path…');
try {
  await compiler.compile('module Main exposing (main)\n\nmain =\n    1 +\n');
  throw new Error('expected the compiler to fail');
} catch (err) {
  if (err.name !== 'ElmCompileError') throw err;
  const title = err.errors?.[0]?.problems?.[0]?.title;
  console.log(`ElmCompileError thrown ✓  type=${err.type} first problem=${title}`);
}

// `formatError` renders Elm's styled message parts (they stringify to
// `[object Object]` when joined directly) as readable text.
console.log('\nChecking formatError…');
try {
  await compiler.compile('module Main exposing (main)\n\nimport NopeNope\n\n\nmain =\n    NopeNope.thing\n');
  throw new Error('expected the compiler to fail');
} catch (err) {
  const text = formatError(err);
  if (text.includes('[object Object]')) throw new Error('formatError left styled parts unflattened');
  if (!text.includes('NopeNope')) throw new Error('formatError lost the message');
  console.log(`formatError ✓  ${text.split('\n').slice(0, 2).join(' / ')}`);
}

// The one-shot API.
const oneShot = await compile(plain);
console.log(`\ncompile() one-shot: ${oneShot.name}, ${oneShot.js.length} bytes ✓`);
