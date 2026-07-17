---
kind: build_system
name: Vite + Vercel Edge Functions Build & Deploy Pipeline
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

The project uses a minimal, script-driven build and deployment stack centered on Vite for the React frontend and Vercel serverless functions for the API layer. There is no Makefile, Dockerfile, or CI pipeline in the repository; everything is wired through package.json scripts and Vercel's declarative config.

Build toolchain:
- Vite (vite.config.js) compiles the React app with @vitejs/plugin-react and Tailwind CSS v4 (@tailwindcss/vite). The dev server runs on port 8787, binds to 0.0.0.0, and proxies /api/* routes to two local helper servers: a Node dev proxy on 8791 (chat) and a Python TTS server on 8790 (TTS + URL fetch). tesseract.js is excluded from dependency pre-bundling.
- npm scripts in package.json orchestrate the full local workflow:
  - npm run dev launches three processes in parallel: the Python TTS server (scripts/tts_server.py), the Node chat dev proxy (scripts/dev-api-server.mjs), and the Vite dev server.
  - npm run build invokes vite build, producing a static dist/ bundle.
  - npm run preview serves the built output locally.
  - npm run test:tts runs an end-to-end regression against the local TTS server using Playwright/Puppeteer helpers in scripts/tts_regression.mjs.

Deployment target — Vercel:
- vercel.json declares buildCommand: npm run build, outputDirectory: dist, and framework: vite. It configures security headers, SPA rewrites for /settings, and maps three files under api/ as serverless functions with explicit maxDuration limits (60s for chat/TTS, 30s for URL fetch).
- The api/ directory contains Vercel Edge-compatible handlers (chat.js, tts.js, fetch-url.js, tts-health.js) that are executed at the edge. They share key-pooling and provider-selection logic via api/_ttsShared.js and api/chat.js.

Local development vs production split:
- During development, AI requests are routed through scripts/dev-api-server.mjs, which reads API keys from environment variables (GEMINI_API_KEY*, DEEPSEEK_API_KEY) and forwards them to DeepSeek or Gemini. This allows running without Vercel credentials.
- In production, api/chat.js performs the same routing but executes as a Vercel function, reading keys from Vercel environment variables. Both implementations share identical key-collection, provider selection, and retry/fallback heuristics.

Artifacts and outputs:
- Frontend: static assets under dist/ produced by vite build.
- No container images, no cross-compilation, no versioned release artifacts beyond the Git tag. Versioning is pinned to 0.0.0 in package.json and not incremented by the build.

Developer conventions:
- Add new Vite plugins or dev-server proxy rules in vite.config.js; keep the dev proxy targets aligned with the ports used by scripts/dev-api-server.mjs (8791) and scripts/tts_server.py (8790).
- New API endpoints should be placed under api/ as single-file handlers exporting a default function plus a config object when they need custom maxDuration or body-parser limits; shared utilities go in api/_ttsShared.js.
- Environment-sensitive configuration (API keys, model names) must be read from process.env inside handlers — never hard-coded.
- Use npm run dev to start the full local stack; do not add extra long-running services without updating the dev script.