#!/usr/bin/env bash
# Recovery step: build.sh links ulm.wasm but the cargs/store churn can lose the
# copy step. This takes an already-linked ulm.wasm from the work dir and emits
# compiler/out/{ulm.wasm,ulm.js}. Run inside the toolchain container.
set -euo pipefail

cd /opt/elm-wasm

BIN="$(find .work/src/dist-newstyle -type f -name ulm.wasm -path '*x/ulm/build/ulm/*' | head -n 1)"
[ -n "$BIN" ] || { echo "no linked ulm.wasm found" >&2; exit 1; }
echo "using: $BIN"
ls -l "$BIN"

mkdir -p out
cp "$BIN" out/ulm.wasm

POST_LINK="$(wasm32-wasi-ghc --print-libdir)/post-link.mjs"
node "$POST_LINK" -i out/ulm.wasm -o out/ulm.js

sha256sum out/ulm.wasm out/ulm.js
ls -l out
