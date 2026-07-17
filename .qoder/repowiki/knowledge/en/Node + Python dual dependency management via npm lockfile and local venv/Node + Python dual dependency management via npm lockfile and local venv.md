---
kind: dependency_management
name: Node + Python dual dependency management via npm lockfile and local venv
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - scripts/tts_server.py
    - scripts/job_fetch.py
---

This repository manages dependencies across two runtimes — Node.js (React PWA, Vite tooling, Playwright/Puppeteer) and Python (local Edge TTS server and job-fetcher). There is no monorepo package manager; instead each runtime uses its own manifest and lockfile at the repo root.

**Node.js side**
- `package.json` declares all runtime and dev dependencies with caret ranges (`^x.y.z`). The project is marked `"private": true`, so it is not published to any registry.
- `package-lock.json` (lockfileVersion 3) pins every transitive dependency tree and includes integrity hashes. It is committed to version control, making builds deterministic without a separate vendoring step.
- No `.npmrc`, private registry, or `overrides`/`resolutions` are present; packages resolve from the default public npm registry.
- Dev-time bundling and linting use Vite 8, Tailwind CSS v4, oxlint, and React tooling; test automation relies on Playwright and Puppeteer (with stealth plugin).

**Python side**
- A local development HTTP server (`scripts/tts_server.py`) and job scraper (`scripts/job_fetch.py`) depend on the third-party `edge_tts` package plus only stdlib modules.
- Dependencies are installed into a per-project virtual environment (`.venv/`), which is gitignored. The `tts` npm script invokes `.venv/bin/python scripts/tts_server.py`, tying the Python runtime into the Node workflow.
- There is no `requirements.txt`, `pyproject.toml`, or `setup.py`; the Python dependency list is implicit in the source imports. The `.python-version` file (gitignored) suggests a version pinning convention for the interpreter itself.

**Cross-runtime orchestration**
- The top-level `npm run dev` concurrently starts the Python TTS server, a Node dev API proxy, and the Vite web dev server, treating the Python process as an external service rather than a bundled dependency.
- The production build (`vite build`) only ships the Node-side bundle; the Python helpers are not included in the artifact and are expected to be provided by the deployment environment (Vercel serverless routes in `api/` handle chat/TTS in production, while the Python server is a local-only convenience).

**Conventions developers should follow**
- Add new Node dependencies through `npm install` so that `package.json` and `package-lock.json` stay in sync; do not edit either file manually.
- Do not add Python third-party packages without also recording them somewhere (e.g., a `requirements.txt` or `pyproject.toml`) — currently none exists, so new Python deps risk being lost between environments.
- Keep the `.venv/` directory untracked; recreate it locally when switching branches or after updating Python code.
- Treat the Python TTS server as a local-only helper: production deployments rely on the Vercel serverless `api/tts.js` route, not on `scripts/tts_server.py`.