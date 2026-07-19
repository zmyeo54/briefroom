# Line Check

Interview coach PWA — turn resume + JD into speakable answers, then practice out loud.

## What It Does

- Parses resumes and job descriptions (PDF, DOCX, image OCR)
- Generates tailored interview Q&A with a Gemini/DeepSeek/Antigravity LLM backend
- Reads answers aloud with Microsoft Edge neural TTS
- Exports answers to PDF and visualizes topics as a mindmap
- Works offline as a PWA with install prompt

## Tech Stack

- **Frontend:** React 19, Vite 8, Tailwind CSS 4, Framer Motion, React Router 7
- **Backend:** Vercel serverless functions (`/api/*`) for chat, TTS, and URL fetching
- **TTS:** Edge TTS (`msedge-tts`) via local Python server or Vercel functions
- **AI Models:** Google Gemini, DeepSeek, Antigravity proxy
- **Docs:** `mammoth` (DOCX), `pdfjs-dist` (PDF), `tesseract.js` (OCR)

## Project Structure

```
├── api/                  # Vercel serverless functions
│   ├── chat.js           # LLM chat endpoint
│   ├── tts.js            # TTS proxy endpoint
│   ├── fetch-url.js      # URL content fetcher
│   └── _ttsShared.js     # Shared TTS utilities
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/            # Route pages (Home, Settings)
│   ├── lib/              # Core logic (prompt, storage, TTS, OCR, i18n)
│   └── App.jsx           # Router, SEO meta, animations
├── scripts/              # Dev servers, TTS checks, regression tests
├── public/               # Static assets, PWA manifest, robots.txt
├── _legacy_flat/         # Legacy PWA build artifacts
└── vite.config.js        # Vite + Tailwind + PWA plugin config
```

## Local

```bash
npm install
npm run tts      # Edge TTS on :8790
npm run dev:web  # Vite on :8787
# or: npm run dev
```

### Prerequisites

- Node.js 18+
- Python 3.9+ and a virtualenv with `msedge-tts` installed (`pip install msedge-tts`)
- A Gemini API key (or DeepSeek / Antigravity key)

### Quick Start

```bash
npm install
npm run tts      # Edge TTS on :8790
npm run dev:web  # Vite on :8787
# or run everything:
npm run dev
```

Open http://127.0.0.1:8787 and add your Gemini API key in **Settings**.

### Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start TTS, API, and web dev servers together |
| `npm run dev:web` | Start Vite frontend only |
| `npm run dev:api` | Start local API proxy server |
| `npm run tts` | Start local Edge TTS server |
| `npm run build` | Production build |
| `npm run lint` | Run Oxlint |
| `npm run preview` | Preview production build |
| `npm run test:tts` | Run TTS regression tests |

## Production (Vercel)

TTS and job-link fetch run as Vercel serverless functions under `/api/*` (Microsoft Edge neural voices — no API key).

Set server env vars (never commit keys):

- `GEMINI_API_KEY` — Google Gemini (`gemini-3.1-flash-lite`), used outside China
- `DEEPSEEK_API_KEY` — DeepSeek (`deepseek-v4-flash`), used for China IPs + fallback
- `ANTIGRAVITY_API_KEY` — Antigravity proxy on Oracle (`gemini-3.1-flash-lite` via OpenAI-compat `/v1`)
- `ANTIGRAVITY_API_BASE` — optional; default `http://138.2.161.62:8045` (`/v1` appended if missing)
- `ANTIGRAVITY_MODEL` — optional; default `gemini-3.1-flash-lite`

`/api/chat` defaults to Gemini worldwide, then Antigravity, then DeepSeek. Prefer in Settings overrides the start of that order.

### Deploy

```bash
npm run build
vercel --prod
```

## Contributing

- Follow existing component and file naming conventions
- Run `npm run lint` before committing
- Add or update TTS regression tests under `scripts/` when changing audio behavior
