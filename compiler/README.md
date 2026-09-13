# Compiler build pipeline

Builds the Elm compiler to WebAssembly: `ulm.wasm` (a WASI reactor module) plus
`ulm.js` (the GHC JSFFI glue that instantiates it). These are the binaries
`@live-codes/elm-wasm` ships (see [`packages/elm-wasm`](../packages/elm-wasm)).

## Why there is a fork

The official [elm/compiler](https://github.com/elm/compiler) is a native binary;
the compiled-to-WASM port lives at
[marc136/elm-compiler-wasm](https://github.com/marc136/elm-compiler-wasm)
(branch `main-wasm`), which adds `WasmMake.hs` / `WasmRepl.hs` entry points and
exports (`compile`, `make`, `addPackage`, …) through GHC's JSFFI. It is a fork of
`elm/compiler`, so the result stays **BSD-3-Clause**; keep the licence and
attribution with any distribution.

## Files

| file | purpose |
| --- | --- |
| `versions.env` | pinned upstream commits, GHC flavour, build options |
| `install-toolchain.sh` | installs `wasm32-wasi-ghc` / `wasm32-wasi-cabal` (via ghc-wasm-meta) |
| `build.sh` | clones, patches, builds `exe:ulm`, emits `ulm.wasm` + `ulm.js` |
| `Dockerfile` | the toolchain as a reproducible image |
| `make-glue.sh` | recovery: regenerate `out/` from an already-linked `ulm.wasm` |

## Build

### Docker (recommended)

```bash
docker build -t elm-wasm-builder compiler
docker run --rm -v "$PWD/compiler/out:/out" elm-wasm-builder
```

Output lands in `compiler/out/` (`ulm.wasm`, `ulm.js`, `SHA256SUMS`). Then:

```bash
npm run fetch-assets -- --local --force   # copy the build into public/assets
```

### On a Linux host / CI

`build.sh` only needs the toolchain on `PATH`:

```bash
./compiler/install-toolchain.sh
source ~/.ghc-wasm/env
./compiler/build.sh
```

The toolchain is a few hundred MB of downloads (GHC bindist, wasi-sdk, node,
binaryen, cabal). `setup.sh` installs it into `~/.ghc-wasm` (or `$PREFIX`).

## How the build works

Roughly what `build.sh` does, and why each step exists:

1. **Clone the fork at a pinned commit** (`ELM_WASM_COMMIT`) and check out the
   `elm-src` submodule at `ELM_SRC_COMMIT`.
   The submodule is declared with an SSH URL in the fork's `.gitmodules`, which
   fails on CI — the script rewrites `git@github.com:` to `https://github.com/`.
2. **`wasm32-wasi-cabal build exe:ulm`.** `ulm.cabal` links the reactor module
   with `-no-hs-main -optl-mexec-model=reactor` and exports the functions
   `hs_init, wip, buildArtifacts, compile, make, addPackage, getPackages`.
3. **Copy the linked module** (`list-bin exe:ulm`) to `ulm.wasm`. `list-bin`
   runs the dependency solver too, so it gets the same flags as `build`; if it
   still refuses, the script falls back to finding the linked `.wasm`.
4. **Generate the JS glue.** GHC's post-linker (`post-link.mjs`, shipped with
   the toolchain) writes the JSFFI runtime that provides `ghc_wasm_jsffi` — the
   import our loader wires up. If GHC already emitted a `.js` next to the module,
   that is used instead.
5. **Optionally `wasm-opt -Oz`** (`OPTIMIZE=1`). This mirrors upstream's
   separate `optimize-wasm.sh` step. It is off by default because we cannot
   verify the optimized module here; turn it on once you have checked the output
   still loads.

Useful env knobs:

| variable | effect |
| --- | --- |
| `REUSE_WORK=1` | reuse an existing checkout in `WORK_DIR` (incremental rebuilds) |
| `WORK_DIR` | where sources are cloned (default `compiler/.work`) |
| `OUT_DIR` | where artifacts go (default `compiler/out`) |
| `CABAL_BUILD_ARGS` | extra flags for `wasm32-wasi-cabal` (see below) |

Because the cabal store lives inside the container, dependencies are rebuilt on
every run (~10 min). Mounting a persistent store speeds that up — but note it
must carry cabal's config too, or dependency resolution changes.

## Patches

**The fork's published tree does not compile.** The commits recorded in
`main-wasm` (including the `elm-src` submodule pin, which is also the branch
tip) are missing changes that the author evidently had locally. `build.sh`
applies the minimum needed, guarded so re-runs are no-ops:

1. **`Show Elm.ModuleName.Canonical`** (`elm-src/compiler/src/Elm/ModuleName.hs`)
   — the type has `Eq`/`Ord`/`Binary` but no `Show`, while
   `CompileToStringHelper` derives `Show Reporting.Error.Canonicalize.Error`,
   which contains it.
2. **`Show Reporting.Error.Error`** (`elm-src/.../CompileToStringHelper.hs`) —
   `Ulm.Details` calls `show` on it inside a `Debug.Trace`. Deriving one would
   require `Show` for every error variant, so the script adds a placeholder
   instance, matching how that module already stubs other types.

`versions.env` also sets `CABAL_BUILD_ARGS="--allow-newer=ulm:ghc-experimental"`:
the fork pins `ghc-experimental ^>=0.1.0.0` (its version in the GHC 9.11 nightly
it was built against), whereas released GHCs version that boot library as
`9.1204.0`, so the solver otherwise rejects the installed one and tries to build
the ancient `0.1.0.0` from Hackage.

## Updating

The upstream fork moves (slowly), so updating the binaries is: bump the pins,
rebuild, republish.

```bash
npm run check:pins     # report whether the pinned commits are stale
npm run update:pins    # rewrite compiler/versions.env with the latest commits
```

That is automated in CI:

- **`.github/workflows/update-compiler-pins.yml`** runs weekly, and if the pins
  are stale opens a PR bumping `versions.env`.
- **`.github/workflows/build-compiler.yml`** builds whenever `compiler/**`
  changes (or on a `compiler-v*` tag) and publishes `ulm.wasm`, `ulm.js`,
  `elm-modules-index.json` and `PINS.env` as a release with a `SHA256SUMS` file.

To consume a published build:

```bash
npm run fetch-assets -- --base https://github.com/OWNER/REPO/releases/latest/download --force
```

## Caveats

- **GHC flavour.** The fork was originally built against a GHC 9.11 nightly;
  `GHC_WASM_FLAVOUR=9.12` is confirmed working (GHC 9.12.4.20260731). If a
  toolchain bump breaks the build, try `9.10`/`9.14` — a one-line change in
  `versions.env`.
- **`elm-src` is a moving submodule.** `update-compiler-pins.mjs` reads the
  submodule commit from the fork's tree, so both pins move together.
- **Build time and disk.** Compiling the Elm compiler with the wasm backend takes
  tens of minutes. The toolchain alone (GHC, wasi-sdk, node, binaryen, wasmtime)
  is a few GB, so give Docker ~10 GB of headroom; a full build peaks well above
  the size of the final image because BuildKit holds the intermediate layers.
- **`python3` is required** by GHC's `./configure`, which `setup.sh` runs. The
  Dockerfile installs it; on a bare host, install it yourself
  (`install-toolchain.sh` checks for it and fails early with a clear message).
