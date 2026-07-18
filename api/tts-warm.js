/**
 * Keep the Vercel TTS lambda + Edge path warm (cron + client ping).
 * ponytail: not a dedicated always-on worker — upgrade to Fly/Railway if
 * cold starts still dominate; set cron + this endpoint first.
 */
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import {
  cors,
  DEFAULT_VOICE,
  resolveVoice,
  rateToEdge,
} from "./_ttsShared.js";

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "GET or POST" });
    return;
  }

  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(
      resolveVoice(DEFAULT_VOICE),
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );
    const { audioStream } = tts.toStream("Ready.", {
      rate: rateToEdge(1),
    });
    // Drain just enough to exercise the Edge WS, then abort.
    await new Promise((resolve, reject) => {
      let got = false;
      const timer = setTimeout(() => {
        try {
          audioStream.destroy();
        } catch {
          /* ignore */
        }
        if (got) resolve();
        else reject(new Error("warm timed out"));
      }, 12000);
      audioStream.on("data", () => {
        if (got) return;
        got = true;
        clearTimeout(timer);
        try {
          audioStream.destroy();
        } catch {
          /* ignore */
        }
        resolve();
      });
      audioStream.on("error", (err) => {
        clearTimeout(timer);
        if (got) resolve();
        else reject(err);
      });
      audioStream.on("end", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    res.status(200).json({ ok: true, warm: true });
  } catch (e) {
    console.error("[tts-warm]", e?.message);
    res.status(500).json({ ok: false, error: e?.message || "warm failed" });
  } finally {
    try {
      tts.close();
    } catch {
      /* ignore */
    }
  }
}
