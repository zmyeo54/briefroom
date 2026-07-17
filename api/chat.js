import { cors } from "./_ttsShared.js";

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: "1mb" } },
};

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/openai";

function serverKey() {
  return String(
    process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ""
  ).trim();
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({ hasKey: Boolean(serverKey()) });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  const key = serverKey();
  if (!key) {
    res.status(503).json({
      error: {
        message:
          "No GEMINI_API_KEY on the server. Set it in Vercel env (no VITE_ needed) and redeploy, or paste a key in Settings.",
      },
    });
    return;
  }

  const body = req.body;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: { message: "Missing JSON body" } });
    return;
  }

  try {
    let upstream = await fetch(`${GEMINI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    let data = await upstream.json().catch(() => ({}));

    // Retry without response_format if the model rejects it
    if (
      !upstream.ok &&
      body.response_format &&
      /response_format|json_object|unknown/i.test(data?.error?.message || "")
    ) {
      const { response_format: _, ...rest } = body;
      upstream = await fetch(`${GEMINI_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(rest),
      });
      data = await upstream.json().catch(() => ({}));
    }

    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({
      error: { message: e.message || "Upstream Gemini request failed" },
    });
  }
}
