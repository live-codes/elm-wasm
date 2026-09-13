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
#
# Env:
#   WORK_DIR     where the sources are cloned (default: <this dir>/.work)
#   REUSE_WORK=1 keep an existing checkout instead of re-cloning (incremental builds)
#   OUT_DIR      where the artifacts are written (default: <this dir>/out)
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

mkdir -p "$OUT_DIR"

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


# PATCHES
#
# The pinned upstream tree does not build as-is. All fixes live here so it is
# obvious what we had to change; each is guarded so re-runs are no-ops.

# `Elm.ModuleName.Canonical` has Eq/Ord/Binary instances but no Show, while
# CompileToStringHelper derives `Show Reporting.Error.Canonicalize.Error`, which
# contains it. Upstream's working tree evidently had this instance.
patch_module_name_show() {
  local file="elm-src/compiler/src/Elm/ModuleName.hs"
  if grep -q 'instance Show Canonical' "$file"; then
    return 0
  fi
  echo "patch: adding the missing Show instance for ModuleName.Canonical"
  cat >>"$file" <<'EOF'


instance Show Canonical where
  show (Canonical pkg name) =
    Pkg.toChars pkg ++ "." ++ Name.toChars name
EOF
}

# `Ulm.Details` (fork code) calls `show` on a `Reporting.Error.Error` inside a
# Debug.Trace, but nothing defines Show for it — and deriving one would require
# Show for every error variant. A placeholder instance is enough, as the helper
# already does for other types.
patch_error_show() {
  local file="elm-src/compiler/src/CompileToStringHelper.hs"
  if grep -q 'instance Show Reporting.Error.Error' "$file"; then
    return 0
  fi
  echo "patch: adding a Show instance for Reporting.Error.Error"
  sed -i 's|^import qualified Reporting.Error.Canonicalize$|import qualified Reporting.Error\nimport qualified Reporting.Error.Canonicalize|' "$file"
  cat >>"$file" <<'EOF'


instance Show Reporting.Error.Error where
  show _ = "<Reporting.Error.Error>"
EOF
}


# SOURCES

if [ "${REUSE_WORK:-0}" = "1" ] && [ -d "$WORK_DIR/src/.git" ]; then
  echo "Reusing checkout in $WORK_DIR/src"
  cd "$WORK_DIR/src"
else
  rm -rf "$WORK_DIR"
  mkdir -p "$WORK_DIR"

  echo "Cloning ${ELM_WASM_REPO} (${ELM_WASM_REF})"
  git clone --depth 1 --branch "$ELM_WASM_REF" "$ELM_WASM_REPO" "$WORK_DIR/src"
  cd "$WORK_DIR/src"

  checkout_pinned . "${ELM_WASM_COMMIT:-}"

  # The elm-src submodule is declared with an SSH URL, which fails in CI and in
  # containers without SSH keys. Rewrite it to https.
  git config --global url."https://github.com/".insteadOf "git@github.com:" || true
  git submodule update --init --recursive

  checkout_pinned elm-src "${ELM_SRC_COMMIT:-}"
fi

patch_module_name_show
patch_error_show

POST_LINK="$(wasm32-wasi-ghc --print-libdir)/post-link.mjs"
[ -f "$POST_LINK" ] || { echo "post-link.mjs not found at $POST_LINK" >&2; exit 1; }

for EXE in $EXES; do
  echo
  echo "=== Building exe:${EXE} (cabal args: ${CABAL_BUILD_ARGS:-none}) ==="
  # shellcheck disable=SC2086
  wasm32-wasi-cabal build "exe:${EXE}" ${CABAL_BUILD_ARGS:-}

  # `list-bin` runs the solver too, so it needs the same flags; fall back to
  # finding the linked module if it still refuses.
  # shellcheck disable=SC2086
  BIN="$(wasm32-wasi-cabal list-bin "exe:${EXE}" ${CABAL_BUILD_ARGS:-} 2>/dev/null || true)"
  if [ -z "$BIN" ] || [ ! -f "$BIN" ]; then
    BIN="$(find dist-newstyle -type f -name "${EXE}.wasm" | head -n 1)"
  fi
  [ -n "$BIN" ] && [ -f "$BIN" ] || { echo "could not locate ${EXE}.wasm" >&2; exit 1; }

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
