#!/usr/bin/env node
/**
 * Progressive play-all: first clip can start before later clips finish synth.
 * Also: hard-fail one item → skip; rest still play.
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

const gate = new Map(); // text → { resolve, promise, delay }
let releases = 0;

globalThis.fetch = async (_url, init) => {
  const text = JSON.parse(init.body || "{}").text || "";
  if (/\bQ2\b|\bA2 answer\b|\bP2\b/.test(text)) {
    return {
      ok: false,
      status: 422,
      async json() {
        return { error: "unsupported locale" };
      },
      async blob() {
        return new Blob();
      },
    };
  }
  // Slow down later items so first can start first
  const slow = /\bQ[456]\b|\bA[456]\b|\bP[456]\b/.test(text);
  if (slow) await new Promise((r) => setTimeout(r, 80));
  else await new Promise((r) => setTimeout(r, 5));
  releases += 1;
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
  pathToFileURL(resolve(ROOT, "src/lib/tts.js")).href + "?prog=" + Date.now()
);

const progress = [];
let startAt = 0;
let firstProgressAt = 0;
const t0 = Date.now();

const result = await speakQaSequence(
  Array.from({ length: 6 }, (_, i) => ({
    q: `Q${i + 1}?`,
    a: `A${i + 1} answer`,
    preface: `P${i + 1}.`,
  })),
  {
    lang: "en",
    onProgress: (i) => {
      if (!firstProgressAt) firstProgressAt = Date.now();
      progress.push(i);
    },
    onStart: () => {
      startAt = Date.now();
    },
  }
);

if (result.played < 5 || result.skipped !== 1) {
  console.error("RED: expected ~5 played / 1 skipped", result);
  process.exit(1);
}
if (!startAt || progress[0] !== 0) {
  console.error("RED: should start on first clip", { startAt, progress });
  process.exit(1);
}
// First audio should begin well before the whole run finishes
const timeToStart = startAt - t0;
const total = Date.now() - t0;
if (timeToStart > total * 0.7) {
  console.error("RED: first play too late (not progressive)", {
    timeToStart,
    total,
  });
  process.exit(1);
}
console.log(
  `GREEN: progressive play-all played=${result.played} skipped=${result.skipped} progress=${progress.join(",")} startMs=${timeToStart} totalMs=${total}`
);
