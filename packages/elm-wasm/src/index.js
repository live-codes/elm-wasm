/**
 * @live-codes/elm-wasm — the Elm compiler, compiled to WebAssembly.
 *
 * Compiles Elm source to JavaScript in the browser, a web worker, or Node.
 * No DOM APIs are used anywhere in this package.
 *
 *   import { compile } from '@live-codes/elm-wasm';
 *   const { js } = await compile(source, { importMap, baseUrl });
 *
 * @see README.md
 */
import { loadAssets, loadModuleIndex, assetUrl, resolveBaseUrl, ASSET_FILES } from './assets.js';
import { createElmCompiler, wrapJsInHtml } from './compiler.js';
import { getSources } from './sources.js';
import { installPackages } from './packages.js';
import { detectImports, resolveImports, autoInstallImports } from './imports.js';
import { installFromImportMap, parseImportMap } from './importmap.js';
import jsffi from '../assets/ulm.js';

export const version = '__VERSION__';

/** Thrown when the Elm compiler reports errors. */
export class ElmCompileError extends Error {
  constructor(result) {
    const first = result?.errors?.[0]?.problems?.[0]?.title;
    super(
      result?.message
        ? `${result.title ?? 'Elm compile error'}: ${result.message}`
        : `Elm compilation failed${first ? ` (${first})` : ''}`,
    );
    this.name = 'ElmCompileError';
    /** @type {'compile-errors'|'error'} */
    this.type = result?.type ?? 'error';
    /** Structured Elm problems: `[{ path, name, problems: [{ title, region, message }] }]` */
    this.errors = result?.errors;
    /** The raw compiler result. */
    this.result = result;
  }
}

/**
 * Create a compiler instance. Reuse it to compile several times — the WASM
 * module, the virtual file system and any installed packages stay warm.
 *
 * @param {object} [options]
 * @param {string} [options.baseUrl]   where `ulm.wasm` and the data files live (default: this module's directory)
 * @param {ArrayBuffer|Uint8Array} [options.wasmBytes]  or provide the module directly
 * @param {string} [options.wasmUrl]
 * @param {ArrayBuffer|Uint8Array} [options.elmInitBytes]
 * @param {ArrayBuffer|Uint8Array} [options.artifactsBytes]
 * @param {object} [options.importMap]  import map applied to every compile
 * @param {string[]} [options.packages] packages to install up front, e.g. `['mdgriffith/elm-ui@1.1.8']`
 * @param {string|string[]} [options.cdn] package source(s); default jsDelivr -> GitHub
 * @param {boolean} [options.autoInstall=true] detect imports and install missing packages
 * @param {Record<string, unknown>} [options.moduleIndex] override the module -> package index
 * @param {(message: string) => void} [options.onLog] compiler output
 */
export async function createCompiler(options = {}) {
  const log = options.onLog ?? (() => {});
  const sources = getSources(options.cdn);

  const assets = await loadAssets(options);
  const compiler = await createElmCompiler({ ...assets, jsffi, log });

  const state = {
    importMapKey: null,
    packagesKey: null,
    moduleIndex: null,
  };

  const getIndex = async () => {
    if (!state.moduleIndex) state.moduleIndex = await loadModuleIndex(options);
    return state.moduleIndex;
  };

  const applyPackages = async (packages) => {
    if (!packages?.length) return;
    const key = JSON.stringify(packages);
    if (key === state.packagesKey) return;
    log(`Installing ${packages.join(', ')}`);
    await installPackages(compiler, packages, { sources, log });
    state.packagesKey = key;
  };

  const applyImportMap = async (importMap) => {
    if (!importMap) return;
    const key = typeof importMap === 'string' ? importMap : JSON.stringify(importMap);
    if (key === state.importMapKey) return;
    await installFromImportMap(compiler, importMap, { index: await getIndex(), sources, log });
    state.importMapKey = key;
  };

  await applyPackages(options.packages);
  await applyImportMap(options.importMap);

  return {
    /**
     * Compile one Elm module.
     *
     * @param {string} source  Elm source code
     * @param {object} [callOptions] same options as `createCompiler`, per call
     * @returns {Promise<{ js: string, name: string, map: undefined }>}
     * @throws {ElmCompileError}
     */
    async compile(source, callOptions = {}) {
      await applyPackages(callOptions.packages);
      await applyImportMap(callOptions.importMap);

      const autoInstall = callOptions.autoInstall ?? options.autoInstall ?? true;
      if (autoInstall) {
        const index = await getIndex();
        if (!index) {
          log('No module index available — pass `moduleIndex` or `baseUrl` to enable import detection.');
        } else {
          await autoInstallImports(compiler, source, { index, sources, log });
        }
      }

      const result = await compiler.compile(source);
      if (result.type !== 'success') throw new ElmCompileError(result);
      // Elm 0.19 does not emit source maps (the `--source-maps` flag was removed
      // in 0.19), so `map` is always undefined for now.
      return { js: result.js, name: result.name, map: undefined };
    },

    /** The module currently installed/exposed, useful for debugging. */
    listPackages: () => compiler.listPackages(),

    /**
     * The low-level compiler (from `createElmCompiler`). Escape hatch for
     * `installPackages` / `installFromImportMap` / `autoInstallImports`.
     */
    raw: compiler,

    /** Drop the compiler instance. */
    dispose() {
      state.moduleIndex = null;
    },
  };
}

let shared = null;

/**
 * Compile with a lazily-created shared instance — the simple entry point.
 *
 *   const { js, name } = await compile(source, { importMap });
 *
 * Options given on the first call configure the shared instance; later calls
 * only apply the per-call options they pass.
 */
export function compile(source, options) {
  shared ??= createCompiler(options);
  return shared.then((compiler) => compiler.compile(source, options));
}

export {
  createElmCompiler,
  wrapJsInHtml,
  assetUrl,
  resolveBaseUrl,
  ASSET_FILES,
  getSources,
  installPackages,
  detectImports,
  resolveImports,
  autoInstallImports,
  installFromImportMap,
  parseImportMap,
};

export { sourceNames } from './sources.js';
export { parseSpec, satisfies, latestVersion } from './packages.js';
export { packageFromUrl, fetchPackage } from './sources.js';
