#!/usr/bin/env node
/** buildMultiVoiceSsml must escape text and emit one <speak> with N voices. */
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { buildMultiVoiceSsml, escapeXml } = await import(
  pathToFileURL(resolve(ROOT, "lib/edgeTts.js")).href
);

if (escapeXml(`a<b&c>"`) !== "a&lt;b&amp;c&gt;&quot;") {
  console.error("RED: escapeXml failed");
  process.exit(1);
}

const ssml = buildMultiVoiceSsml(
  [
    { text: 'Hello & "world"', voice: "en-aria-news" },
    { text: "你好", voice: "zh-xiaoxiao-news" },
  ],
  "+0%"
);

if (!ssml.includes("<speak") || !ssml.includes("</speak>")) {
  console.error("RED: missing speak wrapper", ssml);
  process.exit(1);
}
if ((ssml.match(/<voice /g) || []).length !== 2) {
  console.error("RED: expected 2 voice turns", ssml);
  process.exit(1);
}
if (!ssml.includes("&amp;") || !ssml.includes("&quot;")) {
  console.error("RED: text not escaped", ssml);
  process.exit(1);
}
if (!ssml.includes('name="en-US-AriaNeural"') || !ssml.includes('name="zh-CN-XiaoxiaoNeural"')) {
  console.error("RED: voice ids not resolved", ssml);
  process.exit(1);
}
console.log("GREEN: multi-voice SSML builder ok");
