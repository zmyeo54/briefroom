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
export const MAX_DOC_CHARS = 6000;

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
export const SYSTEM_PROMPT_VERSION = "linecheck-job-interview-v4";

export const DEFAULT_SYSTEM = `You are Line Check (对词间), a senior job-interview coach preparing a real hiring-process rehearsal.

Mission:
- Help the candidate rehearse spoken answers for a live job interview (phone screen, hiring manager, or panel).
- Write answers the candidate can say out loud from memory — natural speech, not essay prose.
- Sound calm, confident, and specific. Prefer ownership language ("I led…", "I decided…") over buzzwords.
- Stay strictly truthful to the resume: never invent employers, titles, degrees, dates, metrics, tools, or achievements.
- Align every answer to the job description's priorities, level, and vocabulary when the resume supports it.
- If there is a gap (title mismatch, short tenure, missing skill), address it honestly and reframe with transferable evidence — never fake experience.
- Prefer concrete examples with situation → action → result when helpful; quantify only when the resume supports numbers.
- Obey answer-length, language, identity, and QUESTION DIRECTIONS in the user prompt — selected themes must shape invented questions and answer framing.
- Answer length mode is hard: Brief / Standard / Deep budgets in the user prompt apply to every "a". Do not ignore them.

Interview craft:
- Questions should sound like a real interviewer for this role — clear, professional, not trick questions.
- Answers should be rehearse-ready: short sentences, spoken rhythm, one clear point per beat.
- Avoid empty claims ("passionate", "synergy", "results-driven") unless tied to a concrete example.
- Do not coach the candidate to lie, bluff credentials, or attack previous employers.
- Prefer evidence a hiring manager can trust: ownership, stakes, trade-offs, result — over vague strengths lists.

Output rules (strict):
- Return valid JSON only — no markdown fences, no commentary outside JSON.
- Exact shape: {"items":[{"q":"...","a":"..."}]}
- Order: (1) mandatory questions first, (2) user target add-ons next, (3) invented extras last.
- Invented extras must cover the selected QUESTION DIRECTIONS as specified in the user prompt.
- Every "q" and "a" must obey the interview-language rules in the user prompt.
- [${SYSTEM_PROMPT_VERSION}]`;

function languageBlock(lang) {
  if (lang === "zh") {
    return `INTERVIEW LANGUAGE (strict): 中文 only.
- 每一道题的 "q" 必须用自然、口语化的中文写（真实面试官会怎么问）。
- 每一道题的 "a" 必须用自然、专业、口语化的中文写，适合当场口述背诵。
- Do not include English in q or a (except unavoidable proper nouns / company names / tech terms).`;
  }
  if (lang === "both") {
    return `INTERVIEW LANGUAGE (strict): Bilingual mix — English first, then Chinese.
- For every "q": English question first, then " / ", then the Chinese question.
- For every "a": write the full English answer first, then a blank line, then the full Chinese answer.
- Both languages must be complete, parallel in meaning, and speakable — do not leave either half empty or abbreviated.`;
  }
  return `INTERVIEW LANGUAGE (strict): English only.
- Write every "q" in natural professional English, as a hiring interviewer would ask it.
- Write every "a" in natural professional English suitable for spoken rehearsal.
- Do not include Chinese in q or a.`;
}

export function buildUserPrompt({
  resume,
  jd,
  questions,
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
  const g = String(gender || "").toLowerCase() === "female" ? "female" : "male";
  const name = String(candidateName || "").trim();

  const identityBlock = name
    ? `CANDIDATE IDENTITY (strict):
- Name on resume: ${name}
- Gender: ${g}
- When the candidate states their name (intro / self-intro), use exactly "${name}" — never invent another name.
- Keep answers in first person. If a third-person pronoun is needed, use ${g === "female" ? "she/her" : "he/him"}.
- Do not invent a different spelling or nickname.`
    : `CANDIDATE IDENTITY:
- Gender: ${g}
- Do not invent a personal name. If a name is required, use only what appears on the resume.
- Keep answers in first person. If a third-person pronoun is needed, use ${g === "female" ? "she/her" : "he/him"}.`;

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
    addonBlock = `TARGET ADD-ONS — user-requested extras. They MUST appear immediately after the mandatory 3 (items 4–${3 + addons.length}), pinned in this order. Rewrite into the interview language if needed, then answer in that same language. Do NOT drop any of them:\n${addons
      .map((q, i) => `${i + 4}. ${q}`)
      .join("\n")}`;
  }

  let inventBlock = "";
  if (autoQuestions) {
    inventBlock = addons.length
      ? `Then invent exactly ${extras} more realistic job-interview questions for THIS role AFTER the target add-ons (starting at item ${startExtra}). Each invented question must clearly map to one of the SELECTED QUESTION DIRECTIONS below (cover as many directions as practical; label the intent in your reasoning but do NOT put labels in the JSON). Prefer questions ${asker} would actually ask for this JD. ${inventLang}`
      : `Then invent exactly ${extras} more realistic job-interview questions for THIS role (after the mandatory 3). Each invented question must clearly map to one of the SELECTED QUESTION DIRECTIONS below (cover as many directions as practical; at least one per direction when extras ≥ focus count). Prefer questions ${asker} would actually ask for this JD. ${inventLang}`;
  } else if (!addons.length) {
    inventBlock = `Then invent exactly 3 additional realistic job-interview questions for THIS role after the mandatory 3. Map each invented question to a SELECTED QUESTION DIRECTION below. Prefer questions ${asker} would actually ask for this JD. ${inventLang}`;
  }

  const roleBlock = role.prompt ? `${role.prompt}\n` : "";

  return `Prepare spoken job-interview Q&A for this candidate applying to the role in the job description.

Context:
- This is rehearsal for a real hiring interview, not a generic chat or essay.
- Ground every answer in the resume. Mirror the JD's priorities only where the resume supports them.
- Invented questions must be role-relevant (scope, stakeholders, delivery, judgment) — not trivia.
- The interviewer persona for invented questions is: ${role.label}${role.id === "any" ? " (no specific bias)" : ""}.

${languageBlock(lang)}

${identityBlock}

${length.prompt}

${roleBlock}${focusPromptBlock(focusIds)}

MANDATORY — these 3 questions MUST be items 1–3 in the JSON, in this exact order (keep this wording / language):
${mandatoryBlock}

${addonBlock}

${inventBlock}

Quality bar:
- Target questions are ADD-ONS on top of the mandatory set — never replace the mandatory 3.
- LENGTH IS MANDATORY: every "a" must match ${length.label} (~${length.speakSeconds}, ≤~${length.maxWords} words${lang === "both" ? " per language" : ""}). Brief stays short; Deep uses the fuller budget; do not blur modes.
- Invented extras MUST reflect the selected QUESTION DIRECTIONS (coverage + answer craft above).
- Invented "q" lines MUST sound like ${asker} — not a generic chatbot.
- Frame answers toward the matching direction when relevant; keep mandatory answers truthful and speakable.
- Tone: calm, clear, ownership-focused${role.id === "exec" ? "; senior-executive presence" : role.id === "hr" ? "; screen-friendly clarity" : ""}.
- No overselling, no empty buzzwords, no fabricated metrics.
- Return STRICT JSON only: {"items":[{"q":"...","a":"..."}]}
- Every item's "q" and "a" must obey INTERVIEW LANGUAGE above.

RESUME:
${clipDoc(resume)}

JOB DESCRIPTION:
${clipDoc(jd)}`;
}

export function previewPrompt(opts) {
  return buildUserPrompt({
    ...opts,
    resume: opts.resume?.trim() ? opts.resume : "[resume will be inserted here]",
    jd: opts.jd?.trim() ? opts.jd : "[job description will be inserted here]",
  });
}
