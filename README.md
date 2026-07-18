# Line Check

Interview coach PWA — turn resume + JD into speakable answers, then practice out loud.

## Local

```bash
npm install
npm run tts      # Edge TTS on :8790
npm run dev:web  # Vite on :8787
# or: npm run dev
```

Open http://127.0.0.1:8787 — add your Gemini API key in Settings.

## Production (Vercel)

TTS and job-link fetch run as Vercel serverless functions under `/api/*` (Microsoft Edge neural voices — no API key).

Set server env vars (never commit keys):

- `GEMINI_API_KEY` — Google Gemini (`gemini-2.5-flash-lite`), used outside China
- `DEEPSEEK_API_KEY` — DeepSeek (`deepseek-v4-flash`), used for China IPs + fallback
- `ANTIGRAVITY_API_KEY` — Antigravity proxy on Oracle (`gemini-3.1-flash-lite` via OpenAI-compat `/v1`)
- `ANTIGRAVITY_API_BASE` — optional; default `http://138.2.161.62:8045` (`/v1` appended if missing)
- `ANTIGRAVITY_MODEL` — optional; default `gemini-3.1-flash-lite`

`/api/chat` defaults to Antigravity worldwide, then Gemini, then DeepSeek. Prefer in Settings overrides the start of that order.

```bash
npm run build
vercel --prod
```
