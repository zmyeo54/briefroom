/** Candidate identity helpers — gender + name from resume. */

export const CANDIDATE_GENDERS = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
];

export function normalizeGender(raw) {
  return String(raw || "").toLowerCase() === "female" ? "female" : "male";
}

/**
 * Pull the candidate's name from resume text (first-line / Name: heuristics).
 */
export function extractCandidateName(resume) {
  const text = String(resume || "").replace(/\r/g, "").trim();
  if (!text) return "";

  const labeled = text.match(
    /(?:^|\n)\s*(?:name|full\s*name|candidate\s*name|姓名|名字)\s*[:：]\s*([^\n|/|，,]{2,48})/i
  );
  if (labeled?.[1]) return cleanName(labeled[1]);

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8);

  for (const line of lines) {
    if (looksLikeNoiseLine(line)) continue;
    const cleaned = cleanName(line.split(/[|•·]/)[0] || line);
    if (isPlausibleName(cleaned)) return cleaned;
  }
  return "";
}

function looksLikeNoiseLine(line) {
  return (
    /@|https?:\/\//i.test(line) ||
    /\d{3,}.*\d{3,}/.test(line) ||
    /^(resume|curriculum|cv|profile|联系|电话|手机|邮箱|地址|objective|summary)/i.test(
      line
    ) ||
    line.length > 48
  );
}

function cleanName(raw) {
  return String(raw || "")
    .replace(/^[\s\-–—:：|]+/, "")
    .replace(/[\s\-–—|]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlausibleName(name) {
  if (!name || name.length < 2 || name.length > 40) return false;
  if (/[0-9@/\\]/.test(name)) return false;
  // Latin: 1–4 words; CJK: 2–8 chars mostly han
  if (/^[\u4e00-\u9fff·•]{2,8}$/.test(name)) return true;
  if (/^[A-Za-z][A-Za-z.'\-]*(?:\s+[A-Za-z][A-Za-z.'\-]*){0,3}$/.test(name)) {
    return true;
  }
  // Mixed e.g. "YE Zhi Ming" or "张三 Zhang"
  if (/^[\u4e00-\u9fffA-Za-z·•.'\-\s]{2,40}$/.test(name) && !/\s{2,}/.test(name)) {
    return name.split(/\s+/).length <= 5;
  }
  return false;
}

/** Swap placeholders / intro names so answers always use the resume name. */
export function applyCandidateNameToText(text, name) {
  const n = cleanName(name);
  if (!n || !text) return text;

  let t = String(text)
    .replace(/\[(?:Your\s+)?Name\]/gi, n)
    .replace(/\bYOUR_NAME\b/g, n)
    .replace(/候选人姓名/g, n)
    .replace(/\bCandidate(?:'s)?\s+Name\b/gi, n);

  t = t.replace(
    /\b((?:I(?:'m| am)|My name is)\s+)[A-Z][A-Za-z.'\-]*(?:\s+[A-Z][A-Za-z.'\-]*){0,3}\b/g,
    `$1${n}`
  );
  t = t.replace(/(我(?:是|叫)\s*)([\u4e00-\u9fffA-Za-z·•.'\-\s]{1,40})/g, (m, p1, who) => {
    // Don't clobber longer clauses that aren't just a name
    if (/[，。！？、,]/.test(who) || who.length > 20) return m;
    return `${p1}${n}`;
  });

  return t;
}

export function applyCandidateNameToItems(items, name) {
  const n = cleanName(name);
  if (!n) return items;
  return (items || []).map((item) => ({
    ...item,
    q: applyCandidateNameToText(item.q, n),
    a: applyCandidateNameToText(item.a, n),
  }));
}
