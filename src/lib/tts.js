/** Edge TTS via local server — separate Q/A voices. */

let currentAudio = null;
let currentUrl = null;
let playToken = 0;

/** In-memory MP3 cache — replay / re-export skips Edge round-trips. */
const audioCache = new Map();
const CACHE_MAX = 100;
const FETCH_CONCURRENCY = 3;

export const TTS_VOICES = [
  {
    id: "zh-xiaoxiao-news",
    label: "中文女声 · Xiaoxiao",
    lang: "zh",
    gender: "female",
  },
  {
    id: "zh-yunyang-news",
    label: "中文男声 · Yunyang",
    lang: "zh",
    gender: "male",
  },
  {
    id: "zh-xiaoyi-news",
    label: "中文女声 · Xiaoyi",
    lang: "zh",
    gender: "female",
  },
  {
    id: "zh-yunjian-news",
    label: "中文男声 · Yunjian",
    lang: "zh",
    gender: "male",
  },
  {
    id: "en-aria-news",
    label: "English · Aria",
    lang: "en",
    gender: "female",
  },
  {
    id: "en-jenny-news",
    label: "English · Jenny",
    lang: "en",
    gender: "female",
  },
  {
    id: "en-guy-news",
    label: "English · Guy",
    lang: "en",
    gender: "male",
  },
  {
    id: "en-davis-news",
    label: "English · Davis",
    lang: "en",
    gender: "male",
  },
];

/** Interviewer / question default (male candidate → female interviewer) */
export const DEFAULT_VOICE_Q = "en-aria-news";
/** Candidate / answer default (male) */
export const DEFAULT_VOICE_A = "en-guy-news";
/** @deprecated use DEFAULT_VOICE_A */
export const DEFAULT_VOICE = DEFAULT_VOICE_A;

export function voiceGender(id) {
  const v = TTS_VOICES.find((x) => x.id === normalizeVoiceId(id));
  return v?.gender === "female" ? "female" : "male";
}

export function pickVoiceFor(lang, gender) {
  const want = gender === "female" ? "female" : "male";
  const family =
    lang === "zh"
      ? TTS_VOICES.filter((v) => v.lang === "zh")
      : TTS_VOICES.filter((v) => v.lang === "en");
  return (
    family.find((v) => v.gender === want)?.id ||
    family[0]?.id ||
    (want === "female" ? DEFAULT_VOICE_Q : DEFAULT_VOICE_A)
  );
}

/** Same role (interviewer/candidate gender), opposite language family. */
export function voiceForLangFamily(voiceId, targetLang) {
  const gender = voiceGender(voiceId);
  const want = targetLang === "zh" ? "zh" : "en";
  const current = TTS_VOICES.find((x) => x.id === normalizeVoiceId(voiceId));
  if (current?.lang === want) return normalizeVoiceId(voiceId);
  return pickVoiceFor(want, gender);
}

/**
 * Split Mix-mode text into English + Chinese halves.
 * Supports "EN / 中文" questions and blank-line / script-run answers.
 */
export function splitBilingualText(text) {
  const raw = String(text || "").trim();
  if (!raw) return { en: "", zh: "" };

  const slash = raw.match(/^([\s\S]+?)\s+\/\s+([\s\S]+)$/);
  if (slash) {
    const left = slash[1].trim();
    const right = slash[2].trim();
    const leftZh = /[\u4e00-\u9fff]/.test(left);
    const rightZh = /[\u4e00-\u9fff]/.test(right);
    if (!leftZh && rightZh) return { en: left, zh: right };
    if (leftZh && !rightZh) return { en: right, zh: left };
    return { en: left, zh: right };
  }

  const parts = raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const enParts = [];
    const zhParts = [];
    for (const p of parts) {
      const zhChars = (p.match(/[\u4e00-\u9fff]/g) || []).length;
      const latin = (p.match(/[A-Za-z]/g) || []).length;
      // "你好，我是 Alex。" → zh wins (CJK present, not Latin-dominant)
      if (zhChars >= 2 && zhChars >= latin * 0.5) zhParts.push(p);
      else enParts.push(p);
    }
    if (enParts.length && zhParts.length) {
      return { en: enParts.join("\n\n"), zh: zhParts.join("\n\n") };
    }
  }

  const hasLatin = /[A-Za-z]{3,}/.test(raw);
  const zhStart = raw.search(/[\u4e00-\u9fff]/);
  // English then Chinese in one block (threshold was 24 — missed short intros)
  if (zhStart > 0 && hasLatin) {
    return {
      en: raw.slice(0, zhStart).trim(),
      zh: raw.slice(zhStart).trim(),
    };
  }
  const latinStart = raw.search(/[A-Za-z]{3,}/);
  if (latinStart > 0 && /[\u4e00-\u9fff]/.test(raw.slice(0, latinStart))) {
    return {
      zh: raw.slice(0, latinStart).trim(),
      en: raw.slice(latinStart).trim(),
    };
  }

  if (/[\u4e00-\u9fff]/.test(raw) && !hasLatin) {
    return { en: "", zh: raw };
  }
  return { en: raw, zh: "" };
}

/** Build speak/export parts: Mix plays English then Mandarin with matching voices. */
export function buildSpeakParts(
  question,
  answer,
  {
    voiceQ = DEFAULT_VOICE_Q,
    voiceA = DEFAULT_VOICE_A,
    preface = "",
    lang = "en",
  } = {}
) {
  const parts = [];
  const qVoice = normalizeVoiceId(voiceQ);
  const aVoice = normalizeVoiceId(voiceA);

  if (lang === "both") {
    const qSplit = splitBilingualText(question);
    const aSplit = splitBilingualText(answer);
    const qEn = voiceForLangFamily(qVoice, "en");
    const qZh = voiceForLangFamily(qVoice, "zh");
    const aEn = voiceForLangFamily(aVoice, "en");
    const aZh = voiceForLangFamily(aVoice, "zh");

    const prefSplit = splitBilingualText(preface);
    const prefEn = sanitizeSpeakText(prefSplit.en);
    const prefZh = sanitizeSpeakText(prefSplit.zh);
    if (prefEn) parts.push({ text: prefEn, voice: qEn });
    if (prefZh) parts.push({ text: prefZh, voice: qZh });
    if (!prefEn && !prefZh) {
      const pref = sanitizeSpeakText(preface);
      if (pref) parts.push({ text: pref, voice: qEn });
    }

    const qEnText = sanitizeSpeakText(qSplit.en);
    const qZhText = sanitizeSpeakText(qSplit.zh);
    const aEnText = sanitizeSpeakText(aSplit.en);
    const aZhText = sanitizeSpeakText(aSplit.zh);

    if (qEnText) parts.push({ text: qEnText, voice: qEn });
    if (qZhText) parts.push({ text: qZhText, voice: qZh });
    if (aEnText) parts.push({ text: aEnText, voice: aEn });
    if (aZhText) parts.push({ text: aZhText, voice: aZh });

    // Fallback if model returned monolingual Mix content
    if (!parts.length) {
      const q = sanitizeSpeakText(question);
      const a = sanitizeSpeakText(answer);
      if (q) parts.push({ text: q, voice: qEn });
      if (a) parts.push({ text: a, voice: aEn });
    }
    return parts;
  }

  const pref = sanitizeSpeakText(preface);
  const q = sanitizeSpeakText(question);
  const a = sanitizeSpeakText(answer);
  if (pref) parts.push({ text: pref, voice: qVoice });
  if (q) parts.push({ text: q, voice: qVoice });
  if (a) parts.push({ text: a, voice: aVoice });
  return parts;
}

const LEGACY_VOICE_MAP = {
  "zh-male": "zh-yunyang-news",
  "zh-female": "zh-xiaoxiao-news",
  "en-male": "en-guy-news",
  "en-female": "en-jenny-news",
  yunyang: "zh-yunyang-news",
};

export function normalizeVoiceId(id) {
  const raw = String(id || "").trim();
  if (!raw) return DEFAULT_VOICE_A;
  if (LEGACY_VOICE_MAP[raw]) return LEGACY_VOICE_MAP[raw];
  if (TTS_VOICES.some((v) => v.id === raw)) return raw;
  return DEFAULT_VOICE_A;
}

export function voicesForLang(lang) {
  if (lang === "en") return TTS_VOICES.filter((v) => v.lang === "en");
  if (lang === "zh") return TTS_VOICES.filter((v) => v.lang === "zh");
  // Mix: show both families, Mandarin first for oral drill flexibility
  return [
    ...TTS_VOICES.filter((v) => v.lang === "zh"),
    ...TTS_VOICES.filter((v) => v.lang === "en"),
  ];
}

function rateForRequest(rate) {
  const n = Number(rate);
  return Number.isFinite(n) ? n : 1;
}

/** Strip markdown / codes / URLs so TTS reads natural speech only. */
export function sanitizeSpeakText(text) {
  let t = String(text || "");
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/https?:\/\/\S+/gi, " ");
  t = t.replace(/\s*\/\s*/g, ". ");
  t = t.replace(/[|｜]+/g, ". ");
  t = t.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/^#+\s*/gm, "");
  t = t.replace(/&nbsp;/g, " ").replace(/&amp;/g, " and ");
  t = t.replace(/&lt;/g, " ").replace(/&gt;/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function isTransientTtsError(status, msg) {
  if (status === 502 || status === 504 || status === 500) return true;
  const m = String(msg || "").toLowerCase();
  return (
    m.includes("stream closed") ||
    m.includes("timed out") ||
    m.includes("websocket") ||
    m.includes("empty audio")
  );
}

function cacheKey(text, voice, rate) {
  return `${normalizeVoiceId(voice)}\0${rateForRequest(rate)}\0${text}`;
}

function rememberBlob(key, blob) {
  audioCache.set(key, blob);
  while (audioCache.size > CACHE_MAX) {
    audioCache.delete(audioCache.keys().next().value);
  }
}

/** Run async work over items with a fixed worker pool (order preserved). */
async function mapPool(items, limit, fn) {
  const n = items.length;
  const out = new Array(n);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, limit), Math.max(1, n)) },
    async () => {
      while (next < n) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }
  );
  await Promise.all(workers);
  return out;
}

async function fetchAudio(text, voice, rate) {
  const clean = sanitizeSpeakText(text);
  if (!clean) throw new Error("Nothing to speak");

  const key = cacheKey(clean, voice, rate);
  const hit = audioCache.get(key);
  if (hit) return hit;

  const payload = {
    text: clean,
    voice: normalizeVoiceId(voice),
    rate: rateForRequest(rate),
  };

  let lastMsg = "TTS failed";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const blob = await res.blob();
      rememberBlob(key, blob);
      return blob;
    }

    let msg = `TTS failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      /* ignore */
    }
    if (res.status === 502 || res.status === 504) {
      msg = "Practice voice isn’t ready yet. Give it a moment and try again.";
    }
    lastMsg = msg;
    if (attempt === 0 && isTransientTtsError(res.status, msg)) {
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    throw new Error(msg);
  }
  throw new Error(lastMsg);
}

/**
 * Build one MP3 (Q voice then A voice). Raw MPEG blobs concatenate fine for playback.
 */
export async function synthesizeQaAudio(
  question,
  answer,
  {
    rate = 1,
    voiceQ = DEFAULT_VOICE_Q,
    voiceA = DEFAULT_VOICE_A,
    preface = "",
    lang = "en",
  } = {}
) {
  const parts = buildSpeakParts(question, answer, {
    voiceQ,
    voiceA,
    preface,
    lang,
  });
  if (!parts.length) throw new Error("Nothing to export");

  // Parallel segment fetches — Mix mode has 4–6 parts; sequential felt like “compile time”.
  const blobs = await Promise.all(
    parts.map((part) => fetchAudio(part.text, part.voice, rate))
  );
  return new Blob(blobs, { type: "audio/mpeg" });
}

/** Trigger a file save (Downloads / Files on phone browsers). */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Merge all Q&A into one continuous MP3 and save to Downloads.
 * Returns number of Q&A pairs included.
 */
export async function exportMergedQaAudio(items, options = {}) {
  const list = (items || []).filter((it) => it?.a?.trim() || it?.q?.trim());
  if (!list.length) throw new Error("Nothing to export");

  const lang = options.lang || "en";
  const blobs = await mapPool(list, FETCH_CONCURRENCY, async (item, i) => {
    const preface =
      lang === "zh" || lang === "both"
        ? `第${i + 1}题。`
        : `Question ${i + 1}.`;
    return synthesizeQaAudio(item.q, item.a, {
      ...options,
      preface,
    });
  });

  const merged = new Blob(blobs, { type: "audio/mpeg" });
  const stamp = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, "-");
  downloadBlob(merged, `linecheck-interview-${stamp}.mp3`);
  return list.length;
}

/** @deprecated use exportMergedQaAudio — kept for single-item saves */
export async function exportQaAudioFiles(items, options = {}) {
  return exportMergedQaAudio(items, options);
}

function playBlob(blob, token, { onStart } = {}) {
  return new Promise((resolve, reject) => {
    if (token !== playToken) {
      resolve();
      return;
    }
    cleanup();
    currentUrl = URL.createObjectURL(blob);
    const audio = new Audio(currentUrl);
    currentAudio = audio;
    audio.onended = () => {
      if (token === playToken) cleanup();
      resolve();
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("Audio playback failed"));
    };
    audio
      .play()
      .then(() => {
        if (token === playToken) onStart?.();
      })
      .catch((e) => {
        cleanup();
        reject(e);
      });
  });
}

export async function speakText(
  text,
  { rate = 1, voice = DEFAULT_VOICE_A } = {}
) {
  const trimmed = sanitizeSpeakText(text);
  if (!trimmed) return;

  stopSpeech();
  const token = playToken;
  const blob = await fetchAudio(trimmed, voice, rate);
  if (token !== playToken) return;
  await playBlob(blob, token);
}

/**
 * Speak question with interviewer voice, then answer with candidate voice.
 * Mix mode: English half → Mandarin half, each with a matching voice.
 * Fetches all segments first, then plays one concatenated MP3 so mobile
 * Safari does not stop after the question (multiple play() calls lose the gesture).
 */
export async function speakQa(
  question,
  answer,
  {
    rate = 1,
    voiceQ = DEFAULT_VOICE_Q,
    voiceA = DEFAULT_VOICE_A,
    preface = "",
    lang = "en",
    onStart,
  } = {}
) {
  return speakQaSequence([{ q: question, a: answer, preface }], {
    rate,
    voiceQ,
    voiceA,
    lang,
    onStart,
  });
}

/**
 * Prefetch every Q&A into one MP3, then play once.
 * Needed for multi-item runs — a second audio.play() after the first ends
 * often fails (Safari gesture), and one TTS error used to abort the rest.
 */
export async function speakQaSequence(entries, options = {}) {
  const list = (entries || []).filter(
    (e) => e?.q?.trim() || e?.a?.trim() || e?.preface?.trim()
  );
  if (!list.length) return;

  stopSpeech();
  const token = playToken;
  const {
    rate = 1,
    voiceQ = DEFAULT_VOICE_Q,
    voiceA = DEFAULT_VOICE_A,
    lang = "en",
    onProgress,
    onStart,
  } = options;

  const blobs = await mapPool(list, FETCH_CONCURRENCY, async (e, i) => {
    if (token !== playToken) return null;
    onProgress?.(i);
    return synthesizeQaAudio(e.q, e.a, {
      rate,
      voiceQ,
      voiceA,
      preface: e.preface || "",
      lang,
    });
  });
  if (token !== playToken) return;
  if (blobs.some((b) => !b)) return;
  onProgress?.(-1);
  await playBlob(new Blob(blobs, { type: "audio/mpeg" }), token, { onStart });
}

/** Pause current practice audio without cancelling the session. */
export function pauseSpeech() {
  if (!currentAudio || currentAudio.paused) return false;
  currentAudio.pause();
  return true;
}

/** Resume after pauseSpeech(). */
export function resumeSpeech() {
  if (!currentAudio || !currentAudio.paused) return Promise.resolve(false);
  return currentAudio
    .play()
    .then(() => true)
    .catch(() => false);
}

export function isSpeechPaused() {
  return Boolean(currentAudio && currentAudio.paused && currentAudio.src);
}

export function stopSpeech() {
  playToken += 1;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  cleanup();
  try {
    speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

function cleanup() {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}
