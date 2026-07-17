---
kind: error_handling
name: Ad-hoc Error Handling with Retry & Fallback Chains
category: error_handling
scope:
    - '**'
source_files:
    - src/lib/fetchUrl.js
    - src/lib/tts.js
    - api/chat.js
    - api/fetch-url.js
    - api/tts.js
---

This repository has no centralized error-handling framework or custom error class hierarchy. Errors are handled ad-hoc using plain `new Error(...)` strings, `try/catch` blocks, and HTTP status codes returned from Vercel serverless functions. The approach is pragmatic and domain-specific rather than architectural.

**Frontend (`src/lib/`)**
- Validation errors throw descriptive `Error` messages (e.g., "Paste a URL first.", "Only http/https URLs are supported.") consumed by callers that surface them to the user.
- Network calls use `.catch(() => ({}))` to swallow parse failures and then rethrow contextualized errors like `Local extract failed (${res.status})`.
- TTS client (`src/lib/tts.js`) implements retry logic: transient server errors (502/504/500, "stream closed", "timed out", "websocket", "empty audio") trigger a single 500ms backoff retry before throwing; non-transient errors fail immediately.
- Audio playback errors reject promises with generic messages; silent failures are common via `.catch(() => {})` on `audio.play()` to avoid blocking UI.

**API layer (`api/`)**
- Every route handler wraps its body in `try/catch`, returning `{ error: { message } }` JSON with appropriate HTTP status (400 for bad input, 405 for wrong method, 502 for upstream failures, 500 for unexpected exceptions).
- `api/chat.js` implements two layered retry strategies:
  - `shouldTryNextKey(status, data)`: rotates API keys on 429/401/403 or when the response message matches quota/rate-limit patterns.
  - `shouldTryOtherProvider(status, data)`: falls back between providers (DeepSeek ↔ Gemini) on 402/429/401/403/404/5xx or provider-specific failure messages.
- `api/fetch-url.js` chains multiple extraction strategies (LinkedIn → SEEK GraphQL → Jina reader → Google cache → Playwright browser), catching each strategy's `Error` and trying the next; only after all fail does it throw a consolidated message.
- `api/tts.js` splits long text into chunks and retries each chunk up to `MAX_ATTEMPTS=3` with exponential backoff (350ms × attempt) against Edge TTS WebSocket flakiness.

**Conventions observed**
- No sentinel errors or typed error classes — all errors are string messages.
- Serverless routes never `throw` unhandled; they always respond with a JSON `{ error }` envelope.
- Transient vs. permanent failures are distinguished by status code + message regex, not by error type.
- There is no global error boundary, logging middleware, or structured logger — only occasional `console.error` / `console.assert`.
- Frontend callers are responsible for translating raw `Error.message` into user-facing feedback.