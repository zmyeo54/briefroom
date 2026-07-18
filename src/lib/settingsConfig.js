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

/**
 * Pinned versioned ID — do not use `-latest` aliases; Google hot-swaps those
 * to newer (often pricier) models without your code changing.
 */
export const PINNED_GEMINI_MODEL = "gemini-2.5-flash-lite";

/** @deprecated use PINNED_GEMINI_MODEL */
export const GEMINI_MODELS = [{ id: PINNED_GEMINI_MODEL, label: "2.5 Flash-Lite" }];

export const DEFAULT_MODEL = PINNED_GEMINI_MODEL;

/** Which server-side LLM to prefer (sent on each /api/chat request). */
export const AI_PROVIDERS = [
  { id: "antigravity" },
  { id: "gemini" },
  { id: "deepseek" },
];
/** Default try order: Antigravity → Gemini → DeepSeek (global + Greater China). */
export const AI_PROVIDER_ORDER = AI_PROVIDERS.map((p) => p.id);
export const DEFAULT_AI_PROVIDER = "antigravity";
export const AI_PROVIDER_IDS = AI_PROVIDER_ORDER;

/** @deprecated region was a proxy for provider — kept for stored settings / headers */
export const AI_REGIONS = [
  { id: "global" },
  { id: "greater-china" },
];
export const DEFAULT_AI_REGION = "global";
const GREATER_CHINA_COUNTRIES = new Set(["CN", "HK"]);

export function isGreaterChinaCountry(country) {
  return GREATER_CHINA_COUNTRIES.has(String(country || "").toUpperCase());
}

export function normalizeAiRegion(raw) {
  const id = String(raw || "").toLowerCase();
  if (
    id === "greater-china" ||
    id === "greaterchina" ||
    id === "china" ||
    id === "cn" ||
    id === "hk" ||
    id === "deepseek"
  ) {
    return "greater-china";
  }
  return "global";
}

export function normalizeAiProvider(raw) {
  const id = String(raw || "").toLowerCase();
  if (id === "deepseek") return "deepseek";
  if (id === "antigravity") return "antigravity";
  if (id === "gemini") return "gemini";
  return DEFAULT_AI_PROVIDER;
}

export function providerToRegion(provider) {
  return normalizeAiProvider(provider) === "deepseek"
    ? "greater-china"
    : "global";
}

/** i18n key for a provider display name. */
export function aiProviderLabelKey(provider) {
  return `settings.aiProvider.${normalizeAiProvider(provider)}`;
}

/**
 * Enabled providers: preferred first, then the rest in AI_PROVIDER_ORDER
 * (Antigravity → Gemini → DeepSeek).
 */
export function enabledAiProviders(settings = {}) {
  const preferred = normalizeAiProvider(settings.aiProvider);
  const flags = {
    antigravity: settings.antigravityEnabled !== false,
    gemini: settings.geminiEnabled !== false,
    deepseek: settings.deepseekEnabled !== false,
  };
  const on = AI_PROVIDER_ORDER.filter((p) => flags[p]);
  if (!on.length) return [];
  if (!on.includes(preferred)) return on;
  return [preferred, ...on.filter((p) => p !== preferred)];
}

/** Antigravity for everyone unless the user chose Prefer manually. */
export function aiProviderForGeo(_country, settings = {}) {
  if (settings.aiProviderManual || settings.aiRegionManual) {
    return normalizeAiProvider(settings.aiProvider || settings.aiRegion);
  }
  return DEFAULT_AI_PROVIDER;
}

/** @deprecated use aiProviderForGeo */
export function aiRegionForGeo(country, settings = {}) {
  return providerToRegion(aiProviderForGeo(country, settings));
}

/** Single pinned model — no silent fallback to a costlier tier. */
export function geminiModelsToTry(preferred = DEFAULT_MODEL) {
  const model =
    preferred === PINNED_GEMINI_MODEL ? PINNED_GEMINI_MODEL : DEFAULT_MODEL;
  return [model];
}

/**
 * Retry another model only when this model is missing/unsupported.
 * Never on 429/quota — that multiplies daily request burn.
 */
export function shouldTryNextGeminiModel(status, data) {
  if (status === 429) return false;
  if (status === 404) return true;
  const msg = String(
    data?.error?.message ||
      data?.error?.status ||
      (typeof data?.error === "string" ? data.error : "") ||
      ""
  );
  if (/quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg)) return false;
  return /no longer available|not found|not supported/i.test(msg);
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
  aiProvider: DEFAULT_AI_PROVIDER,
  aiProviderManual: false,
  geminiEnabled: true,
  deepseekEnabled: true,
  antigravityEnabled: true,
  // synced from aiProvider — legacy clients / geo still read these
  aiRegion: DEFAULT_AI_REGION,
  aiRegionManual: false,
};

export function normalizeSettings(raw) {
  const merged = { ...defaultSettings, ...(raw || {}) };
  merged.baseUrl = GEMINI_BASE;
  // Always lock to pinned cheapest model — no picker, no `-latest` drift
  merged.model = PINNED_GEMINI_MODEL;
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
  // Prefer explicit aiProvider; else migrate from legacy aiRegion
  if (incoming.aiProvider != null && String(incoming.aiProvider).trim()) {
    merged.aiProvider = normalizeAiProvider(incoming.aiProvider);
  } else {
    merged.aiProvider = normalizeAiProvider(merged.aiRegion);
  }
  merged.aiProviderManual = Boolean(
    merged.aiProviderManual || merged.aiRegionManual
  );
  merged.geminiEnabled = merged.geminiEnabled !== false;
  merged.deepseekEnabled = merged.deepseekEnabled !== false;
  merged.antigravityEnabled = merged.antigravityEnabled !== false;
  // Keep region in sync so geo / old headers stay consistent
  merged.aiRegion = providerToRegion(merged.aiProvider);
  merged.aiRegionManual = merged.aiProviderManual;

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
