---
kind: error_handling
name: Ad-hoc try/catch with user-facing Error messages and HTTP error envelopes
category: error_handling
scope:
    - '**'
source_files:
    - src/components/DocumentField.jsx
    - src/pages/HomePage.jsx
    - src/lib/tts.js
    - api/chat.js
    - api/tts.js
    - scripts/dev-api-server.mjs
---

This repository does not define a centralized error-handling framework, custom error classes, or middleware. Errors are handled locally in each component and API route using plain try/catch, throw new Error(...), and .catch() on Promises, with user-visible feedback delivered through React state (setError) or toast-style flash messages.

Client-side (React)
- src/components/DocumentField.jsx wraps file upload and URL fetch in try/catch, sets an error state string, and renders it inline; it also uses setStatus for transient progress and clears errors on success.
- src/pages/HomePage.jsx catches failures from the /api/chat call chain, surfaces them via a flash(..., "error") helper, and implements retry logic by toggling useDeepseekRetry to switch providers.
- src/lib/tts.js throws descriptive Error instances for empty input/nothing to export, retries transient Edge TTS failures (502/504/stream closed) with a short backoff, and converts upstream JSON { error } payloads into thrown messages. Audio playback errors reject the returned Promise rather than swallowing them.
- Browser-capability calls (localStorage, service-worker registration, speechSynthesis.cancel) are wrapped in bare try/catch blocks that ignore failures — these are treated as non-fatal.

Server-side (Vercel Edge / Node API routes)
- api/chat.js validates inputs early and responds with a uniform JSON envelope { error: { message } } for 400/405/503 cases. Upstream provider failures are classified by status + message regex (shouldTryNextKey, shouldTryOtherProvider) to rotate keys and fall back between DeepSeek/Gemini. A top-level catch returns 502 with { error: { message } }.
- api/tts.js parses/sanitizes input, splits long text into chunks, retries synthesis up to 3 times with exponential backoff, and returns 400/502/500 responses using the same { error } shape. Streaming errors from msedge-tts are caught and re-thrown so the outer handler can respond consistently.
- scripts/dev-api-server.mjs mirrors this envelope for local development ({ error: { message } }).

Conventions observed
- No shared error types or sentinel values — every caller constructs its own new Error(message) string.
- Client UI communicates errors either via per-component error state rendered inline or via a global flash(msg, "error") toast.
- Server APIs always return a JSON body shaped like { error: { message } } (or sometimes { error: "..." } in the TTS route), never throw unhandled exceptions.
- Transient network failures (TTS 502/504, upstream rate limits, WebSocket drops) are retried locally before surfacing an error to the user.
- Non-critical browser features (service worker, localStorage, speech synthesis) are guarded with silent try/catch so they do not break the app if unavailable.