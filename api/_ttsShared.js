/** Shared helpers for Vercel `/api/tts*` routes. */
export {
  VOICES,
  DEFAULT_VOICE,
  DEFAULT_VOICE_Q,
  DEFAULT_VOICE_A,
  resolveVoice,
  rateToEdge,
  sanitizeSpeakText,
  escapeXml,
  buildMultiVoiceSsml,
  cors,
} from "../lib/edgeTts.js";
