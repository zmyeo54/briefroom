---
kind: configuration_system
name: Frontend Settings + Server-Side API Key Configuration
category: configuration_system
scope:
    - '**'
source_files:
    - src/lib/settingsConfig.js
    - src/lib/storage.js
    - api/chat.js
    - scripts/dev-api-server.mjs
    - vite.config.js
---

The application uses a two-layer configuration system: user settings persisted in the browser and server-side API keys for proxying LLM requests.

User settings (frontend)
- Central schema and defaults live in src/lib/settingsConfig.js. It defines defaultSettings, normalization helpers (normalizeSettings), and build-time constants like PINNED_GEMINI_MODEL, GEMINI_BASE, AI_REGIONS, and INTERVIEW_LANGS.
- Settings are stored per-tab via src/lib/storage.js, which wraps localStorage with versioned keys (briefroom_settings_v2) and migration from legacy keys. A custom briefroom-storage event keeps multiple tabs in sync.
- Build-time Vite env vars are read through import.meta.env.VITE_GEMINI_API_KEY inside getSavedApiKey(). The runtime resolution order is: user-pasted apiKey in settings -> build-time VITE_GEMINI_API_KEY -> empty string.
- UI language, interview language, voice selection, answer length, interviewer role, focuses, and system prompt all flow through normalizeSettings, which enforces whitelists and migrates legacy fields (e.g., single voice -> voiceQ/voiceA).

Server-side API key management (Edge/Vercel functions)
- api/chat.js implements the chat proxy. Keys are collected from environment variables via collectServerKeys() / collectDeepSeekKeys():
  - GEMINI_API_KEYS (comma/space-separated list)
  - GEMINI_API_KEY (single)
  - VITE_GEMINI_API_KEY (injected by Vercel)
  - GEMINI_API_KEY_2 ... GEMINI_API_KEY_10 (pool)
  - DEEPSEEK_API_KEY
- Request-time key ordering: user-supplied Bearer token first, then the server pool, deduplicated.
- Provider selection (pickProvider) prefers DeepSeek when its key exists; otherwise falls back to Gemini. Region routing is signaled via the x-linecheck-ai-region header (global | greater-china).
- Retry logic rotates keys on 429/401/403/quota errors and can switch providers on 402/404/5xx or provider-specific messages.

Development server
- scripts/dev-api-server.mjs mirrors the same key-collection and provider-selection logic for local development, reading PORT, GEMINI_API_KEY, VITE_GEMINI_API_KEY, and DEEPSEEK_API_KEY from process.env.
- vite.config.js proxies /api/* routes to the dev servers (chat -> :8791, TTS -> :8790).

Conventions & rules
- Never hardcode secrets in source; use VITE_* env vars for build-time injection and GEMINI_API_KEY* / DEEPSEEK_API_KEY for server-side pools.
- Always normalize user input through the normalize* helpers in settingsConfig.js before persisting.
- Do not store raw API keys in localStorage beyond the current session's settings object — they are resolved at call time via resolveApiKey(settings) plus getSavedApiKey().
- Model selection is pinned to gemini-2.5-flash-lite; do not expose a model picker that could drift to -latest aliases.