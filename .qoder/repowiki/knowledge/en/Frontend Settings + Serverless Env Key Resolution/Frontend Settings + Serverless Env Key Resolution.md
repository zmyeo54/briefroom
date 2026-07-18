---
kind: configuration_system
name: Frontend Settings + Serverless Env Key Resolution
category: configuration_system
scope:
    - '**'
source_files:
    - src/lib/settingsConfig.js
    - src/lib/storage.js
    - src/pages/SettingsPage.jsx
    - api/chat.js
    - vite.config.js
    - vercel.json
---

The application uses a two-tier configuration system: user-facing settings persisted in the browser and server-side API keys resolved from Vercel environment variables.

**Frontend settings (user preferences)**
- Central schema and normalization live in `src/lib/settingsConfig.js`. It defines `defaultSettings`, enum lists (`INTERVIEW_LANGS`, `AI_PROVIDERS`), migration helpers, and validation/normalization functions (`normalizeSettings`, `voicesForInterviewLang`, `aiProviderForGeo`).
- Persistence is via `src/lib/storage.js`, which wraps `localStorage` under namespaced keys (`briefroom_settings_v2`, etc.) and handles backward-compatible migration from legacy v1 keys. A custom `briefroom-storage` event keeps multiple tabs in sync.
- The UI surface is `src/pages/SettingsPage.jsx`, which loads normalized settings on mount, debounces saves to localStorage, and exposes controls for name/gender, interview language, voice selection, speaking rate, AI provider toggles, and manual API key paste.
- Build-time defaults are injected through Vite's `import.meta.env.VITE_GEMINI_API_KEY`; `getSavedApiKey()` reads this value so users can opt into a pre-baked key when they haven't pasted their own.

**Server-side secrets (Vercel Edge Functions)**
- Each function declares a top-level `config = { maxDuration, api.bodyParser.sizeLimit }` object (e.g. `api/chat.js`, `api/fetch-url.js`, `api/tts.js`) to tune Vercel runtime limits.
- API keys are collected by `collectServerKeys()` / `collectDeepSeekKeys()` in `api/chat.js`, reading from `GEMINI_API_KEY`, `GEMINI_API_KEYS`, `GEMINI_API_KEY_2..10`, `DEEPSEEK_API_KEY`, and also `VITE_GEMINI_API_KEY` (so a build-time key set in Vercel env is picked up at runtime).
- Per-request resolution merges the user-pasted Bearer key with the server pool, deduplicates, and skips mismatched providers (a Gemini key is not tried against DeepSeek). Failover across keys and across providers is driven by status-code heuristics (`shouldTryNextKey`, `shouldTryOtherProvider`).
- Provider selection respects explicit headers (`x-linecheck-ai-provider`, `x-linecheck-ai-enabled`) or falls back to geo-detection via `x-vercel-ip-country` (CN/HK → DeepSeek, else Gemini).

**Build & deployment wiring**
- `vite.config.js` proxies `/api/*` to local Python TTS and dev chat servers during development; production runs as static assets served by Vercel.
- `vercel.json` configures the Vite framework, SPA rewrites (`/settings` → `/index.html`), security headers, and per-function `maxDuration` overrides that mirror each function's internal `config.maxDuration`.

**Conventions developers should follow**
- New user-visible options go into `defaultSettings` in `settingsConfig.js` and must be handled by `normalizeSettings` (validation, migration, cross-field sync like voices ↔ language).
- Persisted settings keys are defined centrally in `storage.js`'s `KEYS` map; never hardcode localStorage strings elsewhere.
- Secrets belong only in serverless functions; never ship them to the client. If a build-time default is needed, expose it through `import.meta.env.VITE_*` and read it via `getSavedApiKey()`.
- When adding a new LLM provider, add its constants and collection logic in `api/chat.js` and update `enabledAiProviders` / `providersToTry` accordingly.