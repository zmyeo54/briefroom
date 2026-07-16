import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import {
  cors,
  rateToEdge,
  resolveVoice,
  sanitizeSpeakText,
} from "./_ttsShared.js";

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: "32kb" } },
};

function collectStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("close", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    // Safety: some streams emit end without close
    setTimeout(() => {
      if (chunks.length) resolve(Buffer.concat(chunks));
    }, 25000);
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const text = sanitizeSpeakText(body.text || "");
    if (!text) {
      res.status(400).json({ error: "text required" });
      return;
    }
    if (text.length > 4500) {
      res.status(400).json({ error: "text too long" });
      return;
    }

    const edgeVoice = resolveVoice(body.voice);
    const rate = rateToEdge(body.rate);

    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      edgeVoice,
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );
    const { audioStream } = tts.toStream(text, { rate });
    const audio = await collectStream(audioStream);
    if (!audio?.length) {
      res.status(502).json({ error: "empty audio" });
      return;
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(audio);
  } catch (e) {
    res.status(500).json({ error: e?.message || "TTS failed" });
  }
}
