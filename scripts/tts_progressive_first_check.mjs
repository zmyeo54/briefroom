#!/usr/bin/env node
/**
 * First clip must start audio before later Mix parts finish fetching.
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
    setTimeout(() => {
      this.paused = true;
      this.onended?.();
    }, 40);
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
globalThis.indexedDB = undefined;

let partN = 0;
globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(init?.body || "{}");
  // Batch path (later clips) — medium
  if (Array.isArray(body.parts)) {
    await new Promise((r) => setTimeout(r, 80));
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
  }
  // Per-line path for progressive first clip
  const n = partN++;
  const delay = n === 0 ? 10 : 120;
  await new Promise((r) => setTimeout(r, delay));
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

const t0 = Date.now();
let startAt = 0;
await speakQaSequence(
  [
    {
      q: "Hello / 你好",
      a: "I am a candidate. / 我是候选人。",
      preface: "Question 1. / 第一题。",
    },
    { q: "Two?", a: "Answer two.", preface: "Q2." },
  ],
  {
    lang: "both",
    onStart: () => {
      startAt = Date.now();
    },
  }
);

if (!startAt) {
  console.error("RED: onStart never fired");
  process.exit(1);
}
const toStart = startAt - t0;
// First Mix part is fast (10ms); full batch of remaining parts is 120ms each.
// Progressive play should start well before ~200ms+.
if (toStart > 100) {
  console.error("RED: first audio too late for progressive path", {
    toStart,
    partN,
  });
  process.exit(1);
}
console.log(`GREEN: progressive first-audio startMs=${toStart} partsFetched=${partN}`);
