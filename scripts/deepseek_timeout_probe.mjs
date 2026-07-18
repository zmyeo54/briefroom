#!/usr/bin/env node
/**
 * Regression loop: DeepSeek Build must not run with thinking enabled.
 *
 * Bug: deepseek-v4-flash defaults thinking=ON. CoT shares max_tokens with
 * the JSON answer → finish=length truncation, and wall time can exceed
 * Vercel's ~60s → the "DeepSeek took too long" flash.
 *
 * Red: bodyForProvider omits thinking.disabled OR live call returns reasoning
 * Green: body has thinking.disabled AND live call finish=stop, no reasoning
 *
 * Run: node scripts/deepseek_timeout_probe.mjs
 * Needs DEEPSEEK_API_KEY in env or .env.local
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bodyForProvider, DEEPSEEK_MODEL } from "../api/chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const VERCEL_LIMIT_MS = 55_000;

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvLocal();

const key = String(process.env.DEEPSEEK_API_KEY || "").trim();
if (!key) {
  console.error("FAIL: no DEEPSEEK_API_KEY");
  process.exit(2);
}

// --- Unit seam: what /api/chat actually sends ---
const shaped = bodyForProvider(
  {
    model: "gemini-3.1-flash-lite",
    max_tokens: 2048,
    messages: [{ role: "user", content: "hi" }],
  },
  "deepseek"
);
if (shaped.model !== DEEPSEEK_MODEL) {
  console.error("RED: bodyForProvider did not set deepseek model");
  process.exit(1);
}
if (shaped.thinking?.type !== "disabled") {
  console.error(
    "RED: bodyForProvider missing thinking.disabled — app path would enable CoT"
  );
  process.exit(1);
}
console.log("ok: bodyForProvider disables thinking");

// --- Live seam: Build-shaped bilingual+mindmap request ---
const SYSTEM = `You are Line Check, a senior interview coach. Produce spoken Q&A.
JSON only: {"jobTitle":"...","company":"...","items":[{"q":"...","a":"...","category":"foundation","map":{"topic":"...","topicZh":"...","branches":[{"label":"...","labelZh":"...","detail":"...","example":"..."}]}}]}
Bilingual: q = English / Chinese. a = full English, blank line, full Chinese.`;

const USER = `LANGUAGE: Bilingual.
LENGTH HARD: every "a" ≤160 words per lang.
RESUME:
Senior software engineer, 6 years. Led Odoo migration for 3 APAC teams (40% faster close). Built React+Vite SPA. Mentored 4 juniors.
JD:
Backend-leaning full-stack at fintech. Own payments APIs, mentor juniors, ship reliably.
QUESTION DIRECTIONS: leadership, delivery, rolefit.
Produce exactly 6 items: 3 foundation + 3 extras covering directions.`;

const body = bodyForProvider(
  {
    temperature: 0.6,
    max_tokens: 3232,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: USER },
    ],
  },
  "deepseek"
);

const t0 = Date.now();
const res = await fetch("https://api.deepseek.com/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  },
  body: JSON.stringify(body),
});
const data = await res.json().catch(() => ({}));
const ms = Date.now() - t0;
const msg = data?.choices?.[0]?.message || {};
const reasoningLen = String(msg.reasoning_content || "").length;
const finish = data?.choices?.[0]?.finish_reason || null;

console.log(
  JSON.stringify(
    {
      ok: res.ok,
      status: res.status,
      ms,
      overVercelLimit: ms >= VERCEL_LIMIT_MS,
      reasoningLen,
      contentLen: String(msg.content || "").length,
      finish,
      usage: data?.usage || null,
      err: data?.error?.message || null,
    },
    null,
    2
  )
);

if (!res.ok) {
  console.error(`RED: live call HTTP ${res.status}`);
  process.exit(1);
}
if (reasoningLen > 0) {
  console.error(
    `RED: reasoning_content present (${reasoningLen}) — thinking still on`
  );
  process.exit(1);
}
if (finish === "length") {
  console.error(
    "RED: finish=length — answer truncated (thinking used to eat max_tokens)"
  );
  process.exit(1);
}
if (ms >= VERCEL_LIMIT_MS) {
  console.error(`RED: ${ms}ms >= ${VERCEL_LIMIT_MS}ms (would 504 on Vercel)`);
  process.exit(1);
}

console.log("GREEN: DeepSeek Build path safe for Vercel");
process.exit(0);
