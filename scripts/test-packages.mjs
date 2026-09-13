/**
 * Explicitly installing packages through the package API.
 *
 *   node scripts/test-packages.mjs [author/package@version ...]
 */
import { createCompiler } from '../packages/elm-wasm/src/index.js';
import { localCompilerOptions } from './_assets.mjs';

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
  'mdgriffith/elm-ui': `import Element as E

main =
    E.layout [] (E.text "elm-ui works")`,
  'elm/parser': `import Html exposing (text)
import Parser

main =
    text (Debug.toString (Parser.run (Parser.succeed 1) ""))`,
};

const pkgName = specs[0].split('@')[0];
const imports =
  sourceByPackage[pkgName] ?? 'import Html exposing (text)\n\nmain =\n    text "imported a package"';
const source = `module Main exposing (main)

${imports}
`;

const compiler = await createCompiler(
  await localCompilerOptions({ autoInstall: false, onLog: (m) => console.log('  ' + m) }),
);

console.log(`Installing: ${specs.join(', ')}`);
const { js, name } = await compiler.compile(source, { packages: specs });
console.log(`SUCCESS: ${name}, ${js.length} bytes of JS`);
console.log(
  'packages now available:',
  compiler
    .listPackages()
    .map((p) => `${p.name}@${p.version}`)
    .join(', '),
);
