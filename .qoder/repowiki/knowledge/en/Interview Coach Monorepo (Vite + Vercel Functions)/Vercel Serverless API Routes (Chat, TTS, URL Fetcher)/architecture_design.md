Each file is a Vercel serverless handler (`export default async function handler(req, res)`) following the `pages/api` convention; route behavior is declared via an exported `config` object (`maxDuration`, `api.bodyParser.sizeLimit`).

- Shared cross-cutting concerns live in `_ttsShared.js`, which re-exports voice tables, rate conversion, text sanitization, and CORS from `lib/edgeTts.js`. All TTS routes (`tts.js`, `tts-health.js`) depend on this shim.
- `chat.js` implements provider selection logic: it reads `x-linecheck-ai-region`, falls back to `x-vercel-ip-country`, and picks between Gemini (`GEMINI_BASE`) and DeepSeek (`DEEPSEEK_BASE`). It rotates through a deduplicated pool of keys collected from `GEMINI_API_KEY[_N]`, `VITE_GEMINI_API_KEY`, and `DEEPSEEK_API_KEY`, retrying next key or alternate provider based on status/error heuristics (`shouldTryNextKey`, `shouldTryOtherProvider`).
- `fetch-url.js` exposes a single POST endpoint that first tries a LinkedIn-specific scraper, then falls back through Jina reader → Google cache → Playwright headless browser, returning `{text,title,company,source}`.
- `tts.js` splits long input into ≤900-char sentence chunks, synthesizes each via `msedge-tts` with exponential backoff (up to 3 attempts), concatenates MP3 buffers, and streams them as `audio/mpeg`.
- `tts-health.js` is a lightweight GET probe exposing available voices and defaults.

Dependency direction: routes → `_ttsShared.js` → `lib/edgeTts.js`; no inter-route imports. Each route is self-contained and stateless.