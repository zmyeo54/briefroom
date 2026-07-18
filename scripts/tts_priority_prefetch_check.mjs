#!/usr/bin/env node
/**
 * Priority waiters run before normal waiters when the pool is full.
 * Prefetch must fill cache so a later synthesizeQaAudio needs 0 network.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const started = [];

globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(init?.body || "{}");
  const label = Array.isArray(body.parts)
    ? body.parts.map((p) => p.text).join("|")
    : body.text || "";
  started.push(label);
  // Non-priority holds the slot longer so the queue builds up.
  await new Promise((r) =>
    setTimeout(r, label.includes("PRIORITY") ? 5 : 60)
  );
  return {
    ok: true,
    status: 200,
    async blob() {
      return new Blob([new Uint8Array(32)]);
    },
    async json() {
      return {};
    },
  };
};

globalThis.document = {
  createElement() {
    return {
      style: { cssText: "" },
      setAttribute() {},
      appendChild() {},
      remove() {},
      play: () => Promise.resolve(),
      pause() {},
      parentNode: { removeChild() {} },
    };
  },
  body: { appendChild() {} },
};
globalThis.URL.createObjectURL = () => "blob:x";
globalThis.URL.revokeObjectURL = () => {};
globalThis.speechSynthesis = { cancel() {} };
globalThis.indexedDB = undefined;

const { synthesizeQaAudio, prefetchQaSequence } = await import(
  pathToFileURL(resolve(ROOT, "src/lib/tts.js")).href + "?prio=" + Date.now()
);

const normals = Array.from({ length: 6 }, (_, i) =>
  synthesizeQaAudio(`N${i}q?`, `N${i} answer text here.`, {
    lang: "en",
    preface: `N${i}.`,
    priority: false,
  })
);
await new Promise((r) => setTimeout(r, 15));
const prio = synthesizeQaAudio("PRIORITYq?", "PRIORITY answer.", {
  lang: "en",
  preface: "PRIORITY.",
  priority: true,
});
await Promise.all([...normals, prio]);

const prioIdx = started.findIndex((s) => s.includes("PRIORITY"));
// First 2 normals own the slots; priority must be the next to start (index 2).
if (prioIdx !== 2) {
  console.error("RED: priority did not jump queue", { started, prioIdx });
  process.exit(1);
}

const postsBefore = started.length;
await prefetchQaSequence(
  [{ q: "Cache me?", a: "Yes please cache this clip.", preface: "One." }],
  { lang: "en" }
);
const postsAfterPrefetch = started.length;
await synthesizeQaAudio("Cache me?", "Yes please cache this clip.", {
  lang: "en",
  preface: "One.",
});
if (started.length !== postsAfterPrefetch) {
  console.error("RED: prefetch cache miss on replay", {
    postsBefore,
    postsAfterPrefetch,
    after: started.length,
  });
  process.exit(1);
}

console.log(`GREEN: priority+prefetch prioIdx=${prioIdx} posts=${started.length}`);
