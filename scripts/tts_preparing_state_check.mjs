#!/usr/bin/env node
/**
 * Regression: "Now reading" must not appear during prefetch prepare.
 * Mirrors HomePage wiring (playingIndex ← onProgress, audioReady ← onStart).
 *
 * The bug was onProgress(i) during mapPool prefetch — rows hopped/pulsed
 * "Now reading" for many frames while the FAB stayed on "Preparing voice…".
 *
 * Usage: node scripts/tts_preparing_state_check.mjs
 * Exit 1 = RED
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

globalThis.fetch = async () => {
  await new Promise((r) => setTimeout(r, 20));
  return {
    ok: true,
    status: 200,
    async blob() {
      return new Blob([new Uint8Array([0xff, 0xe0])]);
    },
    async json() {
      return {};
    },
  };
};

const { speakQaSequence } = await import(
  pathToFileURL(resolve(ROOT, "src/lib/tts.js")).href
);

let audioReady = false;
let playingIndex = -1;
let inPlaybackStart = false;
const progressBeforeStart = [];

await speakQaSequence(
  Array.from({ length: 5 }, (_, i) => ({
    q: `Question ${i}?`,
    a: `Answer ${i}`,
    preface: `Q${i}.`,
  })),
  {
    lang: "en",
    onProgress: (j) => {
      playingIndex = j >= 0 ? j : -1;
      // Prefetch-era progress (before playBlob fires onStart) is the bug.
      if (!inPlaybackStart && j >= 0) progressBeforeStart.push(j);
    },
    onStart: () => {
      inPlaybackStart = true;
      audioReady = true;
    },
  }
);

if (progressBeforeStart.length) {
  console.error(
    "RED: onProgress during prepare (Now reading while Preparing voice)",
    progressBeforeStart
  );
  process.exit(1);
}
if (!audioReady) {
  console.error("RED: onStart never fired");
  process.exit(1);
}
if (playingIndex !== 0) {
  console.error(
    `RED: expected playingIndex=0 once audio starts, got ${playingIndex}`
  );
  process.exit(1);
}
console.log("GREEN: preparing/now-reading state machine ok");
