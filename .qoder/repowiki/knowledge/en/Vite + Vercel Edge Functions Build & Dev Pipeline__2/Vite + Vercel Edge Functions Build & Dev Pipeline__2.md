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
    - scripts/dev-api-server.mjs
    - scripts/tts_server.py
    - api/chat.js
---

The project uses a lightweight, script-driven build system centered on Vite for the React SPA and Vercel Serverless Functions for the API layer. There is no Makefile or Dockerfile; everything is wired through package.json scripts and a single vercel.json.

Build targets:
- Production build: npm run build runs vite build, emitting static assets to dist/. Vercel picks this up via buildCommand and outputDirectory in vercel.json.
- Preview: npm run preview serves the built dist/ locally.
- Linting: npm run lint runs oxlint (configured by .oxlintrc.json).

Local development workflow:
A single npm run dev orchestrates three concurrent processes:
1. tts - Python HTTP server (scripts/tts_server.py) on port 8790 exposing /tts, /api/tts, /fetch-url, /health.
2. dev:api - Node proxy (scripts/dev-api-server.mjs) on port 8791 forwarding /api/chat to Gemini/DeepSeek with key rotation and failover.
3. dev:web - Vite dev server on port 8787, configured in vite.config.js to proxy /api/* routes to the two local services so the SPA talks to the same origin.

This triad mirrors production routing: the browser hits /api/*, Vite proxies to the local TTS/API servers during dev, while in production Vercel rewrites /api/* to the corresponding api/*.js serverless functions.

Production deployment:
- Platform: Vercel, auto-detected as a Vite app (framework: vite).
- Static assets: Built to dist/, served directly.
- Serverless functions: Each file under api/ is a function entry point. vercel.json declares per-function maxDuration limits (60s for chat/TTS, 30s for fetch-url) and sets security headers plus a SPA fallback rewrite for /settings.
- Routing: Client-side routes are handled by rewriting unknown paths to index.html; /settings is explicitly rewritten.

Key conventions:
- All API endpoints live in api/*.js (Vercel Edge-compatible) and share helpers from api/_ttsShared.js.
- The Vite dev proxy rewrites /api/tts-health to /health and /api/fetch-url to /fetch-url so the frontend always calls /api/* regardless of environment.
- AI provider selection (Gemini vs DeepSeek), key pools, and failover logic are duplicated between the local dev proxy and the production function for parity.
- No CI pipeline, Docker image, or release automation exists in the repo; deployment is driven purely by pushing to main and letting Vercel run npm run build.