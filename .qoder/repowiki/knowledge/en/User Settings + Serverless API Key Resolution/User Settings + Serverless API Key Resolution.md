---
kind: configuration_system
name: User Settings + Serverless API Key Resolution
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

This project uses a two-tier configuration system: per-user runtime settings persisted in the browser, and server-side API keys resolved from environment variables at request time. There is no centralized config file or framework — configuration is composed from three sources with explicit precedence.

**1. User settings (browser-local)**
- Schema and defaults live in `src/lib/settingsConfig.js` (`defaultSettings`, `normalizeSettings`). Every setting has a validator/migrator that coerces values into a canonical shape (voice IDs normalized, interview language clamped to `INTERVIEW_LANGS`, system prompt upgraded to `SYSTEM_PROMPT_VERSION`).
- Persistence is via `src/lib/storage.js`, which wraps `localStorage` under stable keys (`briefroom_settings_v2`, ...) and auto-migrates from legacy v1 keys on read. A debounced autosave fires on every state change; cross-tab sync happens through a custom `briefroom-storage` event plus the native `storage` event.
- The Settings UI (`src/pages/SettingsPage.jsx`) is the single source of truth for editing: it reads → normalizes → patches → saves back through the same `loadJson`/`saveJson` pipeline.

**2. Build-time Vite env vars (client-side fallback key)**
- `VITE_GEMINI_API_KEY` is injected by Vite at build time and surfaced via `import.meta.env.VITE_GEMINI_API_KEY`. It is read only as a fallback when the user has not pasted their own key in Settings.
- `resolveApiKey(settings)` returns the user-pasted key if present, otherwise the build-time value. This lets developers ship a local `.env.local` without touching Settings.

**3. Server-side API keys (edge functions)**
- Each Vercel function (`api/chat.js`, `api/tts.js`, `api/fetch-url.js`) defines its own `config.maxDuration` and body-parser limits.
- `api/chat.js` collects keys from `process.env` using `collectServerKeys()` / `collectDeepSeekKeys()`:
  - `GEMINI_API_KEYS` (comma/space-separated), `GEMINI_API_KEY`, `GEMINI_API_KEY_2..10`, and `VITE_GEMINI_API_KEY` are all accepted and deduplicated.
  - `DEEPSEEK_API_KEY` selects DeepSeek over Gemini when present.
- Keys are rotated per-request: `keysForRequest(userKey, env)` prepends the per-call Bearer token, then appends the server pool. Failures matching `shouldTryNextKey` (429/401/403/quota) trigger rotation within the same provider; `shouldTryOtherProvider` switches providers.

**4. Deployment wiring**
- `vercel.json` declares the Vite build, SPA rewrites (`/settings` → `/index.html`), security headers, and per-function `maxDuration`. No `env` block is present — secrets are expected to be configured in the Vercel dashboard.

**Conventions developers should follow**
- All new user-facing options must go through `settingsConfig.js`: add a field to `defaultSettings`, normalize it in `normalizeSettings`, and expose it in `SettingsPage.jsx`.
- Never mutate localStorage directly outside `storage.js`; always use `loadJson`/`saveJson` so migration logic and cross-tab events fire.
- Client-side secrets must be prefixed `VITE_` and consumed via `import.meta.env.*`; never hardcode them in source.
- Server-side secrets are read from `process.env` inside each function; add entries to `collectServerKeys` / `collectDeepSeekKeys` and document them in `vercel.json`'s functions section.