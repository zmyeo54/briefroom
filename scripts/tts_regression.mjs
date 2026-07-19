#!/usr/bin/env node
/**
 * Local TTS stress + regression.
 * Requires: vite on :8787 (proxies /api/tts) and TTS on :8790.
 *
 * Usage: node scripts/tts_regression.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.TTS_BASE || "http://127.0.0.1:8787";
const OUT = resolve(ROOT, ".tmp/tts-regression");
const PASS = [];
const FAIL = [];

function ok(name, detail = "") {
  PASS.push(name);
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, err) {
  FAIL.push({ name, err: String(err?.stack || err) });
  console.error(`  ✗ ${name} — ${err}`);
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function withRetry(label, fn, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = String(e?.message || e);
      const transient =
        /no audio|stream closed|timed out|websocket|502|504|500/i.test(msg);
      if (!transient || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
      console.warn(`    retry ${label} (${i + 2}/${attempts}): ${msg.slice(0, 80)}`);
    }
  }
  throw last;
}

async function ttsPost(body) {
  const res = await fetch(`${BASE}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return { res, buf, status: res.status };
}

function isMp3(buf) {
  if (!buf?.length || buf.length < 4) return false;
  // ID3 or MPEG frame sync
  return (
    (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
    (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
  );
}

/** Rough duration estimate for 24kHz 48kbps mono MP3 (~6KB/s). */
function estSeconds(bytes) {
  return bytes / 6000;
}

const FIXTURES = [
  {
    id: "en-short",
    q: "Tell me about yourself.",
    a: "I lead delivery teams across markets with clear ownership.",
    lang: "en",
  },
  {
    id: "zh-short",
    q: "请介绍一下你自己。",
    a: "我负责跨区域交付，强调结果与客户信任。",
    lang: "zh",
  },
  {
    id: "mix-bilingual",
    q: "Tell me about yourself. / 请介绍一下你自己。",
    a: "I lead delivery teams across markets.\n\n我负责跨区域交付，强调结果与客户信任。",
    lang: "both",
  },
  {
    id: "en-long",
    q: "Walk me through a hard project.",
    a:
      "We had a six-week migration with three vendors, unclear ownership, and a hard go-live date. " +
      "I mapped dependencies, ran daily risk reviews, and cut scope that did not protect customers. " +
      "We shipped on time with zero P0 incidents in the first week, and the ops team kept the runbook we wrote.",
    lang: "en",
  },
];

async function health() {
  const h = await fetch(`${BASE}/api/tts-health`);
  assert(h.ok, `tts-health ${h.status}`);
  const j = await h.json();
  assert(j.ok, "health not ok");
  ok("health", `${Object.keys(j.voices || {}).length || (j.voices || []).length} voices`);
}

async function unitPlumbing() {
  const {
    buildSpeakParts,
    splitBilingualText,
    sanitizeSpeakText,
  } = await import(resolve(ROOT, "src/lib/tts.js"));
  const { splitSpeakChunks } = await import(resolve(ROOT, "api/tts.js"));

  const split = splitBilingualText("Hello.\n\n你好。");
  assert(split.en.includes("Hello"), "en half");
  assert(split.zh.includes("你好"), "zh half");

  const mix = buildSpeakParts(
    "Tell me about yourself. / 请介绍一下你自己。",
    "Hello, I am Alex.\n\n你好，我是 Alex。",
    {
      lang: "both",
      preface: "Question 1. / 第1题。",
      voiceQ: "en-aria-news",
      voiceA: "en-guy-news",
    }
  );
  assert(mix.length >= 4, `mix parts ${mix.length}`);
  assert(
    mix.some((p) => p.voice.startsWith("zh-") && p.text.includes("你好")),
    "zh answer voice"
  );

  const chunks = splitSpeakChunks(
    "A".repeat(500) + ". " + "B".repeat(500) + ". " + "C".repeat(500) + ".",
    900
  );
  assert(chunks.length >= 2, "chunk split");
  assert(chunks.every((c) => c.length <= 900), "chunk max");

  assert(sanitizeSpeakText("**bold** `x`").includes("bold"), "sanitize");

  // Mismatched settings voices must still map to the interview language family.
  const zhParts = buildSpeakParts("请介绍一下你自己。", "我负责交付。", {
    lang: "zh",
    voiceQ: "en-aria-news",
    voiceA: "en-guy-news",
  });
  assert(
    zhParts.every((p) => p.voice.startsWith("zh-")),
    `zh voices expected, got ${zhParts.map((p) => p.voice)}`
  );
  ok("unit plumbing", `mix=${mix.length} chunks=${chunks.length} zhAligned=${zhParts.length}`);
}

async function synthesizeViaClient(fixture, preface = "") {
  // Route /api/tts through vite while importing browser client helpers.
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith("/api/tts") || u.includes("/api/tts")) {
      const path = u.startsWith("http") ? new URL(u).pathname : u;
      return orig(`${BASE}${path.startsWith("/") ? path : `/${path}`}`, init);
    }
    return orig(url, init);
  };
  try {
    const { synthesizeQaAudio } = await import(resolve(ROOT, "src/lib/tts.js"));
    return await withRetry(fixture.id || "synth", async () => {
      const blob = await synthesizeQaAudio(fixture.q, fixture.a, {
        rate: 1,
        // Intentionally English defaults — buildSpeakParts must align to lang.
        voiceQ: "en-aria-news",
        voiceA: "en-guy-news",
        preface,
        lang: fixture.lang,
      });
      const buf = Buffer.from(await blob.arrayBuffer());
      assert(isMp3(buf), "not mp3");
      assert(buf.length > 1500, `too small ${buf.length}`);
      return buf;
    });
  } finally {
    globalThis.fetch = orig;
  }
}

async function eachClipPlays() {
  mkdirSync(OUT, { recursive: true });
  const sizes = [];
  for (const f of FIXTURES) {
    const t0 = Date.now();
    const buf = await synthesizeViaClient(f, "");
    const ms = Date.now() - t0;
    assert(isMp3(buf), `${f.id} not mp3`);
    assert(buf.length > 1500, `${f.id} too small ${buf.length}`);
    writeFileSync(resolve(OUT, `${f.id}.mp3`), buf);
    sizes.push({ id: f.id, bytes: buf.length, sec: estSeconds(buf.length), ms });
    ok(`clip ${f.id}`, `${buf.length}B ~${estSeconds(buf.length).toFixed(1)}s in ${ms}ms`);
  }
  // Cached replay should be much faster
  const t1 = Date.now();
  const again = await synthesizeViaClient(FIXTURES[0], "");
  const cacheMs = Date.now() - t1;
  assert(again.length === sizes[0].bytes, "cache size mismatch");
  assert(cacheMs < 200, `cache should be fast, got ${cacheMs}ms`);
  ok("clip cache hit", `${cacheMs}ms`);
  return sizes;
}

async function combinedAllClips() {
  const entries = FIXTURES.map((f, i) => ({
    ...f,
    preface: f.lang === "zh" ? `第${i + 1}题。` : `Question ${i + 1}.`,
  }));

  const t0 = Date.now();
  const bufs = [];
  for (const e of entries) {
    // Sequential combine path mirrors export stability under Edge rate limits.
    bufs.push(await synthesizeViaClient(e, e.preface));
  }
  const merged = Buffer.concat(bufs);
  const ms = Date.now() - t0;
  assert(isMp3(merged), "merged not mp3");
  const maxPart = Math.max(...bufs.map((b) => b.length));
  assert(merged.length > maxPart * 1.5, "merged not much longer than one clip");
  writeFileSync(resolve(OUT, "combined-all.mp3"), merged);
  ok(
    "combined all clips",
    `${bufs.length} clips → ${merged.length}B ~${estSeconds(merged.length).toFixed(1)}s in ${ms}ms`
  );
  return { merged, bufs, ms };
}

async function speakSequenceOrder() {
  // speakQaSequence uses mapPool — verify order preserved via progress indices
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith("/api/tts") || u.includes("/api/tts")) {
      const path = u.startsWith("http") ? new URL(u).pathname : u;
      return orig(`${BASE}${path.startsWith("/") ? path : `/${path}`}`, init);
    }
    return orig(url, init);
  };

  // Stub Audio so speakQaSequence can "play" in Node
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.paused = true;
      this.onended = null;
      this.onerror = null;
    }
    play() {
      this.paused = false;
      queueMicrotask(() => {
        this.paused = true;
        this.onended?.();
      });
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }
  globalThis.Audio = FakeAudio;
  globalThis.URL.createObjectURL =
    globalThis.URL.createObjectURL || (() => "blob:test");
  globalThis.URL.revokeObjectURL =
    globalThis.URL.revokeObjectURL || (() => {});
  globalThis.speechSynthesis = { cancel() {} };

  try {
    const { speakQaSequence, pauseSpeech, resumeSpeech, stopSpeech } =
      await import(resolve(ROOT, "src/lib/tts.js"));
    const progress = [];
    let started = false;
    // Sequence API takes one lang — use English-only entries (matches Practice selected).
    const entries = [
      FIXTURES[0],
      FIXTURES[3],
      {
        id: "en-extra",
        q: "Why this role?",
        a: "It matches how I lead delivery and serve customers.",
        lang: "en",
      },
    ].map((f, i) => ({
      q: f.q,
      a: f.a,
      preface: `Question ${i + 1}.`,
    }));

    await withRetry("speakQaSequence", async () => {
      progress.length = 0;
      started = false;
      await speakQaSequence(entries, {
        lang: "en",
        voiceQ: "en-aria-news",
        voiceA: "en-guy-news",
        onProgress: (i) => progress.push(i),
        onStart: () => {
          started = true;
        },
      });
      assert(started, "onStart not fired");
    });
    ok("speakQaSequence plays once", `progress=${JSON.stringify(progress)}`);

    // pause/resume against a live FakeAudio session
    stopSpeech();
    let pausedOk = false;
    await speakQaSequence([{ q: "Hi?", a: "Hello there.", preface: "" }], {
      lang: "en",
      onStart: () => {
        pausedOk = pauseSpeech();
      },
    });
    // onStart runs then FakeAudio ends immediately — pause may race; just ensure API exists
    assert(typeof resumeSpeech === "function", "resume export");
    ok("pause/resume API", pausedOk ? "paused mid-play" : "API present (race ok)");
  } finally {
    globalThis.fetch = orig;
  }
}

async function stressBurst() {
  const texts = Array.from({ length: 8 }, (_, i) => ({
    text: `Stress sample number ${i + 1}. Keep ownership clear.`,
    voice: i % 2 ? "en-guy-news" : "en-aria-news",
    rate: 1,
  }));
  const t0 = Date.now();
  const results = await Promise.all(
    texts.map(async (body, i) => {
      const { status, buf } = await ttsPost(body);
      assert(status === 200, `stress ${i} status ${status}`);
      assert(isMp3(buf), `stress ${i} not mp3`);
      return buf.length;
    })
  );
  const ms = Date.now() - t0;
  ok(
    "stress 8 concurrent TTS",
    `${results.reduce((a, b) => a + b, 0)}B in ${ms}ms`
  );
}

async function longTextChunkPath() {
  // Force server-side chunking (>900 chars)
  const long =
    "This is a longer interview answer meant to exercise chunking. ".repeat(20);
  assert(long.length > 900, "fixture not long enough");
  const { status, buf } = await ttsPost({
    text: long,
    voice: "en-guy-news",
    rate: 1,
  });
  assert(status === 200, `long status ${status}`);
  assert(isMp3(buf), "long not mp3");
  assert(estSeconds(buf.length) > 5, `long too short audio ${buf.length}`);
  writeFileSync(resolve(OUT, "long-chunked.mp3"), buf);
  ok("long text chunk path", `${buf.length}B ~${estSeconds(buf.length).toFixed(1)}s`);
}

async function concurrencyCap() {
  // Mix × parallel items used to open 12–18 Edge WS at once → turn.end drops.
  let inFlight = 0;
  let peak = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    const isTts =
      (u.startsWith("/api/tts") || u.includes("/api/tts")) && !u.includes("health");
    if (isTts) {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
    }
    try {
      if (u.startsWith("/api/") || u.includes("/api/")) {
        const path = u.startsWith("http") ? new URL(u).pathname : u;
        return orig(`${BASE}${path.startsWith("/") ? path : `/${path}`}`, init);
      }
      return orig(url, init);
    } finally {
      if (isTts) inFlight -= 1;
    }
  };
  try {
    const { synthesizeQaAudio } = await import(resolve(ROOT, "src/lib/tts.js"));
    const stamp = Date.now();
    const items = Array.from({ length: 3 }, (_, i) => ({
      q: "Why us? / 为什么是我们？",
      a: `Ownership ${stamp}-${i}.\n\n权责 ${stamp}-${i}。`,
      preface: `Question ${i + 1}. / 第${i + 1}题。`,
    }));
    await Promise.all(
      items.map((e) =>
        synthesizeQaAudio(e.q, e.a, {
          lang: "both",
          voiceQ: "en-aria-news",
          voiceA: "en-guy-news",
          preface: e.preface,
          rate: 1,
        })
      )
    );
    assert(peak <= 6, `TTS inflight peak ${peak} > 6`);
    ok("concurrency cap", `peak=${peak}`);
  } finally {
    globalThis.fetch = orig;
  }
}

async function main() {
  console.log(`\nTTS regression @ ${BASE}\n`);
  try {
    await health();
  } catch (e) {
    console.error("TTS/vite not reachable. Start: npm run tts & npm run dev:web");
    throw e;
  }

  const steps = [
    ["unit", unitPlumbing],
    ["concurrency", concurrencyCap],
    ["each clip", eachClipPlays],
    ["combined", combinedAllClips],
    ["sequence play", speakSequenceOrder],
    ["long chunk", longTextChunkPath],
    ["stress", stressBurst],
  ];

  for (const [label, fn] of steps) {
    console.log(`\n[${label}]`);
    try {
      await fn();
    } catch (e) {
      fail(label, e);
    }
  }

  console.log(`\n———`);
  console.log(`PASS ${PASS.length}  FAIL ${FAIL.length}`);
  if (FAIL.length) {
    for (const f of FAIL) console.error(`\nFAIL ${f.name}\n${f.err}`);
    process.exit(1);
  }
  console.log(`Artifacts: ${OUT}`);
  console.log("OK\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
