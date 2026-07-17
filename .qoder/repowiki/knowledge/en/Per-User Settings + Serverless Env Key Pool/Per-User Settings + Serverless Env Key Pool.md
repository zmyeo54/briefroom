---
kind: configuration_system
name: Per-User Settings + Serverless Env Key Pool
category: configuration_system
scope:
    - '**'
source_files:
    - src/lib/settingsConfig.js
    - src/lib/storage.js
    - api/chat.js
    - vite.config.js
    - vercel.json
---

The application uses a two-layer configuration system: per-user browser settings persisted in localStorage, and server-side environment variables that supply API keys for the Vercel serverless routes. There is no centralized config file (no .env checked in, no YAML/TOML); configuration is split between runtime user preferences and deployment-time secrets.

### Client-side settings (src/lib/settingsConfig.js + src/lib/storage.js)
- A single normalized settings object is defined with defaultSettings and validated/migrated by normalizeSettings. It covers LLM model, interview language, UI locale, candidate name/gender, TTS voices, answer length, interviewer role, focus topics, system prompt, and AI region selection.
- Values are stored under the key briefroom_settings_v2 in localStorage via loadJson/saveJson in src/lib/storage.js, which also handles migration from legacy keys (ic_settings_v1, briefroom_settings_v1).
- The client reads build-time env via import.meta.env.VITE_GEMINI_API_KEY as a fallback when the user has not pasted their own key; user-pasted apiKey always wins.
- The client sends an x-linecheck-ai-region header to let the server pick Gemini vs DeepSeek based on user preference or geo-fallback.

### Server-side provider routing & key pool (api/chat.js)
- The chat route collects a deduplicated pool of API keys from multiple env sources: GEMINI_API_KEYS (comma/space-separated), GEMINI_API_KEY, VITE_GEMINI_API_KEY, plus GEMINI_API_KEY_2..10; DeepSeek keys come from DEEPSEEK_API_KEY.
- Provider selection (pickProvider) follows this precedence: explicit x-linecheck-ai-region header -> Vercel x-vercel-ip-country geo -> default global. Greater China maps to DeepSeek, others to Gemini.
- On failure (429/401/403/quota/not found/5xx), the route rotates through remaining keys in the pool and then tries the alternate provider before returning an error.
- A small self-test block at the bottom of api/chat.js asserts key-collection and routing logic when run directly with Node.

### Build / dev proxy configuration (vite.config.js, vercel.json)
- vite.config.js defines the dev server port (8787) and proxies /api/chat, /api/tts-health, /api/tts, /api/fetch-url to local helper servers running on ports 8791 and 8790.
- vercel.json declares the Vite build pipeline, SPA rewrites, security headers, and function timeouts for each serverless route.

### Environment variable conventions
VITE_GEMINI_API_KEY: Build-time (client) - Fallback Gemini key baked into the PWA
GEMINI_API_KEY[_N]: Serverless runtime - Server-side Gemini key pool (supports N=2..10)
GEMINI_API_KEYS: Serverless runtime - Comma/space-delimited batch of Gemini keys
DEEPSEEK_API_KEY: Serverless runtime - DeepSeek key used when greater-china routing is selected

### Rules developers should follow
- Never hardcode secrets — add new server-side keys only via env; client-only build-time values must be prefixed VITE_.
- Normalize all user settings through normalizeSettings so migrations and defaults stay consistent across tabs and upgrades.
- Do not mutate baseUrl or model in normalizeSettings — those fields are intentionally locked to GEMINI_BASE and PINNED_GEMINI_MODEL.
- When adding a new provider, mirror the pattern in api/chat.js: expose a collector function, update pickProvider/otherProvider, and wire it into providersToTry and shouldTryOtherProvider.
- Keep dev proxy entries in sync — every new /api/* route needs a matching entry in both vite.config.js (dev) and vercel.json (functions timeout).