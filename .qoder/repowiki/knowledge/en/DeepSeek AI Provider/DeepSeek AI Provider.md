---
kind: external_dependency
name: DeepSeek AI Provider
slug: deepseek
category: external_dependency
category_hints:
    - vendor_identity
    - auth_protocol
scope:
    - '**'
---

### DeepSeek
- **Role**: China-region AI provider; primary for CN/HK IPs, fallback for global users when Gemini unavailable.
- **Integration point**: `api/chat.js` calls `https://api.deepseek.com/chat/completions` with Bearer token auth.
- **Auth protocol**: Single key source via `DEEPSEEK_API_KEY` environment variable. User-provided keys supported but server key takes precedence.
- **Durable usage model**: Model name auto-swapped to `deepseek-v4-flash` regardless of client request. Same error-handling and key rotation logic as Gemini.
- **Region logic**: Selected when `x-vercel-ip-country` is CN/HK OR when `x-linecheck-ai-region` header explicitly requests greater-china/global override.