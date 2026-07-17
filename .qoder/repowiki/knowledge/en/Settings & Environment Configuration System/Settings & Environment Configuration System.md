---
kind: configuration_system
name: Settings & Environment Configuration System
category: configuration_system
scope:
    - '**'
source_files:
    - src/lib/settingsConfig.js
    - src/lib/storage.js
    - src/pages/SettingsPage.jsx
    - api/chat.js
    - vercel.json
---

The application uses a layered configuration system combining build-time Vite env vars, runtime server-side environment variables, and user-persisted browser settings stored in localStorage. There is no centralized config file — instead configuration lives in three distinct layers:

**1. Build-time client env (Vite)**
- `import.meta.env.VITE_GEMINI_API_KEY` is read at build time via `getSavedApiKey()` in `src/lib/settingsConfig.js`. This value is baked into the client bundle and serves as a fallback when the user has not pasted their own key.
- No other `VITE_*` variables are used; the app does not expose a generic `.env` loader to the browser.

**2. Runtime server env (Vercel Functions)**
- Serverless functions in `api/chat.js`, `api/tts.js`, `api/fetch-url.js` each export a `config` object with function-level limits (`maxDuration`, body size).
- API keys are collected from multiple env var names for resilience: `GEMINI_API_KEYS`, `GEMINI_API_KEY`, `VITE_GEMINI_API_KEY`, plus `GEMINI_API_KEY_2..10` for key rotation; `DEEPSEEK_API_KEY` for DeepSeek.
- Provider selection is driven by request headers (`x-linecheck-ai-provider`, `x-linecheck-ai-region`, `x-linecheck-ai-enabled`) and falls back to geo-detection via `x-vercel-ip-country` (CN/HK → DeepSeek, else Gemini).

**3. User settings (localStorage)**
- Persisted under the key `briefroom_settings_v2` via `src/lib/storage.js`, which also handles migration from legacy keys (`ic_settings_v1`, `briefroom_settings_v1`).
- The schema is defined in `defaultSettings` in `src/lib/settingsConfig.js` and normalized through `normalizeSettings()`, which enforces defaults, migrates legacy fields (e.g., single `voice` → `voiceQ`/`voiceA`, `aiRegion` → `aiProvider`), validates enums, and upgrades system prompts.
- Settings cover: identity (`name`, `gender`), language (`lang`, `uiLang`), TTS voices (`voiceQ`, `voiceA`, `rate`), interview mode (`answerLength`, `interviewerRole`, `focuses`, `systemPrompt`), AI provider selection (`aiProvider`, `geminiEnabled`, `deepseekEnabled`, manual override flags), and the per-user `apiKey`.
- The Settings UI (`src/pages/SettingsPage.jsx`) loads, patches, debounced-saves, and cross-tab-syncs settings via a custom `briefroom-storage` event.

**Key conventions**
- All mutable user-facing settings go through `normalizeSettings()` before being saved or used, ensuring forward/backward compatibility.
- The pinned model `gemini-2.5-flash-lite` is enforced in `normalizeSettings` — users cannot drift to `-latest` aliases.
- Client-side `resolveApiKey(settings)` gives precedence to the user-pasted key over the build-time `VITE_GEMINI_API_KEY`; an empty user key means "use server/env".
- Server-side `keysForRequest` / `keysForProvider` merge the per-request Bearer token with the server key pool, deduplicating entries.
- Deployment configuration lives in `vercel.json` (build command, rewrites, function durations, security headers) rather than a separate config file.