import {
  filterTargetAddons,
  mandatoryQuestionText,
} from "./mandatoryQuestions";
import {
  answerLengthById,
  DEFAULT_ANSWER_LENGTH,
  DEFAULT_FOCUSES,
  DEFAULT_INTERVIEWER_ROLE,
  focusPromptBlock,
  interviewerRoleById,
  normalizeFocuses,
  normalizeInterviewerRole,
} from "./interviewModes";

/** Default system + user prompt templates used for Q&A generation. */

/** How many AI-invented extras to draft (on top of mandatory 3 + user targets). */
export const INVENT_COUNTS = [3, 5, 7, 10];
/** Fewer extras = fewer output tokens per generate (free-tier TPM/RPD). */
export const DEFAULT_INVENT_COUNT = 3;

/** Cap pasted docs — long resume+JD dominates input tokens. */
export const MAX_DOC_CHARS = 4500;

export function clipDoc(text, max = MAX_DOC_CHARS) {
  const t = String(text || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n…[truncated for length]`;
}

/** Bound completion size from Q count × answer mode × language. */
export function estimateMaxTokens({
  lang,
  answerLength,
  inventCount,
  addonCount = 0,
  autoQuestions = true,
}) {
  const extras = autoQuestions
    ? normalizeInventCount(inventCount)
    : addonCount
      ? 0
      : 3;
  const items = 3 + Number(addonCount || 0) + extras;
  const length = answerLengthById(answerLength);
  // ~1.35 tokens/word + short "q"; Mix doubles answer body
  const words = Number(length.maxWords) || 160;
  const perItem = Math.ceil(words * 1.35) + 48;
  const mult = lang === "both" ? 2 : 1;
  const floor = answerLength === "brief" ? 512 : 768;
  return Math.min(8192, Math.max(floor, Math.ceil(items * perItem * mult) + 64));
}

export function normalizeInventCount(raw) {
  const n = Number(raw);
  return INVENT_COUNTS.includes(n) ? n : DEFAULT_INVENT_COUNT;
}

/** Bump this string when DEFAULT_SYSTEM changes so stored settings auto-upgrade. */
export const SYSTEM_PROMPT_VERSION = "linecheck-job-interview-v9";

export const DEFAULT_SYSTEM = `You are Line Check (对词间), a senior interview coach. Produce spoken Q&A a candidate can rehearse and memorize.

Rules:
- Truthful to resume only — never invent employers, titles, degrees, dates, metrics, or tools.
- Answers must sound natural spoken aloud: short sentences, ownership language ("I led…"), one point per beat.
- Align answers to JD priorities where resume supports it. Address gaps honestly with transferable evidence.
- Use situation → action → result when helpful. Quantify only when resume has numbers.
- No empty claims ("passionate", "synergy") without concrete examples. No lying, bluffing, or attacking ex-employers.
- Obey answer-length budget, language, identity, and QUESTION DIRECTIONS from the user prompt exactly.

Mindmap per answer — extract THIS answer's actual facts into "map":
- topic: the specific claim (e.g. "Led Odoo migration for 3 APAC teams", NOT "Leadership experience").
- branches: 3-5 concrete points from the answer — project names, metrics, stakeholders, tools, results. Each has label + detail + example.
- Extract only what's in the answer. Never generalize or add advice.
- Bilingual/Mix: provide topicZh and labelZh for every branch.

JSON output (strict, no markdown fences):
{"jobTitle":"...","company":"...","items":[{"q":"...","a":"...","category":"...","map":{"topic":"...","topicZh":"...","branches":[{"label":"...","labelZh":"...","detail":"...","example":"..."}]}}]}
jobTitle = concise role name only (≤80 chars, no location/applicants/UI chrome). company = employer name only.
Category: "foundation" (mandatory 1-3), "addon" (user targets), or direction id ("leadership"/"delivery"/"customer"/"rolefit"/"gaps"/"stakeholder"/"culture"/"domain") for invented extras.
Order: foundation → addon → extras. Extras must cover selected QUESTION DIRECTIONS.
[${SYSTEM_PROMPT_VERSION}]`;

function languageBlock(lang) {
  if (lang === "zh") {
    return `LANGUAGE: 中文 only. Questions and answers in natural spoken Chinese. English only for proper nouns/tech terms.`;
  }
  if (lang === "both") {
    return `LANGUAGE: Bilingual. q = English / Chinese. a = full English answer, blank line, full Chinese answer. Both complete and parallel.`;
  }
  return `LANGUAGE: English only. Natural professional English for spoken rehearsal. No Chinese.`;
}

export function buildUserPrompt({
  resume,
  jd,
  questions,
  skills,
  lang,
  autoQuestions,
  inventCount = DEFAULT_INVENT_COUNT,
  answerLength = DEFAULT_ANSWER_LENGTH,
  focuses = DEFAULT_FOCUSES,
  interviewerRole = DEFAULT_INTERVIEWER_ROLE,
  candidateName = "",
  gender = "male",
}) {
  const length = answerLengthById(answerLength);
  const role = interviewerRoleById(normalizeInterviewerRole(interviewerRole));
  const focusIds = normalizeFocuses(focuses);
  const extras = normalizeInventCount(inventCount);
  const skillLines = String(skills || "")
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const skillsBlock = skillLines.length
    ? `SKILLS (shape Q&A where resume supports):\n${skillLines.join("\n")}`
    : "";
  const g = String(gender || "").toLowerCase() === "female" ? "female" : "male";
  const name = String(candidateName || "").trim();

  const identityBlock = name
    ? `CANDIDATE: ${name} (${g}). Use this exact name in intros. First person. Pronouns: ${g === "female" ? "she/her" : "he/him"}.`
    : `CANDIDATE: ${g}. Do not invent a name. First person. Pronouns: ${g === "female" ? "she/her" : "he/him"}.`;

  const mandatory = mandatoryQuestionText(lang);
  const mandatoryBlock = mandatory
    .map((q, i) => `${i + 1}. ${q}`)
    .join("\n");

  const addons = filterTargetAddons(questions);
  const startExtra = 4 + addons.length;

  const inventLang =
    lang === "zh"
      ? "额外题目也必须用中文提问。"
      : lang === "both"
        ? "Invent additional questions in bilingual form (English / Chinese)."
        : "Invent additional questions in English only.";

  const asker =
    role.id === "hr"
      ? "an HR recruiter / talent partner"
      : role.id === "manager"
        ? "the line / hiring manager"
        : role.id === "exec"
          ? "a VP / executive / president-level interviewer"
          : "a hiring interviewer for this role";

  let addonBlock = "";
  if (addons.length) {
    addonBlock = `ADD-ONS (items 4–${3 + addons.length}, pinned order, do NOT drop):\n${addons
      .map((q, i) => `${i + 4}. ${q}`)
      .join("\n")}`;
  }

  let inventBlock = "";
  if (autoQuestions) {
    inventBlock = addons.length
      ? `Invent ${extras} more questions after add-ons (item ${startExtra}+). Map to QUESTION DIRECTIONS below. Sound like ${asker}. ${inventLang}`
      : `Invent ${extras} more questions after mandatory 3. Map to QUESTION DIRECTIONS (≥1 per direction when extras ≥ directions). Sound like ${asker}. ${inventLang}`;
  } else if (!addons.length) {
    inventBlock = `Invent 3 more questions after mandatory 3. Map to QUESTION DIRECTIONS. Sound like ${asker}. ${inventLang}`;
  }

  const roleBlock = role.prompt ? `${role.prompt}\n` : "";

  return `Interview rehearsal Q&A. Ground answers in resume. Mirror JD priorities where resume supports.

${languageBlock(lang)}

${identityBlock}

${length.prompt}

${roleBlock}${skillsBlock ? `${skillsBlock}\n\n` : ""}${focusPromptBlock(focusIds)}

MANDATORY (items 1–3, exact order, keep wording):
${mandatoryBlock}

${addonBlock}

${inventBlock}

LENGTH HARD: every "a" = ${length.label} (≤${length.maxWords} words${lang === "both" ? " per lang" : ""}). Do not blur modes.
Tone: calm, ownership${role.id === "exec" ? ", exec presence" : role.id === "hr" ? ", screen-friendly" : ""}. No buzzwords or fabricated metrics.
Maps: 3-5 key points per answer, short labels, no new claims. Every item needs "category".
Also set top-level jobTitle (short role name only) and company from the JD — strip LinkedIn chrome (applicants, Apply, Save, etc).

RESUME:
${clipDoc(resume)}

JOB DESCRIPTION:
${clipDoc(jd)}`;
}

/**
 * Parse model JSON output resiliently — handles trailing commas, 
 * truncated JSON, and common LLM quirks.
 *
 * 1. Try JSON.parse directly
 * 2. Try extracting JSON from within backticks or braces
 * 3. Try stripping trailing commas before trailing } or ]
 * 4. Try repairing truncated JSON (close open brackets/braces)
 */
export function parseModelJson(raw) {
  const str = String(raw || "").trim();
  if (!str) throw new Error("Empty model response");

  // Direct parse
  try {
    return JSON.parse(str);
  } catch {
    /* fall through */
  }

  // Try extracting JSON from markdown fences (```json ... ```)
  const fenceMatch = str.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {
      /* fall through */
    }
  }

  // Try extracting the outermost {...} block
  const braceMatch = str.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    const candidate = braceMatch[0];
    // Strip trailing commas before ] or }
    const cleaned = candidate
      .replace(/,(\s*[}\]])/g, "$1")     // remove trailing commas in arrays/objects
      .replace(/,\s*$/, "");             // remove trailing comma at end
    try {
      return JSON.parse(cleaned);
    } catch {
      /* fall through — try to repair truncation */
    }

    // Try repairing truncated JSON: close unclosed brackets
    const repaired = repairTruncatedJson(cleaned);
    if (repaired !== cleaned) {
      try {
        return JSON.parse(repaired);
      } catch {
        /* final fall through */
      }
    }
  }

  throw new Error("Model did not return valid JSON");
}

/** Attempt to close unclosed brackets/braces in truncated JSON. */
function repairTruncatedJson(str) {
  const stack = [];
  const pairs = { "{": "}", "[": "]", '"': '"' };
  const openers = new Set(["{", "[", '"']);
  let inString = false;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") {
      stack.push(ch);
    } else if (ch === "}" || ch === "]") {
      if (stack.length > 0) {
        const last = stack[stack.length - 1];
        if ((ch === "}" && last === "{") || (ch === "]" && last === "[")) {
          stack.pop();
        }
      }
    }
  }

  // Close remaining open brackets in reverse
  let result = str.replace(/[,\s]*$/, ""); // trim trailing comma/space
  for (let i = stack.length - 1; i >= 0; i--) {
    result += pairs[stack[i]];
  }
  return result;
}

export function previewPrompt(opts) {
  return buildUserPrompt({
    ...opts,
    resume: opts.resume?.trim() ? opts.resume : "[resume will be inserted here]",
    jd: opts.jd?.trim() ? opts.jd : "[job description will be inserted here]",
    skills: opts.skills || "",
  });
}
