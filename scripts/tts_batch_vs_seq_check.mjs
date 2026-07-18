#!/usr/bin/env node
/**
 * Perf feedback loop for Mix TTS slowness.
 *
 * Symptom: batch /api/tts(parts) much slower than synthesizing the same
 * parts as separate POSTs (SSML-retry tax / wasted Edge turns).
 *
 * Usage:
 *   TTS_BASE=https://linecheck-ai.vercel.app node scripts/tts_batch_vs_seq_check.mjs
 *   # or local: TTS_BASE=http://127.0.0.1:8787
 *
 * RED when batch wall-clock > seq * 1.35 (and > seq + 2s).
 */
const BASE = (process.env.TTS_BASE || "https://linecheck-ai.vercel.app").replace(
  /\/$/,
  ""
);

const PARTS = [
  { text: "Question one.", voice: "en-aria-news" },
  { text: "第一题。", voice: "zh-xiaoxiao-news" },
  { text: "Tell me about yourself.", voice: "en-aria-news" },
  { text: "请介绍一下你自己。", voice: "zh-xiaoxiao-news" },
  {
    text: "I am a software engineer with eight years of experience.",
    voice: "en-guy-news",
  },
  { text: "我是一名有八年经验的软件工程师。", voice: "zh-yunyang-news" },
];

async function post(body) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return { ok: res.ok, status: res.status, ms: Date.now() - t0, bytes: buf.length };
}

const seqMs = [];
let seqBytes = 0;
const tSeq0 = Date.now();
for (const p of PARTS) {
  const r = await post({ text: p.text, voice: p.voice, rate: 1 });
  if (!r.ok) {
    console.error("RED: sequential part failed", r.status);
    process.exit(1);
  }
  seqMs.push(r.ms);
  seqBytes += r.bytes;
}
const seqTotal = Date.now() - tSeq0;

const batch = await post({ rate: 1, parts: PARTS });
if (!batch.ok) {
  console.error("RED: batch failed", batch.status);
  process.exit(1);
}

const ratio = batch.ms / seqTotal;
const waste = batch.ms - seqTotal;
console.log(
  JSON.stringify(
    {
      base: BASE,
      seqTotalMs: seqTotal,
      seqPartsMs: seqMs,
      seqBytes,
      batchMs: batch.ms,
      batchBytes: batch.bytes,
      ratio: Number(ratio.toFixed(2)),
      wasteMs: waste,
    },
    null,
    2
  )
);

// Same audio payload expected (MPEG concat ≈ sum of parts).
if (Math.abs(batch.bytes - seqBytes) > 2048) {
  console.error("RED: batch/seq byte mismatch — not comparing same work");
  process.exit(1);
}

// Batch should not be much worse than doing the parts yourself.
if (batch.ms > seqTotal * 1.35 && waste > 2000) {
  console.error(
    `RED: batch slower than sequential (batch=${batch.ms}ms seq=${seqTotal}ms waste=${waste}ms) — SSML retry tax or serial thrash`
  );
  process.exit(1);
}

console.log(
  `GREEN: batch ok ratio=${ratio.toFixed(2)} wasteMs=${waste} (batch=${batch.ms} seq=${seqTotal})`
);
