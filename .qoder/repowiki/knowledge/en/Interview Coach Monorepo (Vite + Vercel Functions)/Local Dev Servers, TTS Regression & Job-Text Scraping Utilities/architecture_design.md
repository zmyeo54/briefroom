Two independent sub-trees with no shared code:

- `scripts/` — four single-file utilities, each independently executable:
  - `dev-api-server.mjs`: a zero-dependency Node `http` server (port 8791) that proxies `/api/chat` to either Google Gemini or DeepSeek depending on which of `GEMINI_API_KEY*` / `VITE_GEMINI_API_KEY` / `DEEPSEEK_API_KEY` is present, with region-aware key selection via the `X-Linecheck-AI-Region` header.
  - `tts_server.py`: a Python `ThreadingHTTPServer` (port 8790) wrapping `edge_tts`, exposing `/health`, `/api/tts-health`, `/tts` + `/api/tts` (audio/mpeg), and `/fetch-url` + `/api/fetch-url` (delegating to `job_fetch.fetch_job_text`).
  - `job_fetch.py`: pure-Python scrapers for LinkedIn guest API (`linkedin.com/jobs/view/<id>` → `jobs-guest/api/jobPosting/<id>`) and generic pages via Jina Reader → Google Cache → raw HTTP fallback; returns `{text, sourceUrl, title?, company?}`.
  - `tts_regression.mjs`: end-to-end harness that imports `src/lib/tts.js` and `api/tts.js` from the repo root, runs health/unit/synthesis/stress/sequence tests against the Vite dev server (`:8787` → `/api/tts`) and the local TTS server (`:8790`), writes MP3 artifacts to `.tmp/tts-regression`, and exits non-zero on any failure.

- `_legacy_flat/` — self-contained PWA snapshot (HTML/CSS/JS/SW/manifest/icons) served by a plain `python3 -m http.server 8765`; uses browser `speechSynthesis` directly (no TTS server) and stores keys in localStorage. It is kept as a reference implementation and has no dependency on the rest of the repo.

Dependency direction is one-way: `tts_server.py` imports `job_fetch.py` from the same directory; nothing in this module imports from the main application except `tts_regression.mjs`, which dynamically imports `src/lib/tts.js` and `api/tts.js` at runtime.