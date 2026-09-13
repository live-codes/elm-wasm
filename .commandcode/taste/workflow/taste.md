# Workflow preferences

- Prefers tooling that auto-detects what it needs (e.g. inferring and installing package dependencies from the source's imports) over requiring the user to specify configuration explicitly; treats manual lists as optional overrides. Confidence: 0.35
- Prefers to validate a new capability as a self-contained, isolated proof-of-concept (its own dedicated/empty project directory) before wiring it into the main repository — when offered the choice, picked building a standalone PoC over editing the existing checkout directly. Confidence: 0.4
- When requesting a feature, prefers it be modeled on an existing proven implementation and cites the exact source file to follow (e.g. pointed at LiveCodes' `services/modules.ts` as the pattern for the CDN layer). Confidence: 0.5
