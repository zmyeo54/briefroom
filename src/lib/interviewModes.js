/** Answer length + question focus directions for generation. */

export const ANSWER_LENGTHS = [
  {
    id: "brief",
    label: "Brief",
    short: "30 sec",
    eyebrow: "Elevator",
    hint: "One claim, one proof — perfect for warm-up rounds.",
    speakSeconds: "20–35 seconds",
    prompt: `ANSWER LENGTH: Brief (about 20–35 seconds spoken).
- 3–5 short sentences max.
- One main claim + one concrete proof. No long stories.
- Cut filler and preambles.`,
  },
  {
    id: "standard",
    label: "Standard",
    short: "75 sec",
    eyebrow: "Most interviews",
    hint: "Clear STAR story you can say without rushing.",
    speakSeconds: "60–90 seconds",
    prompt: `ANSWER LENGTH: Standard (about 60–90 seconds spoken).
- Tight structure: context → action → result.
- One solid example is enough. Stay conversational.`,
  },
  {
    id: "deep",
    label: "Deep dive",
    short: "2–3 min",
    eyebrow: "Panel / VP",
    hint: "Richer ownership story — stakes, trade-offs, result.",
    speakSeconds: "2–3 minutes",
    prompt: `ANSWER LENGTH: Deep dive (about 2–3 minutes spoken).
- Fuller STAR with stakes, trade-offs, and what you owned.
- Still oral — not an essay. Use short paragraphs / natural pauses.
- Include one measurable result when the resume supports it.`,
  },
];

export const DEFAULT_ANSWER_LENGTH = "standard";

/** Multi-select directions for invented / framed questions */
export const QUESTION_FOCUSES = [
  {
    id: "leadership",
    label: "Leadership",
    hint: "Team calls & ownership",
    invent: "leadership / team ownership / hard decisions",
    keywords: [
      "lead", "leadership", "manager", "management", "team", "mentor",
      "people", "own", "ownership", "decision", "vp", "director", "supervise",
      "领导", "团队", "管理", "带人",
    ],
  },
  {
    id: "delivery",
    label: "Delivery",
    hint: "Ops, SLAs, scale",
    invent: "delivery excellence, operations, SLA / scale challenges",
    keywords: [
      "delivery", "operations", "ops", "sla", "fulfillment", "warehouse",
      "logistics", "distribution", "supply chain", "order", "inventory",
      "execution", "process", "uat", "deployment", "go-live", "transformation",
      "交付", "运营", "供应链", "仓储", "物流",
    ],
  },
  {
    id: "customer",
    label: "Customer",
    hint: "Tough clients & recovery",
    invent: "unhappy customer / escalation / service recovery",
    keywords: [
      "customer", "client", "account", "escalation", "service", "support",
      "complaint", "nps", "csat", "partner", "patient",
      "客户", "投诉", "服务",
    ],
  },
  {
    id: "rolefit",
    label: "Role fit",
    hint: "Why this job, why now",
    invent: "role-fit, motivation for this company and scope",
    keywords: [
      "motivation", "why join", "career", "growth", "mission", "vision",
      "purpose", "passion", "fit",
      "动机", "为什么", "加入",
    ],
  },
  {
    id: "gaps",
    label: "Gaps",
    hint: "Tenure, title, pivots",
    invent: "honest gap / weakness / career transition reframes",
    keywords: [
      "gap", "weakness", "transition", "career change", "pivot", "junior",
      "without experience", "learning", "stretch",
      "短板", "转行", "不足",
    ],
  },
  {
    id: "stakeholder",
    label: "Stakeholders",
    hint: "HQ, partners, conflict",
    invent: "cross-border / HQ / partner stakeholder management",
    keywords: [
      "stakeholder", "cross-functional", "global", "regional", "apac", "hq",
      "collaborate", "collaboration", "alignment", "workshop", "europe", "us",
      "matrix", "partner",
      "跨部门", "总部", "协作", "亚太",
    ],
  },
  {
    id: "culture",
    label: "Culture",
    hint: "Values under pressure",
    invent: "culture fit, working style, values under pressure",
    keywords: [
      "culture", "values", "inclusive", "diversity", "integrity", "trust",
      "way of working", "mindset",
      "文化", "价值观",
    ],
  },
  {
    id: "domain",
    label: "Domain",
    hint: "Industry judgment",
    invent: "domain / industry / role-specific technical judgment",
    keywords: [
      "oracle", "erp", "fusion", "sql", "tableau", "jira", "confluence",
      "analyst", "technical", "techno-functional", "system", "data",
      "medtech", "healthcare", "pharma", "fintech", "banking", "saas",
      "engineering", "architecture",
      "业务分析", "系统", "数据",
    ],
  },
];

export const DEFAULT_FOCUSES = ["leadership", "delivery", "customer", "rolefit"];

/** Always useful baselines when JD is thin */
const ALWAYS_INCLUDE = ["rolefit"];

export function answerLengthById(id) {
  return (
    ANSWER_LENGTHS.find((x) => x.id === id) ||
    ANSWER_LENGTHS.find((x) => x.id === DEFAULT_ANSWER_LENGTH)
  );
}

export function normalizeFocuses(raw) {
  const allowed = new Set(QUESTION_FOCUSES.map((f) => f.id));
  const list = Array.isArray(raw) ? raw : DEFAULT_FOCUSES;
  const cleaned = [...new Set(list.filter((id) => allowed.has(id)))];
  return cleaned.length ? cleaned : [...DEFAULT_FOCUSES];
}

/**
 * Score focus themes from resume + JD text and return recommended ids.
 * Extras = everything else (caller shows them as optional).
 */
export function suggestFocusesFromText({ resume = "", jd = "" } = {}) {
  const blob = `${resume}\n${jd}`.toLowerCase();
  if (!blob.trim()) {
    return [...DEFAULT_FOCUSES];
  }

  const scored = QUESTION_FOCUSES.map((f) => {
    let score = 0;
    for (const kw of f.keywords || []) {
      if (!kw) continue;
      const needle = kw.toLowerCase();
      let hits = 0;
      if (needle.includes(" ") || /[^\u0000-\u007f]/.test(needle)) {
        hits = blob.split(needle).length - 1;
      } else {
        const re = new RegExp(
          `\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "gi"
        );
        hits = (blob.match(re) || []).length;
      }
      if (hits > 0) score += hits * (needle.length > 6 ? 2 : 1);
    }
    return { id: f.id, score };
  }).sort((a, b) => b.score - a.score);

  const picked = [];
  for (const row of scored) {
    if (row.score <= 0) continue;
    picked.push(row.id);
    if (picked.length >= 4) break;
  }

  for (const id of ALWAYS_INCLUDE) {
    if (!picked.includes(id)) picked.push(id);
  }

  // If JD barely matched, keep a sensible default set
  if (picked.length < 3) {
    return normalizeFocuses([...picked, ...DEFAULT_FOCUSES]).slice(0, 4);
  }

  return normalizeFocuses(picked).slice(0, 5);
}

export function partitionFocuses(selectedIds, suggestedIds) {
  const selected = new Set(normalizeFocuses(selectedIds));
  const suggested = normalizeFocuses(suggestedIds);
  const suggestedSet = new Set(suggested);
  const recommended = QUESTION_FOCUSES.filter((f) => suggestedSet.has(f.id));
  const extras = QUESTION_FOCUSES.filter((f) => !suggestedSet.has(f.id));
  return { recommended, extras, selected };
}

export function focusPromptBlock(focusIds) {
  const ids = normalizeFocuses(focusIds);
  const items = QUESTION_FOCUSES.filter((f) => ids.includes(f.id));
  const lines = items.map((f) => `- ${f.label}: ${f.invent}`).join("\n");
  return `QUESTION DIRECTIONS (bias invented extras and answer framing toward these job-interview themes):
${lines}
- Still keep the mandatory 3 and any user target add-ons.
- Prefer directions above when inventing extras; cover as many selected directions as practical without forcing duplicates.
- Keep questions realistic for this role's seniority and scope.`;
}
