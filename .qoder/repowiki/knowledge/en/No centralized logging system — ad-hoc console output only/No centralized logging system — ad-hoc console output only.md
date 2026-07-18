---
kind: logging_system
name: No centralized logging system — ad-hoc console output only
category: logging_system
scope:
    - '**'
source_files:
    - api/tts.js
    - api/chat.js
---

This repository does not implement a structured or centralized logging system. There is no dedicated logger library (pino, winston, bunyan, debug), no log-level configuration, no shared logging utility, and no log routing/sink setup.

**What exists today:**
- Serverless API routes (`api/chat.js`, `api/tts.js`) use bare `console.log` / `console.error` / `console.assert` calls directly in handler code. The only notable structured-ish output is `console.error("[tts] synthesis error:", e?.message, e?.stack)` in `api/tts.js`.
- Test/assert blocks at the bottom of `api/chat.js` also emit via `console.log`/`console.assert`.
- CLI scripts under `scripts/` use `console.log`/`console.warn`/`console.error` for human-readable test output.
- The Vercel deployment relies on the platform's default stdout/stderr capture; there is no custom transport, file sink, or external log aggregator configured.

**Conventions developers should follow (current state):**
- If you need to add logs, place `console.error(...)` calls near the failure path in the relevant serverless handler (`api/*.js`).
- Prefix messages with a module tag like `[tts]` so they can be grepped in Vercel logs.
- Do not log sensitive data (API keys, tokens) — none of the handlers currently sanitize their console output.
- For new features, consider introducing a small shared logger helper (e.g., `lib/logger.js`) that wraps `console.error` with timestamp + request-id fields, but this is not yet present.