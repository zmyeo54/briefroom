#!/usr/bin/env node
/**
 * Idle prefetch must only hit the network for the first PREFETCH_CLIP_LIMIT clips.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let posts = 0;

globalThis.fetch = async () => {
  posts += 1;
  await new Promise((r) => setTimeout(r, 5));
  return {
    ok: true,
    status: 200,
    async blob() {
      return new Blob([new Uint8Array(24)]);
    },
    async json() {
      return {};
    },
  };
};
globalThis.document = {
  createElement() {
    return { style: {}, setAttribute() {}, appendChild() {}, remove() {} };
  },
  body: { appendChild() {} },
};
globalThis.URL.createObjectURL = () => "blob:x";
globalThis.URL.revokeObjectURL = () => {};
globalThis.speechSynthesis = { cancel() {} };
globalThis.indexedDB = undefined;

const { prefetchQaSequence } = await import(
  pathToFileURL(resolve(ROOT, "src/lib/tts.js")).href + "?pf=" + Date.now()
);

const items = Array.from({ length: 8 }, (_, i) => ({
  q: `Q${i + 1}?`,
  a: `Answer ${i + 1} with enough text.`,
  preface: `P${i + 1}.`,
}));

await prefetchQaSequence(items, { lang: "en" });

if (posts > 2) {
  console.error(`RED: prefetch posted ${posts} times for 8 clips (want ≤2)`);
  process.exit(1);
}
if (posts < 1) {
  console.error("RED: prefetch posted nothing");
  process.exit(1);
}
console.log(`GREEN: prefetch posts=${posts} for 8 clips (capped)`);
