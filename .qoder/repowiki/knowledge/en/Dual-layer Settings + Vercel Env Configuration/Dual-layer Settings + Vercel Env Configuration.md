---
kind: configuration_system
name: Dual-layer Settings + Vercel Env Configuration
category: configuration_system
scope:
    - '**'
source_files:
    - src/lib/settingsConfig.js
    - src/lib/storage.js
    - api/chat.js
    - vercel.json
    - vite.config.js
    - src/pages/SettingsPage.jsx
---

The application uses a two-tier configuration system: build-time environment variables injected by Vite, and runtime user settings persisted in localStorage via a normalized schema.

Build-time (Vite) env vars:
- vite.config.js configures dev proxy targets and plugin options; it does not expose env to the client beyond what Vite's import.meta.env.* provides.
- src/lib/settingsConfig.js reads import.meta.env.VITE_GEMINI_API_KEY as a compile-time fallback for the Gemini API key. This is the only place where Vite env vars are consumed at build time.
- No .env or dotenv files exist in the repo — Vite env must be supplied by the host (Vercel).

Runtime user settings (localStorage):
- src/lib/storage.js defines versioned localStorage keys (briefroom_settings_v2, etc.) with migration support from legacy v1 keys. It exposes loadJson(key, fallback) and saveJson(key, value) plus a custom briefroom-storage event for cross-tab sync.
- src/lib/settingsConfig.js defines defaultSettings, normalizeSettings(raw), and helpers that coerce/validate every field (lang, uiLang, gender, voiceQ/voiceA, answerLength, interviewerRole, focuses, aiRegion, systemPrompt). Normalization enforces pinned model (gemini-2.5-flash-lite), locks baseUrl to the Gemini OpenAI-compatible endpoint, migrates legacy single voice → voiceQ/voiceA, and upgrades outdated system prompts.
- src/pages/SettingsPage.jsx is the sole UI surface for editing settings; it debounces saves to localStorage on change and listens for storage events to stay in sync across tabs.

Server-side configuration (Vercel Edge Functions):
- api/chat.js collects server API keys from process.env: GEMINI_API_KEYS, GEMINI_API_KEY, VITE_GEMINI_API_KEY, plus GEMINI_API_KEY_2..10 for rotation; DEEPSEEK_API_KEY for the DeepSeek provider. Keys are deduplicated and tried in order with retry/fallback logic based on HTTP status and error messages.
- vercel.json declares the Vite build pipeline, SPA rewrites, security headers, and per-function maxDuration limits. It also maps /settings → /index.html for client-side routing.
- The /api/chat GET endpoint returns { hasKey, hasGemini, hasDeepseek, country } so the frontend can display whether a server key is configured.

API key resolution precedence:
1. User-pasted settings.apiKey (stored in localStorage) — highest priority.
2. Build-time VITE_GEMINI_API_KEY (injected by Vite at build).
3. Server-side key pool (GEMINI_API_KEY*, DEEPSEEK_API_KEY) — used when no user key is present.

Conventions developers should follow:
- New user-facing settings belong in defaultSettings / normalizeSettings in src/lib/settingsConfig.js; always provide a normalization/migration path.
- Persist settings through storage.saveJson('settings', normalizeSettings(settings)); never write to localStorage directly.
- Add new Vite env vars via import.meta.env.VITE_* in settingsConfig.getSavedApiKey() or equivalent; do not import process.env in client code.
- Server secrets go into Vercel project env; add them to collectServerKeys / collectDeepSeekKeys if they participate in key rotation.