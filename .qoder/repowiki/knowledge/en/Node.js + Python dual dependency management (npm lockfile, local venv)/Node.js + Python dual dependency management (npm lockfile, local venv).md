---
kind: dependency_management
name: Node.js + Python dual dependency management (npm lockfile, local venv)
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - vercel.json
    - scripts/tts_server.py
---

This project manages dependencies across two runtimes — a Node.js frontend/build toolchain and a Python Edge TTS helper server — with no shared manifest between them.

**Node.js side (primary)**
- `package.json` declares runtime deps (`react`, `framer-motion`, `msedge-tts`, `pdfjs-dist`, `tesseract.js`, `playwright`/`puppeteer-extra` for OCR) and dev deps (`vite`, `@vitejs/plugin-react`, `tailwindcss`, `oxlint`). All versions use caret ranges (`^x.y.z`) so minor/patch updates are allowed at install time.
- `package-lock.json` (lockfileVersion 3) pins every transitive dependency to an exact version and records the npm registry URL plus sha512 integrity hashes, ensuring deterministic installs across machines and CI.
- No vendoring (`node_modules` is not committed); builds rely on `npm ci` / `npm install` against the public npm registry. There is no `.npmrc`, private registry, or proxy configuration in the repo.
- Build/deploy hooks: `vercel.json` sets `buildCommand: "npm run build"` and `framework: vite`, so Vercel resolves dependencies from `package.json` + `package-lock.json` during deployment.

**Python side (local-only TTS helper)**
- `scripts/tts_server.py` depends on the third-party `edge_tts` package and is invoked via the npm script `tts` which calls `.venv/bin/python scripts/tts_server.py`. The `.venv` directory is gitignored (see `.gitignore`), meaning each developer creates their own isolated Python environment locally.
- There is no `requirements.txt`, `pyproject.toml`, `Pipfile`, or pinned lockfile in the repository; the Python dependency graph is therefore untracked and must be installed manually per developer machine. This is acceptable because the Python process only runs locally during development and is replaced by the Vercel Edge Function (`api/tts.js`) using the equivalent `msedge-tts` npm package in production.

**Cross-runtime convention**
- Both runtimes wrap the same Microsoft Edge TTS capability: Node code uses `msedge-tts` (production, deployed as Vercel Edge Functions), while the local Python helper uses `edge_tts` (development convenience). The API surface (`/api/tts`, `/api/fetch-url`, `/api/chat`) is identical between the two, so switching backends does not change client code.

**Rules developers should follow**
- Add new Node.js packages through `npm install <pkg>` so both `package.json` and `package-lock.json` stay in sync; never edit either file by hand.
- Do not commit `node_modules`; rely on the lockfile for reproducible installs.
- For local Python TTS work, create/update your own `.venv` and install `edge_tts` there; do not add a global requirements file unless you also want it tracked in version control.
- When deploying to Vercel, ensure `package-lock.json` is up to date before pushing, since the platform installs from it.