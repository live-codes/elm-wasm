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
- **Third-party packages, automatically**: just write `import Element` or `import Maybe.Extra` — imports are detected, resolved to packages via a module index, and installed into the compiler's virtual file system with no package list. A *Packages* field remains for manual overrides. See [Importing packages](#importing-packages).
- **Configurable CDN sources**: packages come from jsDelivr by default (no GitHub API rate limits) with GitHub as a fallback; switch with `?cdn=github`, or point at any mirror via a URL template. See [Package sources](#package-sources-cdns).
- **Import maps**: point individual modules at specific URLs with a small JSON map. See [Import maps](#import-maps).
- Elm's rich, structured **compile errors** (rendered as readable text).
- Everything is **isomorphic**: the same `src/compiler.js`, `src/sources.js`, `src/packages.js`, `src/imports.js` and `src/importmap.js` run in Node (`npm test`, `npm run test:imports`, `npm run test:packages`, `npm run test:sources`, `npm run test:importmap`) and in the browser.

## Quick start

```bash
npm install
npm run fetch-assets   # downloads the compiler assets (~12 MB, see "Assets" below)
npm run build:index    # builds the module -> package index for automatic imports (~30s)
npm start              # builds the bundle and serves http://localhost:8080
```

Other scripts:

| script | what it does |
| --- | --- |
| `npm test` | compiles `examples/counter.elm` in **Node** using the same code path the browser uses |
| `npm run test:imports` | auto-detects imports, installs the packages, and compiles (Node) |
| `npm run test:packages` | installs an explicitly-specified package from GitHub and compiles an importer (Node) |
| `npm run test:sources` | checks the CDN chain, fallback, and URL → package parsing (Node) |
| `npm run test:importmap` | checks that an import map URL actually overrides a module (Node) |
| `npm run build:index` | rebuilds the module → package index (needs network; ~30s) |
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

## Importing packages

Yes — and the playground does it automatically: write `import Maybe.Extra`, press Run, and the PoC detects the import, resolves it to `elm-community/maybe-extra`, installs it, and compiles. No package list required.

There are two halves.

### 1. Detecting imports and resolving them to packages

`src/imports.js` parses the `import` lines (comments stripped), maps each module to a package using `elm-modules-index.json`, and installs whatever is missing.

The mapping is the awkward part. The Elm compiler only knows which modules *installed* packages expose, and package.elm-lang.org has neither a bulk `module → package` endpoint nor CORS headers — so `scripts/build-module-index.mjs` builds an index offline from every package's `elm.json`, then we ship it as a static asset:

- only Elm 0.19 packages (this filters out the 0.18-era `elm-lang/*`, `evancz/*` packages);
- several packages can expose the same module, so ties are broken by how many indexed packages depend on each candidate (a popularity proxy), then by officialness (`elm/*`, `elm-explorations/*`), then by name;
- kernel packages need care: their `exposed-modules` is a map of kernel groups (`{"HTML": ["Html", "Html.Attributes", …]}`), not a list.

```bash
npm run build:index   # ~30s → public/assets/elm-modules-index.json (2042 packages, ~6100 modules, 0.3 MB)
```

Sample resolutions: `Html → elm/html`, `Parser → elm/parser`, `Maybe.Extra → elm-community/maybe-extra`, `Element → mdgriffith/elm-ui`, `Json.Decode.Pipeline → NoRedInk/elm-json-decode-pipeline`.

### 2. Installing the package

`src/packages.js` fetches the package's `elm.json` and `src/` through a CDN source (see below), writes them under `/elm-home/0.19.1/packages/<author>/<pkg>/<version>/`, recurses into the package's Elm dependencies, and rewrites `/elm.json`. Precompiled `artifacts.dat` files are only a cache: when they are missing the compiler builds the package from source on first use.

You can still name packages explicitly (the **Packages** field, or the CLI args below) when you want a specific version or a module the index does not know:

```bash
npm run test:imports                        # fully automatic: derives packages from the imports
npm run test:packages -- mdgriffith/elm-ui  # explicit spec
npm run test:packages -- elm/parser@1.1.0   # a transitive elm/* package
```

Verified automatically: `Element`, `Maybe.Extra`, `List.Extra`, `Json.Decode.Pipeline`. Verified explicitly: `mdgriffith/elm-ui` (1.1.8, ~100 source files) and `elm/parser` — an `elm/*` package that is *not* in the shipped artifacts, so it is fetched and compiled from source.

**Caveats.** The index maps module → package and takes the latest version of the winner; it is not a version solver. Transitive dependencies reuse an installed version when it satisfies the constraint, otherwise the constraint's lower bound. Projects with conflicting diamond constraints need the real `elm` CLI — a production integration should pre-resolve and ship exact versions (see below).

## Package sources (CDNs)

Elm packages are just public Git repos, so anything that mirrors GitHub can serve them. `src/sources.js` models this as an ordered list of sources, each able to map `author/package@version/path` to a URL and (optionally) list a package's files:

| source | file URL | listing |
| --- | --- | --- |
| `jsdelivr` *(default)* | `cdn.jsdelivr.net/gh/...` | `data.jsdelivr.com` API |
| `github` *(fallback)* | `raw.githubusercontent.com/...` | GitHub tree API |
| `statically` | `cdn.statically.io/gh/...` | — (paths derived from `exposed-modules`) |
| `fastly.jsdelivr`, `gcore.jsdelivr`, `jsdelivr.b-cdn` | other jsDelivr edges | jsDelivr API |

All of these send `Access-Control-Allow-Origin: *`, so this works from the browser.

- The **default chain is `jsdelivr → github`**. jsDelivr has a real file-listing API and is not subject to the 60-requests/hour unauthenticated GitHub rate limit, so it goes first; GitHub catches anything jsDelivr cannot serve (it also handles packages whose repo is private/renamed — `fetchPackage` moves to the next source on any error).
- **Choose a source** with the `?cdn=` query parameter (`?cdn=github`, `?cdn=statically`) — the chosen source goes first and the defaults remain as fallbacks.
- Or pass a **URL template** — `?cdn=https://my.mirror/{name}@{version}/{path}` — where `{name}` is `author/package`, `{version}` the version, and `{path}` the file path. Templates have no listing API, so file paths are derived from the package's `exposed-modules`.

```bash
npm run test:sources
```

## Import maps

An import map is JSON that points modules at specific URLs — useful for pinning a module to a fork, a commit, or your own host:

```json
{
  "imports": {
    "Maybe.Extra": "https://cdn.jsdelivr.net/gh/elm-community/maybe-extra@5.3.0/src/Maybe/Extra.elm",
    "Element": {
      "url": "https://example.com/forks/Element.elm",
      "package": "mdgriffith/elm-ui",
      "version": "1.1.8"
    }
  }
}
```

Paste it into the **Import map** panel (or pass the object/JSON to `installFromImportMap`). For each entry, the module's file is fetched from the URL and written over the installed package's copy.

One wrinkle: the Elm compiler only accepts imports that come from an installed **package**, and it validates `author/name@version` against its registry — so a bare URL is not enough on its own (a module dropped into the source directory is *not* importable; the compiler does not scan it). Each entry therefore needs a published package identity, which we resolve in this order:

1. explicit `package` / `version` fields in the entry;
2. parsed from the URL, when it is a known GitHub mirror (`cdn.jsdelivr.net/gh/<name>@<version>/...`, `raw.githubusercontent.com/<name>/<version>/...`, `cdn.statically.io/gh/...`);
3. the module index (for a plain `data:` or custom URL whose module is a published one).

The package is then installed via the CDN chain and the mapped module's file is replaced with the URL's content.

```bash
npm run test:importmap
```

That test patches `Maybe.Extra` so it additionally exposes a `sentinel` string and serves it from a `data:` URL; the compiled JavaScript contains the sentinel, proving the override was used.

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

- **Single module.** `compile(source)` compiles one module (with access to the installed packages). Multi-file projects would need the FS (`/src`) populated with several files — the plumbing is already there.
- **Package resolution is naive** (see [Importing packages](#importing-packages)): the index picks the latest version of the package that exposes a module, and there is no version solver. Packages are fetched from a CDN at runtime (jsDelivr by default, GitHub fallback — see [Package sources](#package-sources-cdns)), so it needs network and the package published on a GitHub-mirrored repo.
- **Import maps need a published package identity** (see [Import maps](#import-maps)): the compiler validates `author/name@version` against its registry, so a URL for a module belonging to no published package cannot be imported.
- **The compiler binary ships ~13 `elm/*` packages.** Anything else is fetched on demand; packages with native kernel code can only be official `elm/*` ones anyway.
- **The module index is a build step** (`npm run build:index`) and covers Elm 0.19 packages only. Without it, imports are not auto-installed and the *Packages* field must be used.
- **~12 MB compiler download**, cached by the browser thereafter. It loads in a fraction of a second locally and compiles the counter in well under a second.
- **Verbose compiler logs.** The Elm compiler's stdout/stderr is routed to the collapsible "Compiler log" panel.

## Path to a LiveCodes integration

LiveCodes already has the right seam for this: [`@live-codes/browser-compilers`](../../live-codes/browser-compilers) hosts in-browser compilers on a CDN, and language definitions declare which scripts to load. A concrete plan:

1. **Build & host the compiler.** Add the Elm WASM compiler + JSFFI glue + package artifacts to the `browser-compilers` repo (built by tag/commit), published to the CDN like the other compilers. This removes the dependency on `elm.run` and pins a specific Elm version.
2. **Thin loader.** Port `src/compiler.js` into a `browser-compilers` entry (e.g. `elm.ts`) exposing `loadElm()` / `elm.compile(code)`. Keep the WASI shim and tarball unpacking there; they are the only Elm-specific machinery.
3. **Worker.** Run the compiler in a Web Worker (as LiveCodes does for other heavy compilers) so the 12 MB module and compilation never block the UI. Load lazily on first Elm compile.
4. **Packages.** Runtime CDN fetches are fine for a PoC but not for production. Pre-resolve dependencies with the official `elm` CLI at build time and ship the exact set (sources + artifacts) as a tarball on the CDN, or route through our own CORS proxy/cache — the `cdn` option already makes the source pluggable. Ship `elm-modules-index.json` alongside the compiler so imports can be auto-resolved without hitting package.elm-lang.org, and let users pin individual modules with import maps.
5. **Language config in LiveCodes.** Register `elm` in the `Language` enum / languages map with `title`, `extensions: ['.elm']`, `editorLanguage: 'elm'` (Monaco's built-in `elm` language), and a `compile` hook that calls the worker and returns the generated JS.
6. **Run the output.** Elm emits a self-contained JS bundle that initializes `Elm.Main`; mount it into the preview iframe the way other compiled languages do. Errors map cleanly onto LiveCodes' error reporting since the compiler already returns structured `{ title, region, message }` problems.
7. **Docs & tests.** Add an "Elm" page under `docs/docs/languages/**`, a starter template, and a compiler test in the same place the other languages are tested.

The nice property of this design: LiveCodes' `compile` contract is just *source in, JS out*, and that is exactly what `wasm.exports.compile` gives us — the WASI/FS plumbing is an implementation detail that can live entirely inside the `browser-compilers` package.

## Project layout

```
src/compiler.js        environment-agnostic compiler core (WASI FS + compile)
src/sources.js         package sources (jsDelivr / GitHub / statically / templates)
src/packages.js        package installer + transitive dependencies
src/imports.js         import detection + module -> package resolution
src/importmap.js       import maps (module -> URL)
src/main.js            browser playground UI
public/index.html      the page
public/styles.css
public/assets/         downloaded/generated assets (git-ignored)
scripts/fetch-assets.mjs
scripts/build-module-index.mjs   builds the module -> package index
scripts/test-compile.mjs   Node smoke test (single module)
scripts/test-imports.mjs   Node smoke test (automatic imports)
scripts/test-packages.mjs  Node smoke test (explicit package install)
scripts/test-sources.mjs   Node smoke test (CDN chain + fallback)
scripts/test-importmap.mjs Node smoke test (import map override)
scripts/build.mjs          esbuild bundle
scripts/serve.mjs          static server with application/wasm
examples/counter.elm
examples/with-package.elm  imports elm-community/maybe-extra (auto-installed)
```

## Sources

- [marc136/elm.run — How to run Elm code in your browser](https://github.com/marc136/elm.run)
- [marc136/elm-compiler-wasm](https://github.com/marc136/elm-compiler-wasm)
- [elm/compiler](https://github.com/elm/compiler)
- [bjorn3/browser_wasi_shim](https://github.com/bjorn3/browser_wasi_shim)
- [GHC WebAssembly backend user guide](https://ghc.gitlab.haskell.org/ghc/doc/users_guide/wasm.html)
- [pithub/elm-compiler-in-elm](https://github.com/pithub/elm-compiler-in-elm)
- [brian-carroll/elm_c_wasm](https://github.com/brian-carroll/elm_c_wasm)
