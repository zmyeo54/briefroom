#!/usr/bin/env node
/**
 * Robustness: intermittent stream-closed + one hard-fail item.
 * Playlist must keep playing the rest (not abort with cut-out).
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

let calls = 0;
let transientFails = 0;
globalThis.fetch = async (_url, init) => {
  calls += 1;
  const text = JSON.parse(init.body || "{}").text || "";
  // Hard-fail item 2 (non-transient) — should be skipped
  if (/\bQ2\b|\bA2\b|\bP2\b/.test(text)) {
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
  // Intermittent Edge flap — retry should recover
  if (calls % 5 === 0) {
    transientFails += 1;
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

try {
  const result = await speakQaSequence(
    [
      { q: "Q1?", a: "A1 answer", preface: "P1." },
      { q: "Q2?", a: "A2 answer", preface: "P2." },
      { q: "Q3?", a: "A3 answer", preface: "P3." },
      { q: "Q4?", a: "A4 answer", preface: "P4." },
    ],
    { lang: "en" }
  );
  if (result.played < 3) {
    console.error("RED: expected >=3 played", result, { calls, transientFails });
    process.exit(1);
  }
  if (result.skipped < 1) {
    console.error("RED: expected Q2 skipped", result);
    process.exit(1);
  }
  console.log(
    `GREEN: played=${result.played} skipped=${result.skipped} transientFails=${transientFails} calls=${calls}`
  );
  process.exit(0);
} catch (e) {
  console.error(`RED: ${e.message} calls=${calls}`);
  process.exit(1);
}
