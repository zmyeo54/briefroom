---
kind: configuration_system
name: Dual-Layer Runtime Configuration (Client Settings + Server Env Keys)
category: configuration_system
scope:
    - '**'
source_files:
    - src/lib/settingsConfig.js
    - src/lib/storage.js
    - api/chat.js
    - vercel.json
---

The application uses a two-layer configuration system: client-side user settings persisted in localStorage, and server-side API keys loaded from Vercel environment variables. There is no centralized config file — instead, configuration lives in dedicated modules with normalization and migration logic.

**Client-Side Settings (`src/lib/settingsConfig.js`)**
- `defaultSettings` defines the complete schema (apiKey, baseUrl, model, lang, uiLang, name, gender, voiceQ/voiceA, rate, answerLength, interviewerRole, focuses, systemPrompt, aiProvider, provider toggles, legacy aiRegion).
- `normalizeSettings(raw)` merges incoming data against defaults, enforces constraints (pinned Gemini model, valid interview language, normalized voices/gender), migrates legacy fields (`voice` → `voiceQ/voiceA`, `aiRegion` → `aiProvider`), and upgrades outdated system prompts.
- `resolveApiKey(settings)` resolves the effective key: user-pasted key wins; otherwise falls back to build-time `import.meta.env.VITE_GEMINI_API_KEY`.
- Provider selection helpers (`enabledAiProviders`, `aiProviderForGeo`, `providerToRegion`) implement geo-aware fallback (DeepSeek for CN/HK) while respecting manual overrides.

**Persistence (`src/lib/storage.js`)**
- All settings are stored under `briefroom_settings_v2` in localStorage via `loadJson`/`saveJson`.
- Legacy key migration supports `ic_settings_v1` / `briefroom_settings_v1` formats, merging any existing apiKey into the new schema.
- A `briefroom-storage` custom event notifies other tabs of changes.

**Server-Side Environment (`api/chat.js`)**
- API keys are collected from multiple env var sources: `GEMINI_API_KEYS` (comma/space separated), `GEMINI_API_KEY`, `VITE_GEMINI_API_KEY`, plus `GEMINI_API_KEY_2..10`; DeepSeek uses `DEEPSEEK_API_KEY`.
- `collectServerKeys()` / `collectDeepSeekKeys()` deduplicate across all sources.
- `keysForProvider(provider, userKey, env)` prioritizes the per-request Bearer token (with fingerprint-based provider matching so a Gemini key isn't tried against DeepSeek), then appends the server pool.
- `providersToTry(req, env)` builds the failover order based on explicit headers (`x-linecheck-ai-provider`, `x-linecheck-ai-enabled`), geo (`x-vercel-ip-country`), and which providers actually have keys available.
- The handler rotates keys on 401/403/429 and fails over between Gemini ↔ DeepSeek when appropriate, with strict timeout budgeting (`HANDLER_BUDGET_MS=55s`, `UPSTREAM_CALL_MS=50s`).

**Build-Time / Deployment Config**
- `vercel.json` declares function durations and rewrites but does not inject env vars — those are set in the Vercel dashboard.
- Build-time `VITE_*` env vars are baked into the client bundle via `import.meta.env` (read by `getSavedApiKey`).
- No `.env` files are committed; local development relies on Vite's `.env.local` convention or passing vars at runtime.

**Conventions developers should follow:**
- Add new top-level settings to `defaultSettings` and handle migration in `normalizeSettings`.
- Never hardcode API keys — use `collectServerKeys`/`collectDeepSeekKeys` on the server side and `resolveApiKey` on the client.
- When adding a new AI provider, update `AI_PROVIDERS`, `enabledAiProviders`, `providersToTry`, and the corresponding key collector.
- Keep `model` pinned to `PINNED_GEMINI_MODEL` — the normalizer rejects `-latest` aliases.