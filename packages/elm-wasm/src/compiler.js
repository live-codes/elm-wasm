/**
 * Core Elm-in-the-browser compiler.
 *
 * This is environment-agnostic: it only needs `WebAssembly` and the two
 * assets (a WASM build of the Elm 0.19.1 compiler plus its GHC JSFFI glue).
 * The same module powers the Node test (`scripts/test-compile.mjs`) and the
 * browser playground (`public/index.html`).
 *
 * The Elm compiler is a Haskell program built to WASI, so we give it a
 * virtual, in-memory file system (an `elm.json`, a `src/` dir for the user's
 * code, and an `elm-home` containing precompiled package artifacts) and run
 * it through a WASI shim.
 */
import {
  WASI,
  File,
  OpenFile,
  ConsoleStdout,
  PreopenDirectory,
  Directory,
} from '@bjorn3/browser_wasi_shim';
import { parseTarGzip } from 'nanotar';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const strToFile = (str) => new File(textEncoder.encode(str));

/**
 * Create a compiler instance backed by an in-memory file system.
 *
 * @param {object} options
 * @param {ArrayBuffer|Uint8Array} options.wasmBytes  the compiler WASM module
 * @param {(exports: object) => object} options.jsffi GHC JSFFI glue factory (`ulm.js` default export)
 * @param {ArrayBuffer|Uint8Array} [options.artifactsTarGz] precompiled Elm package artifacts
 * @param {ArrayBuffer|Uint8Array} [options.elmInitTarGz]   Elm package sources + registry (`elm init` output)
 * @param {(msg: string) => void} [options.log]
 */
export async function createElmCompiler({
  wasmBytes,
  jsffi,
  artifactsTarGz,
  elmInitTarGz,
  log,
} = {}) {
  if (typeof wasmBytes === 'undefined') throw new Error('createElmCompiler: `wasmBytes` is required');
  if (typeof jsffi !== 'function') throw new Error('createElmCompiler: `jsffi` must be the `ulm.js` default export');

  const writeLog = (msg) => {
    if (log) log(msg);
  };

  const pkgDir = new Directory([]);
  const fs = new PreopenDirectory('/', [
    ['src', new Directory([])],
    ['tmp', new Directory([])],
    ['elm-home', new Directory([['0.19.1', new Directory([['packages', pkgDir]])]])],
    ['packages', new Directory([])],
  ]);

  // ---------------------------------------------------------------------------
  // virtual file system helpers
  // ---------------------------------------------------------------------------

  function createDir(dirpath) {
    dirpath = dirpath.replaceAll('//', '/');
    while (dirpath.startsWith('/')) dirpath = dirpath.slice(1);
    while (dirpath.endsWith('/')) dirpath = dirpath.slice(0, -1);
    const segments = dirpath.split('/');
    let node = fs.dir;
    for (const segment of segments) {
      let next = node.contents.get(segment);
      if (!next) {
        next = new Directory([]);
        node.contents.set(segment, next);
      }
      if (!(next instanceof Directory)) {
        throw new Error(`Cannot create directory "${dirpath}": "${segment}" already exists`);
      }
      node = next;
    }
    return node;
  }

  function writeFileInDir(dir, name, content) {
    const buf = typeof content === 'string' ? textEncoder.encode(content) : content;
    dir.contents.set(name, new File(buf));
  }

  function writeFile(filepath, content) {
    filepath = filepath.replaceAll('//', '/');
    const lastSlash = filepath.lastIndexOf('/');
    let dir = fs.dir;
    if (lastSlash > 0) dir = createDir(filepath.slice(0, lastSlash));
    writeFileInDir(dir, filepath.slice(lastSlash + 1), content);
  }

  async function unpackInto({ dest = '/', tar }) {
    for (const file of tar) {
      let fullpath = file.name;
      while (fullpath.startsWith('/')) fullpath = fullpath.slice(1);
      while (fullpath.endsWith('/')) fullpath = fullpath.slice(0, -1);
      if (!fullpath) continue;
      fullpath = (dest === '/' ? '' : dest) + '/' + fullpath;
      switch (file.type) {
        case 'file':
          writeFile(fullpath, file.data ?? new Uint8Array());
          break;
        case 'directory':
          createDir(fullpath);
          break;
        default:
          writeLog(`[compiler] ignoring unsupported tar entry type "${file.type}"`);
      }
    }
  }

  /** @returns {Uint8Array} */
  function readFile(filepath) {
    let node = fs.dir;
    for (const part of filepath.split('/')) {
      if (!part) continue;
      if (!(node instanceof Directory)) throw new Error(`Not a directory while resolving "${filepath}"`);
      const next = node.contents.get(part);
      if (!next) throw new Error(`Could not find "${part}" in path "${filepath}"`);
      node = next;
    }
    if (!(node instanceof File)) throw new Error(`Expected "${filepath}" to be a file`);
    return node.data;
  }

  const readText = (filepath) => textDecoder.decode(readFile(filepath));

  // ---------------------------------------------------------------------------
  // populate packages
  // ---------------------------------------------------------------------------

  // Package sources + registry (also provides a default `/elm.json`).
  if (elmInitTarGz) {
    await unpackInto({ dest: '/', tar: await parseTarGzip(toUint8Array(elmInitTarGz)) });
  }
  // Precompiled interfaces/objects. Unpacking second so real `artifacts.dat`
  // files overwrite the empty placeholders shipped in the sources tarball.
  if (artifactsTarGz) {
    await unpackInto({
      dest: '/elm-home/0.19.1/packages',
      tar: await parseTarGzip(toUint8Array(artifactsTarGz)),
    });
  }

  // ---------------------------------------------------------------------------
  // load the compiler WASM
  // ---------------------------------------------------------------------------

  const wasmExports = {};
  const fds = [
    new OpenFile(new File([])), // stdin
    ConsoleStdout.lineBuffered((msg) => writeLog(`[wasi:out] ${msg}`)),
    ConsoleStdout.lineBuffered((msg) => writeLog(`[wasi:err] ${msg}`)),
    fs,
  ];
  const wasi = new WASI([], [], fds, { debug: false });

  const { instance } = await WebAssembly.instantiate(toUint8Array(wasmBytes), {
    ghc_wasm_jsffi: jsffi(wasmExports),
    wasi_snapshot_preview1: wasi.wasiImport,
  });
  Object.assign(wasmExports, instance.exports);
  wasi.initialize(instance);

  // ---------------------------------------------------------------------------
  // public API
  // ---------------------------------------------------------------------------

  if (typeof wasmExports.compile !== 'function') {
    throw new Error(
      `The compiler module does not export a \`compile\` function (exports: ${Object.keys(wasmExports).join(', ')})`,
    );
  }

  /**
   * Compile a single Elm module to JavaScript.
   *
   * @param {string} source
   * @returns {Promise<
   *   | { type: 'success', name: string, file: string, js: string }
   *   | { type: 'compile-errors', errors?: unknown[] }
   *   | { type: 'error', title?: string, message?: string, [k: string]: unknown }
   * >}
   */
  async function compile(source) {
    const raw = await wasmExports.compile(source);
    const envelope = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const result = normalizeResult(envelope);
    if (result.type === 'success' && result.file) {
      return { ...result, js: readText(result.file) };
    }
    return result;
  }

  /**
   * The compiler returns different shapes across builds:
   *   older: { type: 'success', file, name } | { type: 'compile-errors', errors }
   *   newer: { fn: 'compile', result: 'ok' | 'err', data: {...} }
   * Normalise both into a single tagged union.
   */
  function normalizeResult(envelope) {
    if (envelope && typeof envelope === 'object' && 'fn' in envelope && 'result' in envelope) {
      const data = envelope.data ?? {};
      if (envelope.result === 'ok') return { type: 'success', ...data };
      if (data.errors) return { type: 'compile-errors', ...data };
      return { type: 'error', ...data };
    }
    return envelope;
  }

  /** List what the compiler can see, useful for debugging. */
  function printFs() {
    const withIndent = (indent, node) => {
      let str = node.constructor.name ?? '<unknown>';
      if (node.contents) {
        str += ` [${node.contents.size}]\n`;
        node.contents.forEach((val, key) => {
          str += '  '.repeat(indent) + key + ' ' + withIndent(indent + 1, val);
        });
      } else if (node instanceof File) {
        str += ` (${node.size} bytes)\n`;
      } else {
        str += '\n';
      }
      return str;
    };
    return fs.prestat_name + withIndent(1, fs.dir);
  }

  /**
   * List the packages currently visible to the compiler, with the modules each
   * one exposes. This is everything needed to tell whether an `import` in the
   * user's source is already satisfiable.
   *
   * @returns {{ name: string, version: string, modules: string[] }[]}
   */
  function listPackages() {
    const packages = [];
    for (const [author, authorDir] of pkgDir.contents) {
      if (!(authorDir instanceof Directory)) continue;
      for (const [pkg, versions] of authorDir.contents) {
        if (!(versions instanceof Directory)) continue;
        for (const [version, versionDir] of versions.contents) {
          if (!(versionDir instanceof Directory)) continue;
          const elmJsonFile = versionDir.contents.get('elm.json');
          if (!(elmJsonFile instanceof File)) continue;
          try {
            const elmJson = JSON.parse(textDecoder.decode(elmJsonFile.data));
            const exposed = elmJson['exposed-modules'];
            packages.push({
              name: `${author}/${pkg}`,
              version,
              // Kernel packages describe exposure as { kernelGroup: [modules] }.
              modules: Array.isArray(exposed) ? exposed : Object.values(exposed ?? {}).flat(),
            });
          } catch {
            // ignore unreadable manifests
          }
        }
      }
    }
    return packages;
  }

  /**
   * Every module name present in the file system, whether or not the
   * application depends on it. Note that this includes packages that are only
   * there because the compiler ships their precompiled artifacts. Use
   * `listImportableModules()` for the modules an `import` can resolve to.
   */
  function listModules() {
    const names = new Set();
    for (const pkg of listPackages()) for (const m of pkg.modules) names.add(m);
    return names;
  }

  /**
   * The modules the application can actually import: those exposed by the
   * packages listed in its `elm.json` (direct or indirect).
   *
   * This is deliberately narrower than `listModules()`. The compiler ships
   * precompiled artifacts for a set of `elm/*` packages, so those packages are
   * present in the file system — but Elm resolves an import against the
   * application's dependencies only, so a package that is merely present is not
   * importable until it is added to `elm.json`.
   *
   * @returns {Set<string>}
   */
  function listImportableModules() {
    const elmJson = JSON.parse(readText('/elm.json'));
    const dependencies = new Set([
      ...Object.keys(elmJson.dependencies?.direct ?? {}),
      ...Object.keys(elmJson.dependencies?.indirect ?? {}),
    ]);
    const modules = new Set();
    for (const pkg of listPackages()) {
      if (!dependencies.has(pkg.name)) continue;
      for (const moduleName of pkg.modules) modules.add(moduleName);
    }
    return modules;
  }

  /**
   * Install an Elm package into the virtual file system so the compiler can
   * import it. `files` maps paths relative to the package root (e.g.
   * `"src/Maybe/Extra.elm"`) to their contents.
   *
   * Artifacts are optional: if a package has no precompiled `artifacts.dat`,
   * the compiler builds it from these sources on first use.
   */
  const packagePath = (name, version) => `/elm-home/0.19.1/packages/${name}/${version}`;

  function installPackage({ name, version, elmJson, files = {} }) {
    const base = packagePath(name, version);
    writeFile(`${base}/elm.json`, typeof elmJson === 'string' ? elmJson : JSON.stringify(elmJson, null, 4));
    for (const [relativePath, content] of Object.entries(files)) {
      writeFile(`${base}/${relativePath}`, content);
    }
    return base;
  }

  /**
   * The `elm.json` of a package version present in the file system, or `null`
   * when it is not there. Needed to resolve the dependencies of a package that
   * is satisfied from the file system instead of being downloaded.
   */
  function readPackageElmJson(name, version) {
    try {
      return JSON.parse(readText(`${packagePath(name, version)}/elm.json`));
    } catch {
      return null;
    }
  }

  /** Replace the application manifest the compiler reads at `/elm.json`. */
  function setApplicationElmJson(elmJson, filepath = '/elm.json') {
    writeFile(filepath, typeof elmJson === 'string' ? elmJson : JSON.stringify(elmJson, null, 4));
  }

  return {
    compile,
    readFile,
    readText,
    writeFile,
    createDir,
    unpackInto,
    installPackage,
    readPackageElmJson,
    setApplicationElmJson,
    listPackages,
    listModules,
    listImportableModules,
    printFs,
    fs,
    pkgDir,
    exports: wasmExports,
  };
}

function toUint8Array(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  return new Uint8Array(bytes);
}

/**
 * Wrap generated Elm JavaScript into a standalone HTML document.
 * @param {string} js  the compiled JavaScript
 * @param {string} name  the Elm module name (e.g. `Main`)
 */
export function wrapJsInHtml(js, name) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${name}</title>
  <style>body { padding: 8px; font-family: sans-serif; }</style>
</head>
<body>
<pre id="elm"></pre>
<script>
try {
${js}
  var app = Elm.${name}.init({ node: document.getElementById("elm") });
} catch (e) {
  var header = document.createElement("h1");
  header.style.fontFamily = "monospace";
  header.innerText = "Initialization Error";
  var pre = document.getElementById("elm");
  document.body.insertBefore(header, pre);
  pre.innerText = e;
  throw e;
}
</script>
</body>
</html>`;
}
