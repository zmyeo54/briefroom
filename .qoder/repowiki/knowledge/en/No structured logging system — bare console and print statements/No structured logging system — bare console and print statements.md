---
kind: logging_system
name: No structured logging system — bare console and print statements
category: logging_system
scope:
    - '**'
source_files:
    - api/chat.js
    - scripts/dev-api-server.mjs
    - scripts/tts_server.py
---

This repository does not implement a logging system. There is no dedicated logger framework, no log-level management, no structured-log fields, and no centralized logging configuration.

Evidence across the codebase:
- No logging dependencies in `package.json` (no pino, winston, bunyan, debug, loglevel, sentry, datadog, etc.).
- The Node.js API routes (`api/chat.js`, `api/tts.js`, `scripts/dev-api-server.mjs`) contain zero `console.log/info/warn/error` calls; they return JSON error objects with an `error.message` / `error.code` shape but do not emit server-side logs.
- The only stdout output comes from ad-hoc `console.assert(...)` unit-style assertions in `api/chat.js` and a single `console.log` startup message in `scripts/dev-api-server.mjs`. The Python TTS helper uses plain `print()` calls.
- The React frontend (`src/`) contains no client-side logging at all; errors are surfaced to the UI via state and flash messages rather than being logged.

Consequences: there are no conventions for log levels, no request-id correlation, no audit trail of upstream provider failures, and no way to filter or route logs by severity or component.