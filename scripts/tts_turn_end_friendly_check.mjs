#!/usr/bin/env node
/**
 * Regression: Edge "no turn.end" must never surface raw to the UI, and Mix
 * segment fetches must stay concurrency-capped (was unbounded Promise.all).
 *
 * Usage: node scripts/tts_turn_end_friendly_check.mjs
 * Exit 1 = RED
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW =
  "Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const { friendlyTtsError, synthesizeQaAudio } = await import(
  pathToFileURL(resolve(ROOT, "src/lib/tts.js")).href
);

const mapped = friendlyTtsError(RAW, 500);
assert(!mapped.includes("turn.end"), `still raw: ${mapped}`);
assert(!mapped.includes("truncated"), `still raw: ${mapped}`);
assert(/play again|try again|hiccup/i.test(mapped), `unhelpful: ${mapped}`);
console.log("ok friendlyTtsError maps turn.end drop");

let inFlight = 0;
let peak = 0;
const orig = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  const isTts =
    (u.startsWith("/api/tts") || u.includes("/api/tts")) &&
    !u.includes("health");
  if (isTts) {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 30));
    inFlight -= 1;
    return new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x00]), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    });
  }
  return orig(url, init);
};

try {
  await synthesizeQaAudio(
    "Why us? / 为什么是我们？",
    "Ownership across markets.\n\n我负责跨区域交付。",
    {
      lang: "both",
      voiceQ: "en-aria-news",
      voiceA: "en-guy-news",
      preface: "Question 1. / 第1题。",
      rate: 1,
    }
  );
  // Mix preface+Q+A × en/zh → several parts; must not open them all at once.
  assert(peak <= 2, `segment peak ${peak} > PART_CONCURRENCY 2`);
  console.log(`ok Mix segment concurrency peak=${peak}`);
} finally {
  globalThis.fetch = orig;
}

console.log("\nALL GOOD\n");
