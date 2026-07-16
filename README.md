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

```bash
npm run build
vercel --prod
```
