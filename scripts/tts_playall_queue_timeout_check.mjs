#!/usr/bin/env node
/**
 * Regression: play-all must not abort while waiting for a TTS slot.
 * Simulates Mix-style queue depth (many parts, inflight limit 2, slow fetches).
 *
 * Usage: node scripts/tts_playall_queue_timeout_check.mjs
 * Exit 1 = RED (timed out / cut out from queue wait)
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

let aborts = 0;
globalThis.fetch = async (_url, init) => {
  const signal = init?.signal;
  await new Promise((resolve, reject) => {
    // Hold slot 6s; with limit 2, later parts wait well past 15s in queue.
    const t = setTimeout(resolve, 6000);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      aborts += 1;
      const err = new Error("aborted");
      err.name = "AbortError";
      reject(err);
    });
  });
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

const items = Array.from({ length: 4 }, (_, i) => ({
  q: `Q${i}?`,
  a: `A${i} answer text here.`,
  preface: `P${i}.`,
}));

const t0 = Date.now();
try {
  await speakQaSequence(items, { lang: "en" });
  console.log(
    `GREEN: play-all survived queue depth in ${Date.now() - t0}ms (aborts=${aborts})`
  );
  process.exit(0);
} catch (e) {
  console.error(
    `RED: ${e.message} after ${Date.now() - t0}ms (aborts=${aborts})`
  );
  process.exit(1);
}
