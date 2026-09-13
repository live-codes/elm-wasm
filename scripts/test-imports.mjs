/**
 * Automatic import handling through the package API: nothing declares the
 * dependencies — the `import` lines are detected, resolved via the module index
 * and installed.
 *
 *   node scripts/test-imports.mjs
 */
import { createCompiler, detectImports } from '../packages/elm-wasm/src/index.js';
import { localCompilerOptions } from './_assets.mjs';

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

const compiler = await createCompiler(
  await localCompilerOptions({ onLog: (m) => console.log('  ' + m) }),
);

const { js, name } = await compiler.compile(source);
console.log(`SUCCESS: ${name}, ${js.length} bytes of JS`);
