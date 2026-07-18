#!/usr/bin/env node
/**
 * Browser TTS engine must speak via speechSynthesis (no /api/tts) and fire onStart ASAP.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let posts = 0;
globalThis.fetch = async () => {
  posts += 1;
  throw new Error("fetch should not run for browser TTS");
};

const uttered = [];
globalThis.speechSynthesis = {
  getVoices() {
    return [
      { name: "Test EN", lang: "en-US" },
      { name: "Test ZH Female", lang: "zh-CN" },
    ];
  },
  addEventListener() {},
  cancel() {},
  speak(u) {
    uttered.push(u.text);
    setTimeout(() => u.onend?.(), 5);
  },
};
globalThis.SpeechSynthesisUtterance = function (text) {
  this.text = text;
  this.rate = 1;
  this.voice = null;
  this.lang = "";
  this.onend = null;
  this.onerror = null;
};
globalThis.document = {
  createElement() {
    return { style: {}, setAttribute() {}, appendChild() {}, remove() {} };
  },
  body: { appendChild() {} },
};
globalThis.URL.createObjectURL = () => "blob:x";
globalThis.URL.revokeObjectURL = () => {};
globalThis.indexedDB = undefined;

const { speakQaSequence } = await import(
  pathToFileURL(resolve(ROOT, "src/lib/tts.js")).href + "?br=" + Date.now()
);

const t0 = Date.now();
let startAt = 0;
await speakQaSequence([{ q: "Hello?", a: "Hi there.", preface: "One." }], {
  lang: "en",
  ttsEngine: "browser",
  onStart: () => {
    startAt = Date.now();
  },
});

if (posts !== 0) {
  console.error("RED: browser engine hit network", posts);
  process.exit(1);
}
if (!uttered.length) {
  console.error("RED: no utterances", uttered);
  process.exit(1);
}
if (!startAt || startAt - t0 > 50) {
  console.error("RED: onStart not instant", { startAt, dt: startAt - t0 });
  process.exit(1);
}
console.log(
  `GREEN: browser TTS utter=${uttered.length} startMs=${startAt - t0} posts=${posts}`
);
