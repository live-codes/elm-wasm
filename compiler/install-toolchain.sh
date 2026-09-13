#!/usr/bin/env bash
# Installs the GHC WebAssembly toolchain (wasm32-wasi-ghc + cabal + wasi-sdk +
# binaryen) via ghc-wasm-meta, pinned to GHC_WASM_META_REF.
#
# This mirrors what ghc-wasm-meta's bootstrap.sh does, except bootstrap.sh
# always downloads the `master` tarball; here the ref is pinned.
#
#   ./compiler/install-toolchain.sh
#   source ~/.ghc-wasm/env
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=versions.env
. "$HERE/versions.env"

PREFIX="${PREFIX:-$HOME/.ghc-wasm}"
REF="${GHC_WASM_META_REF:-master}"
FLAVOUR="${GHC_WASM_FLAVOUR:-9.12}"

for tool in curl tar; do
  command -v "$tool" >/dev/null || { echo "missing required tool: $tool" >&2; exit 1; }
done

# GHC's ./configure (run by ghc-wasm-meta's setup.sh) needs Python 3.7+.
if ! command -v python3 >/dev/null && ! command -v python >/dev/null; then
  echo "missing required tool: python3 (GHC's configure needs Python >= 3.7)" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Installing ghc-wasm-meta@${REF} (GHC ${FLAVOUR}) into ${PREFIX}"
curl -fsSL --retry 5 \
  "https://gitlab.haskell.org/haskell-wasm/ghc-wasm-meta/-/archive/${REF}/ghc-wasm-meta-${REF}.tar.gz" \
  | tar xz --strip-components=1 -C "$WORK"

FLAVOUR="$FLAVOUR" PREFIX="$PREFIX" "$WORK/setup.sh"

echo
echo "Toolchain installed. Add it to your PATH with:"
echo "  source ${PREFIX}/env"
