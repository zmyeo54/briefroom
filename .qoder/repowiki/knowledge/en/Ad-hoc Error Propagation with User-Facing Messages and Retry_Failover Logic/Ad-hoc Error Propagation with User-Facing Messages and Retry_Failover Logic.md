---
kind: error_handling
name: Ad-hoc Error Propagation with User-Facing Messages and Retry/Failover Logic
category: error_handling
scope:
    - '**'
source_files:
    - api/chat.js
    - api/tts.js
    - src/lib/tts.js
    - src/lib/fetchUrl.js
    - src/components/DocumentField.jsx
---

This repository does not define a centralized error-handling framework. Instead, each layer (Vercel Edge Functions, browser-side libraries, React components) uses its own lightweight pattern for surfacing errors to the user while keeping internal failures contained.

**Serverless API layer (`api/`)**
- Handlers return JSON bodies shaped as `{ error: { message, code?, provider? } }` on non-200 responses (e.g. `405`, `400`, `503`, `502`). There is no shared error class — status codes and an `error.message` string are the contract.
- Transient upstream failures are handled by retry/failover helpers rather than thrown:
  - `shouldTryNextKey(status, data)` rotates through server-side API keys on 401/403/429 or messages matching quota/rate-limit patterns.
  - `shouldTryOtherProvider(status, data)` falls back between Gemini and DeepSeek on 402/404/4xx/5xx or timeout/connection strings.
  - `isAbortError(err)` treats `AbortError` / `TimeoutError` as timeouts, converting them into a structured 504 `timeoutResponse(provider)` so the outer loop can try another provider.
- The chat handler wraps the whole provider loop in a single `try/catch`; any unexpected exception becomes a 502 with `error.message`.
- TTS handler (`api/tts.js`) splits long text into chunks, retries synthesis up to 3 times with exponential backoff, and returns `502 { error: "empty audio" }` when the stream yields nothing.

**Browser-side library layer (`src/lib/`, `lib/`)**
- Library functions throw plain `new Error("human-readable message")` values — there is no custom error type hierarchy. Callers catch and surface these via UI state.
- `src/lib/tts.js` implements its own retry loop over `/api/tts`: transient statuses (502/504/500) and messages containing `stream closed`/`timed out`/`websocket`/`empty audio` trigger up to 4 attempts with short delays; after exhaustion it throws a friendly `Error` that the component displays.
- `src/lib/fetchUrl.js` normalizes input early (throwing descriptive errors for missing/malformed URLs), then chains three fetch strategies (`viaLocalHelper` → `viaJina` → `viaAllOrigins`), throwing progressively more specific messages at each failure point.
- `src/lib/ocr.js` relies on third-party workers (pdfjs, mammoth, tesseract); errors bubble up as native rejections without wrapping.

**React component layer (`src/components/`)**
- Components manage local `useState` fields `status` and `error` and render them inline (e.g. `<p className="err">{error}</p>`). They wrap async flows in `try/catch`, set `busy`, clear previous state, and display the caught `e.message`.
- No global error boundary or top-level `unhandledrejection` listener was found.

**Shared utilities**
- `lib/edgeTts.js` and `api/_ttsShared.js` export only voice maps, rate conversion, text sanitization, and CORS helpers — no error types.

**Conventions developers should follow**
- For serverless handlers: respond with `{ error: { message, ... } }` and an appropriate HTTP status; use `shouldTryNextKey` / `shouldTryOtherProvider` / `isAbortError` to decide whether to rotate keys or providers instead of throwing.
- For browser libraries: throw plain `Error` instances with concise, user-facing messages; callers should catch and map to UI state rather than propagating further.
- Avoid panics / `process.exit`; Vercel edge functions must always end with a `res.status(...).json(...)` response.