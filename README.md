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

`/api/chat` picks DeepSeek when `x-vercel-ip-country` is `CN`, otherwise Gemini.

```bash
npm run build
vercel --prod
```
