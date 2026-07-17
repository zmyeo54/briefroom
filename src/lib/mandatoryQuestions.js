/** Always-first interview questions (pinned on top). */

export const MANDATORY_QUESTIONS = [
  {
    id: "intro",
    qZh: "请介绍一下你自己。",
    qEn: "Tell me about yourself.",
    match: /introduce yourself|tell me about yourself|自我介绍|介绍一下你自己/i,
  },
  {
    id: "left",
    qZh: "为什么离开上一份工作？",
    qEn: "Why did you leave your previous role?",
    match: /leave.*(previous|last|prior)|left.*(previous|last|job|role)|why.*(change|switch).*job|离开.*(上一|前一份|上一家)|为什么换工作|为什么离职/i,
  },
  {
    id: "whyUs",
    qZh: "为什么想加入我们？",
    qEn: "Why do you want to work with us?",
    match: /why.*(work|join|us|this (company|role|team))|why.*(choose|interested).*us|为什么.*(加入|选择).*(我们|贵公司|这家)|为什么想.*(来|加入)/i,
  },
];

export function mandatoryQuestionText(lang = "en") {
  return MANDATORY_QUESTIONS.map((m) =>
    lang === "zh" ? m.qZh : lang === "both" ? `${m.qEn} / ${m.qZh}` : m.qEn
  );
}

function mandatoryQuestionForLang(m, lang) {
  if (lang === "zh") return m.qZh;
  if (lang === "both") return `${m.qEn} / ${m.qZh}`;
  return m.qEn;
}

function normalizeQ(q) {
  return String(q || "")
    .toLowerCase()
    .replace(/[？?。.!！,，、/\s]+/g, "")
    .slice(0, 48);
}

/** Extract meaningful words from a question (drops stop words). */
function qWords(q) {
  const stop = new Set([
    "what", "is", "are", "do", "does", "did", "how", "why", "can", "could",
    "would", "should", "will", "the", "a", "an", "your", "you", "my", "me",
    "i", "we", "us", "this", "that", "for", "of", "in", "to", "and", "or",
    "be", "been", "was", "were", "have", "has", "had", "not", "no",
    "请", "你", "的", "吗", "呢", "了", "是", "为", "什么", "怎么",
    "如何", "能", "会", "可以", "想", "要",
  ]);
  return new Set(
    String(q || "")
      .toLowerCase()
      .replace(/[？?。.!！,，、/]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stop.has(w))
  );
}

function isSameQuestion(a, b) {
  const na = normalizeQ(a);
  const nb = normalizeQ(b);
  if (!na || !nb) return false;
  // Exact substring match (fast path)
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  // Word-overlap fallback: if ≥60% of meaningful words match
  const wa = qWords(a);
  const wb = qWords(b);
  if (!wa.size || !wb.size) return false;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  const ratio = common / Math.min(wa.size, wb.size);
  return ratio >= 0.6;
}

function isMandatoryText(q) {
  return MANDATORY_QUESTIONS.some((m) => m.match.test(q || ""));
}

/** Drop target lines that duplicate the mandatory three. */
export function filterTargetAddons(targetQuestions = []) {
  return (targetQuestions || [])
    .map((q) => String(q || "").trim())
    .filter(Boolean)
    .filter((q) => !isMandatoryText(q));
}

/**
 * Pin order: mandatory 3 → target add-ons → everything else.
 */
export function pinMandatoryFirst(items, lang = "en", targetQuestions = []) {
  const list = Array.isArray(items) ? [...items] : [];
  const used = new Set();
  const pinned = [];

  for (const m of MANDATORY_QUESTIONS) {
    const idx = list.findIndex((it, i) => !used.has(i) && m.match.test(it.q || ""));
    if (idx >= 0) {
      used.add(idx);
      pinned.push({
        ...list[idx],
        // Always show the must-ask wording in the active interview language
        q: mandatoryQuestionForLang(m, lang),
        pinned: true,
        pinKind: "mandatory",
        mandatoryId: m.id,
      });
    } else {
      pinned.push({
        q: mandatoryQuestionForLang(m, lang),
        a: "",
        pinned: true,
        pinKind: "mandatory",
        mandatoryId: m.id,
        missing: true,
      });
    }
  }

  const addons = filterTargetAddons(targetQuestions);
  for (const [ti, tq] of addons.entries()) {
    const idx = list.findIndex(
      (it, i) => !used.has(i) && isSameQuestion(it.q, tq)
    );
    if (idx >= 0) {
      used.add(idx);
      pinned.push({
        ...list[idx],
        pinned: true,
        pinKind: "target",
        targetId: `target-${ti}`,
      });
    } else {
      pinned.push({
        q: tq,
        a: "",
        pinned: true,
        pinKind: "target",
        targetId: `target-${ti}`,
        missing: true,
      });
    }
  }

  const rest = list
    .filter((_, i) => !used.has(i))
    .map((it) => ({ ...it, pinned: false, pinKind: "extra" }));

  return [...pinned, ...rest];
}
