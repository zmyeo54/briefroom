#!/usr/bin/env node
/**
 * Regression: fetchAudio must hit IndexedDB after memory miss (no network).
 * Exit 0 = GREEN, 1 = RED.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "src/lib/tts.js");
const TMP = resolve(ROOT, "scripts/.tts_idb_check_tmp.mjs");

const store = new Map();
class FakeReq {
  constructor(result) {
    this.result = result;
    this.onsuccess = null;
    this.onerror = null;
    queueMicrotask(() => this.onsuccess?.());
  }
}
class FakeTx {
  constructor(mode) {
    this.mode = mode;
    this.oncomplete = null;
    this.onerror = null;
    queueMicrotask(() => this.oncomplete?.());
  }
  objectStore() {
    return {
      get: (key) => new FakeReq(store.has(key) ? store.get(key) : undefined),
      put: (row) => {
        store.set(row.key, row);
        return new FakeReq(undefined);
      },
      delete: (key) => {
        store.delete(key);
        return new FakeReq(undefined);
      },
      getAll: () => new FakeReq([...store.values()]),
    };
  }
}
class FakeDb {
  objectStoreNames = { contains: () => true };
  transaction() {
    return new FakeTx();
  }
}

globalThis.indexedDB = {
  open() {
    const req = {
      result: new FakeDb(),
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
    };
    queueMicrotask(() => req.onsuccess?.());
    return req;
  },
};

let fetches = 0;
globalThis.fetch = async () => {
  fetches += 1;
  return {
    ok: true,
    async blob() {
      return new Blob([Uint8Array.of(1, 2, 3)], { type: "audio/mpeg" });
    },
  };
};

// Strip browser-only DOM bits by importing after fakes; speak paths need audio.
globalThis.document = {
  createElement() {
    return {
      style: { cssText: "" },
      setAttribute() {},
      appendChild() {},
      removeChild() {},
      play: () => Promise.resolve(),
      pause() {},
      parentNode: null,
    };
  },
  body: { appendChild() {} },
};
globalThis.URL = {
  createObjectURL: () => "blob:fake",
  revokeObjectURL() {},
};
globalThis.speechSynthesis = { cancel() {} };

const src = readFileSync(SRC, "utf8");
// Export fetch helpers via a thin wrapper — call through speakText path's cache.
writeFileSync(
  TMP,
  src.replace(
    "export async function speakText",
    "export async function __fetchAudio(text, voice, rate) { return fetchAudio(text, voice, rate); }\nexport async function speakText"
  )
);

try {
  const mod = await import(pathToFileURL(TMP).href + `?t=${Date.now()}`);
  const blob1 = await mod.__fetchAudio("hello cache", "en-aria-news", 1);
  if (!(blob1 instanceof Blob) || fetches !== 1) {
    console.error("RED: first fetch should hit network once", { fetches });
    process.exit(1);
  }
  // Drop memory cache by re-importing? Same module keeps Map — clear via second key path:
  // Simulate memory miss: overwrite by reading from a fresh module is hard; instead
  // poke: fetch same key after wiping Map isn't exported. Use two-module trick.
} finally {
  try {
    unlinkSync(TMP);
  } catch {
    /* ignore */
  }
}

// Re-do with explicit memory wipe by re-running idb path in isolation
writeFileSync(
  TMP,
  src.replace(
    "export async function speakText",
    `export async function __fetchAudio(text, voice, rate) { return fetchAudio(text, voice, rate); }
export function __wipeMem() { audioCache.clear(); }
export async function speakText`
  )
);

try {
  const mod = await import(pathToFileURL(TMP).href + `?t=${Date.now() + 1}`);
  fetches = 0;
  await mod.__fetchAudio("hello cache 2", "en-aria-news", 1);
  if (fetches !== 1) {
    console.error("RED: seed fetch expected", fetches);
    process.exit(1);
  }
  mod.__wipeMem();
  fetches = 0;
  const blob = await mod.__fetchAudio("hello cache 2", "en-aria-news", 1);
  if (fetches !== 0 || !(blob instanceof Blob)) {
    console.error("RED: after wipe, should serve from IndexedDB", {
      fetches,
      blob: !!blob,
    });
    process.exit(1);
  }
  console.log("GREEN: IndexedDB serves after memory wipe (0 network)");
  process.exit(0);
} finally {
  try {
    unlinkSync(TMP);
  } catch {
    /* ignore */
  }
}
