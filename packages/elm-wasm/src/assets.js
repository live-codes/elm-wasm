/**
 * Asset loading.
 *
 * The package ships the compiler (`ulm.wasm`) and the package-data tarballs
 * next to the bundle, in `dist/`. `baseUrl` overrides where they come from
 * (e.g. a CDN); any of them can also be passed in as raw bytes.
 *
 * No DOM APIs are used, so this works in a web worker.
 */

/** Files the package expects to find under `baseUrl`. */
export const ASSET_FILES = {
  wasm: 'ulm.wasm',
  elmInit: 'elm-init.tar.gz',
  artifacts: 'elm-all-examples-package-artifacts.tar.gz',
  moduleIndex: 'elm-modules-index.json',
};

// Computed so bundlers leave it alone (it is only ever reached in Node).
const NODE_FS = ['node', 'fs/promises'].join(':');

const toBytes = (value) =>
  value instanceof Uint8Array ? value : new Uint8Array(value);

/** Read bytes from a URL, falling back to the filesystem for `file:` URLs. */
export async function readBytes(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    if (typeof url === 'string' && url.startsWith('file:')) {
      try {
        const { readFile } = await import(/* @vite-ignore */ NODE_FS);
        return new Uint8Array(await readFile(new URL(url)));
      } catch {
        // fall through to the original error
      }
    }
    throw err;
  }
}

const bytesFromUrl = readBytes;

/**
 * The URL of this module, when the bundle format provides one. IIFE/UMD builds
 * have no `import.meta`, and the caller falls back to the document/worker
 * location.
 */
function moduleUrl() {
  try {
    // `import.meta` is empty (not an error) in non-ESM output formats.
    return typeof import.meta !== 'undefined' ? import.meta.url : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve a `baseUrl` (absolute or relative) to an absolute one.
 *
 * In an ESM/worker bundle this is relative to the module; in an IIFE/UMD build
 * (loaded with a `<script>` tag or `importScripts`) it is relative to the
 * document, or to the worker's location.
 */
export function resolveBaseUrl(baseUrl) {
  const base = baseUrl ?? './';
  const fromModule = moduleUrl();
  if (fromModule) return new URL(base, fromModule).href;

  const fallback =
    (typeof document !== 'undefined' && document.baseURI) ||
    (typeof location !== 'undefined' && location.href) ||
    undefined;
  if (!fallback) {
    throw new Error('Cannot resolve the asset base URL — pass an absolute `baseUrl`.');
  }
  return new URL(base, fallback).href;
}

/**
 * Resolve the URL of one asset. `explicit` wins, then `baseUrl`, then the
 * location of this module.
 */
export function assetUrl(name, { baseUrl, explicit } = {}) {
  if (explicit) return new URL(explicit, resolveBaseUrl(baseUrl)).href;
  return new URL(name, resolveBaseUrl(baseUrl)).href;
}

/**
 * Load the compiler and its data files.
 *
 * @param {object} [options]
 * @param {string} [options.baseUrl]      base for all assets (default: this module's directory)
 * @param {string} [options.wasmUrl]
 * @param {ArrayBuffer|Uint8Array} [options.wasmBytes]
 * @param {string} [options.elmInitUrl]
 * @param {ArrayBuffer|Uint8Array} [options.elmInitBytes]
 * @param {string} [options.artifactsUrl]
 * @param {ArrayBuffer|Uint8Array} [options.artifactsBytes]
 */
export async function loadAssets(options = {}) {
  const pick = (bytes, explicit, name, required = true) => {
    if (bytes) return Promise.resolve(toBytes(bytes));
    if (!explicit && !required) {
      return bytesFromUrl(assetUrl(name, { baseUrl: options.baseUrl })).catch(() => null);
    }
    return bytesFromUrl(assetUrl(name, { baseUrl: options.baseUrl, explicit }));
  };

  const [wasmBytes, elmInitTarGz, artifactsTarGz] = await Promise.all([
    pick(options.wasmBytes, options.wasmUrl, ASSET_FILES.wasm),
    pick(options.elmInitBytes, options.elmInitUrl, ASSET_FILES.elmInit, false),
    pick(options.artifactsBytes, options.artifactsUrl, ASSET_FILES.artifacts, false),
  ]);

  return { wasmBytes, elmInitTarGz, artifactsTarGz };
}

/**
 * Load the module -> package index (used to auto-install imports). Optional:
 * returns `null` when the file is not present.
 */
export async function loadModuleIndex(options = {}) {
  if (options.moduleIndex) return options.moduleIndex;
  try {
    const bytes = await readBytes(assetUrl(ASSET_FILES.moduleIndex, { baseUrl: options.baseUrl }));
    const json = JSON.parse(new TextDecoder().decode(bytes));
    return json?.modules ?? null;
  } catch {
    return null;
  }
}
