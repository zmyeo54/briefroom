/** Edge TTS via local server — separate Q/A voices. */

let currentAudio = null;
let currentUrl = null;
let playToken = 0;

/** In-memory MP3 cache — replay / re-export skips Edge round-trips. */
const audioCache = new Map();
const CACHE_MAX = 100;
/** Persist clips across refresh so replay doesn't re-hit Edge. */
const IDB_NAME = "linecheck-tts-v1";
const IDB_STORE = "clips";
const IDB_MAX = 120;
/** How many Q&A clips to prepare at once (Jul 17 “All good!” play-all). */
const FETCH_CONCURRENCY = 3;
/** Segments within one Q&A (Mix = 4–6). Unbounded Promise.all opened too many Edge WS. */
const PART_CONCURRENCY = 2;

function openTtsIdb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGetClip(key) {
  const db = await openTtsIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => {
        const row = req.result;
        resolve(row?.blob instanceof Blob ? row.blob : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSetClip(key, blob) {
  const db = await openTtsIdb();
  if (!db || !(blob instanceof Blob)) return;
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put({ key, blob, at: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    // ponytail: trim oldest when over cap — upgrade: LRU by last-hit
    const rows = await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    if (rows.length <= IDB_MAX) return;
    rows.sort((a, b) => (a.at || 0) - (b.at || 0));
    const drop = rows.slice(0, rows.length - IDB_MAX);
    await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      for (const row of drop) store.delete(row.key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore quota / private mode */
  }
}

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

  const family = lang === "zh" ? "zh" : "en";
  const qAligned = voiceForLangFamily(qVoice, family);
  const aAligned = voiceForLangFamily(aVoice, family);
  const pref = sanitizeSpeakText(preface);
  const q = sanitizeSpeakText(question);
  const a = sanitizeSpeakText(answer);
  if (pref) parts.push({ text: pref, voice: qAligned });
  if (q) parts.push({ text: q, voice: qAligned });
  if (a) parts.push({ text: a, voice: aAligned });
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
    m.includes("turn.end") ||
    m.includes("truncated") ||
    m.includes("timed out") ||
    m.includes("websocket") ||
    m.includes("empty audio")
  );
}

/** Map Edge/msedge-tts internals to something a human can act on. */
export function friendlyTtsError(msg, status = 0) {
  const raw = String(msg || "").trim();
  const m = raw.toLowerCase();
  if (
    status === 502 ||
    status === 504 ||
    m.includes("stream closed") ||
    m.includes("turn.end") ||
    m.includes("truncated") ||
    m.includes("websocket") ||
    m.includes("timed out")
  ) {
    return "Practice voice hiccuped mid-clip. Tap play again.";
  }
  if (!raw || /^tts failed/i.test(raw)) {
    return "Practice voice isn’t ready. Give it a moment and try again.";
  }
  return raw;
}

function cacheKey(text, voice, rate) {
  return `${normalizeVoiceId(voice)}\0${rateForRequest(rate)}\0${text}`;
}

function rememberBlob(key, blob) {
  audioCache.set(key, blob);
  while (audioCache.size > CACHE_MAX) {
    audioCache.delete(audioCache.keys().next().value);
  }
  void idbSetClip(key, blob);
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

  const disk = await idbGetClip(key);
  if (disk) {
    audioCache.set(key, disk);
    return disk;
  }

  const payload = {
    text: clean,
    voice: normalizeVoiceId(voice),
    rate: rateForRequest(rate),
  };

  let lastMsg = "TTS failed";
  for (let attempt = 0; attempt < 3; attempt++) {
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
    lastMsg = friendlyTtsError(msg, res.status);
    if (attempt < 2 && isTransientTtsError(res.status, msg)) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      continue;
    }
    throw new Error(lastMsg);
  }
  throw new Error(friendlyTtsError(lastMsg));
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

  // Cap segment fetches — Mix mode has 4–6 parts; all-at-once opened 12–18 Edge WS.
  const blobs = await mapPool(parts, PART_CONCURRENCY, (part) =>
    fetchAudio(part.text, part.voice, rate)
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

/** Title-case a string for professional filenames. */
function titleCase(text) {
  return String(text || "")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+-\s+/g, " - ")
    .slice(0, 60);
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
  const stamp = new Date().toISOString().slice(0, 10);
  const parts = ["Line Check"];
  if (options.jobTitle) parts.push(titleCase(options.jobTitle));
  if (options.candidateName) parts.push(titleCase(options.candidateName));
  parts.push(stamp);
  downloadBlob(merged, `${parts.join(" - ")}.mp3`);
  return list.length;
}

/** @deprecated use exportMergedQaAudio — kept for single-item saves */
export async function exportQaAudioFiles(items, options = {}) {
  return exportMergedQaAudio(items, options);
}

/** Shared hidden container for audio elements (avoids appending to <body>). */
let audioContainer = null;
function getAudioContainer() {
  if (!audioContainer) {
    audioContainer = document.createElement("div");
    audioContainer.style.cssText = "position:fixed;left:-9999px;width:0;height:0;overflow:hidden";
    document.body.appendChild(audioContainer);
  }
  return audioContainer;
}

/** Minimal WAV header for ~50ms of silence (8-bit PCM, 8 kHz). */
let silentBlobUrl = null;
function getSilentUrl() {
  if (silentBlobUrl) return silentBlobUrl;
  // WAV: 44-byte header + 400 samples of silence (50ms at 8 kHz)
  const len = 44 + 400;
  const buf = new ArrayBuffer(len);
  const v = new DataView(buf);
  const w = (p, s) => { v.setUint32(p, s, true); };
  const s = (p, val) => { v.setUint16(p, val, true); };
  v.setUint32(0, 0x52494646, false); // "RIFF"
  w(4, len - 8);
  v.setUint32(8, 0x57415645, false); // "WAVE"
  v.setUint32(12, 0x666D7420, false); // "fmt "
  w(16, 16);          // chunk size
  s(20, 1);           // PCM
  s(22, 1);           // mono
  w(24, 8000);        // sample rate
  w(28, 8000);        // byte rate
  s(32, 1);           // block align
  s(34, 8);           // bits per sample
  v.setUint32(36, 0x64617461, false); // "data"
  w(40, 400);         // data size
  // samples already zeroed (silence)
  silentBlobUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  return silentBlobUrl;
}

/**
 * Warm up an <audio> element synchronously (from a user gesture) so mobile
 * Safari / WeChat doesn't hijack playback with its own media overlay.
 * Uses a real silent WAV blob instead of empty src — some browsers show
 * a native media player when playing audio with src="".
 */
function warmupAudio(token) {
  cleanup();
  const el = document.createElement("audio");
  el.preload = "auto";
  el.autoplay = true;
  el.playsInline = true;
  el.setAttribute("playsinline", "");
  el.setAttribute("webkit-playsinline", "");
  el.crossOrigin = "anonymous";
  el.style.cssText = "display:none;width:0;height:0";
  el.src = getSilentUrl();
  currentAudio = el;
  currentUrl = "";
  getAudioContainer().appendChild(el);
  // Start playing a real silent audio to grab the audio context without
  // triggering any browser media overlay.
  el.play().catch(() => {});
}

function playBlob(blob, token, { onStart } = {}) {
  return new Promise((resolve, reject) => {
    if (token !== playToken) {
      resolve();
      return;
    }
    // Swap the real audio into the pre-warmed element
    const url = URL.createObjectURL(blob);
    const el = currentAudio;
    if (!el || token !== playToken) {
      URL.revokeObjectURL(url);
      resolve();
      return;
    }
    // Revoke old URL
    if (currentUrl && currentUrl !== url) {
      URL.revokeObjectURL(currentUrl);
    }
    currentUrl = url;
    el.src = url;
    el.play()
      .then(() => {
        if (token === playToken) onStart?.();
      })
      .catch((e) => {
        if (token !== playToken) {
          resolve();
          return;
        }
        cleanup();
        reject(e);
      });
    el.onended = () => {
      if (token === playToken) cleanup();
      resolve();
    };
    el.onerror = () => {
      if (token !== playToken) {
        resolve();
        return;
      }
      cleanup();
      reject(new Error("Audio playback failed"));
    };
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
  warmupAudio(token);
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

  // Warm up audio context synchronously (in the user gesture) so mobile
  // Safari / WeChat doesn't show its own media player overlay.
  warmupAudio(token);

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
  cleanup();
  try {
    speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * Remove the current <audio> element from the DOM and revoke its blob URL.
 * Must be called BEFORE setting currentAudio to null so the element is
 * actually removed — otherwise orphaned <audio> tags accumulate in <body>
 * and can trigger unwanted browser media overlays on mobile.
 */
function cleanup() {
  const el = currentAudio;
  if (el) {
    try {
      el.pause();
      el.src = "";
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    } catch {
      /* ignore */
    }
  }
  currentAudio = null;
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}
