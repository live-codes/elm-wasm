# Reproducible toolchain for building the Elm compiler to WebAssembly.
#
#   docker build -t elm-wasm-builder compiler
#   docker run --rm -v "$PWD/compiler/out:/out" elm-wasm-builder
#
# The image only contains the toolchain; builds happen in build.sh at run time,
# so changing a pinned commit does not invalidate the image layer.
FROM debian:bookworm-slim

# setup.sh needs these; build.sh needs git/node (node comes from the toolchain).
# python3 is required by GHC's ./configure, which setup.sh runs.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl git jq unzip xz-utils zstd make perl file \
      build-essential procps python3 \
 && rm -rf /var/lib/apt/lists/*

COPY versions.env install-toolchain.sh build.sh /opt/elm-wasm/

RUN chmod +x /opt/elm-wasm/install-toolchain.sh /opt/elm-wasm/build.sh \
 && PREFIX=/opt/ghc-wasm /opt/elm-wasm/install-toolchain.sh

ENV OUT_DIR=/out
# Put the toolchain on PATH for the entrypoint.
ENV BASH_ENV=/opt/ghc-wasm/env

WORKDIR /workspace
ENTRYPOINT ["/bin/bash", "-lc", "/opt/elm-wasm/build.sh"]
