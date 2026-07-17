/** Answer length + question focus directions for generation. */

export const ANSWER_LENGTHS = [
  {
    id: "brief",
    label: "Brief",
    short: "30 sec",
    eyebrow: "Elevator",
    hint: "One claim, one proof — perfect for warm-up rounds.",
    speakSeconds: "20–35 seconds",
    /** Soft cap the model must stay under (per language if Mix). */
    maxWords: 55,
    prompt: `ANSWER LENGTH (HARD — every "a" must obey): Brief (~20–35 seconds spoken).
- Max ~55 words per answer (if Mix: ~55 words English AND ~55 words Chinese, not combined).
- 3–5 short sentences only.
- One claim + one proof. No STAR monologue, no filler, no preamble.`,
  },
  {
    id: "standard",
    label: "Standard",
    short: "75 sec",
    eyebrow: "Most interviews",
    hint: "Clear STAR story you can say without rushing.",
    speakSeconds: "60–90 seconds",
    maxWords: 160,
    prompt: `ANSWER LENGTH (HARD — every "a" must obey): Standard (~60–90 seconds spoken).
- Target ~120–160 words per answer (if Mix: that budget PER language).
- Structure: context → action → result. One solid example.
- Conversational speech — not an essay. Do not write Deep Dive length.`,
  },
  {
    id: "deep",
    label: "Deep Dive",
    short: "2–3 min",
    eyebrow: "Panel / VP",
    hint: "Richer ownership story — stakes, trade-offs, result.",
    speakSeconds: "2–3 minutes",
    maxWords: 320,
    prompt: `ANSWER LENGTH (HARD — every "a" must obey): Deep dive (~2–3 minutes spoken).
- Target ~240–320 words per answer (if Mix: that budget PER language).
- Fuller STAR: stakes, trade-offs, what you owned, one measurable result when resume supports it.
- Still oral — short paragraphs / natural pauses. Use the full budget; do not stay Brief.`,
  },
];

export const DEFAULT_ANSWER_LENGTH = "standard";

/**
 * Optional interviewer persona for invented questions.
 * `any` = no bias (default). Other ids shape how questions are asked.
 */
export const INTERVIEWER_ROLES = [
  {
    id: "any",
    label: "Any",
    short: "Default",
    eyebrow: "Optional",
    hint: "No role bias — typical mixed interview questions.",
    prompt: "",
  },
  {
    id: "hr",
    label: "HR",
    short: "Screen",
    eyebrow: "Recruiter",
    hint: "Screening, motivation, culture, logistics.",
    prompt: `INTERVIEWER ROLE (strict): HR / recruiter screen.
- Write every invented "q" as if asked by an HR recruiter or talent partner — not a deep technical peer.
- Prefer: motivation & why this role/company, career narrative, culture/values fit, communication clarity, logistics/availability, high-level strengths & gaps.
- Avoid deep domain grill or system-architecture probes unless the JD clearly requires them in a screen.
- Tone: warm, structured, professional; questions should sound like a real phone/video screen.
- Answers should still be rehearse-ready for that screen — clear, concise, credible.`,
  },
  {
    id: "manager",
    label: "Line Manager",
    short: "HM",
    eyebrow: "Hiring mgr",
    hint: "Day-to-day ownership, delivery, team fit.",
    prompt: `INTERVIEWER ROLE (strict): Line manager / hiring manager.
- Write every invented "q" as if asked by the hiring manager who would manage this person day-to-day.
- Prefer: ownership of outcomes, how they work with the team, prioritization under constraints, stakeholder friction, role-specific judgment, what success looks like in the first 90 days.
- Probe for concrete examples the manager can trust — stakes, trade-offs, what YOU did.
- Tone: practical, direct, curious about how the candidate would operate on this team.
- Avoid pure HR logistics questions; keep culture questions tied to working style on the job.`,
  },
  {
    id: "exec",
    label: "Exec / VP",
    short: "VP+",
    eyebrow: "Leadership",
    hint: "Strategy, judgment, scale, executive presence.",
    prompt: `INTERVIEWER ROLE (strict): Executive / VP / President-level interviewer.
- Write every invented "q" as if asked by a senior leader (VP, director+, or president) — not a peer IC screen.
- Prefer: strategic judgment, trade-offs at scale, cross-org influence, leadership under ambiguity, risk & integrity calls, business impact, how the candidate thinks — not only what they did.
- Questions should feel high-altitude but still answerable with resume-backed stories (no trivia, no gotchas).
- Tone: calm, probing, senior — expects ownership language and clear thinking.
- Avoid checklist HR screens; avoid low-level task walkthroughs unless used to reveal judgment.`,
  },
];

export const DEFAULT_INTERVIEWER_ROLE = "any";

export function interviewerRoleById(id) {
  return (
    INTERVIEWER_ROLES.find((x) => x.id === id) ||
    INTERVIEWER_ROLES.find((x) => x.id === DEFAULT_INTERVIEWER_ROLE)
  );
}

export function normalizeInterviewerRole(id) {
  return interviewerRoleById(id).id;
}

/**
 * Multi-select rehearsal directions.
 * `ask` = what a hiring manager probes; `answer` = how to frame spoken answers;
 * `invent` = short bias line (kept for compatibility).
 */
export const QUESTION_FOCUSES = [
  {
    id: "leadership",
    label: "Leadership",
    hint: "Calls & ownership",
    invent: "leadership, ownership, hard decisions, coaching others",
    ask: "Hard decisions you owned; leading through conflict or ambiguity; coaching someone who was struggling; influence without formal authority.",
    answer:
      "Lead with the decision and stakes, then what YOU did (not “we”), then the outcome and what you’d repeat. Name trade-offs. Avoid generic “I’m a people person.”",
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
    invent: "execution under constraints, ops/SLA, prioritization, scale",
    ask: "Near-miss deadlines; prioritizing when everything is urgent; fixing a broken process; shipping with incomplete specs; owning a metric or SLA.",
    answer:
      "Situation → constraint → your actions → measurable result (only if resume supports numbers). Show judgment under pressure, not busywork.",
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
    hint: "Hard moments & recovery",
    invent: "unhappy customer, escalation, service recovery, trust rebuild",
    ask: "Turning around an unhappy customer; handling an escalation; rebuilding trust after a miss; balancing customer ask vs company constraint.",
    answer:
      "Name the emotion/stakes briefly, your listening + action, recovery steps, and the lasting fix — not just “I apologized.”",
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
    invent: "why this role/company/now; motivation grounded in evidence",
    ask: "Why this role; why this company; why now in your career; what in the JD matches your strongest proof points.",
    answer:
      "Tie motivation to specific JD priorities + 1–2 resume proofs. No flattery. Clear “why me / why now” without inventing company facts you don’t know.",
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
    invent: "honest gap / weakness / pivot reframes with transferable proof",
    ask: "Missing years or title vs JD; career pivot; skill you are still building; a real weakness with a fix-in-progress.",
    answer:
      "Name the gap honestly in one line, then transferable evidence from the resume, then how you’re closing it. Never fake experience or credentials.",
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
    invent: "cross-functional / HQ / partner alignment and conflict",
    ask: "Conflict with a stakeholder; aligning HQ vs local; pushing a decision across functions; managing a difficult partner.",
    answer:
      "Show how you read interests, what you negotiated, and how you protected the outcome — calm ownership, not blame.",
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
    invent: "values under pressure, integrity, working style, disagreement",
    ask: "Values tested under pressure; disagreeing with a manager; integrity call; how you work when the team is stressed.",
    answer:
      "One concrete moment > abstract values speech. Show the principle, the action, and the cost you accepted.",
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
    ask: "A judgment call in this domain; trade-off between tools/process options; teaching a non-expert; catching a risk others missed.",
    answer:
      "Explain the judgment in plain spoken language — what you knew, what you chose, why — tied only to tools/domains on the resume.",
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

/** Themes this interviewer persona tends to lean on (soft prior, not a hard lock). */
const ROLE_FOCUS_BIAS = {
  any: [],
  hr: ["rolefit", "culture", "gaps", "customer"],
  manager: ["delivery", "leadership", "stakeholder", "customer"],
  exec: ["leadership", "stakeholder", "domain", "rolefit"],
};

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
 * Optional interviewerRole adds a soft prior (who asks × what to rehearse).
 */
export function suggestFocusesFromText({
  resume = "",
  jd = "",
  interviewerRole = DEFAULT_INTERVIEWER_ROLE,
} = {}) {
  const blob = `${resume}\n${jd}`.toLowerCase();
  const role = normalizeInterviewerRole(interviewerRole);
  const roleBias = new Set(ROLE_FOCUS_BIAS[role] || []);
  const hasDocs = Boolean(blob.trim());

  if (!hasDocs) {
    if (roleBias.size) {
      return normalizeFocuses([...roleBias]).slice(0, 4);
    }
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
    // Soft prior from interviewer persona — never outweighs strong JD hits
    if (roleBias.has(f.id)) score += 2.5;
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

  if (picked.length < 3) {
    const fallback = roleBias.size
      ? [...roleBias, ...DEFAULT_FOCUSES]
      : [...DEFAULT_FOCUSES];
    return normalizeFocuses([...picked, ...fallback]).slice(0, 4);
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

/** Build the prompt block that steers invented Qs + answer framing. */
export function focusPromptBlock(focusIds) {
  const ids = normalizeFocuses(focusIds);
  const items = QUESTION_FOCUSES.filter((f) => ids.includes(f.id));
  const n = items.length;

  const detail = items
    .map(
      (f, i) => `${i + 1}. ${f.label.toUpperCase()}
   Probe for: ${f.ask}
   Answer craft: ${f.answer}`
    )
    .join("\n");

  return `QUESTION DIRECTIONS — selected by the candidate (${n}). These are REQUIRED rehearsal themes, not soft suggestions.

COVERAGE (invented extras only — after mandatory 3 and any user target add-ons):
- Aim for at least one invented question per selected direction when inventing 5+ extras.
- If inventing fewer extras than selected directions, cover the highest-priority directions first (order listed below).
- Do not invent duplicate questions that only rephrase the same probe.
- Mandatory intros / self-intro may lightly echo role-fit; do not force every direction into the mandatory 3.

ANSWER FRAMING:
- When a question maps to a selected direction, shape the spoken answer with that direction's "Answer craft".
- Stay truthful to the resume. Prefer ownership language ("I led…", "I decided…").
- Score for substance + structure: one clear story beat, concrete action, believable result — not buzzwords.

SELECTED DIRECTIONS (in priority order):
${detail}`;
}
