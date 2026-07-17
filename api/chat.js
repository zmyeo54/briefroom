import { cors } from "./_ttsShared.js";

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: "1mb" } },
};

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/openai";
const DEEPSEEK_BASE = "https://api.deepseek.com";
export const DEEPSEEK_MODEL = "deepseek-v4-flash";
export const AI_REGION_HEADER = "x-linecheck-ai-region";
export const AI_PROVIDER_HEADER = "x-linecheck-ai-provider";
export const AI_ENABLED_HEADER = "x-linecheck-ai-enabled";
/** Soft ceiling under Vercel maxDuration:60 — return JSON 504 instead of HTML kill. */
export const HANDLER_BUDGET_MS = 55_000;
/** Per upstream call; leaves room to return cleanly (or try a fast failover). */
export const UPSTREAM_CALL_MS = 50_000;
/** Min remaining budget before attempting the other provider after a timeout. */
export const FAILOVER_MIN_MS = 20_000;
/** DeepSeek output cap (API max for chat-family; V4 allows more but 8k keeps Builds inside Vercel time). */
export const DEEPSEEK_MAX_TOKENS = 8192;

/** User setting: global → Gemini, greater-china → DeepSeek. */
export function parseAiRegion(req) {
  const raw = String(req.headers?.[AI_REGION_HEADER] || "").toLowerCase();
  if (
    raw === "greater-china" ||
    raw === "greaterchina" ||
    raw === "china" ||
    raw === "cn" ||
    raw === "hk"
  ) {
    return "greater-china";
  }
  if (raw === "global") return "global";
  return "";
}

/** Explicit provider header, else derive from legacy region header. */
export function parseAiProvider(req) {
  const raw = String(req.headers?.[AI_PROVIDER_HEADER] || "").toLowerCase();
  if (raw === "deepseek" || raw === "gemini") return raw;
  const region = parseAiRegion(req);
  if (region === "greater-china") return "deepseek";
  if (region === "global") return "gemini";
  return "";
}

/** Comma-separated enabled providers from client. null = both allowed. */
export function parseEnabledProviders(req) {
  const raw = String(req.headers?.[AI_ENABLED_HEADER] || "").trim();
  if (!raw) return null;
  const set = new Set();
  for (const part of raw.split(/[\s,]+/)) {
    const p = part.trim().toLowerCase();
    if (p === "gemini" || p === "deepseek") set.add(p);
  }
  return set.size ? set : null;
}

function isGreaterChinaCountry(country) {
  const c = String(country || "").toUpperCase();
  return c === "CN" || c === "HK";
}

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

export function collectDeepSeekKeys(env = process.env) {
  const k = String(env.DEEPSEEK_API_KEY || "").trim();
  return k ? [k] : [];
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

/** DeepSeek keys are sk-…; Settings still labels the paste field as Gemini. */
export function keyLooksLikeDeepSeek(key) {
  return /^sk-/i.test(String(key || "").trim());
}

export function keysForProvider(provider, userKey, env = process.env) {
  const out = [];
  const u = String(userKey || "").trim();
  // Skip mismatched paste-key (Gemini key → DeepSeek = fast 401 noise).
  if (u) {
    const ds = keyLooksLikeDeepSeek(u);
    if (provider === "deepseek" ? ds : !ds) out.push(u);
  }
  const pool =
    provider === "deepseek" ? collectDeepSeekKeys(env) : collectServerKeys(env);
  for (const k of pool) {
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

/** Prefer client choice; fall back to geo; respect on/off + key presence. */
export function pickProvider(req, env = process.env) {
  const order = providersToTry(req, env);
  return order[0] || null;
}

export function otherProvider(provider, env = process.env) {
  const alt = provider === "deepseek" ? "gemini" : "deepseek";
  const hasAlt =
    alt === "deepseek"
      ? collectDeepSeekKeys(env).length > 0
      : collectServerKeys(env).length > 0;
  return hasAlt ? alt : null;
}

/**
 * Preference order for this request.
 * Client sends preferred provider + which are enabled; missing keys are skipped.
 */
export function providersToTry(req, env = process.env) {
  const enabled = parseEnabledProviders(req);
  const userKey = Boolean(bearerFromReq(req));
  // Bearer may be either provider's key — allow both routes when present.
  const hasDeepseek = collectDeepSeekKeys(env).length > 0 || userKey;
  const hasGemini = collectServerKeys(env).length > 0 || userKey;

  const allow = (p) => {
    if (enabled && !enabled.has(p)) return false;
    return p === "deepseek" ? hasDeepseek : hasGemini;
  };

  let preferred = parseAiProvider(req);
  if (!preferred) {
    const country = req.headers?.["x-vercel-ip-country"];
    preferred = isGreaterChinaCountry(country) ? "deepseek" : "gemini";
  }

  const order = [];
  if (allow(preferred)) order.push(preferred);
  const alt = preferred === "deepseek" ? "gemini" : "deepseek";
  if (allow(alt)) order.push(alt);
  return order;
}

export function bodyForProvider(body, provider) {
  if (provider === "deepseek") {
    // V4 defaults thinking=enabled; CoT eats max_tokens + wall clock →
    // truncated JSON (finish=length) and Vercel ~60s 504s on Build.
    const rawMax = Number(body?.max_tokens);
    const max_tokens = Math.min(
      Number.isFinite(rawMax) && rawMax > 0 ? rawMax : DEEPSEEK_MAX_TOKENS,
      DEEPSEEK_MAX_TOKENS
    );
    return {
      ...body,
      model: DEEPSEEK_MODEL,
      thinking: { type: "disabled" },
      max_tokens,
    };
  }
  return body;
}

export function isAbortError(err) {
  const name = String(err?.name || "");
  return name === "AbortError" || name === "TimeoutError";
}

export function timeoutResponse(provider) {
  return {
    upstream: { ok: false, status: 504 },
    data: {
      error: {
        message: `${provider} timed out`,
        code: "upstream_timeout",
        provider,
      },
    },
  };
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

export function shouldTryOtherProvider(status, data) {
  // Same client body would fail on the other provider too.
  if (status === 400) return false;
  if (status === 402 || status === 429) return true;
  if (status === 401 || status === 403 || status === 404) return true;
  if (status >= 500) return true;
  const msg = String(
    data?.error?.message ||
      data?.error?.status ||
      (typeof data?.error === "string" ? data.error : "") ||
      ""
  );
  return /quota|rate.?limit|not found|not available|no longer available|invalid.?key|RESOURCE_EXHAUSTED|timeout|timed out|ECONNREFUSED|fetch failed/i.test(
    msg
  );
}

function bearerFromReq(req) {
  const h = String(req.headers?.authorization || "");
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : "";
}

async function callChat(baseUrl, key, body, signal) {
  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  const data = await upstream.json().catch(() => ({}));
  return { upstream, data };
}

async function callProvider(provider, key, body, signal) {
  const base = provider === "deepseek" ? DEEPSEEK_BASE : GEMINI_BASE;
  const payload = bodyForProvider(body, provider);
  let { upstream, data } = await callChat(base, key, payload, signal);

  if (
    !upstream.ok &&
    body.response_format &&
    /response_format|json_object|unknown/i.test(data?.error?.message || "")
  ) {
    const { response_format: _, ...rest } = payload;
    ({ upstream, data } = await callChat(base, key, rest, signal));
  }

  return { upstream, data };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const geminiKeys = collectServerKeys();
  const deepseekKeys = collectDeepSeekKeys();
  const hasKey = geminiKeys.length > 0 || deepseekKeys.length > 0;

  if (req.method === "GET") {
    const country = String(
      req.headers?.["x-vercel-ip-country"] || ""
    ).toUpperCase();
    res.status(200).json({
      hasKey,
      hasGemini: geminiKeys.length > 0,
      hasDeepseek: deepseekKeys.length > 0,
      country: country || null,
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  const userKey = bearerFromReq(req);
  const order = providersToTry(req);
  if (!order.length) {
    res.status(503).json({
      error: {
        message:
          "No API key on the server. Set GEMINI_API_KEY and/or DEEPSEEK_API_KEY in Vercel env, or paste a key in Settings.",
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
    const deadline = Date.now() + HANDLER_BUDGET_MS;

    for (let p = 0; p < order.length; p++) {
      const provider = order[p];
      const keys = keysForProvider(provider, userKey);
      if (!keys.length) continue;

      let timedOut = false;
      for (let i = 0; i < keys.length; i++) {
        const left = deadline - Date.now();
        if (left < 3_000) {
          ({ upstream, data } = timeoutResponse(provider));
          timedOut = true;
          break;
        }
        const signal = AbortSignal.timeout(Math.min(UPSTREAM_CALL_MS, left));
        try {
          ({ upstream, data } = await callProvider(
            provider,
            keys[i],
            body,
            signal
          ));
        } catch (e) {
          if (!isAbortError(e)) throw e;
          ({ upstream, data } = timeoutResponse(provider));
          timedOut = true;
          break; // same provider will also burn the budget
        }
        if (upstream.ok) break;
        if (shouldTryNextKey(upstream.status, data) && i < keys.length - 1) {
          continue;
        }
        break;
      }

      if (upstream.ok) break;
      const canFailover =
        p < order.length - 1 &&
        (timedOut
          ? deadline - Date.now() >= FAILOVER_MIN_MS
          : shouldTryOtherProvider(upstream.status, data));
      if (canFailover) continue;
      break;
    }

    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({
      error: { message: e.message || "Upstream chat request failed" },
    });
  }
}

// ponytail: assert-based self-check — run: node api/chat.js
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("chat.js")) {
  const env = {
    GEMINI_API_KEY: "a,b",
    GEMINI_API_KEY_2: "c",
    VITE_GEMINI_API_KEY: "a",
    DEEPSEEK_API_KEY: "ds",
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
  console.assert(
    pickProvider({ headers: { "x-vercel-ip-country": "CN" } }, env) ===
      "deepseek",
    "CN geo → deepseek"
  );
  console.assert(
    pickProvider(
      { headers: { [AI_REGION_HEADER]: "global", "x-vercel-ip-country": "US" } },
      env
    ) === "gemini",
    "global → gemini"
  );
  console.assert(
    pickProvider({ headers: { [AI_PROVIDER_HEADER]: "deepseek" } }, env) ===
      "deepseek",
    "explicit deepseek"
  );
  console.assert(
    pickProvider(
      {
        headers: {
          [AI_PROVIDER_HEADER]: "deepseek",
          [AI_ENABLED_HEADER]: "gemini",
        },
      },
      env
    ) === "gemini",
    "preferred off → other enabled"
  );
  console.assert(
    pickProvider(
      {
        headers: {
          [AI_PROVIDER_HEADER]: "gemini",
          [AI_ENABLED_HEADER]: "deepseek",
        },
      },
      env
    ) === "deepseek",
    "gemini off → deepseek"
  );
  console.assert(
    isGreaterChinaCountry("HK") && isGreaterChinaCountry("CN"),
    "greater china countries"
  );
  console.assert(
    JSON.stringify(
      providersToTry(
        { headers: { [AI_PROVIDER_HEADER]: "gemini" } },
        env
      )
    ) === JSON.stringify(["gemini", "deepseek"]),
    "gemini first then deepseek"
  );
  console.assert(
    otherProvider("deepseek", env) === "gemini",
    "deepseek alt → gemini"
  );
  console.assert(shouldTryOtherProvider(404, { error: { message: "not found" } }), "404 falls back");
  console.assert(!shouldTryOtherProvider(400, {}), "400 stays");
  console.assert(
    bodyForProvider({ model: "gemini-2.5-flash-lite", messages: [] }, "deepseek")
      .model === DEEPSEEK_MODEL,
    "deepseek model swap"
  );
  console.assert(
    bodyForProvider({ model: "x", messages: [] }, "deepseek").thinking
      ?.type === "disabled",
    "deepseek disables thinking"
  );
  console.assert(
    bodyForProvider({ model: "x", messages: [] }, "gemini").thinking == null,
    "gemini leaves thinking alone"
  );
  console.assert(
    bodyForProvider({ max_tokens: 8192, messages: [] }, "deepseek")
      .max_tokens === DEEPSEEK_MAX_TOKENS,
    "deepseek caps max_tokens"
  );
  console.assert(
    keyLooksLikeDeepSeek("sk-abc") && !keyLooksLikeDeepSeek("AIza"),
    "key fingerprint"
  );
  console.assert(
    JSON.stringify(keysForProvider("deepseek", "AIza-gemini", env)) ===
      JSON.stringify(["ds"]),
    "skip gemini paste on deepseek"
  );
  console.assert(
    JSON.stringify(keysForProvider("gemini", "sk-deepseek", env)) ===
      JSON.stringify(["a", "b", "c"]),
    "skip deepseek paste on gemini"
  );
  console.assert(isAbortError({ name: "TimeoutError" }), "timeout is abort");
  console.assert(
    timeoutResponse("deepseek").upstream.status === 504,
    "timeout → 504"
  );
  console.log("ok");
}
