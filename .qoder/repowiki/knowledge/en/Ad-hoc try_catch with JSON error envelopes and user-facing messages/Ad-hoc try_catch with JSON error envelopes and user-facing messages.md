---
kind: error_handling
name: Ad-hoc try/catch with JSON error envelopes and user-facing messages
category: error_handling
scope:
    - '**'
source_files:
    - api/chat.js
    - api/tts.js
    - api/fetch-url.js
    - src/components/DocumentField.jsx
    - scripts/tts_server.py
---

This repository has no centralized error-handling framework, typed error classes, or middleware. Errors are handled locally in each file using plain `try`/`catch`, thrown as bare `Error` (Node/JS) or `ValueError` (Python), and surfaced to callers via simple JSON bodies that contain an `error` field — usually a string message. There is no shared error type, sentinel errors, or structured error code system.

**Serverless API routes (`api/*.js`)**
- Each Vercel handler starts by calling `cors(res)` and immediately returns early for `OPTIONS` and non-`POST` requests with a `{ error: "..." }` JSON body and a specific status (405).
- Input validation failures return `400` with `{ error: "text required" | "url required" | ... }`.
- Upstream provider failures are not re-thrown; instead the route inspects HTTP status + parsed JSON fields (`data.error.message`, `data.error.status`) and decides whether to rotate keys or switch providers (`shouldTryNextKey`, `shouldTryOtherProvider`). When all retries are exhausted it forwards the upstream status/data unchanged, so client errors (4xx) bubble through.
- Unhandled exceptions inside the handler's top-level `try` block are caught and returned as `502`/`500` with `{ error: e.message || "..." }`.
- The chat route additionally uses regex matching on error strings for quota/rate-limit/timeout keywords to drive retry/fallback logic.

**TTS synthesis (`api/tts.js`, `scripts/tts_server.py`)**
- Both Node and Python TTS endpoints split long text into chunks, wrap each chunk in a retry loop with exponential backoff, and throw `Error("empty audio")` / `ValueError("empty audio")` when the stream yields nothing. These propagate up to the handler's outer `try`/`catch`, which maps them to `502`/`500` JSON responses.
- Validation errors (`text too long`, `empty speech text`) return `400` with a human-readable `{ error: "..." }`.

**URL fetcher (`api/fetch-url.js`, `scripts/job_fetch.py`)**
- Each strategy function throws descriptive `Error`/`ValueError` messages (e.g. `"LinkedIn page did not include a usable job description"`, `"Not a LinkedIn job URL"`). The caller loops strategies and re-throws the last exception after exhausting all options, which the handler catches and returns as `502 { error: "..." }`.
- The Python server also wraps JSON parse failures in explicit `400 { error: "invalid json" }` responses.

**React UI (`src/components/DocumentField.jsx`)**
- User-facing errors are stored in local component state (`setError(...)`) and rendered inline as small red paragraphs. Errors come from either thrown `Error`s during OCR/URL extraction or from the server's `{ error }` envelope, which the parent call sites unwrap before throwing a new user-friendly `Error`.
- Non-fatal browser-capability checks (service worker registration, PWA install prompt) use `.catch(() => {})` to silently swallow errors.

**Conventions developers should follow**
- For serverless handlers: validate inputs early and return `400 { error: "..." }`; wrap async work in a single `try`/`catch` and map unhandled exceptions to `502`/`500 { error: e.message }`; never swallow network errors without returning a response.
- For library functions: throw descriptive `Error`/`ValueError` messages rather than returning nulls, so callers can decide how to surface them.
- For the React UI: catch async operations, set a local `error` state, and render a concise user-facing message; do not log raw stack traces to the user.