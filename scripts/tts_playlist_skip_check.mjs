#!/usr/bin/env node
/**
 * Play-all builds one merged MP3 (like export) then plays once.
 * Must include every synthesizable item — not stop after ~2 clips.
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
globalThis.URL.createObjectURL = (blob) => {
  // Encode how many parts were merged (each part is a tiny mp3-ish blob)
  const n = blob?.size || 0;
  return `blob:test#${n}`;
};
globalThis.URL.revokeObjectURL = () => {};
globalThis.speechSynthesis = { cancel() {} };

let calls = 0;
globalThis.fetch = async (_url, init) => {
  calls += 1;
  const text = JSON.parse(init.body || "{}").text || "";
  // Hard-fail only Q2 — rest must still merge + play
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
  // Intermittent flap — retries should recover
  if (calls % 7 === 0) {
    return {
      ok: false,
      status: 500,
      async json() {
        return { error: "Stream closed before turn.end" };
      },
      async blob() {
        return new Blob();
      },
    };
  }
  return {
    ok: true,
    status: 200,
    async blob() {
      return new Blob([new Uint8Array(100)]); // 100 bytes each
    },
    async json() {
      return {};
    },
  };
};

const { speakQaSequence } = await import(
  pathToFileURL(resolve(ROOT, "src/lib/tts.js")).href
);

const progress = [];
let starts = 0;
const result = await speakQaSequence(
  Array.from({ length: 6 }, (_, i) => ({
    q: `Q${i + 1}?`,
    a: `A${i + 1} answer`,
    preface: `P${i + 1}.`,
  })),
  {
    lang: "en",
    onProgress: (i) => progress.push(i),
    onStart: () => {
      starts += 1;
    },
  }
);

// Q2 skipped → 5 played in one merged play, one onStart
if (result.played !== 5 || result.skipped !== 1) {
  console.error("RED: expected played=5 skipped=1", result, { calls });
  process.exit(1);
}
if (starts !== 1 || progress.join(",") !== "0") {
  console.error("RED: expected single merged play", { starts, progress });
  process.exit(1);
}
console.log(
  `GREEN: merged play-all played=${result.played} skipped=${result.skipped} starts=${starts}`
);
