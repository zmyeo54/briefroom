#!/usr/bin/env node
/**
 * Progressive first chunk must include the question, not only "Question 1."
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const { firstPlayGroupSize, buildSpeakParts } = await import(
  pathToFileURL(resolve(ROOT, "src/lib/tts.js")).href + "?g=" + Date.now()
);

const entry = {
  q: "Tell me about yourself. / 请介绍一下你自己。",
  a: "I lead teams. / 我带团队。",
  preface: "Question 1. / 第1题。",
};
const parts = buildSpeakParts(entry.q, entry.a, {
  lang: "both",
  preface: entry.preface,
});
const n = firstPlayGroupSize(parts, entry, { lang: "both" });

if (n < 3) {
  console.error("RED: group too small (preface-only risk)", { n, parts });
  process.exit(1);
}
const texts = parts.slice(0, n).map((p) => p.text);
if (!texts.some((t) => /yourself|介绍/i.test(t))) {
  console.error("RED: first group missing real question", texts);
  process.exit(1);
}
if (texts.some((t) => /lead teams|带团队/i.test(t))) {
  console.error("RED: first group should not include answer yet", texts);
  process.exit(1);
}
console.log(`GREEN: firstPlayGroupSize=${n} head=${JSON.stringify(texts)}`);
