/**
 * Shared helper for the Node tests: load the compiler (and package data) from
 * `public/assets/` and hand them to the package as bytes, so the tests do not
 * depend on a network or on the default asset URLs.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const assetsDir = path.join(root, 'public', 'assets');

export const load = (name) => readFile(path.join(assetsDir, name));

/** Options for `createCompiler()` that come straight from disk. */
export async function localCompilerOptions(extra = {}) {
  const [wasmBytes, elmInitBytes, artifactsBytes, indexJson] = await Promise.all([
    load('ulm.wasm'),
    load('elm-init.tar.gz'),
    load('elm-all-examples-package-artifacts.tar.gz'),
    readFile(path.join(assetsDir, 'elm-modules-index.json'), 'utf8').catch(() => null),
  ]);
  return {
    wasmBytes,
    elmInitBytes,
    artifactsBytes,
    moduleIndex: indexJson ? JSON.parse(indexJson).modules : null,
    ...extra,
  };
}
