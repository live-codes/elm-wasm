# Architecture preferences

- Prefers fetching third-party package assets through a pluggable source layer with a sensible default plus automatic fallback, rather than one hard-coded provider — explicitly asked to move off GitHub to a CDN mirror (default jsDelivr) because of rate limits. Confidence: 0.55
- Prefers declarative, data-driven config (e.g. a JSON import map mapping modules to URLs) for overriding resolution behavior, layered on top of automatic resolution. Confidence: 0.4
