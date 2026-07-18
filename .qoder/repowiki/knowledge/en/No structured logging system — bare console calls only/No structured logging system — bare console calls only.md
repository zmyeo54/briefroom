---
kind: logging_system
name: No structured logging system — bare console calls only
category: logging_system
scope:
    - '**'
source_files:
    - api/tts.js
    - api/chat.js
    - scripts/dev-api-server.mjs
    - scripts/tts_regression.mjs
---

This repository does not implement a logging system. There is no dedicated logger framework (winston, pino, bunyan, log4js, debug, etc.), no centralized logger initialization, and no configuration for log levels or sinks.

All output in the codebase uses plain `console.log`, `console.error`, and `console.warn` calls scattered across:
- `api/tts.js` — error logging with a `[tts]` prefix
- `api/chat.js` — minimal `console.log("ok")`
- `scripts/dev-api-server.mjs` — startup message
- `scripts/tts_regression.mjs` — test harness output (pass/fail summaries)

There are no shared logging utilities, no structured log fields, no log rotation or file sinks, and no environment-based level control. The frontend (`src/`) contains no logging calls at all.