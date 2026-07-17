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

This repository does not implement a logging system. There is no dedicated logger library (pino, winston, bunyan, debug, etc.), no log-level configuration, no structured log fields, and no centralized logging initialization or sink routing.

Across the codebase, all output uses plain Node.js `console` methods:
- `api/tts.js`: `console.error("[tts] synthesis error:", e?.message, e?.stack)` in the Vercel Edge Function error handler.
- `scripts/dev-api-server.mjs`: `console.log("[dev-api] listening on http://...")` at startup.
- `scripts/tts_regression.mjs`: `console.log`, `console.warn`, `console.error` used for test pass/fail reporting.
- `api/chat.js`: `console.assert` and `console.log("ok")` are used exclusively inside an inline self-test block that runs when the file is executed directly (`node api/chat.js`).

The React SPA under `src/` contains zero `console.*` calls, so browser-side output is also unstructured and absent. There is no middleware, no request/response interceptor, and no convention for attaching contextual fields (request id, user id, latency) to logs.