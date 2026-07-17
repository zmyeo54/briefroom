#!/usr/bin/env node
/**
 * Self-check for split Builds (7 → 2, 10 → 3).
 * Mirrors planBuildBatches in src/lib/prompt.js — keep in sync.
 * Run: node scripts/build_batches_check.mjs
 */
function normalizeInventCount(raw) {
  const n = Number(raw);
  return [3, 5, 7, 10].includes(n) ? n : 3;
}

function planBuildBatches({ inventCount, autoQuestions = true }) {
  const extras = autoQuestions ? normalizeInventCount(inventCount) : 0;
  if (!autoQuestions || extras < 7) {
    return [{ inventCount: extras || 3, extrasOnly: false }];
  }
  const parts = extras >= 10 ? 3 : 2;
  const chunk = Math.floor(extras / parts);
  const rem = extras % parts;
  return Array.from({ length: parts }, (_, i) => ({
    inventCount: chunk + (i < rem ? 1 : 0),
    extrasOnly: i > 0,
  }));
}

const ten = planBuildBatches({ inventCount: 10 });
const seven = planBuildBatches({ inventCount: 7 });
const three = planBuildBatches({ inventCount: 3 });

if (ten.length !== 3) throw new Error(`10 → expected 3 batches, got ${ten.length}`);
if (ten.map((b) => b.inventCount).join("+") !== "4+3+3") {
  throw new Error(`10 split failed: ${JSON.stringify(ten)}`);
}
if (!ten[1].extrasOnly || !ten[2].extrasOnly) {
  throw new Error("batches 2–3 must be extrasOnly");
}
if (seven.length !== 2 || seven[0].inventCount + seven[1].inventCount !== 7) {
  throw new Error(`7 split failed: ${JSON.stringify(seven)}`);
}
if (three.length !== 1) throw new Error("3 extras must stay one shot");

console.log("ok — split 10→4+3+3, 7→4+3, 3→single");
