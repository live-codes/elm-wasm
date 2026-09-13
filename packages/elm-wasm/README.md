# @live-codes/elm-wasm

The Elm compiler, compiled to WebAssembly. Compiles Elm to JavaScript in the
**browser**, a **web worker**, or **Node** — no server round-trip. No DOM APIs
are used anywhere in the package.

```js
import { compile } from '@live-codes/elm-wasm';

const { js, name } = await compile(elmSource);
```

That's the whole API surface for the common case. The compiled `js` is a
self-contained Elm program: run it with `Elm.<name>.init({ node })`, or wrap it
in a document with `wrapJsInHtml(js, name)`.

## Install

```bash
npm install @live-codes/elm-wasm
```

The published package contains:

| file | size | what |
| --- | --- | --- |
| `dist/index.js` | ~40 kB | bundled, minified ESM (WASI shim + tarball reader + JSFFI glue included) |
| `dist/index.umd.js` | ~40 kB | the same bundle as an IIFE, defining the global `ElmWasm` |
| `dist/ulm.wasm` | ~12 MB | the compiler |
| `dist/elm-init.tar.gz` | 250 kB | Elm package sources + registry |
| `dist/elm-all-examples-package-artifacts.tar.gz` | 111 kB | precompiled package artifacts |
| `dist/elm-modules-index.json` | 324 kB | module → package index (for automatic imports) |

The JS bundle is small; the compiler itself is a separate `.wasm` file so it can
be streamed, cached and hosted on a CDN.

## Usage

### Compile

```js
import { compile } from '@live-codes/elm-wasm';

const source = `
module Main exposing (main)

import Html exposing (text)

main =
    text "hello"
`;

const { js, name } = await compile(source);
// name === 'Main'
```

Compilation failures throw an `ElmCompileError` carrying the structured Elm
problems:

```js
import { compile, ElmCompileError } from '@live-codes/elm-wasm';

try {
  await compile(source);
} catch (err) {
  if (err instanceof ElmCompileError) {
    for (const report of err.errors ?? []) {
      for (const problem of report.problems) {
        console.log(problem.title, problem.region, problem.message);
      }
    }
  }
}
```

### Reuse an instance

`createCompiler` keeps the WASM instance, the virtual file system and any
installed packages warm. Use it when compiling repeatedly (e.g. a playground):

```js
import { createCompiler } from '@live-codes/elm-wasm';

const elm = await createCompiler({ baseUrl: '/elm-wasm/' });

const a = await elm.compile(sourceA);
const b = await elm.compile(sourceB); // much faster — nothing is reloaded
```

### In a web worker

The package is worker-safe. Use a **module** worker (the bundle is ESM):

```js
// worker.js
import { compile } from '@live-codes/elm-wasm';

self.onmessage = async (event) => {
  try {
    const { js, name } = await compile(event.data);
    self.postMessage({ js, name });
  } catch (err) {
    self.postMessage({ error: err.message, errors: err.errors });
  }
};
```

```js
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
worker.postMessage(source);
```

> Behind a bundler, make sure the asset files (`ulm.wasm`, the two tarballs and
> the index) are copied to `baseUrl` — see [Assets](#assets).

### With a plain `<script>` tag (IIFE build)

`dist/index.umd.js` is a standalone IIFE build that defines the global
`ElmWasm` — no bundler, no module support required:

```html
<script src="https://cdn.jsdelivr.net/npm/@live-codes/elm-wasm/dist/index.umd.js"></script>
<script>
  ElmWasm.compile(source, {
    baseUrl: 'https://cdn.jsdelivr.net/npm/@live-codes/elm-wasm/dist/',
  })
    .then(({ js, name }) => {
      // `js` is a self-contained Elm program
    })
    .catch((err) => console.error(err.errors ?? err));
</script>
```

The same file works in a **classic** worker via `importScripts`:

```js
importScripts('https://cdn.jsdelivr.net/npm/@live-codes/elm-wasm/dist/index.umd.js');

self.onmessage = async (event) => {
  const { js, name } = await ElmWasm.compile(event.data, { baseUrl: '.../dist/' });
  self.postMessage({ js, name });
};
```

An IIFE has no `import.meta`, so the default asset location falls back to the
document (or, in a worker, to `location`). Passing an absolute `baseUrl` is
recommended.

### Packages

**Automatic.** `import Maybe.Extra` just works: imports are detected, resolved
to packages through the bundled module index, downloaded from a CDN and
installed into the compiler's virtual file system.

**Explicit.** Pin versions, or use something the index does not know:

```js
await compile(source, { packages: ['mdgriffith/elm-ui@1.1.8'] });
```

**Import maps.** Point a module at a specific URL (a fork, a commit, your own
host):

```js
await compile(source, {
  importMap: {
    'Maybe.Extra':
      'https://cdn.jsdelivr.net/gh/elm-community/maybe-extra@5.3.0/src/Maybe/Extra.elm',
  },
});
```

## Options

| option | default | meaning |
| --- | --- | --- |
| `baseUrl` | this module's directory | where `ulm.wasm` and the other assets are fetched from |
| `wasmBytes` / `wasmUrl` | — | provide the compiler module directly |
| `elmInitBytes` / `artifactsBytes` | — | override the package-data tarballs |
| `moduleIndex` | loaded from `baseUrl` | module → package index used by import detection |
| `importMap` | — | `{ "Module.Name": "url" }` or `{ imports: { … } }` |
| `packages` | `[]` | packages to install, e.g. `['elm-community/maybe-extra@5.3.0']` |
| `cdn` | `'jsdelivr'` → `'github'` | package source(s); a name, a list, or a URL template |
| `autoInstall` | `true` | detect imports and install missing packages |
| `onLog` | — | receives the compiler's output (useful for a log panel) |

`options` can be passed to `createCompiler` (defaults) and/or to
`compiler.compile(source, options)` (per call).

### Assets

By default assets are loaded relative to `dist/index.js`. That works when the
package is consumed unbundled, or served as-is. If you bundle the library into
your own app, the module URL changes — point `baseUrl` at wherever you copied
the files (a CDN is ideal, since `ulm.wasm` is ~12 MB):

```js
const elm = await createCompiler({ baseUrl: 'https://cdn.example.com/elm-wasm/' });
```

In Node the assets are read from disk (`file:` URLs are handled), so
`createCompiler()` works with no extra configuration.

## Notes and limitations

- **No source maps.** Elm 0.19 removed `--source-maps`, so `compile()` returns
  `map: undefined`. The field is reserved in case that changes.
- **The JSFFI glue is patched at build time.** GHC's post-link glue resolves
  `setImmediate` with a top-level `await`, which would make an IIFE build
  impossible; the build rewrites that one expression to resolve lazily. Behaviour
  is unchanged (the value is only needed when the RTS schedules work), and the
  ES build also ends up await-free. See `scripts/patch-glue.mjs`.
- **Single module.** `compile(source)` compiles one module; dependencies come
  from installed packages.
- **Package resolution is not a full version solver.** Imports are mapped to the
  latest version of the package that exposes the module; transitive dependencies
  reuse an installed version when it satisfies the constraint, otherwise the
  constraint's lower bound.
- **Network.** Automatic package installation fetches from a CDN at runtime
  (jsDelivr by default, GitHub as a fallback). Pass `autoInstall: false` and
  provide everything up front for a fully offline setup.
- **Licence.** The compiler is a fork of [elm/compiler](https://github.com/elm/compiler)
  (BSD-3-Clause); keep its licence and attribution with any redistribution.

## Development

```bash
npm run fetch-assets   # collect the compiler + data files (see below)
npm run build          # bundle + minify into dist/
node scripts/test-package.mjs
```

`assets/` is not committed. `fetch-assets` copies from the repo's
`public/assets/` when present, otherwise downloads them. The repo root builds
them:

```bash
npm run build:compiler   # ulm.wasm + ulm.js from the pinned upstream commit
npm run build:index      # elm-modules-index.json
```

The worker test lives in `test/` — serve it and open `test/index.html`.
