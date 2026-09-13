# Architecture preferences

- Prefers fetching third-party package assets through a pluggable source layer with a sensible default plus automatic fallback, rather than one hard-coded provider — explicitly asked to move off GitHub to a CDN mirror (default jsDelivr) because of rate limits. Confidence: 0.55
- Prefers declarative, data-driven config (e.g. a JSON import map mapping modules to URLs) for overriding resolution behavior, layered on top of automatic resolution. Confidence: 0.4
- Wants a deliberately simple, minimal public API surface for a library — a one-shot entry point plus an optional reusable instance — rather than exposing internals. Confidence: 0.75
- Requires code to be environment-agnostic: no DOM APIs, so the same library runs in a web worker, the browser, and Node. Confidence: 0.7
- Wants published libraries bundled and minified (single artifact) when shipped as a package. Confidence: 0.7
- Wants libraries to ship more than one output format — alongside ESM, also an IIFE/UMD build that defines a global — so they can be consumed from a plain `<script>` tag and classic workers, not only by bundlers. Confidence: 0.55
