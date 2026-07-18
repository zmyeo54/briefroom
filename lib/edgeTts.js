/** Shared Edge voice map for Vercel TTS routes. */

export const VOICES = {
  "zh-xiaoxiao-news": "zh-CN-XiaoxiaoNeural",
  "zh-yunyang-news": "zh-CN-YunyangNeural",
  "zh-xiaoyi-news": "zh-CN-XiaoyiNeural",
  "zh-yunjian-news": "zh-CN-YunjianNeural",
  "en-aria-news": "en-US-AriaNeural",
  "en-jenny-news": "en-US-JennyNeural",
  "en-guy-news": "en-US-GuyNeural",
  "en-davis-news": "en-US-DavisNeural",
  "zh-male": "zh-CN-YunyangNeural",
  "zh-female": "zh-CN-XiaoxiaoNeural",
  "en-male": "en-US-GuyNeural",
  "en-female": "en-US-JennyNeural",
  yunyang: "zh-CN-YunyangNeural",
};

export const DEFAULT_VOICE = "en-guy-news";
export const DEFAULT_VOICE_Q = "en-aria-news";
export const DEFAULT_VOICE_A = "en-guy-news";

export function resolveVoice(id) {
  return VOICES[id] || VOICES[DEFAULT_VOICE];
}

export function rateToEdge(rate) {
  const n = Number(rate);
  const base = Number.isFinite(n) ? n : 1;
  let pct = Math.round((base - 1) * 100 - 4);
  pct = Math.max(-40, Math.min(40, pct));
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

export function sanitizeSpeakText(text) {
  let t = String(text || "");
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/https?:\/\/\S+/gi, " ");
  t = t.replace(/\s*\/\s*/g, ". ");
  t = t.replace(/[|｜]+/g, ". ");
  t = t.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/^#+\s*/gm, "");
  t = t.replace(/&nbsp;/g, " ").replace(/&amp;/g, " and ");
  t = t.replace(/&lt;/g, " ").replace(/&gt;/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/** Escape text for embedding inside SSML. */
export function escapeXml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * One SSML document with multiple <voice> turns — one Edge WebSocket for a
 * whole Q&A instead of N sequential connections.
 */
export function buildMultiVoiceSsml(parts, rate) {
  const rateStr = typeof rate === "string" ? rate : rateToEdge(rate);
  const body = (parts || [])
    .map((part) => {
      const text = sanitizeSpeakText(part?.text || "");
      if (!text) return "";
      const voice = resolveVoice(part.voice);
      return `<voice name="${voice}"><prosody rate="${rateStr}">${escapeXml(text)}</prosody></voice>`;
    })
    .filter(Boolean)
    .join("");
  if (!body) return "";
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">${body}</speak>`;
}

export function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Linecheck-AI-Region, X-Linecheck-AI-Provider, X-Linecheck-AI-Enabled"
  );
}
