/** Job title / company heuristics from JD text (upload, OCR, URL, paste). */

export function cleanJobTitle(raw) {
  const t = String(raw || "")
    .replace(/^[\s\-–—:：|]+/, "")
    .replace(/[\s\-–—|]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  // Reject JD blobs that slipped in as a "title" (LinkedIn scrape bug, paste, etc.)
  if (!t || t.length > 100) return "";
  return t;
}

function looksLikeJdBody(line) {
  const t = line.toLowerCase();
  return (
    line.length > 100 ||
    /^(about|description|responsibilities|requirements|qualifications|benefits|job description|overview|what you|we are|the role|职位描述|岗位职责|任职要求)/i.test(
      line
    ) ||
    /^(company|location|posted|apply|salary|remote|hybrid)\s*[:：]/i.test(line) ||
    (t.includes("years of experience") && t.includes("and"))
  );
}

/**
 * Pull role title from JD text — URL prefixes, labels, or a short first line.
 */
export function extractJobTitle(jd) {
  const text = String(jd || "").replace(/\r/g, "").trim();
  if (!text) return "";

  const labeled = text.match(
    /(?:^|\n)\s*(?:job\s*title|role|position|opening|title|职位|岗位|招聘岗位)\s*[:：]\s*([^\n]{2,120})/i
  );
  if (labeled?.[1]) return cleanJobTitle(labeled[1]);

  const hiring = text.match(
    /(?:^|\n)\s*([A-Za-z0-9][^\n]{2,80}?)\s+hiring\s+([^\n]{2,80}?)\s+in\s+/i
  );
  if (hiring?.[2]) return cleanJobTitle(hiring[2]);

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12);

  for (const line of lines) {
    if (looksLikeJdBody(line)) continue;
    const head = cleanJobTitle(line.split(/[|•·]/)[0] || line);
    if (head.length >= 2 && head.length <= 80) return head;
  }
  return "";
}

export function extractJobCompany(jd) {
  const text = String(jd || "").replace(/\r/g, "").trim();
  if (!text) return "";

  const labeled = text.match(
    /(?:^|\n)\s*(?:company|employer|organization|公司|雇主)\s*[:：]\s*([^\n]{2,80})/i
  );
  if (labeled?.[1]) return cleanJobTitle(labeled[1]);
  return "";
}

/** Parse Jina reader plain-text header (Title: …). */
export function parseJinaMeta(text) {
  const raw = String(text || "");
  const title = raw.match(/(?:^|\n)Title:\s*(.+)/i)?.[1]?.trim() || "";
  return {
    title: cleanJobTitle(title) || extractJobTitle(raw),
    company: extractJobCompany(raw),
  };
}
