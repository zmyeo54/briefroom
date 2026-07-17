---
kind: build_system
name: Vite + Vercel Edge Functions Build & Dev Pipeline
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - vite.config.js
    - vercel.json
    - index.html
    - scripts/dev-api-server.mjs
    - scripts/tts_server.py
---

LineCheck uses a minimal, script-driven build system centered on Vite for the React SPA and Vercel for hosting. There is no Makefile, Dockerfile, or CI YAML — the entire pipeline is expressed through `package.json` scripts and `vercel.json`.

**Build toolchain**
- **Vite 8** with `@vitejs/plugin-react` and `@tailwindcss/vite` compiles `src/` into static assets under `dist/`. The dev server runs on port 8787 (`--host 0.0.0.0`) and proxies `/api/*` to two local helper servers (see below).
- `optimizeDeps.exclude = ['tesseract.js']` avoids pre-bundling that library because it ships native WASM binaries.
- `index.html` is the Vite entry; PWA manifest, icons, OG/Twitter metadata, and JSON-LD are baked in directly.

**Local development workflow**
The `npm run dev` script starts three processes in parallel:
1. `scripts/tts_server.py` — a Python `ThreadingHTTPServer` on `127.0.0.1:8790` exposing `/tts`, `/api/tts`, `/fetch-url`, `/health` backed by `edge_tts` with newscaster voice styles, chunking, retry, and SSML sanitization.
2. `scripts/dev-api-server.mjs` — a Node `http` server on `127.0.0.1:8791` proxying `/api/chat` to either DeepSeek (`https://api.deepseek.com`) or Gemini (`generativelanguage.googleapis.com/v1beta/openai`) depending on which API keys are present in the environment (`DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `GEMINI_API_KEYS`, `GEMINI_API_KEY_2..10`). It also exposes `/health` and a capability probe at `/api/chat`.
3. `vite --host 0.0.0.0 --port 8787` — the SPA dev server, whose `vite.config.js` rewrites `/api/tts-health` → `/health`, `/api/tts` → `/tts`, `/api/fetch-url` → `/fetch-url`, and forwards `/api/chat` to the Node proxy.

A separate `npm test:tts` runs `scripts/tts_regression.mjs` against the local TTS server to assert audio output quality.

**Production build & deployment**
- `npm run build` invokes `vite build`; the output directory is `dist/`.
- `vercel.json` declares `buildCommand: npm run build`, `outputDirectory: dist`, and `framework: vite` so Vercel auto-detects the project. Static assets are served from `dist/`.
- Serverless functions live in `api/` (`chat.js`, `tts.js`, `fetch-url.js`) and are mapped via `functions` with per-function `maxDuration` limits (60 s for chat/tts, 30 s for fetch-url). A single-page rewrite sends `/settings` to `/index.html` for client-side routing.
- Security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`) are applied globally; `/og-image.png` gets a 1-day cache header.

**Conventions & constraints**
- All runtime secrets (API keys) are consumed exclusively from process environment variables; nothing is committed. The dev proxy reads multiple key names to support key rotation.
- The TTS server hardcodes its host/port (`127.0.0.1:8790`) and is only intended for local development; production deployments use Vercel Edge Functions instead of this Python server.
- The build has no version bump step — `package.json` stays at `0.0.0` and Vercel's git-based deploy triggers the build automatically.