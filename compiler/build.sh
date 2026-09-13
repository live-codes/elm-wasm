#!/usr/bin/env bash
# Builds the Elm compiler to WebAssembly.
#
# Produces, in $OUT_DIR (default compiler/out):
#   ulm.wasm   the compiler, as a WASI reactor module
#   ulm.js     the GHC JSFFI glue to instantiate it with
#   SHA256SUMS
#
# Requires the GHC wasm toolchain on PATH (see install-toolchain.sh or the
# Dockerfile), plus git, curl and node.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=versions.env
. "$HERE/versions.env"

OUT_DIR="${OUT_DIR:-$HERE/out}"
WORK_DIR="${WORK_DIR:-$HERE/.work}"
EXES="${ELM_WASM_EXES:-ulm}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing required tool: $1" >&2; exit 1; }; }
need git
need curl
need node
need wasm32-wasi-cabal
need wasm32-wasi-ghc

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR" "$OUT_DIR"

echo "Cloning ${ELM_WASM_REPO} (${ELM_WASM_REF})"
git clone --depth 1 --branch "$ELM_WASM_REF" "$ELM_WASM_REPO" "$WORK_DIR/src"
cd "$WORK_DIR/src"

# Fetch a specific commit even if it is behind the branch head. A shallow fetch
# by SHA works on GitHub; fall back to unshallowing if it does not.
checkout_pinned() {
  local dir="$1" commit="$2"
  [ -n "$commit" ] || return 0
  if ! git -C "$dir" fetch --depth 1 origin "$commit" 2>/dev/null; then
    (cd "$dir" && git fetch --unshallow) 2>/dev/null || git -C "$dir" fetch --all
  fi
  git -C "$dir" checkout --detach "$commit"
}

checkout_pinned . "${ELM_WASM_COMMIT:-}"

# The elm-src submodule is declared with an SSH URL, which fails in CI and in
# containers without SSH keys. Rewrite it to https.
git config --global url."https://github.com/".insteadOf "git@github.com:" || true
git submodule update --init --recursive

checkout_pinned elm-src "${ELM_SRC_COMMIT:-}"

POST_LINK="$(wasm32-wasi-ghc --print-libdir)/post-link.mjs"
[ -f "$POST_LINK" ] || { echo "post-link.mjs not found at $POST_LINK" >&2; exit 1; }

for EXE in $EXES; do
  echo
  echo "=== Building exe:${EXE} ==="
  wasm32-wasi-cabal build "exe:${EXE}"
  BIN="$(wasm32-wasi-cabal list-bin "exe:${EXE}")"

  if [ "$EXE" = "ulm" ]; then
    OUTPUT_WASM="$OUT_DIR/ulm.wasm"
    OUTPUT_JS="$OUT_DIR/ulm.js"
  else
    OUTPUT_WASM="$OUT_DIR/${EXE}.wasm"
    OUTPUT_JS="$OUT_DIR/${EXE}.js"
  fi

  cp "$BIN" "$OUTPUT_WASM"

  # The JSFFI glue is produced by GHC's post-linker. GHC usually emits it next
  # to the linked module; generate it explicitly if it didn't.
  if [ -f "${BIN}.js" ]; then
    cp "${BIN}.js" "$OUTPUT_JS"
  else
    node "$POST_LINK" -i "$OUTPUT_WASM" -o "$OUTPUT_JS"
  fi

  if [ "${OPTIMIZE:-0}" = "1" ] && command -v wasm-opt >/dev/null 2>&1; then
    echo "Optimizing with wasm-opt -Oz"
    wasm-opt -Oz "$OUTPUT_WASM" -o "$OUTPUT_WASM.opt"
    mv "$OUTPUT_WASM.opt" "$OUTPUT_WASM"
  fi
done

cd "$OUT_DIR"
# shellcheck disable=SC2012
ARTIFACTS="$(ls *.wasm *.js 2>/dev/null || true)"
if [ -n "$ARTIFACTS" ]; then
  # shellcheck disable=SC2086
  sha256sum $ARTIFACTS > SHA256SUMS
  echo
  cat SHA256SUMS
fi
ls -lh
