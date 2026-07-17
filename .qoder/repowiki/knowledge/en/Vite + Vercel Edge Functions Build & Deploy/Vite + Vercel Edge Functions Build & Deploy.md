---
kind: build_system
name: Vite + Vercel Edge Functions Build & Deploy
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - vite.config.js
    - vercel.json
---

This project uses a minimal, script-driven build system centered on Vite for the React PWA and Vercel for hosting and serverless functions. There is no Makefile, Dockerfile, or CI pipeline in the repository — builds are invoked directly via npm scripts.

Build toolchain:
- Vite 8 (vite.config.js) compiles the React app with @vitejs/plugin-react and Tailwind CSS v4 via @tailwindcss/vite. The dev server runs on port 8787 and proxies /api/* routes to local helper servers (chat on 8791, TTS/fetch-url on 8790). tesseract.js is excluded from dependency pre-bundling.
- npm scripts in package.json orchestrate the full local dev loop: npm run dev starts three processes in parallel — a Python Edge-TTS server (scripts/tts_server.py), a Node API proxy (scripts/dev-api-server.mjs), and the Vite dev server. Production build is a single vite build emitting to dist/.
- Linting uses Oxlint (.oxlintrc.json); no ESLint setup.

Deployment:
- Vercel is the sole deployment target, declared by vercel.json. It sets buildCommand: npm run build, outputDirectory: dist, and declares the framework as vite. Client-side SPA routing is handled via a rewrite of /settings to /index.html. Security headers (X-Content-Type-Options, Referrer-Policy) and a long cache for og-image.png are added at the edge.
- Serverless Vercel Functions are defined for api/chat.js, api/tts.js, and api/fetch-url.js with explicit maxDuration limits (30–60 s) to accommodate streaming chat and audio generation. These functions run on Vercel's runtime; they are not bundled into the static dist/ output.

Local development workflow:
- npm run tts launches a standalone Python TTS server (requires a local .venv).
- npm run dev:api starts a Node-based API shim that forwards requests to the same endpoints exposed by the TTS server.
- npm run dev:web runs Vite with --host 0.0.0.0 --port 8787 so it can be reached from other containers or hosts.
- npm run test:tts executes a Playwright-based regression suite against the TTS server (scripts/tts_regression.mjs).

Conventions & constraints:
- No versioned release artifacts are produced beyond dist/; the package version field is pinned at 0.0.0 and marked private, indicating this is an application rather than a distributable library.
- There is no CI configuration, no Docker image, and no cross-compilation step — the build assumes a Node.js environment capable of running Vite 8 and a Python 3 environment for the TTS helper.
- All build logic lives in flat files at the repo root (package.json, vite.config.js, vercel.json); there is no subdirectory-based build orchestration.