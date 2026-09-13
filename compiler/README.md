# Compiler build pipeline

Builds the Elm compiler to WebAssembly: `ulm.wasm` (a WASI reactor module) plus
`ulm.js` (the GHC JSFFI glue that instantiates it). These are the binaries the
PoC loads in `src/compiler.js`.

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
| `build.sh` | clones, builds `exe:ulm`, emits `ulm.wasm` + `ulm.js` |
| `Dockerfile` | the toolchain as a reproducible image |

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
3. **Copy the linked module** (`list-bin exe:ulm`) to `ulm.wasm`.
4. **Generate the JS glue.** GHC's post-linker (`post-link.mjs`, shipped with
   the toolchain) writes the JSFFI runtime that provides `ghc_wasm_jsffi` — the
   import our loader wires up in `src/compiler.js`. If GHC already emitted a
   `.js` next to the module, that is used instead.
5. **Optionally `wasm-opt -Oz`** (`OPTIMIZE=1`). This mirrors upstream's
   separate `optimize-wasm.sh` step. It is off by default because we cannot
   verify the optimized module here; turn it on once you have checked the output
   still loads.

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

- **GHC flavour.** The fork was originally built against a GHC 9.11 nightly.
  `versions.env` pins `GHC_WASM_FLAVOUR=9.12`, the closest released toolchain
  that provides `GHC.Wasm.Prim` (via the `ghc-experimental` boot library). If the
  build fails after a toolchain bump, try `9.10`/`9.14` — that is a one-line
  change in `versions.env`.
- **`elm-src` is a moving submodule.** `update-compiler-pins.mjs` reads the
  submodule commit from the fork's tree, so both pins move together.
- **Build time and disk.** Compiling the Elm compiler with the wasm backend takes
  tens of minutes. The toolchain alone (GHC, wasi-sdk, node, binaryen, wasmtime)
  is a few GB, so give Docker ~10 GB of headroom; a full build peaks well above
  the size of the final image because BuildKit holds the intermediate layers.
- **`python3` is required** by GHC's `./configure`, which `setup.sh` runs. The
  Dockerfile installs it; on a bare host, install it yourself
  (`install-toolchain.sh` checks for it and fails early with a clear message).
