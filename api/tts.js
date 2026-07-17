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

/** Edge WS often drops mid-synthesis on long turns — keep each request short. */
const CHUNK_CHARS = 900;
const MAX_ATTEMPTS = 3;

function collectStream(stream, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      try {
        stream.destroy();
      } catch {
        /* ignore */
      }
      finish(reject, new Error("TTS timed out"));
    }, timeoutMs);

    stream.on("data", (d) =>
      chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d))
    );
    // Only trust a clean end — premature close is truncated (msedge-tts destroys with err).
    stream.on("end", () => finish(resolve, Buffer.concat(chunks)));
    stream.on("error", (err) => finish(reject, err));
  });
}

/** Split on sentence boundaries so Edge TTS can finish each turn.end. */
export function splitSpeakChunks(text, maxLen = CHUNK_CHARS) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  if (raw.length <= maxLen) return [raw];

  const sentences = raw.split(/(?<=[.!?。！？；;])\s+/).filter(Boolean);
  const parts = [];
  let buf = "";
  for (const s of sentences) {
    if (buf && buf.length + 1 + s.length > maxLen) {
      parts.push(buf);
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf) parts.push(buf);

  // Hard-split any leftover monster sentence
  return parts.flatMap((p) => {
    if (p.length <= maxLen) return [p];
    const hard = [];
    for (let i = 0; i < p.length; i += maxLen) hard.push(p.slice(i, i + maxLen));
    return hard;
  });
}

async function synthesizeOnce(text, edgeVoice, rate) {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(
      edgeVoice,
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );
    const { audioStream } = tts.toStream(text, { rate });
    const audio = await collectStream(audioStream);
    if (!audio?.length) throw new Error("empty audio");
    return audio;
  } finally {
    try {
      tts.close();
    } catch {
      /* ignore */
    }
  }
}

async function synthesizeWithRetry(text, edgeVoice, rate) {
  let last;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await synthesizeOnce(text, edgeVoice, rate);
    } catch (e) {
      last = e;
      // Brief backoff — Edge rate-limits / flaps the WS
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  throw last;
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
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
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
    const pieces = splitSpeakChunks(text);
    const buffers = [];
    for (const piece of pieces) {
      buffers.push(await synthesizeWithRetry(piece, edgeVoice, rate));
    }
    const audio = Buffer.concat(buffers);
    if (!audio.length) {
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
