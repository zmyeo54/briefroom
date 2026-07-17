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
---

This project uses two independent package managers for its JavaScript and Python layers, with no cross-language lockfile or unified tooling.

**JavaScript (Node.js) — npm**
- `package.json` declares runtime dependencies (`react`, `framer-motion`, `msedge-tts`, `pdfjs-dist`, `tesseract.js`, etc.) and dev dependencies (`vite`, `@vitejs/plugin-react`, `tailwindcss`, `oxlint`). All versions use caret ranges (`^x.y.z`) allowing minor/patch upgrades within the major version.
- `package-lock.json` (lockfileVersion 3) pins every transitive dependency to an exact tarball URL and sha512 integrity hash from `https://registry.npmjs.org`. This is committed to the repo, so CI and local installs resolve deterministically without network variance.
- `node_modules/` is gitignored. There is no vendoring strategy; packages are installed on-demand into a per-project `node_modules` tree.
- No `.npmrc`, `.yarnrc`, or private registry configuration exists — all packages come from the public npm registry.
- The project is marked `"type": "module"`, so imports use ESM throughout.

**Python — virtual environment (.venv)**
- A local `.venv/` directory is created by the developer and gitignored. The TTS server is invoked via `"tts": ".venv/bin/python scripts/tts_server.py"`, meaning the Python runtime and its packages must be bootstrapped manually before running that script.
- There is **no** `requirements.txt`, `pyproject.toml`, `Pipfile`, `poetry.lock`, or any other pinned Python dependency manifest in the repository. The `.python-version` file is also gitignored, so no explicit CPython version is enforced at the repo level.
- The only Python code shipped is `scripts/tts_server.py` plus `__pycache__/` artifacts (also ignored).

**Build/dev orchestration**
- `npm run dev` launches three parallel processes: the Python TTS server, a Node dev API proxy (`scripts/dev-api-server.mjs`), and the Vite dev server. This couples the JS and Python dependency trees at runtime but not at install time.
- Playwright and Puppeteer are declared as runtime dependencies (not dev-only), which means their native binaries are installed during normal `npm ci`/`npm install` runs.

**Conventions / rules developers should follow**
- Add new JS dependencies only through `package.json`; never edit `package-lock.json` by hand. Commit both files together after `npm i`.
- Do not commit `node_modules/` or `.venv/`.
- If you add Python packages, document them outside this repo (e.g., in a README note) since there is no checked-in manifest to enforce pinning.
- Keep `"type": "module"` consistency — all source files import/export using ESM syntax.