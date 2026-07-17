---
kind: error_handling
name: Ad-hoc try/catch with per-layer error shaping, no centralized error system
category: error_handling
scope:
    - '**'
source_files:
    - api/chat.js
    - api/tts.js
    - api/_ttsShared.js
    - src/lib/tts.js
    - src/lib/fetchUrl.js
    - src/lib/prompt.js
    - src/components/DocumentField.jsx
---

The repository has no centralized error-handling framework or shared error types. Each layer handles errors locally using plain `try`/`catch` and `throw new Error(...)`, then shapes the response for its caller.

**Server-side (Vercel Edge Functions)**
- `api/chat.js`: No custom error class. Upstream failures are detected by status codes and message regexes (`shouldTryNextKey`, `shouldTryOtherProvider`). Timeouts use `AbortSignal.timeout` and `isAbortError`; a `timeoutResponse` helper returns `{ upstream: { ok:false, status:504 }, data: { error: { message, code:"upstream_timeout", provider } } }`. The handler loops over providers → keys, falls back to the other provider when `shouldTryOtherProvider` is true, and wraps the whole loop in a top-level `try` that returns 502 on unexpected exceptions. Validation errors return 400/405/503 JSON bodies with an `error.message` field.
- `api/tts.js`: Uses a `collectStream` wrapper around the Edge TTS stream; timeouts reject with `new Error("TTS timed out")`. A retry loop (`synthesizeWithRetry`) retries transient failures up to `MAX_ATTEMPTS=3` with exponential backoff. Input validation returns 400 JSON `{ error }`; synthesis errors log via `console.error` and return 500 JSON `{ error }`.
- Shared helpers in `lib/edgeTts.js` (re-exported through `api/_ttsShared.js`) provide `sanitizeSpeakText`, `resolveVoice`, `rateToEdge`, `cors` — no error types there.

**Client-side (React + Vite)**
- `src/lib/tts.js`: `fetchAudio` calls `/api/tts`, parses `res.json()` into `data?.error`, maps 502/504 to a friendly "Practice voice isn't ready yet" message, and re-throws a user-facing `Error(msg)` after one retry for transient statuses (`isTransientTtsError` checks 502/504/500 plus "stream closed"/"timed out"/"websocket"/"empty audio"). `synthesizeQaAudio` / `exportMergedQaAudio` throw `Error("Nothing to export")` when input is empty.
- `src/lib/fetchUrl.js`: Throws descriptive `Error`s for each extraction path (local proxy, Reader API, external proxy) — e.g. "Only http/https URLs are supported", "Got a LinkedIn login page instead of the job description", "Proxy hit a login wall".
- `src/lib/prompt.js`: Throws `Error("Empty model response")` and `Error("Model did not return valid JSON")` when parsing fails.
- Components (`DocumentField.jsx`, `InstallPrompt.jsx`, `Shell.jsx`) catch thrown errors and set local `useState` error strings or silently swallow browser-API errors via `.catch(() => {})`.

**Conventions observed**
- Errors are represented as plain `Error` objects with human-readable `message` strings — no custom subclasses or sentinel values.
- Server routes respond with a consistent `{ error: { message, ... } }` JSON shape; clients read `data?.error` from responses.
- Transient network/stream failures are retried at the call site rather than bubbled up.
- There is no global unhandled-rejection handler, no error boundary, and no structured logging library — server errors fall back to `console.error`.

**Rules developers should follow**
1. Throw `new Error(userMessage)` from lib functions; let callers decide whether to retry or surface to UI.
2. In Vercel handlers, validate inputs early and return `{ error: { message } }` with the appropriate HTTP status (400/405/503); wrap async work in a single `try` that returns 502 on unexpected exceptions.
3. For upstream calls, prefer status-code + message-regex heuristics (`shouldTryNextKey`, `shouldTryOtherProvider`) over custom error types to drive key rotation and provider failover.
4. Treat 502/504/500 plus stream-related messages as transient and retry once before surfacing an error to the user.