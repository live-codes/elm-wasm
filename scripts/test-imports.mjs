/**
 * Automatic import handling through the package API: nothing declares the
 * dependencies — the `import` lines are detected, resolved via the module index
 * and installed.
 *
 * Covers both kinds of package:
 *
 *   - ones bundled with the compiler (~13 `elm/*` packages shipped as precompiled
 *     artifacts), which only need to be declared in `elm.json` — importing one
 *     must not download anything, including its transitive dependencies;
 *   - ones that are not bundled, which are fetched from a CDN.
 *
 *   node scripts/test-imports.mjs
 */
import { createCompiler, detectImports } from '../packages/elm-wasm/src/index.js';
import { localCompilerOptions } from './_assets.mjs';

/** Compile `source` on a fresh compiler and report what the installer did. */
async function compileLogging(source) {
  const log = [];
  const compiler = await createCompiler(
    await localCompilerOptions({ onLog: (m) => log.push(m) }),
  );
  const { js, name } = await compiler.compile(source);
  const downloaded = log.filter((m) => m.startsWith('Installing') || m.startsWith('  via '));
  const bundled = log.filter((m) => m.startsWith('Using bundled'));
  return { js, name, downloaded, bundled };
}

// Packages that the compiler ships artifacts for (`elm/random`, `elm/svg`), plus
// one of their dependencies (`elm/http` needs elm/bytes and elm/file). None of
// this should be downloaded.
const bundledSource = `module Main exposing (main)

import Html exposing (Html, text)
import Http
import Random
import Svg
import Svg.Attributes


type alias Model =
    Http.Error


seed : Random.Seed
seed =
    Random.initialSeed 42


circle : Svg.Svg msg
circle =
    Svg.circle [ Svg.Attributes.r "4" ] []


main : Html msg
main =
    text (String.fromInt (Tuple.first (Random.step (Random.int 1 6) seed)))
`;

// No package list anywhere — there is no package bundled for these, so both are
// detected, resolved and fetched.
const fetchedSource = `module Main exposing (main)

import Element as E
import Html exposing (Html)
import Html.Attributes
import Maybe.Extra


main : Html msg
main =
    E.layout []
        (E.text (Maybe.Extra.unwrap "no value" String.fromInt (Just 42)))
`;

const bundled = await compileLogging(bundledSource);
console.log('imports detected:', detectImports(bundledSource).join(', '));
console.log('bundled packages used:', bundled.bundled.join(', ') || '(none)');
if (!bundled.bundled.length) throw new Error('expected the bundled packages to be used as-is');
if (bundled.downloaded.length) {
  throw new Error(`expected no downloads, but got: ${bundled.downloaded.join(', ')}`);
}
console.log(`SUCCESS (no downloads): ${bundled.name}, ${bundled.js.length} bytes of JS\n`);

const fetched = await compileLogging(fetchedSource);
console.log('imports detected:', detectImports(fetchedSource).join(', '));
console.log('downloads:', fetched.downloaded.join(', ') || '(none)');
if (!fetched.downloaded.length) throw new Error('expected the third-party packages to be fetched');
console.log(`SUCCESS (fetched): ${fetched.name}, ${fetched.js.length} bytes of JS`);
