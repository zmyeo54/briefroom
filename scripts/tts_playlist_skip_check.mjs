#!/usr/bin/env node
/**
 * First audio should start before the whole playlist finishes.
 * onPrepareProgress must report percent (per clip after batch).
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

class FakeAudioEl {
  constructor() {
    this.src = "";
    this.paused = true;
    this.style = { cssText: "" };
    this.onended = null;
    this.onerror = null;
    this.parentNode = { removeChild() {} };
    this.volume = 1;
  }
  setAttribute() {}
  play() {
    this.paused = false;
    // Hold "playing" briefly so rest can generate mid-play
    setTimeout(() => {
      this.paused = true;
      this.onended?.();
    }, 120);
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

globalThis.document = {
  createElement(tag) {
    if (tag === "audio") return new FakeAudioEl();
    return {
      style: { cssText: "" },
      appendChild() {},
      remove() {},
      click() {},
      setAttribute() {},
    };
  },
  body: { appendChild() {} },
};
globalThis.URL.createObjectURL = () => "blob:test";
globalThis.URL.revokeObjectURL = () => {};
globalThis.speechSynthesis = { cancel() {} };

globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(init.body || "{}");
  const text = Array.isArray(body.parts)
    ? body.parts.map((p) => p.text || "").join(" ")
    : body.text || "";
  const slow = /\bQ[3-9]\b|\bA[3-9]\b|\bP[3-9]\b/.test(text);
  await new Promise((r) => setTimeout(r, slow ? 100 : 8));
  return {
    ok: true,
    status: 200,
    async blob() {
      return new Blob([new Uint8Array(40)]);
    },
    async json() {
      return {};
    },
  };
};

const { speakQaSequence } = await import(
  pathToFileURL(resolve(ROOT, "src/lib/tts.js")).href + "?pct=" + Date.now()
);

const pcts = [];
let startAt = 0;
const t0 = Date.now();

await speakQaSequence(
  Array.from({ length: 5 }, (_, i) => ({
    q: `Q${i + 1}?`,
    a: `A${i + 1} answer with enough text.`,
    preface: `P${i + 1}.`,
  })),
  {
    lang: "en",
    onPrepareProgress: (p) => pcts.push(p.percent),
    onStart: () => {
      startAt = Date.now();
    },
  }
);

if (!startAt) {
  console.error("RED: onStart never fired");
  process.exit(1);
}
if (!pcts.length || pcts[pcts.length - 1] < 100) {
  console.error("RED: expected prepare % to reach 100", pcts.slice(-5));
  process.exit(1);
}
const timeToStart = startAt - t0;
const total = Date.now() - t0;
if (timeToStart > total * 0.55) {
  console.error("RED: first clip too late", { timeToStart, total });
  process.exit(1);
}
console.log(
  `GREEN: batch+pct startMs=${timeToStart} totalMs=${total} lastPct=${pcts[pcts.length - 1]} samples=${pcts.length}`
);
