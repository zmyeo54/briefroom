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
    - scripts/tts_regression.mjs
---

## Build System Overview

LineCheck uses a **Vite-based React SPA** with a dual-process development server and Vercel Edge Functions for deployment. There is no Makefile, Dockerfile, or CI pipeline in the repository — build orchestration lives entirely in `package.json` scripts and `vite.config.js`, with deployment configuration in `vercel.json`.

### Development Workflow (`npm run dev`)
The dev command launches three concurrent processes:
- **Python TTS server** (`scripts/tts_server.py`) on port 8790 — wraps Microsoft Edge TTS with newscaster voice styles, text chunking, and retry logic
- **Node API proxy** (`scripts/dev-api-server.mjs`) on port 8791 — proxies `/api/chat` to Gemini/DeepSeek backends with key rotation and region routing
- **Vite dev server** on port 8787 — serves the React app and rewrites `/api/*` routes to the two local services via its built-in proxy

This multi-process setup lets developers iterate on the frontend while independently testing the Python TTS service and Node chat proxy without a container runtime.

### Production Build (`npm run build`)
Runs `vite build` which outputs a static `dist/` directory. The build includes:
- React 19 + Tailwind CSS v4 compilation via `@vitejs/plugin-react` and `@tailwindcss/vite`
- Dependency optimization excluding `tesseract.js` (large WASM module) from pre-bundling
- Single-page application output with client-side routing

### Deployment (Vercel)
`vercel.json` configures:
- **Static site**: `buildCommand: npm run build`, `outputDirectory: dist`, `framework: vite`
- **Edge Functions**: `api/tts.js`, `api/fetch-url.js`, `api/chat.js` are deployed as serverless functions with explicit `maxDuration` limits (30–60s)
- **SPA rewrites**: `/settings` → `/index.html` for client-side routing
- **Security headers**: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` on all responses, plus cache control for OG image

### Testing & Regression
The `test:tts` script runs `scripts/tts_regression.mjs`, a Node-based regression suite that:
- Probes `/api/tts-health` for service availability
- Imports and exercises browser-side TTS utilities (`src/lib/tts.js`) against the live dev stack
- Generates MP3 fixtures into `.tmp/tts-regression/` covering short/long/bilingual inputs, chunked synthesis, combined sequences, and stress bursts (8 concurrent requests)
- Validates MP3 magic bytes, minimum sizes, duration estimates, and cache hit performance

### Key Conventions
- **Port contract**: Vite (8787) → TTS (8790), Vite → Chat proxy (8791). Changing one requires updating the other's proxy config.
- **API path rewriting**: Vite strips `/api/` prefix when forwarding to the TTS server (e.g., `/api/tts` → `/tts`), so the Python server must handle both prefixed and unprefixed paths.
- **Environment-driven providers**: The chat proxy reads keys from `GEMINI_API_KEY*`, `DEEPSEEK_API_KEY`, and per-request `Authorization: Bearer` headers, with automatic fallback between providers based on `x-linecheck-ai-region`.
- **No global state across builds**: Each process is independent; there is no shared build artifact between the Python TTS server and the Vite bundle.