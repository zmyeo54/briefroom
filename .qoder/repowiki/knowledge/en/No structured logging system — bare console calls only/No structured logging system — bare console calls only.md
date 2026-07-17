---
kind: logging_system
name: No structured logging system — bare console calls only
category: logging_system
scope:
    - '**'
source_files:
    - api/tts.js
    - scripts/dev-api-server.mjs
    - scripts/tts_regression.mjs
    - api/chat.js
---

This repository does not implement a logging system. There is no dedicated logger framework (e.g., pino, winston, bunyan), no log-level configuration, no centralized logger initialization, and no structured log fields or sinks.

Across the codebase, logging consists entirely of ad-hoc `console.log`, `console.error`, and `console.warn` / `console.assert` calls scattered in a few places:
- Serverless API route `api/tts.js` uses `console.error("[tts] synthesis error:", e?.message, e?.stack)` for TTS failures.
- Scripts under `scripts/` (`dev-api-server.mjs`, `tts_regression.mjs`) use `console.log`/`console.error` for human-readable test output.
- `api/chat.js` uses `console.assert` for internal unit-style checks.
- The React frontend (`src/`) contains zero `console.*` calls; it has no client-side logging at all.

There is no shared logging utility, no environment-based level toggling, and no convention for log message formatting beyond simple bracketed prefixes like `[tts]`. Errors are surfaced to callers via thrown exceptions and HTTP responses rather than being emitted through a logging layer.