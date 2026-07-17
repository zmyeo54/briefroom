---
kind: external_dependency
name: Google Gemini AI Provider
slug: google-gemini
category: external_dependency
category_hints:
    - vendor_identity
    - auth_protocol
scope:
    - '**'
---

### Google Gemini
- **Role**: Primary AI chat provider for non-China users; accessed via OpenAI-compatible endpoint.
- **Integration point**: `api/chat.js` proxies requests to `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` using Bearer token auth.
- **Auth protocol**: Supports multiple key sources — user-provided `Authorization: Bearer <key>` header takes priority, then falls back to server-side pool from env vars `GEMINI_API_KEY`, `GEMINI_API_KEY_2..10`, `GEMINI_API_KEYS`, `VITE_GEMINI_API_KEY`. Keys are deduplicated across all sources.
- **Durable usage model**: When response_format errors occur, automatically retries without JSON schema constraints. Key rotation on 429/401/403/quota errors. Falls back to DeepSeek when unavailable or rate-limited.
- **Model**: Uses `gemini-2.5-flash-lite` as default (configurable via client settings).