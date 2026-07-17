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
    - scripts/job_fetch.py
---

This project manages dependencies across two runtimes — Node.js (Vite/React frontend) and Python (Edge TTS helper server) — using separate, isolated strategies.

**Node.js dependencies**
- Declared in `package.json` under `dependencies` and `devDependencies`, with caret (`^`) version ranges for all packages.
- A committed `package-lock.json` (lockfileVersion 3) pins every transitive resolution to exact versions and integrity hashes, ensuring deterministic installs across environments.
- No vendoring (`node_modules` is not checked in); the default npm registry is used. There is no `.npmrc`, private registry, or `overrides`/`resolutions` field, so all third-party packages come from the public npm registry.
- The React runtime is pinned at `^19.2.7` alongside `react-dom` and `react-router-dom`; build tooling uses Vite 8, Tailwind CSS 4, and oxlint as the linter.
- Browser-side PDF/OCR capabilities are pulled in via `pdfjs-dist` and `tesseract.js`, while Playwright/Puppeteer extras are present only as dev/test dependencies.

**Python dependencies**
- The Edge TTS server lives in `scripts/tts_server.py` and depends on the `edge_tts` package plus a small sibling module `scripts/job_fetch.py`. Both use only the Python standard library beyond that single external package.
- Dependencies are installed into a local virtual environment (`.venv/`) referenced by the npm script `"tts": ".venv/bin/python scripts/tts_server.py"`. The `.venv` directory is gitignored.
- There is no `requirements.txt`, `pyproject.toml`, `poetry.lock`, or any other declarative Python manifest in the repository; the presence of `.python-version` in `.gitignore` suggests a pyenv-managed interpreter but no lockfile is tracked.
- Because the Python side has exactly one third-party import (`edge_tts`), the absence of a lockfile is low-risk, but it means the Python install is not reproducible without manual pinning.

**Runtime orchestration**
- The top-level `npm run dev` concurrently starts three processes: the Python TTS server (`scripts/tts_server.py`), the Node dev API proxy (`scripts/dev-api-server.mjs`), and the Vite dev server (`vite --host 0.0.0.0 --port 8787`).
- The Node app also ships a bundled copy of `msedge-tts` (`lib/edgeTts.js`) as a client-side fallback when the Python server is unavailable, giving the PWA a hybrid TTS path.

**Conventions / rules for developers**
- Add new Node.js packages through `npm install <pkg>` so both `package.json` and `package-lock.json` stay in sync; do not edit the lockfile by hand.
- Keep `type: "module"` consistency — the repo already declares ESM at the project root.
- For Python additions, create or update a `requirements.txt` (or `pyproject.toml`) next to `scripts/` and commit it alongside the code; avoid relying on an untracked `.venv` for CI reproducibility.
- Do not vendor `node_modules` into the repo — rely on the lockfile instead.