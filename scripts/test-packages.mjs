/**
 * Can we import third-party Elm packages?
 *
 * Installs `elm-community/maybe-extra` from GitHub into the virtual file
 * system and compiles a module that imports it.
 *
 *   node scripts/test-packages.mjs [author/package@version ...]
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElmCompiler } from '../src/compiler.js';
import { installPackages } from '../src/packages.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetsDir = path.join(root, 'public', 'assets');
const load = (name) => readFile(path.join(assetsDir, name));

const specs = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (!specs.length) specs.push('elm-community/maybe-extra@5.3.0');

const sourceByPackage = {
  'elm-community/maybe-extra': `import Html exposing (text)
import Maybe.Extra

main =
    text
        (if Maybe.Extra.isJust (Just 42) then
            "maybe-extra works"

         else
            "maybe-extra is broken"
        )`,
  'mdgriffith/elm-ui': `import Element as E exposing (Element)

main =
    E.layout [] (E.text "elm-ui works")`,
  'elm/parser': `import Html exposing (text)
import Parser exposing (Parser, run)

main =
    text (Debug.toString (run (Parser.succeed 1) ""))`,
};

const pkgName = specs[0].split('@')[0];
const imports = sourceByPackage[pkgName] ?? 'import Html exposing (text)\n\nmain =\n    text "imported a package"';
const source = `module Main exposing (main)

${imports}
`;

console.log(`Loading compiler assets...`);
const [wasmBytes, artifactsTarGz, elmInitTarGz] = await Promise.all([
  load('ulm.wasm'),
  load('elm-all-examples-package-artifacts.tar.gz'),
  load('elm-init.tar.gz'),
]);
const jsffi = (await import(pathToFileURL(path.join(assetsDir, 'ulm.js')).href)).default;

const compiler = await createElmCompiler({
  wasmBytes,
  jsffi,
  artifactsTarGz,
  elmInitTarGz,
  log: process.env.VERBOSE ? console.log : () => {},
});

console.log(`Installing: ${specs.join(', ')}`);
const elmJson = await installPackages(compiler, specs, { log: (m) => console.log('  ' + m) });
console.log('direct deps:', JSON.stringify(elmJson.dependencies.direct));

console.log('Compiling an importer...');
const result = await compiler.compile(source);
console.log('result.type =', result.type);
if (result.type === 'success') {
  console.log(`SUCCESS: ${result.name}, ${result.js.length} bytes of JS`);
} else {
  console.log(JSON.stringify(result, null, 2).slice(0, 4000));
  process.exitCode = 1;
}
