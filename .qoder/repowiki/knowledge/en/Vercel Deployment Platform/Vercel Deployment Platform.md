---
kind: external_dependency
name: Vercel Deployment Platform
slug: vercel
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
---

### Vercel
- **Role**: Primary deployment platform for Line Check PWA; hosts both static frontend and serverless API functions.
- **Integration points**:
  - `vercel.json` configures build (`npm run build`), output directory (`dist`), framework detection (`vite`), rewrites for SPA routing, and function timeouts per route.
  - Serverless functions under `/api/*` (chat, tts, fetch-url) with custom `maxDuration` limits.
  - Geo-based routing via `x-vercel-ip-country` header used to select AI provider (DeepSeek for CN/HK, Gemini otherwise).
- **Durable usage model**: Functions are stateless Node.js handlers; environment variables injected at runtime (never committed). Headers like `X-Content-Type-Options` and `Referrer-Policy` set globally via Vercel headers config.
- **Verify exact timeout/size limits against current vercel.json** — these are configuration values that may change.