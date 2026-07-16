const STORAGE = {
  settings: "ic_settings_v1",
  draft: "ic_draft_v1",
  qa: "ic_qa_v1",
};

const $ = (id) => document.getElementById(id);

const state = {
  qa: [],
  speakingIndex: -1,
  utterQueue: [],
  deferredInstall: null,
};

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getSettings() {
  return {
    apiKey: $("apiKey").value.trim(),
    baseUrl: $("baseUrl").value.trim().replace(/\/$/, ""),
    model: $("model").value.trim(),
    lang: $("lang").value,
    voiceURI: $("voice").value,
    rate: Number($("rate").value),
  };
}

function applySettings(s) {
  if (!s) return;
  $("apiKey").value = s.apiKey || "";
  $("baseUrl").value = s.baseUrl || "https://api.openai.com/v1";
  $("model").value = s.model || "gpt-4o-mini";
  $("lang").value = s.lang || "zh";
  $("rate").value = s.rate || 1;
  $("rateLabel").textContent = Number($("rate").value).toFixed(2);
  if (s.voiceURI) $("voice").value = s.voiceURI;
}

function setStatus(el, msg, kind = "") {
  el.textContent = msg || "";
  el.className = "status" + (kind ? ` ${kind}` : "");
}

/* ---------------- TTS (browser, no server) ---------------- */

function populateVoices() {
  const sel = $("voice");
  const current = sel.value;
  const voices = speechSynthesis.getVoices();
  sel.innerHTML = "";
  if (!voices.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "系统暂无可用声音";
    sel.appendChild(opt);
    return;
  }
  const preferred = [...voices].sort((a, b) => {
    const score = (v) =>
      (v.lang.startsWith("zh") ? 3 : 0) +
      (v.lang.startsWith("en") ? 1 : 0) +
      (/Ting|Mei|Yun|Xiaoxiao|Google|Premium|Enhanced|Sinji|Tingting/i.test(v.name) ? 2 : 0);
    return score(b) - score(a);
  });
  for (const v of preferred) {
    const opt = document.createElement("option");
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})`;
    sel.appendChild(opt);
  }
  const saved = loadJson(STORAGE.settings, {}).voiceURI;
  sel.value = current || saved || preferred[0].voiceURI;
}

function pickVoice(uri) {
  return speechSynthesis.getVoices().find((v) => v.voiceURI === uri) || null;
}

function stopSpeech() {
  state.utterQueue = [];
  state.speakingIndex = -1;
  speechSynthesis.cancel();
  document.querySelectorAll(".qa.playing").forEach((el) => el.classList.remove("playing"));
}

function speakText(text, { onStart, onEnd, onError } = {}) {
  return new Promise((resolve, reject) => {
    if (!text?.trim()) {
      resolve();
      return;
    }
    const s = getSettings();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = s.rate || 1;
    const voice = pickVoice(s.voiceURI);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else if (s.lang === "en") {
      u.lang = "en-US";
    } else {
      u.lang = "zh-CN";
    }
    u.onstart = () => onStart && onStart();
    u.onend = () => {
      onEnd && onEnd();
      resolve();
    };
    u.onerror = (e) => {
      onError && onError(e);
      // interrupted by cancel is fine
      if (e.error === "interrupted" || e.error === "canceled") resolve();
      else reject(e);
    };
    speechSynthesis.speak(u);
  });
}

async function speakAnswer(index) {
  stopSpeech();
  const item = state.qa[index];
  if (!item) return;
  const card = document.querySelector(`.qa[data-i="${index}"]`);
  state.speakingIndex = index;
  if (card) card.classList.add("playing");
  try {
    await speakText(`${item.q}。${item.a}`, {
      onEnd: () => card && card.classList.remove("playing"),
    });
  } finally {
    if (card) card.classList.remove("playing");
    state.speakingIndex = -1;
  }
}

async function speakAll() {
  stopSpeech();
  for (let i = 0; i < state.qa.length; i++) {
    const card = document.querySelector(`.qa[data-i="${i}"]`);
    state.speakingIndex = i;
    if (card) card.classList.add("playing");
    try {
      await speakText(`第${i + 1}题。${state.qa[i].q}。${state.qa[i].a}`);
    } catch {
      break;
    } finally {
      if (card) card.classList.remove("playing");
    }
    if (state.speakingIndex === -1 && speechSynthesis.paused === false && !speechSynthesis.speaking) {
      // stopped
    }
  }
  state.speakingIndex = -1;
}

/* ---------------- LLM generation ---------------- */

function buildPrompt({ resume, jd, questions, lang, autoQuestions }) {
  const langInstr =
    lang === "en"
      ? "Write all answers in natural professional English."
      : lang === "both"
        ? "For each answer, write Chinese first, then a blank line, then an English version."
        : "用自然、专业、口语化的中文写回答，适合面试口述，不要太书面。";

  const qBlock = questions.length
    ? `Use exactly these questions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : autoQuestions
      ? "Invent 8 likely interview questions for this role based on the resume + JD (include intro, motivation, gaps/weaknesses, role-fit, customer/conflict scenario)."
      : "Use any questions provided; if none, invent 6 likely ones.";

  return `You are an interview coach. Create concise spoken-style answers the candidate can memorize and say out loud.

${langInstr}

Rules:
- Stay truthful to the resume; do not invent employers or degrees not present.
- Align answers to the job description priorities.
- Each answer: 80–160 words (or Chinese equivalent length), first-person.
- Sound confident but not arrogant.
- Return STRICT JSON only: {"items":[{"q":"...","a":"..."}]}

RESUME:
${resume}

JOB DESCRIPTION:
${jd}

QUESTIONS:
${qBlock}`;
}

async function generateAnswers() {
  const settings = getSettings();
  const resume = $("resume").value.trim();
  const jd = $("jd").value.trim();
  const questions = $("questions").value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const autoQuestions = $("autoQuestions").checked;

  if (!settings.apiKey) {
    $("settingsPanel").open = true;
    setStatus($("genStatus"), "请先在设置里填写 API Key。", "error");
    return;
  }
  if (!resume || !jd) {
    setStatus($("genStatus"), "请粘贴简历和职位描述。", "error");
    return;
  }

  const btn = $("generate");
  btn.disabled = true;
  setStatus($("genStatus"), "正在生成回答…");

  const prompt = buildPrompt({
    resume,
    jd,
    questions,
    lang: settings.lang,
    autoQuestions,
  });

  try {
    const res = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You help candidates prepare interview answers. Always return valid JSON.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || res.statusText || "API error";
      throw new Error(msg);
    }

    const content = data.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("模型没有返回 JSON");
      parsed = JSON.parse(m[0]);
    }

    const items = (parsed.items || parsed.qa || parsed.answers || [])
      .map((x) => ({
        q: String(x.q || x.question || "").trim(),
        a: String(x.a || x.answer || "").trim(),
      }))
      .filter((x) => x.q && x.a);

    if (!items.length) throw new Error("没有解析到任何问答");

    state.qa = items;
    saveJson(STORAGE.qa, state.qa);
    renderQa();
    setStatus($("genStatus"), `已生成 ${items.length} 条回答。可点 ▶ 朗读。`, "ok");
  } catch (err) {
    setStatus($("genStatus"), `生成失败：${err.message}`, "error");
  } finally {
    btn.disabled = false;
  }
}

/* ---------------- UI ---------------- */

function renderQa() {
  const list = $("qaList");
  $("qaCount").textContent = `${state.qa.length} 题`;
  if (!state.qa.length) {
    list.innerHTML = `<p class="empty">还没有回答。填好设置与材料后点「生成面试回答」。</p>`;
    return;
  }
  list.innerHTML = state.qa
    .map(
      (item, i) => `
      <article class="qa" data-i="${i}">
        <div class="q">${i + 1}. ${escapeHtml(item.q)}</div>
        <div class="a">${escapeHtml(item.a)}</div>
        <div class="actions">
          <button class="btn good" data-play="${i}" type="button">▶ 朗读</button>
          <button class="btn" data-copy="${i}" type="button">复制</button>
        </div>
      </article>`
    )
    .join("");
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function exportJson() {
  const blob = new Blob([JSON.stringify({ qa: state.qa }, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "interview-answers.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function bind() {
  $("rate").addEventListener("input", () => {
    $("rateLabel").textContent = Number($("rate").value).toFixed(2);
  });

  $("saveSettings").addEventListener("click", () => {
    const s = getSettings();
    saveJson(STORAGE.settings, s);
    setStatus($("settingsStatus"), "设置已保存到本机。", "ok");
  });

  $("testTts").addEventListener("click", async () => {
    stopSpeech();
    await speakText("你好，这是面试教练语音测试。Hello, this is a voice test.");
  });

  $("generate").addEventListener("click", generateAnswers);
  $("playAll").addEventListener("click", () => {
    if (!state.qa.length) return;
    speakAll();
  });
  $("stopAll").addEventListener("click", stopSpeech);
  $("exportJson").addEventListener("click", exportJson);

  $("saveDraft").addEventListener("click", () => {
    saveJson(STORAGE.draft, {
      resume: $("resume").value,
      jd: $("jd").value,
      questions: $("questions").value,
      autoQuestions: $("autoQuestions").checked,
    });
    setStatus($("genStatus"), "草稿已保存。", "ok");
  });

  $("clearQa").addEventListener("click", () => {
    stopSpeech();
    state.qa = [];
    saveJson(STORAGE.qa, []);
    renderQa();
    setStatus($("genStatus"), "已清空回答。", "ok");
  });

  $("qaList").addEventListener("click", async (e) => {
    const play = e.target.closest("[data-play]");
    const copy = e.target.closest("[data-copy]");
    if (play) await speakAnswer(Number(play.dataset.play));
    if (copy) {
      const i = Number(copy.dataset.copy);
      const item = state.qa[i];
      if (item) {
        await navigator.clipboard.writeText(`Q: ${item.q}\n\nA: ${item.a}`);
        setStatus($("genStatus"), "已复制到剪贴板。", "ok");
      }
    }
  });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.deferredInstall = e;
    $("installBtn").hidden = false;
  });

  $("installBtn").addEventListener("click", async () => {
    if (!state.deferredInstall) return;
    state.deferredInstall.prompt();
    await state.deferredInstall.userChoice;
    state.deferredInstall = null;
    $("installBtn").hidden = true;
  });
}

function init() {
  applySettings(loadJson(STORAGE.settings, {}));
  const draft = loadJson(STORAGE.draft, null);
  if (draft) {
    $("resume").value = draft.resume || "";
    $("jd").value = draft.jd || "";
    $("questions").value = draft.questions || "";
    $("autoQuestions").checked = draft.autoQuestions !== false;
  }
  state.qa = loadJson(STORAGE.qa, []);
  renderQa();
  populateVoices();
  speechSynthesis.onvoiceschanged = populateVoices;
  bind();

  if (!getSettings().apiKey) $("settingsPanel").open = true;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  if (window.matchMedia("(display-mode: standalone)").matches) {
    $("pwaBadge").textContent = "已安装";
  }
}

init();
