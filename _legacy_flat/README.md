# Interview Coach PWA

Paste resume + job description → AI generates interview Q&A → browser TTS reads them aloud.

## How it works

- **Answer generation**: your OpenAI-compatible API (OpenAI / DeepSeek / Groq / etc.)
- **TTS**: browser `speechSynthesis` — **no TTS server**
- API key stays in **localStorage** on your device

## Run locally

```bash
cd ~/Desktop/interview-coach-pwa
python3 -m http.server 8765
```

Open http://localhost:8765

On phone (same Wi‑Fi): use your computer’s LAN IP, then Safari/Chrome → Add to Home Screen.

## Setup

1. Open **API & 语音设置**
2. Paste API key
3. Optionally change Base URL / model (e.g. DeepSeek: `https://api.deepseek.com/v1`)
4. Paste resume + JD → Generate → Play
