---
kind: build_system
name: Vite + Vercel Build & Dev Pipeline
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - vite.config.js
    - vercel.json
    - scripts/dev-api-server.mjs
    - scripts/tts_server.py
---

The project uses a lightweight, script-driven build system centered on Vite for the React PWA and Vercel Functions for serverless API routes. There is no Makefile, Dockerfile, or CI pipeline in the repository; everything is wired through package.json scripts and Vercel's declarative config.

Build toolchain:
- Bundler: Vite 8 with @vitejs/plugin-react and @tailwindcss/vite. The dev server runs on port 8787 (strictPort true, host 0.0.0.0) and proxies /api/* requests to local helper servers. tesseract.js is excluded from dependency pre-bundling.
- Linting: Oxlint via npm run lint.
- Preview: vite preview serves the built dist/ directory locally.

Local development workflow:
Three parallel processes are started by npm run dev:
1. npm run tts launches scripts/tts_server.py (Python 3, edge_tts), serving TTS synthesis and job URL fetching on http://127.0.0.1:8790.
2. npm run dev:api launches scripts/dev-api-server.mjs (Node http module), an OpenAI-compatible proxy that forwards /api/chat to Gemini or DeepSeek based on env keys (GEMINI_API_KEY*, DEEPSEEK_API_KEY) and the X-Linecheck-AI-Region header. Runs on port 8791.
3. npm run dev:web starts the Vite dev server on port 8787, which rewrites /api/chat to http://127.0.0.1:8791, /api/tts-health to http://127.0.0.1:8790/health, /api/tts to http://127.0.0.1:8790/tts, and /api/fetch-url to http://127.0.0.1:8790/fetch-url.
A separate npm run test:tts runs scripts/tts_regression.mjs against the local TTS server to validate audio output across languages.

Production deployment:
- Platform: Vercel, configured via vercel.json.
- Build command: npm run build (Vite) producing dist/.
- Framework detection: framework vite enables Vercel's Vite integration.
- SPA routing: A catch-all rewrite sends all non-API/static paths to /index.html.
- Serverless functions: Each file under api/ is treated as a Vercel Function with explicit maxDuration limits (chat/TTS up to 60s, fetch-url 30s).
- Headers: Security headers (X-Content-Type-Options, Referrer-Policy) applied globally; long-lived cache for og-image.png.

Artifacts:
- Built static assets land in dist/ (Vite default, consumed by Vercel).
- No container images, versioned release artifacts, or cross-compilation targets exist.

Conventions for developers:
- Add new client-side dependencies via npm install --save-dev / --save; keep runtime deps in dependencies and build-only tools in devDependencies.
- New Vercel serverless endpoints go in api/*.js; configure their timeout in vercel.json under functions.
- Local-only helpers stay in scripts/ and are invoked through package.json scripts rather than global CLI commands.
- Do not commit secrets; both the local dev API proxy and production functions read provider keys from environment variables.