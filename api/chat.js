import { cors } from "./_ttsShared.js";

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: "1mb" } },
};

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/openai";
const DEEPSEEK_BASE = "https://api.deepseek.com";
/** Oracle Always Free Antigravity proxy (OpenAI-compatible /v1). */
export const ANTIGRAVITY_DEFAULT_BASE = "http://138.2.161.62:8045";
export const ANTIGRAVITY_MODEL = "gemini-3.1-flash-lite";
export const DEEPSEEK_MODEL = "deepseek-v4-flash";
export const AI_REGION_HEADER = "x-linecheck-ai-region";
export const AI_PROVIDER_HEADER = "x-linecheck-ai-provider";
export const AI_ENABLED_HEADER = "x-linecheck-ai-enabled";
const KNOWN_PROVIDERS = new Set(["gemini", "antigravity", "deepseek"]);
/** Default try order when keys exist: Antigravity → Gemini → DeepSeek. */
export const PROVIDER_ORDER = ["antigravity", "gemini", "deepseek"];
export const DEFAULT_AI_PROVIDER = "antigravity";
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
  if (KNOWN_PROVIDERS.has(raw)) return raw;
  // Legacy region header — both regions now default to Antigravity.
  const region = parseAiRegion(req);
  if (region) return DEFAULT_AI_PROVIDER;
  return "";
}

/** Comma-separated enabled providers from client. null = all allowed. */
export function parseEnabledProviders(req) {
  const raw = String(req.headers?.[AI_ENABLED_HEADER] || "").trim();
  if (!raw) return null;
  const set = new Set();
  for (const part of raw.split(/[\s,]+/)) {
    const p = part.trim().toLowerCase();
    if (KNOWN_PROVIDERS.has(p)) set.add(p);
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

export function collectAntigravityKeys(env = process.env) {
  const k = String(env.ANTIGRAVITY_API_KEY || "").trim();
  if (k) return [k];
  const cline = String(env.ANTIGRAVITY_CLINE_API_KEY || "").trim();
  return cline ? [cline] : [];
}

/** OpenAI-compatible base; accepts host with or without /v1. */
export function resolveAntigravityBase(env = process.env) {
  let base = String(
    env.ANTIGRAVITY_API_BASE || ANTIGRAVITY_DEFAULT_BASE
  )
    .trim()
    .replace(/\/$/, "");
  if (!base) base = ANTIGRAVITY_DEFAULT_BASE;
  if (!/\/v1$/i.test(base)) base = `${base}/v1`;
  return base;
}

export function antigravityModel(env = process.env) {
  return (
    String(env.ANTIGRAVITY_MODEL || "").trim() || ANTIGRAVITY_MODEL
  );
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

/** DeepSeek + Antigravity proxy keys are both sk-…; Gemini paste is not. */
export function keyLooksLikeDeepSeek(key) {
  return /^sk-/i.test(String(key || "").trim());
}

export function keysForProvider(provider, userKey, env = process.env) {
  const out = [];
  const u = String(userKey || "").trim();
  if (u) {
    const sk = keyLooksLikeDeepSeek(u);
    // sk- paste → DeepSeek or Antigravity; other paste → Gemini only.
    if (provider === "deepseek" || provider === "antigravity") {
      if (sk) out.push(u);
    } else if (!sk) {
      out.push(u);
    }
  }
  const pool =
    provider === "deepseek"
      ? collectDeepSeekKeys(env)
      : provider === "antigravity"
        ? collectAntigravityKeys(env)
        : collectServerKeys(env);
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
  for (const alt of PROVIDER_ORDER) {
    if (alt === provider) continue;
    const hasAlt =
      alt === "deepseek"
        ? collectDeepSeekKeys(env).length > 0
        : alt === "antigravity"
          ? collectAntigravityKeys(env).length > 0
          : collectServerKeys(env).length > 0;
    if (hasAlt) return alt;
  }
  return null;
}

/**
 * Preference order for this request.
 * Client sends preferred provider + which are enabled; missing keys are skipped.
 * Rest follow PROVIDER_ORDER (Antigravity → Gemini → DeepSeek).
 */
export function providersToTry(req, env = process.env) {
  const enabled = parseEnabledProviders(req);
  const bearer = bearerFromReq(req);
  const userKey = Boolean(bearer);
  const skBearer = keyLooksLikeDeepSeek(bearer);
  const has = {
    gemini: collectServerKeys(env).length > 0 || userKey,
    deepseek: collectDeepSeekKeys(env).length > 0 || skBearer,
    antigravity: collectAntigravityKeys(env).length > 0 || skBearer,
  };

  const allow = (p) => {
    if (enabled && !enabled.has(p)) return false;
    return Boolean(has[p]);
  };

  let preferred = parseAiProvider(req) || DEFAULT_AI_PROVIDER;

  const order = [];
  if (allow(preferred)) order.push(preferred);
  for (const p of PROVIDER_ORDER) {
    if (p !== preferred && allow(p)) order.push(p);
  }
  return order;
}

export function bodyForProvider(body, provider, env = process.env) {
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
  if (provider === "antigravity") {
    return {
      ...body,
      model: antigravityModel(env),
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

async function callProvider(provider, key, body, signal, env = process.env) {
  const base =
    provider === "deepseek"
      ? DEEPSEEK_BASE
      : provider === "antigravity"
        ? resolveAntigravityBase(env)
        : GEMINI_BASE;
  const payload = bodyForProvider(body, provider, env);
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
  const antigravityKeys = collectAntigravityKeys();
  const hasKey =
    geminiKeys.length > 0 ||
    deepseekKeys.length > 0 ||
    antigravityKeys.length > 0;

  if (req.method === "GET") {
    const country = String(
      req.headers?.["x-vercel-ip-country"] || ""
    ).toUpperCase();
    res.status(200).json({
      hasKey,
      hasGemini: geminiKeys.length > 0,
      hasDeepseek: deepseekKeys.length > 0,
      hasAntigravity: antigravityKeys.length > 0,
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
          "No API key on the server. Set GEMINI_API_KEY, DEEPSEEK_API_KEY, and/or ANTIGRAVITY_API_KEY in Vercel env, or paste a key in Settings.",
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
    ANTIGRAVITY_API_KEY: "ag",
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
      "antigravity",
    "CN geo → antigravity"
  );
  console.assert(
    pickProvider(
      { headers: { [AI_REGION_HEADER]: "global", "x-vercel-ip-country": "US" } },
      env
    ) === "antigravity",
    "global region → antigravity"
  );
  console.assert(
    pickProvider({ headers: { [AI_PROVIDER_HEADER]: "deepseek" } }, env) ===
      "deepseek",
    "explicit deepseek"
  );
  console.assert(
    pickProvider({ headers: { [AI_PROVIDER_HEADER]: "antigravity" } }, env) ===
      "antigravity",
    "explicit antigravity"
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
    ) === JSON.stringify(["gemini", "antigravity", "deepseek"]),
    "prefer gemini then AG then deepseek"
  );
  console.assert(
    JSON.stringify(
      providersToTry(
        { headers: { [AI_PROVIDER_HEADER]: "antigravity" } },
        env
      )
    ) === JSON.stringify(["antigravity", "gemini", "deepseek"]),
    "default order AG → gemini → deepseek"
  );
  console.assert(
    otherProvider("deepseek", env) === "antigravity",
    "deepseek alt → antigravity"
  );
  console.assert(shouldTryOtherProvider(404, { error: { message: "not found" } }), "404 falls back");
  console.assert(!shouldTryOtherProvider(400, {}), "400 stays");
  console.assert(
    bodyForProvider({ model: "gemini-3.1-flash-lite", messages: [] }, "deepseek")
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
    bodyForProvider({ model: "x", messages: [] }, "antigravity", env).model ===
      ANTIGRAVITY_MODEL,
    "antigravity model swap"
  );
  console.assert(
    resolveAntigravityBase({}).endsWith("/v1"),
    "antigravity base has /v1"
  );
  console.assert(
    resolveAntigravityBase({ ANTIGRAVITY_API_BASE: "http://x:8045/v1" }) ===
      "http://x:8045/v1",
    "antigravity base no double /v1"
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
  console.assert(
    JSON.stringify(keysForProvider("antigravity", "sk-paste", env)) ===
      JSON.stringify(["sk-paste", "ag"]),
    "antigravity accepts sk- paste"
  );
  console.assert(
    JSON.stringify(keysForProvider("antigravity", "AIza-gemini", env)) ===
      JSON.stringify(["ag"]),
    "antigravity skips gemini paste"
  );
  console.assert(isAbortError({ name: "TimeoutError" }), "timeout is abort");
  console.assert(
    timeoutResponse("deepseek").upstream.status === 504,
    "timeout → 504"
  );
  console.log("ok");
}
