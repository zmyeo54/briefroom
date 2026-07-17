import { cors } from "./_ttsShared.js";

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: "1mb" } },
};

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/openai";

/** Comma/space-separated + GEMINI_API_KEY_2..10. Deduped. */
export function collectServerKeys(env = process.env) {
  const out = [];
  const push = (raw) => {
    for (const part of String(raw || "").split(/[\s,]+/)) {
      const k = part.trim();
      if (k && !out.includes(k)) out.push(k);
    }
  };
  push(env.GEMINI_API_KEYS);
  push(env.GEMINI_API_KEY);
  push(env.VITE_GEMINI_API_KEY);
  for (let i = 2; i <= 10; i++) push(env[`GEMINI_API_KEY_${i}`]);
  return out;
}

/** User key (request) first, then server pool — used for this call only. */
export function keysForRequest(userKey, env = process.env) {
  const out = [];
  const u = String(userKey || "").trim();
  if (u) out.push(u);
  for (const k of collectServerKeys(env)) {
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

export function shouldTryNextKey(status, data) {
  if (status === 429 || status === 401 || status === 403) return true;
  const msg = String(
    data?.error?.message ||
      data?.error?.status ||
      (typeof data?.error === "string" ? data.error : "") ||
      ""
  );
  return /quota|rate.?limit|RESOURCE_EXHAUSTED|API[_ ]?key|invalid.?key|permission/i.test(
    msg
  );
}

function bearerFromReq(req) {
  const h = String(req.headers?.authorization || "");
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : "";
}

async function callGemini(key, body) {
  const upstream = await fetch(`${GEMINI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  return { upstream, data };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const serverKeys = collectServerKeys();

  if (req.method === "GET") {
    res.status(200).json({ hasKey: serverKeys.length > 0 });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  const keys = keysForRequest(bearerFromReq(req));
  if (!keys.length) {
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
    let upstream;
    let data;
    for (let i = 0; i < keys.length; i++) {
      ({ upstream, data } = await callGemini(keys[i], body));

      // Retry without response_format if the model rejects it
      if (
        !upstream.ok &&
        body.response_format &&
        /response_format|json_object|unknown/i.test(data?.error?.message || "")
      ) {
        const { response_format: _, ...rest } = body;
        ({ upstream, data } = await callGemini(keys[i], rest));
      }

      if (upstream.ok) break;
      if (shouldTryNextKey(upstream.status, data) && i < keys.length - 1) {
        continue;
      }
      break;
    }

    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({
      error: { message: e.message || "Upstream Gemini request failed" },
    });
  }
}

// ponytail: assert-based self-check — run: node api/chat.js
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("chat.js")) {
  const env = {
    GEMINI_API_KEY: "a,b",
    GEMINI_API_KEY_2: "c",
    VITE_GEMINI_API_KEY: "a",
  };
  console.assert(
    JSON.stringify(collectServerKeys(env)) === JSON.stringify(["a", "b", "c"]),
    "collectServerKeys"
  );
  console.assert(
    JSON.stringify(keysForRequest("u", env)) ===
      JSON.stringify(["u", "a", "b", "c"]),
    "keysForRequest"
  );
  console.assert(shouldTryNextKey(429, {}), "429 rotates");
  console.assert(!shouldTryNextKey(400, { error: { message: "bad" } }), "400 stays");
  console.log("ok");
}
