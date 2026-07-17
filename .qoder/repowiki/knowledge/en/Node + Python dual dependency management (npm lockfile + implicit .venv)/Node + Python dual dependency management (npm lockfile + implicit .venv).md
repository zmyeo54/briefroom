---
kind: dependency_management
name: Node + Python dual dependency management (npm lockfile + implicit .venv)
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - .gitignore
    - scripts/tts_server.py
---

This repository manages dependencies across two runtimes — a Node.js frontend and an embedded Python TTS server — using different strategies.

**Node.js (frontend)**
- Declared in `package.json` under `dependencies` and `devDependencies`, pinned with caret ranges (`^x.y.z`) to allow compatible updates.
- A `package-lock.json` (lockfileVersion 3) is committed, so installs are deterministic and reproducible across machines. No vendoring directory exists; packages are installed into `node_modules` at install time.
- The project uses npm as the package manager (no pnpm/yarn lockfiles present). Scripts in `package.json` orchestrate dev workflows that also start the Python side.
- Key runtime deps include React 19, Vite 8, Tailwind CSS v4, Framer Motion, PDF/OCR libraries (`pdfjs-dist`, `tesseract.js`, `mammoth`), Edge TTS client (`msedge-tts`), and Playwright/Puppeteer for testing.

**Python (local TTS helper)**
- The local development TTS server lives in `scripts/tts_server.py` and depends on the third-party `edge_tts` package plus standard-library modules only.
- There is **no** `requirements.txt`, `pyproject.toml`, `Pipfile`, or similar manifest checked into version control. Instead, the script is invoked via the npm script `"tts": ".venv/bin/python scripts/tts_server.py"`, which expects a pre-created virtual environment at `.venv/`.
- `.venv/` is gitignored (`.gitignore` line 3), confirming the Python environment is intentionally not tracked. Developers must create it manually before running `npm run tts`.
- The Python side has no lockfile or private registry configuration; it relies on whatever `edge_tts` version resolves from PyPI inside the active virtualenv.

**Cross-runtime convention**
- The single `npm run dev` script starts both sides concurrently: `npm run tts & npm run dev:api & npm run dev:web`, making the Python TTS server part of the default developer experience even though its dependencies are not declared alongside the Node ones.