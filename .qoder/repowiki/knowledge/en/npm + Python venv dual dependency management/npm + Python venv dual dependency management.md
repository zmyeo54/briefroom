---
kind: dependency_management
name: npm + Python venv dual dependency management
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - .gitignore
    - scripts/tts_server.py
---

This repository manages dependencies across two runtimes with separate toolchains and lockfiles.

**Node.js (frontend + dev tooling)**
- Package manager: **npm** (v3 lockfile via `package-lock.json`).
- All runtime and dev dependencies are declared in `package.json` under `dependencies` and `devDependencies`, using caret (`^`) ranges so minor/patch updates are accepted automatically.
- No vendoring — packages are installed into `node_modules` at install time; the directory is not committed.
- Build/dev scripts in `package.json` orchestrate three concurrent processes: a Python TTS server, a Node dev API proxy, and Vite (`npm run dev`).
- Playwright is listed as a dependency (not devDependency) and is used by `scripts/tts_regression.mjs` for regression tests that drive real browser instances.

**Python (Edge TTS sidecar server)**
- Runtime: Python 3 with a local virtual environment (`.venv/`, ignored via `.gitignore`).
- The TTS server (`scripts/tts_server.py`) depends on the third-party package `edge_tts`, which is expected to be installed inside `.venv` before running `npm run tts`.
- There is no `requirements.txt`, `pyproject.toml`, or `setup.py` checked in; the Python dependency list is implicit in the source imports. The `.python-version` file is also gitignored, so the exact interpreter version is not pinned in the repo.
- A separate Node wrapper (`api/tts.js`) uses the npm package `msedge-tts` to call Edge's TTS directly from the Vercel-deployed API routes, while the local dev path goes through the Python server.

**Cross-cutting conventions**
- Lockfiles are committed (`package-lock.json`) but the Python venv is intentionally excluded, meaning each developer must create their own `.venv` and install `edge_tts` manually.
- No private registry or scoped npm configuration is present; all packages resolve from the public npm registry.