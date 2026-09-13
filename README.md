# Elm in the browser — proof of concept

A small, self-contained proof of concept that **compiles Elm to JavaScript entirely in the browser** — no server round-trip, no build step on the user's machine. It is structured so the compiler module can be lifted into [LiveCodes](../../live-codes/livecodes) later.

Open the page, edit `Main.elm`, press **Run** (or Ctrl/⌘+Enter), and the compiled Elm app renders in the output pane.

```
┌───────────────────────────┬───────────────────────────┐
│  Main.elm (textarea)      │  output iframe            │
│                           │                           │
│  module Main exposing ..  │   Elm in the browser      │
│  ...                      │    -   3   +              │
└───────────────────────────┴───────────────────────────┘
        [Run ▸]  Ctrl/⌘+Enter          Compiled in 828 ms
```

## What works

- Full Elm **0.19.1** compilation (the real Elm compiler, not an interpreter) running as WebAssembly in the page.
- A real app: the default example is a `Browser.sandbox` counter using `elm/browser` + `elm/html`, with working `onClick` events in the output iframe.
- Elm's rich, structured **compile errors** (rendered as readable text).
- Everything is **isomorphic**: the exact same `src/compiler.js` runs in Node (`npm test`) and in the browser.

## Quick start

```bash
npm install
npm run fetch-assets   # downloads the compiler assets (~12 MB, see "Assets" below)
npm start              # builds the bundle and serves http://localhost:8080
```

Other scripts:

| script | what it does |
| --- | --- |
| `npm test` | compiles `examples/counter.elm` in **Node** using the same code path the browser uses |
| `npm run build` | bundles `src/main.js` → `public/bundle.js` with esbuild |
| `npm run serve` | serves `public/` with correct MIME types (`application/wasm`) |
| `npm run fetch-assets -- --force` | re-downloads the compiler assets |

> If `esbuild` is missing after `npm install`, you are probably installing with `NODE_ENV=production`. Run `npm install --include=dev`.

## How it works

The Elm compiler is a Haskell program. This PoC uses a build of it compiled to **WASI** with GHC's WebAssembly backend. That means the browser must provide:

1. **A WASI implementation** — [`@bjorn3/browser_wasi_shim`](https://github.com/bjorn3/browser_wasi_shim).
2. **The GHC WebAssembly JSFFI glue** — `ulm.js`, the runtime support for Haskell's JS foreign function interface.
3. **A virtual file system** — the compiler reads an `elm.json` and `src/`, and resolves dependencies from an `elm-home/.../packages` tree. All of that lives in memory (`PreopenDirectory` from the shim), populated from two tarballs.

At a high level (`src/compiler.js`):

```
createElmCompiler({ wasmBytes, jsffi, artifactsTarGz, elmInitTarGz })
        │
        ├─ build an in-memory FS:
        │     /elm.json            (application manifest, deps)
        │     /src/                (the user's code)
        │     /tmp/                (compiler output goes here)
        │     /elm-home/0.19.1/packages/   (Elm package sources + artifacts)
        │
        ├─ unpack elm-init.tar.gz              -> package sources, registry, elm.json
        ├─ unpack ...package-artifacts.tar.gz  -> precompiled interfaces/objects (artifacts.dat)
        │
        ├─ WebAssembly.instantiate(wasm, { ghc_wasm_jsffi, wasi_snapshot_preview1 })
        │
        └─ compile(source) -> wasm.exports.compile(source)
                             -> { file: "/tmp/generated.js", name: "Main" }
                             -> readFile()/decode -> wrapJsInHtml() -> iframe
```

`wasm.exports.compile(source)` takes an Elm source string and returns JSON. The result envelope differs between builds, so `normalizeResult()` accepts both:

- `{ fn: "compile", result: "ok",  data: { file, name } }`
- `{ fn: "compile", result: "err", data: { errors: [...] } }`

and the older `{ type: "success" | "compile-errors", ... }` shape.

## Assets

`npm run fetch-assets` downloads four files into `public/assets/` (git-ignored):

| file | size | purpose |
| --- | --- | --- |
| `ulm.wasm` | ~12 MB | the Elm compiler, built to WASI |
| `ulm.js` | 4.6 KB | GHC WebAssembly JSFFI glue |
| `elm-init.tar.gz` | 250 KB | Elm package **sources** + the package registry (`elm init` output) |
| `elm-all-examples-package-artifacts.tar.gz` | 114 KB | precompiled package **interfaces/objects** (`artifacts.dat`) |

Sources and artifacts are complementary: the tarball of sources gives the compiler real `.elm` files, and the artifacts tarball gives it precompiled `artifacts.dat` so dependencies are not recompiled on every run. Unpacking sources first and artifacts second means the real `artifacts.dat` files overwrite the empty placeholders in the sources tarball.

### Where the binaries come from

Building the compiler to WASM needs a GHC WebAssembly cross-compiler plus a WASI sysroot, which is out of scope for a PoC. These binaries are therefore reused from the [elm.run](https://github.com/marc136/elm.run) project by [@marc136](https://github.com/marc136):

- `ulm.wasm` / `ulm.js` — <https://elm.run/ulm.wasm>, <https://elm.run/ulm.js>
- the tarballs — <https://elm.run/elm-init.tar.gz>, <https://elm.run/elm-all-examples-package-artifacts.tar.gz>

The compiler itself is a fork of the official [elm/compiler](https://github.com/elm/compiler) (BSD-3-Clause); the wasm port lives at [marc136/elm-compiler-wasm](https://github.com/marc136/elm-compiler-wasm). **For a real integration these artifacts must be built and hosted by us** (see below), with the Elm compiler's BSD-3 license and attribution preserved — treat this PoC's binaries as a stopgap for evaluating feasibility, not as something to ship.

## Why not the other options

I evaluated the other ways to compile Elm in a browser before settling on this one:

- **Official `elm-lang.org/try`** — compiles **server-side** (it posts to `worker.elm-lang.org/compile`). Not usable offline/in-browser.
- **`pithub/elm-compiler-in-elm`** — a full port of the compiler from Haskell to Elm that runs as pure JS in the browser. Attractive (no WASM), but it is a work-in-progress port and it needs Elm package sources at runtime (the demo uses a CORS proxy). Keep an eye on it.
- **`brian-carroll/elm_c_wasm`** — compiles **Elm apps to WASM**; it is not an Elm→JS compiler you can run in the page.
- **Building GHC→WASM ourselves** — the "correct" long-term answer, but it needs the GHC wasm cross toolchain and a WASI sysroot.

## Limitations / rough edges

- **Single module.** `compile(source)` compiles one module (with access to all `elm/*` packages). Multi-file projects would need the FS (`/src`) populated with several files — the plumbing is already there.
- **Only `elm/*` core packages.** The artifacts tarball ships the standard packages (`elm/core`, `elm/html`, `elm/browser`, `elm/json`, `elm/virtual-dom`, `elm/time`, `elm/url`, plus `svg`, `regex`, `bytes`, `file`, `random`, `http`). Third-party packages would need their sources/artifacts added to the FS (and `registry.dat` for resolution).
- **~12 MB compiler download**, cached by the browser thereafter. It loads in a fraction of a second locally and compiles the counter in well under a second.
- **Verbose compiler logs.** The Elm compiler's stdout/stderr is routed to the collapsible "Compiler log" panel.

## Path to a LiveCodes integration

LiveCodes already has the right seam for this: [`@live-codes/browser-compilers`](../../live-codes/browser-compilers) hosts in-browser compilers on a CDN, and language definitions declare which scripts to load. A concrete plan:

1. **Build & host the compiler.** Add the Elm WASM compiler + JSFFI glue + package artifacts to the `browser-compilers` repo (built by tag/commit), published to the CDN like the other compilers. This removes the dependency on `elm.run` and pins a specific Elm version.
2. **Thin loader.** Port `src/compiler.js` into a `browser-compilers` entry (e.g. `elm.ts`) exposing `loadElm()` / `elm.compile(code)`. Keep the WASI shim and tarball unpacking there; they are the only Elm-specific machinery.
3. **Worker.** Run the compiler in a Web Worker (as LiveCodes does for other heavy compilers) so the 12 MB module and compilation never block the UI. Load lazily on first Elm compile.
4. **Language config in LiveCodes.** Register `elm` in the `Language` enum / languages map with `title`, `extensions: ['.elm']`, `editorLanguage: 'elm'` (Monaco's built-in `elm` language), and a `compile` hook that calls the worker and returns the generated JS.
5. **Run the output.** Elm emits a self-contained JS bundle that initializes `Elm.Main`; mount it into the preview iframe the way other compiled languages do. Errors map cleanly onto LiveCodes' error reporting since the compiler already returns structured `{ title, region, message }` problems.
6. **Docs & tests.** Add an "Elm" page under `docs/docs/languages/**`, a starter template, and a compiler test in the same place the other languages are tested.

The nice property of this design: LiveCodes' `compile` contract is just *source in, JS out*, and that is exactly what `wasm.exports.compile` gives us — the WASI/FS plumbing is an implementation detail that can live entirely inside the `browser-compilers` package.

## Project layout

```
src/compiler.js        environment-agnostic compiler core (WASI FS + compile)
src/main.js            browser playground UI
public/index.html      the page
public/styles.css
public/assets/         downloaded compiler assets (git-ignored)
scripts/fetch-assets.mjs
scripts/test-compile.mjs   Node smoke test
scripts/build.mjs          esbuild bundle
scripts/serve.mjs          static server with application/wasm
examples/counter.elm
```

## Sources

- [marc136/elm.run — How to run Elm code in your browser](https://github.com/marc136/elm.run)
- [marc136/elm-compiler-wasm](https://github.com/marc136/elm-compiler-wasm)
- [elm/compiler](https://github.com/elm/compiler)
- [bjorn3/browser_wasi_shim](https://github.com/bjorn3/browser_wasi_shim)
- [GHC WebAssembly backend user guide](https://ghc.gitlab.haskell.org/ghc/doc/users_guide/wasm.html)
- [pithub/elm-compiler-in-elm](https://github.com/pithub/elm-compiler-in-elm)
- [brian-carroll/elm_c_wasm](https://github.com/brian-carroll/elm_c_wasm)
