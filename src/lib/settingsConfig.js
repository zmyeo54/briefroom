import { DEFAULT_SYSTEM, SYSTEM_PROMPT_VERSION } from "./prompt";
import {
  DEFAULT_ANSWER_LENGTH,
  DEFAULT_FOCUSES,
  DEFAULT_INTERVIEWER_ROLE,
  ANSWER_LENGTHS,
  normalizeFocuses,
  normalizeInterviewerRole,
} from "./interviewModes";
import { DEFAULT_UI_LANG, normalizeUiLang } from "./i18n";
import { normalizeGender } from "./candidate";
import {
  DEFAULT_VOICE_A,
  DEFAULT_VOICE_Q,
  TTS_VOICES,
  normalizeVoiceId,
  pickVoiceFor,
} from "./tts";

export const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/openai";

/** Interview language — drives both question and answer text */
export const INTERVIEW_LANGS = [
  {
    id: "en",
    label: "English",
    short: "EN",
    hint: "Full interview in English",
    detail: "Q&A in English",
    eyebrow: "Default",
  },
  {
    id: "zh",
    label: "中文",
    short: "ZH",
    hint: "整场问答用中文口述",
    detail: "全程中文问答",
    eyebrow: "Mandarin",
  },
  {
    id: "both",
    label: "Mix",
    short: "Both",
    hint: "English first, then 中文",
    detail: "English → 中文",
    eyebrow: "Bilingual",
  },
];

export function interviewLangLabel(id) {
  return INTERVIEW_LANGS.find((l) => l.id === id)?.label || id;
}

/** Candidate gender → answer voice; opposite gender → interviewer. */
export function pickDefaultPair(lang, gender = "male") {
  const candidate = normalizeGender(gender);
  const interviewer = candidate === "male" ? "female" : "male";
  return {
    voiceQ: pickVoiceFor(lang, interviewer),
    voiceA: pickVoiceFor(lang, candidate),
  };
}

function sameLangFamily(voiceId, lang) {
  const v = TTS_VOICES.find((x) => x.id === normalizeVoiceId(voiceId));
  if (!v) return false;
  if (lang === "en") return v.lang === "en";
  if (lang === "zh") return v.lang === "zh";
  return true;
}

/** Align Q/A voices to interview language; keep gender when possible. */
export function voicesForInterviewLang(lang, voiceQ, voiceA, gender = "male") {
  const defaults = pickDefaultPair(lang, gender);
  let nextQ = normalizeVoiceId(voiceQ);
  let nextA = normalizeVoiceId(voiceA);

  if (!sameLangFamily(nextQ, lang)) nextQ = defaults.voiceQ;
  if (!sameLangFamily(nextA, lang)) nextA = defaults.voiceA;

  if (nextQ === nextA) {
    nextA =
      defaults.voiceA !== nextQ
        ? defaults.voiceA
        : TTS_VOICES.find((v) => v.id !== nextQ && sameLangFamily(v.id, lang))
            ?.id || nextA;
  }

  return { voiceQ: nextQ, voiceA: nextA };
}

/** @deprecated */
export function voiceForInterviewLang(lang, currentVoice) {
  const { voiceA } = voicesForInterviewLang(lang, currentVoice, currentVoice);
  return voiceA;
}

/** Light / free-tier friendly models — cheapest first; last is a stable alias. */
export const GEMINI_MODELS = [
  {
    id: "gemini-2.5-flash-lite",
    label: "2.5 Flash-Lite (default · free · lightest)",
  },
  {
    id: "gemini-2.0-flash-lite",
    label: "2.0 Flash-Lite (free · light)",
  },
  {
    id: "gemini-2.0-flash",
    label: "2.0 Flash (free · balanced)",
  },
  {
    id: "gemini-flash-latest",
    label: "Flash latest (fallback)",
  },
];

export const DEFAULT_MODEL = GEMINI_MODELS[0].id;

/** Preferred model first, then the rest — for 429 / unavailable fallback. */
export function geminiModelsToTry(preferred = DEFAULT_MODEL) {
  const ids = GEMINI_MODELS.map((m) => m.id);
  const first = ids.includes(preferred) ? preferred : DEFAULT_MODEL;
  return [first, ...ids.filter((id) => id !== first)];
}

/** Retry another model on quota / missing model — not on auth or bad-request. */
export function shouldTryNextGeminiModel(status, data) {
  if (status === 429 || status === 404) return true;
  const msg = String(
    data?.error?.message ||
      data?.error?.status ||
      (typeof data?.error === "string" ? data.error : "") ||
      ""
  );
  return /quota|rate.?limit|RESOURCE_EXHAUSTED|no longer available|not found|not supported/i.test(
    msg
  );
}

/** Build-time Vite env (local .env.local / Vercel VITE_* at build). */
export function getSavedApiKey() {
  return String(import.meta.env.VITE_GEMINI_API_KEY || "").trim();
}

/** User-pasted key wins; otherwise fall back to build-time env. */
export function resolveApiKey(settings) {
  const user = String(settings?.apiKey || "").trim();
  if (user) return user;
  return getSavedApiKey();
}

export const defaultSettings = {
  apiKey: "",
  baseUrl: GEMINI_BASE,
  model: DEFAULT_MODEL,
  lang: "en",
  uiLang: DEFAULT_UI_LANG,
  name: "",
  gender: "male",
  voiceQ: DEFAULT_VOICE_Q,
  voiceA: DEFAULT_VOICE_A,
  rate: 1,
  answerLength: DEFAULT_ANSWER_LENGTH,
  interviewerRole: DEFAULT_INTERVIEWER_ROLE,
  focuses: [...DEFAULT_FOCUSES],
  systemPrompt: DEFAULT_SYSTEM,
};

export function normalizeSettings(raw) {
  const merged = { ...defaultSettings, ...(raw || {}) };
  merged.baseUrl = GEMINI_BASE;
  // Always lock to the default free model — no picker in UI
  merged.model = DEFAULT_MODEL;
  if (!INTERVIEW_LANGS.some((l) => l.id === merged.lang)) {
    merged.lang = "en";
  }
  merged.uiLang = normalizeUiLang(merged.uiLang);
  merged.name = String(merged.name || "").trim().slice(0, 80);
  merged.gender = normalizeGender(merged.gender);

  // Migrate single `voice` → voiceQ / voiceA
  const incoming = raw || {};
  if (incoming.voice && !incoming.voiceQ && !incoming.voiceA) {
    const legacy = normalizeVoiceId(incoming.voice);
    const defaults = pickDefaultPair(merged.lang, merged.gender);
    merged.voiceA = legacy;
    merged.voiceQ =
      legacy === defaults.voiceA ? defaults.voiceQ : defaults.voiceQ;
    if (merged.voiceQ === merged.voiceA) merged.voiceQ = defaults.voiceQ;
  }

  merged.voiceQ = normalizeVoiceId(merged.voiceQ || DEFAULT_VOICE_Q);
  merged.voiceA = normalizeVoiceId(merged.voiceA || DEFAULT_VOICE_A);
  delete merged.voice;

  const pair = voicesForInterviewLang(
    merged.lang,
    merged.voiceQ,
    merged.voiceA,
    merged.gender
  );
  merged.voiceQ = pair.voiceQ;
  merged.voiceA = pair.voiceA;

  if (!ANSWER_LENGTHS.some((x) => x.id === merged.answerLength)) {
    merged.answerLength = DEFAULT_ANSWER_LENGTH;
  }
  merged.interviewerRole = normalizeInterviewerRole(merged.interviewerRole);
  merged.focuses = normalizeFocuses(merged.focuses);

  // Keep apiKey as the user override only — empty means "use env / server key".
  // (Previously we refilled from VITE_ here, which made Clear impossible.)
  merged.apiKey = String(merged.apiKey || "").trim();
  // Upgrade legacy / outdated system prompts to the current job-interview default
  const sp = merged.systemPrompt?.trim() || "";
  if (
    !sp ||
    !sp.includes(SYSTEM_PROMPT_VERSION) ||
    sp === "You help candidates prepare interview answers. Always return valid JSON only."
  ) {
    merged.systemPrompt = DEFAULT_SYSTEM;
  }
  return merged;
}
