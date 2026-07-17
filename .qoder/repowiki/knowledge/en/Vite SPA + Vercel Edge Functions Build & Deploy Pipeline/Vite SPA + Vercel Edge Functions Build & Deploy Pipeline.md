---
kind: build_system
name: Vite SPA + Vercel Edge Functions Build & Deploy Pipeline
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - vite.config.js
    - vercel.json
    - scripts/dev-api-server.mjs
    - scripts/tts_server.py
    - api/chat.js
---

The project uses a minimal, script-driven build system centered on Vite for the React SPA and Vercel serverless functions for backend APIs. There is no Makefile, Dockerfile, or CI pipeline in the repository; all orchestration lives in `package.json` scripts and `vercel.json`.

**Build toolchain**
- **Vite 8** (`vite.config.js`) compiles the React app with the official `@vitejs/plugin-react` and Tailwind v4 via `@tailwindcss/vite`. The dev server runs on port 8787, does not auto-open a browser, and proxies `/api/*` routes to local helper servers (see below).
- **Tailwind CSS v4** is configured as a Vite plugin rather than through PostCSS.
- **Oxlint** is the only linter (`npm run lint`).
- No TypeScript — the project is pure JSX/JS with ESM (`"type": "module"`).

**Local development workflow**
Three processes are started concurrently by `npm run dev`:
1. `scripts/tts_server.py` — a Python HTTP server exposing `/tts`, `/api/tts`, `/fetch-url`, `/health` backed by Microsoft Edge TTS (newscaster voices). Runs on `127.0.0.1:8790`.
2. `scripts/dev-api-server.mjs` — a Node.js HTTP proxy that forwards `/api/chat` to either DeepSeek or Gemini OpenAI-compatible endpoints, rotating API keys from environment variables (`GEMINI_API_KEY[_N]`, `DEEPSEEK_API_KEY`). Runs on `127.0.0.1:8791`.
3. `vite --host 0.0.0.0 --port 8787` — the Vite dev server, which rewrites `/api/*` requests to the two helpers above.

A separate Playwright-based regression suite (`npm run test:tts`) drives `scripts/tts_regression.mjs` against the local TTS server to validate MP3 output across languages and durations.

**Production build & deployment**
- `npm run build` invokes `vite build`, emitting static assets into `dist/`.
- `vercel.json` declares `buildCommand: npm run build`, `outputDirectory: dist`, and `framework: vite`, so Vercel's native Vite integration handles compilation.
- Every file under `api/*.js` is treated as a Vercel Edge Function. Per-function timeouts are set via the `functions` map (`chat.js` and `tts.js` get 60s, `fetch-url.js` gets 30s).
- SPA client-side routing is handled by a rewrite rule mapping `/settings` → `/index.html`; all other paths serve static files.
- Security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`) are applied globally; `/og-image.png` gets a 1-day cache header.

**Environment & secrets strategy**
- Server-side API keys are read from process environment at runtime: `GEMINI_API_KEY[_N]`, `VITE_GEMINI_API_KEY`, `DEEPSEEK_API_KEY`. Both the local dev proxy and the Vercel function share the same key-collection logic (`collectServerKeys`, `collectDeepSeekKeys`), enabling identical behavior locally and in production.
- User-supplied keys can be passed per-request via an `Authorization: Bearer <key>` header, prepended before the server pool.
- Region selection (`x-linecheck-ai-region` header) switches between DeepSeek (greater-china) and Gemini (global); currently DeepSeek takes priority when configured.

**Conventions developers should follow**
- Add new Vite plugins or dev-server proxy rules in `vite.config.js` only; keep them mirrored in `vercel.json` if they affect production routing.
- New serverless API endpoints go in `api/<name>.js` and must export a default `(req, res)` handler plus a `config.maxDuration` value; reuse shared helpers from `api/_ttsShared.js`.
- Local-only services stay under `scripts/` and are wired into `package.json` scripts — do not introduce additional background processes without updating `npm run dev`.
- All secret values flow through environment variables; never hardcode API keys in source.