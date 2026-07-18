/** Edge TTS via local server — separate Q/A voices. */

let currentAudio = null;
let currentUrl = null;
let playToken = 0;

/** In-memory MP3 cache — replay / re-export skips Edge round-trips. */
const audioCache = new Map();
const CACHE_MAX = 100;
/** Persist clips across refresh so replay doesn't re-hit Vercel TTS. */
const IDB_NAME = "linecheck-tts-v1";
const IDB_STORE = "clips";
const IDB_MAX = 120;
/**
 * Max simultaneous Edge TTS turns. Clips are all queued in parallel; this
 * pool is what actually hits the network. Mix batches are heavy — 4 saturated
 * Edge and made play-all feel stuck; 2 keeps headroom for clip #1 priority.
 */
const TTS_INFLIGHT_LIMIT = 2;
const TTS_FETCH_TIMEOUT_MS = 45000;
const TTS_FETCH_ATTEMPTS = 6;
/** Idle prefetch only warms the first N clips (play starts ASAP from cache). */
const PREFETCH_CLIP_LIMIT = 2;
let ttsInflight = 0;
const ttsWaiters = [];
const ttsPriorityWaiters = [];
const activeFetchControllers = new Set();
/** Invalidate in-flight idle prefetch without stopping active playback. */
let prefetchGen = 0;

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
      const store = tx.objectStore(IDB_STORE);
      store.put({ key, blob, at: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    // ponytail: trim oldest when over cap
    const keys = await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    if (keys.length <= IDB_MAX) return;
    keys.sort((a, b) => (a.at || 0) - (b.at || 0));
    const drop = keys.slice(0, keys.length - IDB_MAX);
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

function withTtsSlot(fn, { priority = false } = {}) {
  return new Promise((resolve, reject) => {
    const entry = {
      run: () => {
        ttsInflight += 1;
        Promise.resolve()
          .then(fn)
          .then(resolve, reject)
          .finally(() => {
            if (ttsInflight > 0) {
              ttsInflight -= 1;
            }
            const next = ttsPriorityWaiters.shift() || ttsWaiters.shift();
            next?.run?.();
          });
      },
      reject,
    };
    if (ttsInflight < TTS_INFLIGHT_LIMIT) entry.run();
    else if (priority) ttsPriorityWaiters.push(entry);
    else ttsWaiters.push(entry);
  });
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
    label: "English female · Aria",
    lang: "en",
    gender: "female",
  },
  {
    id: "en-jenny-news",
    label: "English female · Jenny",
    lang: "en",
    gender: "female",
  },
  {
    id: "en-guy-news",
    label: "English male · Guy",
    lang: "en",
    gender: "male",
  },
  {
    id: "en-davis-news",
    label: "English male · Davis",
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

/**
 * How many leading parts to play as the first progressive chunk.
 * Include preface + question only — never start audio on "Question 1." alone
 * and leave the real question waiting.
 */
export function firstPlayGroupSize(parts, entry, options = {}) {
  const list = parts || [];
  if (!list.length) return 0;
  const qOnly = buildSpeakParts(entry?.q || "", "", {
    voiceQ: options.voiceQ,
    voiceA: options.voiceA,
    preface: entry?.preface || "",
    lang: options.lang || "en",
  });
  return Math.min(list.length, Math.max(1, qOnly.length));
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

export const TTS_ENGINES = [
  { id: "edge", labelKey: "settings.ttsEngineEdge" },
  { id: "browser", labelKey: "settings.ttsEngineBrowser" },
];

function browserRate(rate) {
  const n = Number(rate);
  return Number.isFinite(n) ? Math.min(1.4, Math.max(0.6, n)) : 1;
}

async function loadBrowserVoices() {
  if (typeof speechSynthesis === "undefined") return [];
  const existing = speechSynthesis.getVoices();
  if (existing.length) return existing;
  return new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices() || []);
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 400);
  });
}

/** Map Edge voice id → closest device voice (lang + rough gender). */
async function pickBrowserVoice(voiceId) {
  const voices = await loadBrowserVoices();
  if (!voices.length) return null;
  const meta = TTS_VOICES.find((v) => v.id === normalizeVoiceId(voiceId));
  const wantZh = meta?.lang === "zh";
  const wantFemale = meta?.gender === "female";
  const pool = voices.filter((v) =>
    wantZh ? /zh(-|_)/i.test(v.lang) : /^en/i.test(v.lang)
  );
  const ranked = (pool.length ? pool : voices).slice().sort((a, b) => {
    const score = (v) => {
      let s = 0;
      const name = `${v.name} ${v.lang}`.toLowerCase();
      if (
        wantFemale &&
        /female|woman|zira|samantha|tingting|xiaoxiao/i.test(name)
      )
        s += 2;
      if (!wantFemale && /male|man|david|guy|yunyang|kangkang/i.test(name))
        s += 2;
      if (wantZh && /zh-cn|chinese/i.test(name)) s += 1;
      if (!wantZh && /en-us|en-gb/i.test(name)) s += 1;
      return s;
    };
    return score(b) - score(a);
  });
  return ranked[0] || null;
}

function speakBrowserPart(text, voiceId, rate, token) {
  const clean = sanitizeSpeakText(text);
  if (!clean) return Promise.resolve();
  if (typeof speechSynthesis === "undefined") {
    return Promise.reject(new Error("This browser has no built-in voice."));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    pickBrowserVoice(voiceId).then((voice) => {
      if (token !== playToken) {
        finish(resolve);
        return;
      }
      const u = new SpeechSynthesisUtterance(clean);
      u.rate = browserRate(rate);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      }
      u.onend = () => finish(resolve);
      u.onerror = () => {
        if (token !== playToken) finish(resolve);
        else finish(reject, new Error("Browser voice failed."));
      };
      try {
        speechSynthesis.speak(u);
      } catch (e) {
        finish(reject, e);
      }
    });
  });
}

/**
 * Instant device TTS (Web Speech API) — free, no server, lower quality.
 */
async function speakQaSequenceBrowser(list, options) {
  const {
    rate = 1,
    voiceQ = DEFAULT_VOICE_Q,
    voiceA = DEFAULT_VOICE_A,
    lang = "en",
    onProgress,
    onStart,
    onPrepareProgress,
  } = options;
  const token = playToken;

  onPrepareProgress?.({
    done: 1,
    total: 1,
    percent: 100,
    clip: list.length,
    clips: list.length,
    cached: true,
  });

  let started = false;
  let played = 0;
  const markStart = (i) => {
    if (!started) {
      started = true;
      onStart?.();
    }
    onProgress?.(i);
  };

  for (let i = 0; i < list.length; i++) {
    if (token !== playToken) return { played, skipped: list.length - played };
    const parts = buildSpeakParts(list[i].q, list[i].a, {
      voiceQ,
      voiceA,
      preface: list[i].preface || "",
      lang,
    });
    if (!parts.length) continue;
    markStart(i);
    for (const part of parts) {
      if (token !== playToken) return { played, skipped: list.length - played };
      await speakBrowserPart(part.text, part.voice, rate, token);
    }
    played += 1;
  }

  if (!played) {
    throw new Error("Couldn't start browser voice. Try Edge neural instead.");
  }
  return { played, skipped: 0 };
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

async function fetchAudio(text, voice, rate, { priority = false } = {}) {
  const clean = sanitizeSpeakText(text);
  if (!clean) throw new Error("Nothing to speak");

  const key = cacheKey(clean, voice, rate);
  const hit = audioCache.get(key);
  if (hit) return hit;

  // Disk cache (survives refresh) — no Vercel TTS bandwidth.
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

  const startToken = playToken;
  let lastMsg = "TTS failed";
  for (let attempt = 0; attempt < TTS_FETCH_ATTEMPTS; attempt++) {
    try {
      // Timeout must start only after the TTS slot is acquired — play-all queues
      // many Mix parts behind TTS_INFLIGHT_LIMIT; a pre-slot timer aborted waiters
      // with "timed out" / transient cut-outs while single-item play stayed fine.
      const result = await withTtsSlot(async () => {
        if (playToken !== startToken) {
          const err = new Error("Playback cancelled");
          err.name = "AbortError";
          throw err;
        }
        const controller = new AbortController();
        activeFetchControllers.add(controller);
        const timeoutId = setTimeout(() => {
          try {
            controller.abort();
          } catch {
            /* ignore */
          }
        }, TTS_FETCH_TIMEOUT_MS);
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          if (res.ok) {
            return { ok: true, blob: await res.blob() };
          }
          let msg = `TTS failed (${res.status})`;
          try {
            const data = await res.json();
            if (data?.error) msg = data.error;
          } catch {
            /* ignore */
          }
          return { ok: false, status: res.status, msg };
        } finally {
          clearTimeout(timeoutId);
          activeFetchControllers.delete(controller);
        }
      }, { priority });

      if (result.ok) {
        rememberBlob(key, result.blob);
        return result.blob;
      }

      let msg = result.msg;
      const transient =
        result.status === 502 ||
        result.status === 504 ||
        isTransientTtsError(result.status, msg);
      if (result.status === 502 || result.status === 504) {
        msg = "Practice voice isn’t ready yet. Give it a moment and try again.";
      } else if (transient) {
        msg = "Voice cut out mid-line. Tap play once more.";
      }
      lastMsg = msg;
      if (attempt < TTS_FETCH_ATTEMPTS - 1 && transient) {
        await new Promise((r) =>
          setTimeout(r, Math.min(6000, 700 * 2 ** attempt))
        );
        continue;
      }
      throw new Error(lastMsg);
    } catch (err) {
      if (err.name === "AbortError" || err.message === "Playback cancelled") {
        if (playToken !== startToken || err.message === "Playback cancelled") {
          throw new Error("Playback cancelled");
        }
        lastMsg = "Voice request timed out. Please try again.";
        if (attempt < TTS_FETCH_ATTEMPTS - 1) {
          await new Promise((r) =>
            setTimeout(r, Math.min(6000, 700 * 2 ** attempt))
          );
          continue;
        }
        throw new Error(lastMsg);
      }
      lastMsg = err.message || "TTS failed";
      // Only retry flaky Edge/network errors — don't burn attempts on hard failures.
      if (
        attempt < TTS_FETCH_ATTEMPTS - 1 &&
        (isTransientTtsError(0, lastMsg) ||
          /timed out|cut out|TTS failed \(\d/i.test(lastMsg))
      ) {
        await new Promise((r) =>
          setTimeout(r, Math.min(6000, 700 * 2 ** attempt))
        );
        continue;
      }
      throw new Error(lastMsg);
    }
  }
  throw new Error(lastMsg);
}

function clipCacheKey(parts, rate) {
  return (
    "clip\0" +
    parts
      .map((p) =>
        cacheKey(sanitizeSpeakText(p.text), normalizeVoiceId(p.voice), rate)
      )
      .join("\n")
  );
}

/**
 * One serverless invoke for a whole Q&A (all Mix lines). Avoids N cold starts.
 */
async function fetchAudioBatch(parts, rate, { priority = false } = {}) {
  const cleaned = parts
    .map((p) => ({
      text: sanitizeSpeakText(p.text),
      voice: normalizeVoiceId(p.voice),
    }))
    .filter((p) => p.text);
  if (!cleaned.length) throw new Error("Nothing to speak");

  const keys = cleaned.map((p) => cacheKey(p.text, p.voice, rate));
  const fromParts = [];
  let allHit = true;
  for (let i = 0; i < cleaned.length; i++) {
    let hit = audioCache.get(keys[i]);
    if (!hit) {
      hit = await idbGetClip(keys[i]);
      if (hit) audioCache.set(keys[i], hit);
    }
    if (hit) fromParts.push(hit);
    else {
      allHit = false;
      break;
    }
  }
  if (allHit) return new Blob(fromParts, { type: "audio/mpeg" });

  const clipKey = "clip\0" + keys.join("\n");
  let clipHit = audioCache.get(clipKey);
  if (!clipHit) {
    clipHit = await idbGetClip(clipKey);
    if (clipHit) audioCache.set(clipKey, clipHit);
  }
  if (clipHit) return clipHit;

  const payload = {
    parts: cleaned.map((p) => ({ text: p.text, voice: p.voice })),
    rate: rateForRequest(rate),
  };
  // Batch does more Edge work per request — give it room before aborting.
  const timeoutMs = Math.min(
    120000,
    TTS_FETCH_TIMEOUT_MS + cleaned.length * 12000
  );

  const startToken = playToken;
  let lastMsg = "TTS failed";
  for (let attempt = 0; attempt < TTS_FETCH_ATTEMPTS; attempt++) {
    try {
      const result = await withTtsSlot(async () => {
        if (playToken !== startToken) {
          const err = new Error("Playback cancelled");
          err.name = "AbortError";
          throw err;
        }
        const controller = new AbortController();
        activeFetchControllers.add(controller);
        const timeoutId = setTimeout(() => {
          try {
            controller.abort();
          } catch {
            /* ignore */
          }
        }, timeoutMs);
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          if (res.ok) {
            return { ok: true, blob: await res.blob() };
          }
          let msg = `TTS failed (${res.status})`;
          try {
            const data = await res.json();
            if (data?.error) msg = data.error;
          } catch {
            /* ignore */
          }
          return { ok: false, status: res.status, msg };
        } finally {
          clearTimeout(timeoutId);
          activeFetchControllers.delete(controller);
        }
      }, { priority });

      if (result.ok) {
        rememberBlob(clipKey, result.blob);
        return result.blob;
      }

      let msg = result.msg;
      const transient =
        result.status === 502 ||
        result.status === 504 ||
        isTransientTtsError(result.status, msg);
      if (result.status === 502 || result.status === 504) {
        msg = "Practice voice isn’t ready yet. Give it a moment and try again.";
      } else if (transient) {
        msg = "Voice cut out mid-line. Tap play once more.";
      }
      lastMsg = msg;
      if (attempt < TTS_FETCH_ATTEMPTS - 1 && transient) {
        await new Promise((r) =>
          setTimeout(r, Math.min(6000, 700 * 2 ** attempt))
        );
        continue;
      }
      throw new Error(lastMsg);
    } catch (err) {
      if (err.name === "AbortError" || err.message === "Playback cancelled") {
        if (playToken !== startToken || err.message === "Playback cancelled") {
          throw new Error("Playback cancelled");
        }
        lastMsg = "Voice request timed out. Please try again.";
        if (attempt < TTS_FETCH_ATTEMPTS - 1) {
          await new Promise((r) =>
            setTimeout(r, Math.min(6000, 700 * 2 ** attempt))
          );
          continue;
        }
        throw new Error(lastMsg);
      }
      lastMsg = err.message || "TTS failed";
      if (
        attempt < TTS_FETCH_ATTEMPTS - 1 &&
        (isTransientTtsError(0, lastMsg) ||
          /timed out|cut out|TTS failed \(\d/i.test(lastMsg))
      ) {
        await new Promise((r) =>
          setTimeout(r, Math.min(6000, 700 * 2 ** attempt))
        );
        continue;
      }
      throw new Error(lastMsg);
    }
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
    onPartComplete,
    priority = false,
  } = {}
) {
  const parts = buildSpeakParts(question, answer, {
    voiceQ,
    voiceA,
    preface,
    lang,
  });
  if (!parts.length) throw new Error("Nothing to export");

  // Prefer one /api/tts call for the whole Q&A (batch). Fall back to per-line
  // if the batch endpoint fails (older deploys / transient Edge errors).
  try {
    const blob = await fetchAudioBatch(parts, rate, { priority });
    for (let i = 0; i < parts.length; i++) onPartComplete?.();
    return blob;
  } catch (err) {
    if (String(err?.message || err) === "Playback cancelled") throw err;
  }

  const results = await Promise.all(
    parts.map(async (part) => {
      try {
        const blob = await fetchAudio(part.text, part.voice, rate, {
          priority,
        });
        onPartComplete?.();
        return blob;
      } catch (err) {
        onPartComplete?.();
        if (String(err?.message || err) === "Playback cancelled") throw err;
        return null;
      }
    })
  );
  const blobs = results.filter(Boolean);
  if (!blobs.length) throw new Error("Nothing to speak");
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
 * Merge all Q&A into one continuous MP3 blob (same pipeline as export / play-all).
 * Every clip is started in parallel; TTS_INFLIGHT_LIMIT throttles Edge.
 */
export async function synthesizeMergedQaAudio(items, options = {}) {
  const list = (items || []).filter(
    (it) => it?.a?.trim() || it?.q?.trim() || it?.preface?.trim()
  );
  if (!list.length) throw new Error("Nothing to export");

  const lang = options.lang || "en";
  const blobs = await Promise.all(
    list.map(async (item, i) => {
      const preface =
        item.preface ||
        (lang === "zh" || lang === "both"
          ? `第${i + 1}题。`
          : `Question ${i + 1}.`);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await synthesizeQaAudio(item.q, item.a, {
            ...options,
            preface,
            lang,
          });
        } catch (err) {
          if (String(err?.message || err) === "Playback cancelled") throw err;
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
      return null;
    })
  );
  const ready = blobs.filter(Boolean);
  if (!ready.length) throw new Error("Nothing to export");
  return new Blob(ready, { type: "audio/mpeg" });
}

/**
 * Merge all Q&A into one continuous MP3 and save to Downloads.
 * Returns number of Q&A pairs included.
 */
export async function exportMergedQaAudio(items, options = {}) {
  const list = (items || []).filter((it) => it?.a?.trim() || it?.q?.trim());
  if (!list.length) throw new Error("Nothing to export");

  const merged = await synthesizeMergedQaAudio(list, options);
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

/** Minimal WAV of true silence (~50ms). Unsigned 8-bit PCM must use 0x80, not 0
 *  — zeros are full-scale negative and sound like a mic pop / static click. */
let silentBlobUrl = null;
function getSilentUrl() {
  if (silentBlobUrl) return silentBlobUrl;
  const sampleCount = 400; // 50ms at 8 kHz
  const len = 44 + sampleCount;
  const buf = new ArrayBuffer(len);
  const v = new DataView(buf);
  const w = (p, s) => {
    v.setUint32(p, s, true);
  };
  const s16 = (p, val) => {
    v.setUint16(p, val, true);
  };
  v.setUint32(0, 0x52494646, false); // "RIFF"
  w(4, len - 8);
  v.setUint32(8, 0x57415645, false); // "WAVE"
  v.setUint32(12, 0x666D7420, false); // "fmt "
  w(16, 16); // chunk size
  s16(20, 1); // PCM
  s16(22, 1); // mono
  w(24, 8000); // sample rate
  w(28, 8000); // byte rate
  s16(32, 1); // block align
  s16(34, 8); // bits per sample
  v.setUint32(36, 0x64617461, false); // "data"
  w(40, sampleCount);
  new Uint8Array(buf, 44, sampleCount).fill(0x80); // unsigned 8-bit midpoint
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
  el.volume = 0;
  el.style.cssText = "display:none;width:0;height:0";
  el.src = getSilentUrl();
  currentAudio = el;
  currentUrl = "";
  getAudioContainer().appendChild(el);
  // Start playing a real silent audio to grab the audio context without
  // triggering any browser media overlay.
  el.play().catch(() => {});
}

function playBlob(blob, token, { onStart, keepElement = false } = {}) {
  return new Promise((resolve, reject) => {
    if (token !== playToken) {
      resolve();
      return;
    }
    const url = URL.createObjectURL(blob);
    const el = currentAudio;
    if (!el || token !== playToken) {
      URL.revokeObjectURL(url);
      resolve();
      return;
    }
    if (currentUrl && currentUrl !== url) {
      URL.revokeObjectURL(currentUrl);
    }
    currentUrl = url;

    // Clear prior handlers before swapping src — otherwise a stale onended
    // from the previous clip can resolve this play immediately (playlist died
    // after ~2 items).
    el.onended = null;
    el.onerror = null;
    try {
      el.pause();
    } catch {
      /* ignore */
    }

    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    el.volume = 1;
    el.src = url;
    el.onended = () => {
      if (token === playToken && !keepElement) cleanup();
      finish(resolve);
    };
    el.onerror = () => {
      if (token !== playToken) {
        finish(resolve);
        return;
      }
      cleanup();
      finish(reject, new Error("Audio playback failed"));
    };
    el.play()
      .then(() => {
        if (token === playToken) onStart?.();
      })
      .catch((e) => {
        if (token !== playToken) {
          finish(resolve);
          return;
        }
        cleanup();
        finish(reject, e);
      });
  });
}

export async function speakText(
  text,
  { rate = 1, voice = DEFAULT_VOICE_A, ttsEngine = "edge" } = {}
) {
  const trimmed = sanitizeSpeakText(text);
  if (!trimmed) return;

  stopSpeech();
  const token = playToken;
  if (ttsEngine === "browser") {
    await speakBrowserPart(trimmed, voice, rate, token);
    return;
  }
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
    ttsEngine = "edge",
  } = {}
) {
  return speakQaSequence([{ q: question, a: answer, preface }], {
    rate,
    voiceQ,
    voiceA,
    lang,
    onStart,
    ttsEngine,
  });
}

/**
 * Progressive play-all:
 * 1) Clip #1 plays its first Mix segment ASAP (rest of the clip continues in parallel)
 * 2) Remaining clips generate in parallel (lower priority), chained after #1
 * 3) Merge-fallback if a later play() is blocked
 */
export async function speakQaSequence(entries, options = {}) {
  const list = (entries || []).filter(
    (e) => e?.q?.trim() || e?.a?.trim() || e?.preface?.trim()
  );
  if (!list.length) return { played: 0, skipped: 0 };

  cancelPrefetch();
  stopSpeech();
  const token = playToken;
  const {
    rate = 1,
    voiceQ = DEFAULT_VOICE_Q,
    voiceA = DEFAULT_VOICE_A,
    lang = "en",
    onProgress,
    onStart,
    onPrepareProgress,
    ttsEngine = "edge",
  } = options;

  if (ttsEngine === "browser") {
    return speakQaSequenceBrowser(list, {
      rate,
      voiceQ,
      voiceA,
      lang,
      onProgress,
      onStart,
      onPrepareProgress,
    });
  }

  warmupAudio(token);

  const entryParts = (entry) =>
    buildSpeakParts(entry.q, entry.a, {
      voiceQ,
      voiceA,
      preface: entry.preface || "",
      lang,
    });

  // Hydrate memory from IndexedDB so refresh replay skips Vercel TTS.
  const diskKeys = [];
  for (const entry of list) {
    const parts = entryParts(entry);
    const clipKey = clipCacheKey(parts, rate);
    if (!audioCache.has(clipKey)) diskKeys.push(clipKey);
    for (const part of parts) {
      const clean = sanitizeSpeakText(part.text);
      if (!clean) continue;
      const key = cacheKey(clean, part.voice, rate);
      if (!audioCache.has(key)) diskKeys.push(key);
    }
  }
  if (diskKeys.length) {
    await Promise.all(
      diskKeys.map(async (key) => {
        const blob = await idbGetClip(key);
        if (blob) audioCache.set(key, blob);
      })
    );
  }

  const partCached = (entry) => {
    const parts = entryParts(entry);
    if (audioCache.has(clipCacheKey(parts, rate))) return true;
    return parts.every((part) => {
      const clean = sanitizeSpeakText(part.text);
      if (!clean) return true;
      return audioCache.has(cacheKey(clean, part.voice, rate));
    });
  };
  const allWarm = list.every(partCached);
  if (allWarm) {
    onPrepareProgress?.({
      done: 1,
      total: 1,
      percent: 100,
      clip: list.length,
      clips: list.length,
      cached: true,
    });
  }

  // Progress is per Q&A clip (one batch request each), not per Mix line.
  const totalClips = list.length;
  let doneClips = 0;
  const bumpClip = (clipIndex) => {
    doneClips += 1;
    onPrepareProgress?.({
      done: doneClips,
      total: totalClips,
      percent: Math.min(100, Math.round((doneClips / totalClips) * 100)),
      clip: clipIndex + 1,
      clips: list.length,
    });
  };

  const synthesizeOne = async (entry, clipIndex, priority) => {
    if (token !== playToken) return null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const blob = await synthesizeQaAudio(entry.q, entry.a, {
          rate,
          voiceQ,
          voiceA,
          preface: entry.preface || "",
          lang,
          priority,
        });
        bumpClip(clipIndex);
        return blob;
      } catch (err) {
        if (token !== playToken) return null;
        if (String(err?.message || err) === "Playback cancelled") throw err;
        await new Promise((r) =>
          setTimeout(r, Math.min(4000, 800 * 2 ** attempt))
        );
      }
    }
    bumpClip(clipIndex);
    return null;
  };

  /**
   * Clip #1: fetch parts in parallel, play the first part as soon as it lands
   * while the rest of the clip (and later clips) still synthesize.
   */
  const playFirstClipProgressive = async () => {
    const entry = list[0];
    const parts = entryParts(entry);
    if (!parts.length) {
      bumpClip(0);
      return false;
    }

    const clipKey = clipCacheKey(parts, rate);
    let cached = audioCache.get(clipKey);
    if (!cached) {
      cached = await idbGetClip(clipKey);
      if (cached) audioCache.set(clipKey, cached);
    }
    if (cached) {
      bumpClip(0);
      await playBlob(cached, token, {
        keepElement: list.length > 1,
        onStart: () => markStart(0),
      });
      return true;
    }

    const partTasks = parts.map((part) =>
      fetchAudio(part.text, part.voice, rate, { priority: true }).catch(
        (err) => {
          if (String(err?.message || err) === "Playback cancelled") throw err;
          return null;
        }
      )
    );

    // Wait for preface + question (not just "Question 1.") before starting.
    const groupN = firstPlayGroupSize(parts, entry, {
      voiceQ,
      voiceA,
      lang,
    });
    const headBlobs = [];
    for (let i = 0; i < groupN; i++) {
      if (token !== playToken) return false;
      onPrepareProgress?.({
        done: i,
        total: Math.max(groupN, 1),
        percent: Math.min(
          99,
          Math.round(((i + 0.5) / Math.max(groupN, 1)) * 100)
        ),
        clip: 1,
        clips: list.length,
      });
      const b = await partTasks[i];
      if (b) headBlobs.push(b);
    }
    if (token !== playToken) return false;
    if (!headBlobs.length) {
      bumpClip(0);
      return false;
    }

    const firstBlob = new Blob(headBlobs, { type: "audio/mpeg" });
    const restPromise = Promise.all(partTasks.slice(groupN));
    try {
      await playBlob(firstBlob, token, {
        keepElement: true,
        onStart: () => markStart(0),
      });
    } catch {
      if (token !== playToken) return false;
      warmupAudio(token);
      const rest = (await restPromise).filter(Boolean);
      const all = [...headBlobs, ...rest];
      rememberBlob(clipKey, new Blob(all, { type: "audio/mpeg" }));
      bumpClip(0);
      await playBlob(new Blob(all, { type: "audio/mpeg" }), token, {
        keepElement: list.length > 1,
        onStart: () => markStart(0),
      });
      return true;
    }

    if (token !== playToken) return false;
    const rest = (await restPromise).filter(Boolean);
    const full = new Blob([...headBlobs, ...rest], { type: "audio/mpeg" });
    rememberBlob(clipKey, full);
    bumpClip(0);

    if (rest.length) {
      await playBlob(new Blob(rest, { type: "audio/mpeg" }), token, {
        keepElement: list.length > 1,
      });
    }
    return true;
  };

  let started = false;
  let played = 0;
  let skipped = 0;

  const markStart = (i) => {
    if (!started) {
      started = true;
      onStart?.();
    }
    onProgress?.(i);
  };

  try {
    onPrepareProgress?.({
      done: 0,
      total: totalClips,
      percent: 0,
      clip: 1,
      clips: list.length,
    });

    // Start later clips after clip-1 part fetches are queued (priority slots).
    const firstPlay = playFirstClipProgressive();
    await Promise.resolve();
    const restTasks = list
      .slice(1)
      .map((entry, j) => synthesizeOne(entry, j + 1, false));

    let firstOk = false;
    try {
      firstOk = await firstPlay;
    } catch (err) {
      if (String(err?.message || err) === "Playback cancelled") {
        return { played, skipped };
      }
      firstOk = false;
    }
    if (token !== playToken) return { played, skipped };
    if (firstOk) played += 1;
    else skipped += 1;

    for (let i = 1; i < list.length; i++) {
      if (token !== playToken) return { played, skipped };
      const blob = await restTasks[i - 1];
      if (token !== playToken) return { played, skipped };
      if (!blob) {
        skipped += 1;
        continue;
      }
      try {
        await playBlob(blob, token, {
          keepElement: true,
          onStart: () => markStart(i),
        });
        played += 1;
      } catch {
        if (token !== playToken) return { played, skipped };
        warmupAudio(token);
        const rest = [];
        for (let j = i; j < list.length; j++) {
          const b = await restTasks[j - 1];
          if (b) rest.push(b);
          else skipped += 1;
        }
        if (!rest.length) break;
        await playBlob(new Blob(rest, { type: "audio/mpeg" }), token, {
          onStart: () => markStart(i),
        });
        played += rest.length;
        break;
      }
    }
  } finally {
    if (token === playToken && currentAudio) cleanup();
  }

  if (!played) {
    throw new Error("Couldn't prepare practice audio. Tap play once more.");
  }
  return { played, skipped };
}

/** Cancel idle prefetch without stopping playback. */
export function cancelPrefetch() {
  prefetchGen += 1;
}

/**
 * Warm the TTS lambda / Edge path in the background (no audio playback).
 */
export async function warmupTts() {
  try {
    await fetch("/api/tts-warm", { method: "GET", cache: "no-store" });
  } catch {
    /* ignore — best-effort keep-warm */
  }
}

/**
 * Synthesize selected Q&A into cache while the user is idle (no playback).
 * Play then hits memory/IDB instead of waiting on Edge.
 */
export async function prefetchQaSequence(entries, options = {}) {
  const list = (entries || []).filter(
    (e) => e?.q?.trim() || e?.a?.trim() || e?.preface?.trim()
  );
  if (!list.length) return;

  const gen = ++prefetchGen;
  const {
    rate = 1,
    voiceQ = DEFAULT_VOICE_Q,
    voiceA = DEFAULT_VOICE_A,
    lang = "en",
  } = options;

  const entryParts = (entry) =>
    buildSpeakParts(entry.q, entry.a, {
      voiceQ,
      voiceA,
      preface: entry.preface || "",
      lang,
    });

  const diskKeys = [];
  for (const entry of list) {
    const parts = entryParts(entry);
    const clipKey = clipCacheKey(parts, rate);
    if (!audioCache.has(clipKey)) diskKeys.push(clipKey);
    for (const part of parts) {
      const clean = sanitizeSpeakText(part.text);
      if (!clean) continue;
      const key = cacheKey(clean, part.voice, rate);
      if (!audioCache.has(key)) diskKeys.push(key);
    }
  }
  if (diskKeys.length) {
    await Promise.all(
      diskKeys.map(async (key) => {
        const blob = await idbGetClip(key);
        if (blob) audioCache.set(key, blob);
      })
    );
  }
  if (gen !== prefetchGen) return;

  // Only warm the first few clips — prefetching a full Mix playlist saturates
  // Edge and often gets cancelled when the user hits Play.
  const warm = list.slice(0, PREFETCH_CLIP_LIMIT);

  await synthesizeQaAudio(warm[0].q, warm[0].a, {
    rate,
    voiceQ,
    voiceA,
    preface: warm[0].preface || "",
    lang,
    priority: true,
  }).catch(() => {});
  if (gen !== prefetchGen) return;

  await Promise.all(
    warm.slice(1).map((entry) =>
      synthesizeQaAudio(entry.q, entry.a, {
        rate,
        voiceQ,
        voiceA,
        preface: entry.preface || "",
        lang,
        priority: false,
      }).catch(() => {})
    )
  );
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

  // Abort any active fetches
  try {
    for (const controller of activeFetchControllers) {
      controller.abort();
    }
  } catch {
    /* ignore */
  }
  activeFetchControllers.clear();

  // Reject queued slot waiters so play-all doesn't hang after Stop/re-play.
  const pending = [...ttsPriorityWaiters.splice(0), ...ttsWaiters.splice(0)];
  ttsInflight = 0;
  for (const w of pending) {
    try {
      const err = new Error("Playback cancelled");
      err.name = "AbortError";
      w.reject(err);
    } catch {
      /* ignore */
    }
  }

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
