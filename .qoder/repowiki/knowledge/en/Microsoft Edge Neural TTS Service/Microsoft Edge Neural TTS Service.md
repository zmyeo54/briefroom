---
kind: external_dependency
name: Microsoft Edge Neural TTS Service
slug: microsoft-edge-tts
category: external_dependency
category_hints:
    - vendor_identity
    - client_constraint
scope:
    - '**'
---

### Microsoft Edge TTS
- **Role**: Free text-to-speech backend producing MP3 audio streams; no API key required.
- **Integration point**: `api/tts.js` uses `msedge-tts` npm package to call Edge neural voices via WebSocket stream.
- **Client constraint**: Stream often drops mid-synthesis on long turns — implementation splits input into ~900-character chunks at sentence boundaries and concatenates results. Each synthesis attempt has 45-second timeout with exponential backoff retry (up to 3 attempts).
- **Voice mapping**: Predefined voice IDs map to specific Edge neural voices (e.g., `zh-xiaoxiao-news` → `zh-CN-XiaoxiaoNeural`, `en-guy-news` → `en-US-GuyNeural`). Rate control converted to Edge's percentage format (-40% to +40%).
- **Output**: 24kHz 48kbps mono MP3, streamed directly to client with `audio/mpeg` content type.