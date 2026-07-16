import {
  cors,
  VOICES,
  DEFAULT_VOICE_Q,
  DEFAULT_VOICE_A,
} from "./_ttsShared.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  res.status(200).json({
    ok: true,
    voices: Object.keys(VOICES),
    defaults: { q: DEFAULT_VOICE_Q, a: DEFAULT_VOICE_A },
  });
}
