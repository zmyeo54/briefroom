#!/usr/bin/env node
/**
 * synthesizeQaAudio must POST one batched /api/tts (parts[]) when cold.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const posts = [];
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init?.body || "{}");
  posts.push({ url: String(url), body });
  return {
    ok: true,
    status: 200,
    async blob() {
      return new Blob([new Uint8Array(64)]);
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

const { synthesizeQaAudio } = await import(
  pathToFileURL(resolve(ROOT, "src/lib/tts.js")).href + "?batch=" + Date.now()
);

await synthesizeQaAudio("Question one?", "Answer one with detail.", {
  lang: "en",
  preface: "Intro.",
});

if (posts.length !== 1) {
  console.error("RED: expected 1 TTS POST, got", posts.length, posts);
  process.exit(1);
}
if (!Array.isArray(posts[0].body.parts) || posts[0].body.parts.length < 2) {
  console.error("RED: expected parts[] batch body", posts[0].body);
  process.exit(1);
}
if (posts[0].body.text) {
  console.error("RED: batch should not send top-level text", posts[0].body);
  process.exit(1);
}
console.log(
  `GREEN: batch request parts=${posts[0].body.parts.length} voices=${[
    ...new Set(posts[0].body.parts.map((p) => p.voice)),
  ].join(",")}`
);
