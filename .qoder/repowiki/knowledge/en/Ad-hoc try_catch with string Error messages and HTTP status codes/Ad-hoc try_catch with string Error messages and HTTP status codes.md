---
kind: error_handling
name: Ad-hoc try/catch with string Error messages and HTTP status codes
category: error_handling
scope:
    - '**'
source_files:
    - api/chat.js
    - api/fetch-url.js
    - api/tts.js
    - api/_ttsShared.js
    - lib/edgeTts.js
    - src/lib/tts.js
---

This repository does not define a centralized error-handling system. Errors are handled locally in each Vercel Edge Function and in the browser TTS client using plain `try`/`catch`, `throw new Error(...)`, and `.catch()` on promises, with no shared error types, sentinel values, or middleware.

**Server-side (Vercel Edge Functions)**
- Each route (`api/chat.js`, `api/fetch-url.js`, `api/tts.js`) wraps its handler body in a top-level `try`/`catch` that converts any thrown exception into a JSON `{ error: message }` response with an HTTP status of 502 or 500.
- Validation failures return early with explicit 4xx statuses (400 for missing/invalid body, 405 for wrong method, 503 when no API keys are configured).
- Upstream provider failures are surfaced by returning the upstream `res.status` and parsed JSON body directly to the caller; transient failures (429/401/403) trigger key rotation via `shouldTryNextKey`, and cross-provider fallback is driven by `shouldTryOtherProvider`.
- Scraping helpers in `api/fetch-url.js` throw descriptive `Error` strings per strategy (LinkedIn, SEEK GraphQL, Jina reader, Google cache, Playwright browser); the outer handler catches them and returns 502.
- The TTS route uses a small retry loop (`MAX_ATTEMPTS = 3`) around `MsEdgeTTS.toStream`, with backoff and a stream-timeout wrapper that rejects with `"TTS timed out"`.
- No custom error class exists; all server errors are plain `Error` objects whose `.message` is echoed to the client.

**Client-side (src/lib/tts.js)**
- `fetchAudio` calls `/api/tts` and retries once on transient responses (502/504 or messages containing "stream closed", "timed out", "websocket", "empty audio") before throwing a user-facing `Error`.
- `synthesizeQaAudio` / `exportMergedQaAudio` throw `Error("Nothing to export")` when there is no content.
- Audio playback errors bubble up as rejected Promises from `playBlob`; callers typically ignore them or surface a generic message.
- There is no global unhandled-rejection handler, no toast/notification library integration, and no structured error envelope — the UI reads `data.error` from the JSON body where present.

**Conventions observed**
- Use `res.status(N).json({ error: message })` for every server error path.
- Throw plain `new Error("human-readable message")` from internal helpers so the route-level catch can serialize it.
- Treat 429/401/403/500/502/504 as transient and retry/backoff rather than failing immediately.
- Do not swallow errors silently except for non-fatal housekeeping (e.g., `tts.close().catch(() => {})`).

There is no shared error module, no Zod-style validation layer, no Sentry/Bugsnag integration, and no `panic`/`recover` equivalent.