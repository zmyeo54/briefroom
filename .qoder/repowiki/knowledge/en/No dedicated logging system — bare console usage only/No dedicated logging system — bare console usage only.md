---
kind: logging_system
name: No dedicated logging system — bare console usage only
category: logging_system
scope:
    - '**'
source_files:
    - package.json
    - api/chat.js
    - scripts/tts_regression.mjs
    - scripts/dev-api-server.mjs
---

This repository does not implement a structured or framework-backed logging system. Across the React PWA (`src/`), Vercel serverless routes (`api/`), and Node/Python dev helpers (`scripts/`), all output is produced via plain `console.log`, `console.warn`, `console.error`, and `console.assert` calls with no centralized logger, log-level configuration, structured fields, or sink abstraction.

Evidence:
- No logging library is declared in `package.json` (no winston, pino, bunyan, morgan, debug, etc.).
- The only `console.*` usages are ad-hoc: API route assertions for internal tests (`api/chat.js`), script progress/error reporting (`scripts/tts_regression.mjs`, `scripts/dev-api-server.mjs`), and legacy flat app UI status messages (`_legacy_flat/app.js`).
- There is no `log/` or `logging/` directory, no logger initialization file, and no middleware that would capture request/response logs.

Consequences:
- Logs are unstructured text emitted to stdout/stderr; there is no way to filter by level, tag, or component.
- Serverless deployments rely on the platform's default stdout capture rather than any configured sink.
- Frontend code has no runtime logging at all (only UI error strings).

Developers should be aware that adding a proper logging layer (e.g., a shared logger module with levels and structured fields) would require introducing a dependency and wiring it into both the browser bundle and the serverless API entry points.