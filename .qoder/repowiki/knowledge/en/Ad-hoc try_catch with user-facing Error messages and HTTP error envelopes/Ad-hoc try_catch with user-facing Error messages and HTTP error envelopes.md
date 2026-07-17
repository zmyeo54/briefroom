---
kind: error_handling
name: Ad-hoc try/catch with user-facing Error messages and HTTP error envelopes
category: error_handling
scope:
    - '**'
source_files:
    - api/chat.js
    - api/tts.js
    - api/_ttsShared.js
    - src/components/DocumentField.jsx
    - src/lib/fetchUrl.js
    - src/lib/exportPdf.js
---

This repository does not define a centralized error-handling framework or custom error class hierarchy. Instead, it uses plain JavaScript Error objects thrown from functions and caught locally in try/catch blocks, with two distinct presentation layers:

Server-side (Vercel Edge/Node API routes) — Each route handler (api/chat.js, api/tts.js, api/fetch-url.js) wraps its body in a single try/catch. On success the handler returns JSON; on failure it responds with an envelope { error: { message: ... } } (chat) or { error: "..." } (tts). Validation errors return early with 400/405/503 status codes before entering the try block. Network failures from upstream providers are mapped to 502/500 responses. There is no global middleware or unhandled-rejection listener; each route owns its own catch.

Client-side (React components + lib) — Library functions in src/lib/* throw descriptive new Error("...") strings for validation and upstream failures (e.g. fetchUrl.js, exportPdf.js). Components like DocumentField.jsx catch these errors into local useState("error") state and render them via a small <p className="err"> element. Status messages use a separate status state for transient progress text, while error holds persistent failure messages. No top-level error boundary is used; errors bubble as uncaught exceptions if a component forgets to wrap its async call.

Key conventions observed
- Errors are represented by plain Error instances carrying human-readable messages; there are no sentinel values or typed error classes.
- Server routes respond with a uniform { error: { message } } shape so the client can display a single message string.
- Transient vs. permanent problems are distinguished by HTTP status (400/401/403/405/429/502/503) rather than by error type.
- The chat route implements retry-and-fallback logic based on status codes and error-message regexes (shouldTryNextKey, shouldTryOtherProvider) instead of throwing on every upstream failure.
- TTS synthesis uses explicit retry loops with exponential backoff and a timeout wrapper around stream collection.

What is missing
- No shared error base class or enum of error codes.
- No React error boundary to prevent full-page crashes.
- No structured logging library; server errors are logged via console.error only in the TTS route.
- No centralised request interceptor that normalises fetch/network errors before they reach UI code.