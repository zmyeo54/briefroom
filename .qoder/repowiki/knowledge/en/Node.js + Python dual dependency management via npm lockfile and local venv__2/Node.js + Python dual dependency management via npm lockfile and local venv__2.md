---
kind: dependency_management
name: Node.js + Python dual dependency management via npm lockfile and local venv
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - scripts/tts_server.py
---

This repository manages dependencies across two runtimes — Node.js (Vite/React frontend) and Python (local TTS microservice) — using separate, conventional strategies.

**Node.js dependencies**
- Declared in `package.json` under `dependencies` and `devDependencies`, split between runtime packages (React 19, Framer Motion, Playwright, Puppeteer, PDF.js, Tesseract.js, msedge-tts) and build/dev tooling (Vite 8, Tailwind CSS v4, Oxlint).
- A committed `package-lock.json` (lockfileVersion 3) pins every transitive resolution with integrity hashes, ensuring reproducible installs across machines. No vendoring (`node_modules` is not checked in); the lockfile is the source of truth for CI and collaborators.
- The project uses ESM (`"type": "module"`) so all imports are bare specifiers; no custom registry or private scope is configured beyond the public npm registry.

**Python dependencies**
- The Python TTS server (`scripts/tts_server.py`) depends on `edge_tts` and a sibling script `job_fetch.py`. There is no `requirements.txt`, `pyproject.toml`, or Poetry lockfile tracked in version control.
- Dependencies are expected to be installed into a local virtual environment at `.venv/`, which is gitignored. The npm script `tts` invokes `.venv/bin/python scripts/tts_server.py`, making the venv path part of the development contract rather than an explicit manifest.
- Because no lockfile exists, Python dependency versions drift unless developers pin them manually before committing changes.

**Cross-cutting conventions**
- Runtime vs dev-tooling separation is enforced by placing utilities only in `dependencies` (e.g., `msedge-tts` is used both by the Vercel Edge Functions and the local server) while bundlers/linters stay in `devDependencies`.
- Browser automation tools (`playwright`, `puppeteer-extra`, stealth plugin) are declared as runtime dependencies because they are imported from both the Vite build pipeline and the local dev server; there is no separate test-only workspace.
- No private npm registry, `.npmrc`, or scoped package configuration is present — all packages resolve from the default public registry.