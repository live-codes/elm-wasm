# Workflow preferences

- Prefers tooling that auto-detects what it needs (e.g. inferring and installing package dependencies from the source's imports) over requiring the user to specify configuration explicitly; treats manual lists as optional overrides. Confidence: 0.35
- Prefers to validate a new capability as a self-contained, isolated proof-of-concept (its own dedicated/empty project directory) before wiring it into the main repository — when offered the choice, picked building a standalone PoC over editing the existing checkout directly. Confidence: 0.4
