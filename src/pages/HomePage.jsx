import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  MagicWand,
  SpeakerHigh,
  FilePdf,
  SpinnerGap,
  ArrowCounterClockwise,
  Trash,
  Pause,
  Play,
  Square,
} from "@phosphor-icons/react";
import DocumentField from "../components/DocumentField";
import FocusBubbles from "../components/FocusBubbles";
import QaList from "../components/QaList";
import Shell from "../components/Shell";
import OnboardingTour, { isOnboardingDone } from "../components/OnboardingTour";
import { pinMandatoryFirst } from "../lib/mandatoryQuestions";
import {
  ANSWER_LENGTHS,
  DEFAULT_FOCUSES,
  DEFAULT_INTERVIEWER_ROLE,
  INTERVIEWER_ROLES,
  normalizeFocuses,
  partitionFocuses,
  suggestFocusesFromText,
} from "../lib/interviewModes";
import {
  buildUserPrompt,
  DEFAULT_SYSTEM,
  INVENT_COUNTS,
  normalizeInventCount,
  DEFAULT_INVENT_COUNT,
  parseModelJson,
  planBuildBatches,
} from "../lib/prompt";
import {
  extractCandidateName,
  pickCandidateName,
  applyCandidateNameToItems,
} from "../lib/candidate";
import {
  cleanJobTitle,
  extractJobTitle,
  extractJobCompany,
} from "../lib/jobMeta";
import { exportQaPdf } from "../lib/exportPdf";
import {
  INTERVIEW_LANGS,
  interviewLangLabel,
  normalizeSettings,
  resolveApiKey,
  geminiModelsToTry,
  shouldTryNextGeminiModel,
  voicesForInterviewLang,
  enabledAiProviders,
  aiProviderLabelKey,
  providerToRegion,
} from "../lib/settingsConfig";
import { useI18n } from "../lib/I18nContext";
import { pickTargetPlaceholder } from "../lib/i18n";
import { loadJson, saveJson } from "../lib/storage";
import {
  speakQa,
  speakQaSequence,
  stopSpeech,
  pauseSpeech,
  resumeSpeech,
  exportMergedQaAudio,
} from "../lib/tts";

function readSettings() {
  return normalizeSettings(loadJson("settings", {}));
}

export default function HomePage() {
  const { t, uiLang } = useI18n();
  const reduce = useReducedMotion();
  // One example set per visit — no rotating loop
  const [targetPh, setTargetPh] = useState(() => pickTargetPlaceholder(uiLang));
  useEffect(() => {
    setTargetPh(pickTargetPlaceholder(uiLang));
  }, [uiLang]);
  const [settings, setSettings] = useState(readSettings);
  const [resume, setResume] = useState(() => loadJson("draft", {}).resume || "");
  const [resumeMeta, setResumeMeta] = useState(() => loadJson("draft", {}).resumeMeta || null);
  const [jd, setJd] = useState(() => loadJson("draft", {}).jd || "");
  const [jobTitle, setJobTitle] = useState(() => {
    const draft = loadJson("draft", {});
    return cleanJobTitle(draft.jobTitle) || extractJobTitle(draft.jd || "");
  });
  const [jobCompany, setJobCompany] = useState(() => {
    const draft = loadJson("draft", {});
    return cleanJobTitle(draft.jobCompany) || extractJobCompany(draft.jd || "");
  });
  const [questionsRaw, setQuestionsRaw] = useState(
    () => loadJson("draft", {}).questions || ""
  );
  const [autoQuestions, setAutoQuestions] = useState(
    () => loadJson("draft", {}).autoQuestions !== false
  );
  const [inventCount, setInventCount] = useState(() =>
    normalizeInventCount(loadJson("draft", {}).inventCount)
  );
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingDone());

  // Keep resume / JD / target questions until the user clears them
  useEffect(() => {
    const payload = {
      resume,
      resumeMeta,
      jd,
      jobTitle,
      jobCompany,
      questions: questionsRaw,
      autoQuestions,
      inventCount,
    };
    const id = setTimeout(() => saveJson("draft", payload), 200);
    return () => {
      clearTimeout(id);
      saveJson("draft", payload);
    };
  }, [resume, jd, jobTitle, jobCompany, questionsRaw, autoQuestions, inventCount]);

  const [qa, setQa] = useState(() => {
    const stored = loadJson("qa", []);
    return pinMandatoryFirst(
      Array.isArray(stored) ? stored : [],
      readSettings().lang,
      String(loadJson("draft", {}).questions || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    );
  });
  const [qaEpoch, setQaEpoch] = useState(0);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  // After a failed Build, next attempt starts on the alternate provider
  const [useAltProviderRetry, setUseAltProviderRetry] = useState(false);
  const [status, setStatus] = useState({ text: "", kind: "" });
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [speaking, setSpeaking] = useState(false);
  const [audioPaused, setAudioPaused] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [preparePct, setPreparePct] = useState(0);
  const [prepareClip, setPrepareClip] = useState({ clip: 0, clips: 0 });
  const [fabPos, setFabPos] = useState({ dragged: false, left: 0, top: 0 });
  const [fabDragging, setFabDragging] = useState(false);
  const fabElementRef = useRef(null);
  const fabDragState = useRef({ active: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });
  const [exportingAudio, setExportingAudio] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [audioNote, setAudioNote] = useState({ text: "", kind: "" });
  const [genMeta, setGenMeta] = useState(() => loadJson("genMeta", null));
  const [showGenSecret, setShowGenSecret] = useState(false);
  const practiceSetTaps = useRef({ n: 0, timer: null });
  const playSessionRef = useRef(0);

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const endPlayback = () => {
    setPlayingIndex(-1);
    setSpeaking(false);
    setAudioPaused(false);
    setAudioReady(false);
    setPreparePct(0);
    setPrepareClip({ clip: 0, clips: 0 });
    setAudioNote((prev) =>
      prev.kind === "error" || prev.kind === "ok" ? prev : { text: "", kind: "" }
    );
  };

  const beginPlaySession = () => {
    playSessionRef.current += 1;
    return playSessionRef.current;
  };

  const finishPlaySession = (session, err, meta = {}) => {
    if (playSessionRef.current !== session) return;
    const msg = String(err?.message || err || "");
    // Superseded by Stop / Restart — not a real failure to show.
    if (msg && msg !== "Playback cancelled") {
      flash(msg, "error");
    } else if (!msg && meta.skipped > 0) {
      flash(t("home.flash.audioSkipped", { n: meta.skipped }), "ok");
    }
    endPlayback();
  };

  const haltPlayback = () => {
    playSessionRef.current += 1;
    stopSpeech();
    endPlayback();
  };

  const onFabPointerMove = (event) => {
    if (!fabDragState.current.active) return;
    const dx = event.clientX - fabDragState.current.startX;
    const dy = event.clientY - fabDragState.current.startY;
    const left = fabDragState.current.startLeft + dx;
    const top = fabDragState.current.startTop + dy;
    const minX = 8;
    const minY = 8;
    const maxX = window.innerWidth - 8 - fabDragState.current.width;
    const maxY = window.innerHeight - 8 - fabDragState.current.height;
    setFabPos({
      dragged: true,
      left: clamp(left, minX, maxX),
      top: clamp(top, minY, maxY),
    });
  };

  const onFabPointerUp = () => {
    if (!fabDragState.current.active) return;
    fabDragState.current.active = false;
    setFabDragging(false);
    window.removeEventListener("pointermove", onFabPointerMove);
    window.removeEventListener("pointerup", onFabPointerUp);
    window.removeEventListener("pointercancel", onFabPointerUp);
  };

  const onFabPointerDown = (event) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (target.closest("button")) return;
    const fabRect = fabElementRef.current
      ? fabElementRef.current.getBoundingClientRect()
      : event.currentTarget.getBoundingClientRect();
    fabDragState.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: fabPos.dragged ? fabPos.left : fabRect.left,
      startTop: fabPos.dragged ? fabPos.top : fabRect.top,
      width: fabRect.width,
      height: fabRect.height,
    };
    setFabDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", onFabPointerMove);
    window.addEventListener("pointerup", onFabPointerUp);
    window.addEventListener("pointercancel", onFabPointerUp);
  };

  const togglePause = async () => {
    if (!speaking || !audioReady) return;
    if (audioPaused) {
      const ok = await resumeSpeech();
      if (ok) setAudioPaused(false);
    } else if (pauseSpeech()) {
      setAudioPaused(true);
    }
  };

  useEffect(() => {
    if (!status.text) return undefined;
    const ms =
      status.kind === "error" ? 5200 : status.kind === "ok" ? 2800 : 4200;
    const id = setTimeout(() => setStatus({ text: "", kind: "" }), ms);
    return () => clearTimeout(id);
  }, [status]);

  const questions = useMemo(
    () =>
      questionsRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [questionsRaw]
  );

  // Pick up settings after visiting /settings or UI-lang sync
  useEffect(() => {
    const refresh = () => setSettings(readSettings());
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("briefroom-storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("briefroom-storage", refresh);
    };
  }, []);

  // Keep must-ask labels aligned with interview language (including Settings changes)
  useEffect(() => {
    setQa((prev) => {
      if (!prev?.length) return prev;
      const next = pinMandatoryFirst(prev, settings.lang, questions);
      const same =
        next.length === prev.length &&
        next.every((item, i) => item.q === prev[i]?.q && item.a === prev[i]?.a);
      if (same) return prev;
      saveJson("qa", next);
      return next;
    });
  }, [settings.lang, questions]);

  useEffect(() => {
    setSelected(new Set(qa.map((_, i) => i)));
  }, [qa]);

  useEffect(() => {
    if (!resetConfirmOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setResetConfirmOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetConfirmOpen]);

  const flash = (text, kind = "") => setStatus({ text, kind });

  const patchSettings = (partial) => {
    const next = normalizeSettings({ ...readSettings(), ...partial });
    saveJson("settings", next);
    setSettings(next);
  };

  const resetAllContent = () => {
    setResetConfirmOpen(false);
    haltPlayback();
    setJd("");
    setJobTitle("");
    setJobCompany("");
    setQuestionsRaw("");
    setAutoQuestions(true);
    setInventCount(DEFAULT_INVENT_COUNT);
    setQa([]);
    setSelected(new Set());
    setQaEpoch((n) => n + 1);
    saveJson("draft", {
      resume,
      resumeMeta,
      jd: "",
      jobTitle: "",
      jobCompany: "",
      questions: "",
      autoQuestions: true,
      inventCount: DEFAULT_INVENT_COUNT,
    });
    saveJson("qa", []);
    saveJson("genMeta", null);
    setGenMeta(null);
    setShowGenSecret(false);
    patchSettings({ focuses: [...DEFAULT_FOCUSES], interviewerRole: DEFAULT_INTERVIEWER_ROLE });
    flash(t("home.flash.resetAll"), "ok");
  };

  const clearAnswers = () => {
    haltPlayback();
    setQa([]);
    setSelected(new Set());
    setQaEpoch((n) => n + 1);
    saveJson("qa", []);
    saveJson("genMeta", null);
    setGenMeta(null);
    setShowGenSecret(false);
    flash(t("home.flash.cleared"), "ok");
  };

  const onPracticeSetSecretTap = () => {
    const taps = practiceSetTaps.current;
    taps.n += 1;
    clearTimeout(taps.timer);
    taps.timer = setTimeout(() => {
      taps.n = 0;
    }, 2500);
    if (taps.n >= 5) {
      taps.n = 0;
      setShowGenSecret((on) => !on);
    }
  };

  const genSecretLabel = useMemo(() => {
    if (!genMeta?.model) return "";
    const label = t(aiProviderLabelKey(settings.aiProvider));
    return `${label} · ${genMeta.model}`;
  }, [genMeta, settings.aiProvider, t]);

  /** Fill Settings → Your name after AI spots one (user edit wins). */
  const catchNameIfEmpty = useCallback((spotted) => {
    const name = String(spotted || "").trim();
    if (!name) return "";
    const cur = readSettings();
    if (String(cur.name || "").trim()) return name;
    patchSettings({ name });
    return name;
  }, []);

  const setInterviewLang = (lang) => {
    const cur = readSettings();
    const voices = voicesForInterviewLang(
      lang,
      cur.voiceQ,
      cur.voiceA,
      cur.gender
    );
    patchSettings({ lang, ...voices });

    // Relabel pinned must-asks to match the new interview language
    setQa((prev) => {
      const next = pinMandatoryFirst(prev, lang, questions);
      saveJson("qa", next);
      return next;
    });
    setQaEpoch((n) => n + 1);

    flash(
      t("home.flash.lang", { lang: interviewLangLabel(lang) }),
      "ok"
    );
  };

  const suggestedFocuses = useMemo(
    () =>
      suggestFocusesFromText({
        resume,
        jd,
        interviewerRole: settings.interviewerRole,
      }),
    [resume, jd, settings.interviewerRole]
  );

  const { recommended, extras } = useMemo(
    () => partitionFocuses(settings.focuses, suggestedFocuses),
    [settings.focuses, suggestedFocuses]
  );

  const toggleFocus = (id) => {
    const cur = normalizeFocuses(readSettings().focuses);
    const next = cur.includes(id)
      ? cur.filter((x) => x !== id)
      : [...cur, id];
    patchSettings({
      focuses: normalizeFocuses(
        next.length ? next : hasDocsFocusFallback()
      ),
    });
  };

  function hasDocsFocusFallback() {
    return resume.trim() || jd.trim()
      ? suggestedFocuses
      : [...DEFAULT_FOCUSES];
  }

  async function generate() {
    const latest = readSettings();
    setSettings(latest);

    const apiKey = resolveApiKey(latest);

    if (!resume.trim() || !jd.trim()) {
      flash(t("home.flash.needDocs"), "error");
      return;
    }

    saveJson("draft", {
      resume,
      jd,
      questions: questionsRaw,
      autoQuestions,
      inventCount,
    });
    setLoading(true);
    haltPlayback();

    const promptBase = {
      resume,
      jd,
      questions,
      lang: latest.lang,
      autoQuestions,
      answerLength: latest.answerLength,
      focuses: latest.focuses,
      interviewerRole: latest.interviewerRole,
      candidateName:
        String(latest.name || "").trim() || extractCandidateName(resume),
      gender: latest.gender,
    };
    const addonCount = questions.filter((q) => q.trim()).length;
    const batches = planBuildBatches({
      inventCount,
      autoQuestions,
      lang: latest.lang,
      answerLength: latest.answerLength,
      addonCount,
    });

    try {
      const order = enabledAiProviders(latest);
      if (!order.length) {
        flash(t("home.flash.noProvider"), "error");
        return;
      }
      // Fresh Build: try preferred then alt in the same click (each /api/chat
      // gets a full Vercel budget). After a prior failure flag, start on alt.
      const providersQueue =
        useAltProviderRetry && order.length > 1 ? [order[1]] : [...order];
      const enabledHeader = order.join(",");

      let provider = providersQueue[0];

      // Prefer /api/chat (user key + Vercel keys rotate there). Local Vite has no
      // chat proxy — fall back to direct Gemini with the pasted key only.
      async function callChat(payload) {
        const headers = {
          "Content-Type": "application/json",
          "X-Linecheck-AI-Provider": provider,
          "X-Linecheck-AI-Enabled": enabledHeader,
          // legacy header — kept for older proxies
          "X-Linecheck-AI-Region": providerToRegion(provider),
        };
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          });
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const data = await res.json().catch(() => ({}));
            return { res, data };
          }
          // 504 HTML / gateway timeout — Vercel killed the function (~60s)
          if (res.status === 504 || res.status === 502) {
            return {
              res,
              data: {
                error: {
                  message: t("home.flash.timeout", {
                    provider: t(aiProviderLabelKey(provider)),
                  }),
                },
              },
            };
          }
        } catch (err) {
          /* offline / no local api / browser "Failed to fetch" on gateway kill */
          const msg = String(err?.message || "");
          if (/failed to fetch|networkerror|load failed/i.test(msg)) {
            return {
              res: { ok: false, status: 504, statusText: "Gateway Timeout" },
              data: {
                error: {
                  message: t("home.flash.timeout", {
                    provider: t(aiProviderLabelKey(provider)),
                  }),
                },
              },
            };
          }
        }
        if (!apiKey) {
          return {
            res: { ok: false, status: 503, statusText: "No API" },
            data: { error: { message: "No server key and no local key" } },
          };
        }
        const res = await fetch(
          `${latest.baseUrl.replace(/\/$/, "")}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          }
        );
        const data = await res.json().catch(() => ({}));
        return { res, data };
      }

      async function callChatWithModel(model, body) {
        let { res, data } = await callChat({
          ...body,
          model,
          response_format: { type: "json_object" },
        });
        if (
          !res.ok &&
          /response_format|json_object|unknown/i.test(data?.error?.message || "")
        ) {
          ({ res, data } = await callChat({ ...body, model }));
        }
        return { res, data };
      }

      /** One batch through provider/model failover. Returns parsed items + meta. */
      async function runBatch(batch, queue) {
        const userContent = buildUserPrompt({
          ...promptBase,
          inventCount: batch.inventCount,
          extrasOnly: batch.extrasOnly,
        });
        const body = {
          temperature: 0.6,
          max_tokens: batch.maxTokens,
          messages: [
            { role: "system", content: latest.systemPrompt || DEFAULT_SYSTEM },
            { role: "user", content: userContent },
          ],
        };
        const models = geminiModelsToTry(latest.model);
        let batchRes;
        let batchData;
        let batchStatus = 0;
        providerLoop: for (let pi = 0; pi < queue.length; pi++) {
          provider = queue[pi];
          for (let i = 0; i < models.length; i++) {
            ({ res: batchRes, data: batchData } = await callChatWithModel(
              models[i],
              body
            ));
            batchStatus = batchRes.status;
            if (batchRes.ok) break providerLoop;
            if (batchRes.status === 503) {
              if (pi < queue.length - 1) continue providerLoop;
              throw new Error(
                batchData?.error?.message || t("home.flash.needKey")
              );
            }
            if (batchRes.status === 504 || batchRes.status === 502) {
              if (pi < queue.length - 1) continue providerLoop;
              throw new Error(
                batchData?.error?.message ||
                  t("home.flash.timeout", {
                    provider: t(aiProviderLabelKey(provider)),
                  })
              );
            }
            if (
              shouldTryNextGeminiModel(batchRes.status, batchData) &&
              i < models.length - 1
            ) {
              continue;
            }
            break;
          }
          if (!batchRes.ok && pi < queue.length - 1) continue;
          break;
        }
        if (!batchRes.ok) {
          if (batchStatus === 429 || batchStatus === 404) {
            const err = new Error(
              batchStatus === 429
                ? t("home.flash.rateLimited")
                : t("home.flash.modelUnavailable")
            );
            err.code = batchStatus;
            throw err;
          }
          const detail =
            batchData?.error?.message ||
            batchData?.error?.status ||
            (typeof batchData?.error === "string" ? batchData.error : "") ||
            batchRes.statusText ||
            `HTTP ${batchRes.status}`;
          throw new Error(detail);
        }
        const content = batchData.choices?.[0]?.message?.content || "";
        let parsed;
        try {
          parsed = parseModelJson(content);
        } catch (e) {
          throw new Error(`Model did not return valid JSON: ${e.message}`);
        }
        const raw = (parsed.items || parsed.qa || parsed.answers || [])
          .map((x) => ({
            q: String(x.q || x.question || "").trim(),
            a: String(x.a || x.answer || "").trim(),
            category: String(x.category || "").trim() || null,
            map: x.map && typeof x.map === "object" ? x.map : null,
          }))
          .filter((x) => x.q && x.a);
        if (!raw.length) throw new Error("No Q&A parsed from response");
        return { raw, parsed, data: batchData, provider };
      }

      const merged = [];
      let parsedMeta = null;
      let modelData = null;
      // Stick to the provider that won batch 1 for batch 2 (same click budget).
      let queue = [...providersQueue];
      for (const batch of batches) {
        const result = await runBatch(batch, queue);
        merged.push(...result.raw);
        if (!parsedMeta) parsedMeta = result.parsed;
        modelData = result.data;
        queue = [result.provider];
      }

      const spotted = pickCandidateName(
        parsedMeta?.candidateName || parsedMeta?.name,
        resume
      );
      const fromAi = catchNameIfEmpty(spotted);
      const nameForAnswers =
        String(readSettings().name || "").trim() || fromAi || spotted;

      const named = applyCandidateNameToItems(merged, nameForAnswers);
      const items = pinMandatoryFirst(named, latest.lang, questions);
      const modelUsed = String(modelData?.model || latest.model || "").trim();
      if (modelUsed) {
        const meta = { model: modelUsed, at: new Date().toISOString() };
        saveJson("genMeta", meta);
        setGenMeta(meta);
      }
      // AI often sees the real role name even when LinkedIn scrape polluted jobTitle
      const aiTitle = cleanJobTitle(
        parsedMeta?.jobTitle || parsedMeta?.role || parsedMeta?.title || ""
      );
      const aiCompany = cleanJobTitle(parsedMeta?.company || "");
      if (aiTitle) setJobTitle(aiTitle);
      if (aiCompany) setJobCompany(aiCompany);
      setUseAltProviderRetry(false);
      setQa(items);
      setQaEpoch((n) => n + 1);
      setSelected(new Set());
      saveJson("qa", items);
      const addonN = questions.filter((q) => q.trim()).length;
      flash(
        t("home.flash.generated", {
          n: items.length,
          lang: interviewLangLabel(latest.lang),
          addons: addonN ? t("home.flash.addons", { n: addonN }) : "",
        }),
        "ok"
      );
    } catch (e) {
      const order = enabledAiProviders(latest);
      if (e?.code === 429 || e?.code === 404) {
        setUseAltProviderRetry(true);
        flash(e.message, "error");
      } else if (!useAltProviderRetry && order.length > 1) {
        setUseAltProviderRetry(true);
        flash(t("home.flash.retryAltProvider"), "error");
      } else {
        flash(`Generate failed: ${e.message}`, "error");
      }
    } finally {
      setLoading(false);
    }
  }

  const toggle = (i) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (qa.length && prev.size === qa.length) return new Set();
      return new Set(qa.map((_, i) => i));
    });
  };

  const playOne = useCallback(
    async (i) => {
      const latest = readSettings();
      const session = beginPlaySession();
      stopSpeech();
      setSpeaking(true);
      setAudioPaused(false);
      setAudioReady(false);
      setStatus({ text: "", kind: "" });
      setAudioNote({ text: t("home.preparingAudio"), kind: "" });
      try {
        await speakQa(qa[i].q, qa[i].a, {
          rate: latest.rate,
          voiceQ: latest.voiceQ,
          voiceA: latest.voiceA,
          lang: latest.lang,
          onStart: () => {
            if (playSessionRef.current !== session) return;
            setPlayingIndex(i);
            setAudioReady(true);
            setAudioNote({ text: "", kind: "" });
          },
        });
        finishPlaySession(session);
      } catch (e) {
        finishPlaySession(session, e);
      }
    },
    [qa, t]
  );

  const playSelected = async () => {
    const indices = [...selected]
      .sort((a, b) => a - b)
      .filter((i) => qa[i]?.a?.trim());
    if (!indices.length) {
      flash(t("home.flash.selectAnswer"), "error");
      return;
    }
    const latest = readSettings();
    const session = beginPlaySession();
    stopSpeech();
    setSpeaking(true);
    setAudioPaused(false);
    setAudioReady(false);
    setStatus({ text: "", kind: "" });
    const entries = indices.map((i) => {
      const preface =
        latest.lang === "zh"
          ? `第${i + 1}题。`
          : latest.lang === "both"
            ? `Question ${i + 1}. / 第${i + 1}题。`
            : `Question ${i + 1}.`;
      return { q: qa[i].q, a: qa[i].a, preface };
    });
    setAudioNote({ text: t("home.preparingAudio"), kind: "" });
    setPreparePct(0);
    setPrepareClip({ clip: 0, clips: entries.length });
    try {
      const result = await speakQaSequence(entries, {
        rate: latest.rate,
        voiceQ: latest.voiceQ,
        voiceA: latest.voiceA,
        lang: latest.lang,
        onPrepareProgress: ({ percent, clip, clips, cached }) => {
          if (playSessionRef.current !== session) return;
          setPreparePct(percent);
          setPrepareClip({ clip, clips });
          setAudioNote({
            text: cached
              ? t("home.preparingAudioCached")
              : t("home.preparingAudioClip", { n: percent, clip, clips }),
            kind: "",
          });
        },
        onProgress: (j) => {
          if (playSessionRef.current !== session) return;
          setPlayingIndex(j >= 0 ? indices[j] : -1);
        },
        onStart: () => {
          if (playSessionRef.current !== session) return;
          setAudioReady(true);
          setAudioNote({ text: "", kind: "" });
        },
      });
      finishPlaySession(session, null, result);
    } catch (e) {
      finishPlaySession(session, e);
    }
  };

  const handleJdChange = (text, meta) => {
    if (meta?.source === "url") {
      const body = String(meta.body || "").trim();
      if (!body) {
        setJd("");
        setJobTitle("");
        setJobCompany("");
        return;
      }
      setJd(body);
      setJobTitle(
        cleanJobTitle(meta.title || text) || extractJobTitle(body)
      );
      setJobCompany(
        cleanJobTitle(meta.company) || extractJobCompany(body)
      );
      return;
    }

    const next = String(text || "");
    setJd(next);
    if (!next.trim()) {
      setJobTitle("");
      setJobCompany("");
      return;
    }
    setJobTitle(cleanJobTitle(meta?.title) || extractJobTitle(next));
    setJobCompany(cleanJobTitle(meta?.company) || extractJobCompany(next));
  };

  const exportPdf = async (indices) => {
    const list = (indices?.length
      ? indices
      : selected.size
        ? [...selected]
        : qa.map((_, i) => i)
    )
      .sort((a, b) => a - b)
      .filter((i) => qa[i]?.a?.trim() || qa[i]?.q?.trim())
      .map((i) => qa[i]);

    if (!list.length) {
      setAudioNote({ text: t("home.flash.selectAnswer"), kind: "error" });
      return;
    }

    const latest = readSettings();
    setExportingPdf(true);
    setAudioNote({ text: t("home.exportingPdf"), kind: "" });
    try {
      const n = await exportQaPdf(list, {
        jobTitle,
        company: jobCompany,
        candidateName: latest.name,
      });
      setAudioNote({
        text: t("home.flash.pdfSaved", { n }),
        kind: "ok",
      });
    } catch (e) {
      setAudioNote({
        text: t("home.flash.pdfFailed", {
          detail: e.message || "PDF export failed.",
        }),
        kind: "error",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const exportAudio = async (indices) => {
    const list = (indices?.length
      ? indices
      : selected.size
        ? [...selected]
        : qa.map((_, i) => i)
    )
      .sort((a, b) => a - b)
      .filter((i) => qa[i]?.a?.trim() || qa[i]?.q?.trim())
      .map((i) => qa[i]);

    if (!list.length) {
      setAudioNote({ text: t("home.flash.selectAnswer"), kind: "error" });
      return;
    }

    const latest = readSettings();
    setExportingAudio(true);
    setAudioNote({ text: t("home.exportingAudio"), kind: "" });
    try {
      const n = await exportMergedQaAudio(list, {
        rate: latest.rate,
        voiceQ: latest.voiceQ,
        voiceA: latest.voiceA,
        lang: latest.lang,
        jobTitle,
        candidateName: latest.name,
      });
      setAudioNote({
        text: t("home.flash.audioSaved", { n }),
        kind: "ok",
      });
    } catch (e) {
      setAudioNote({
        text: t("home.flash.audioFailed", {
          detail: e.message || "TTS failed.",
        }),
        kind: "error",
      });
    } finally {
      setExportingAudio(false);
    }
  };

  return (
    <Shell>
      <div className="settings-page">
        <div className="settings-grid-bg" aria-hidden />
        <header className="settings-hero mb-6 md:mb-10">
          <p className="settings-eyebrow">{t("home.eyebrow")}</p>
          <h1 className="settings-title">
            {t("brand.name")}
            <span className="settings-title-accent">.</span>
          </h1>
          <p className="line-responsive mt-2 max-w-[36ch] text-sm leading-relaxed mute md:mt-3 md:max-w-[48ch] md:text-base">
            {t("home.tagline")}
          </p>
        </header>

      <section className="panel mb-4 space-y-5 p-4 sm:p-5 md:mb-5 md:space-y-6 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="label mb-1.5">{t("home.prepLabel")}</p>
            <h2 className="display text-lg title md:text-2xl">
              {t("home.prepTitle")}
            </h2>
            <p className="mt-1 max-w-[54ch] text-xs leading-relaxed mute md:mt-1.5 md:text-sm">
              {t("home.prepHint")}
            </p>
          </div>
          <button
            type="button"
            className="btn shrink-0"
            onClick={() => setResetConfirmOpen(true)}
            title={t("home.resetAllHint")}
          >
            <ArrowCounterClockwise size={16} weight="bold" />
            {t("home.resetAll")}
          </button>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold title">{t("home.interviewLang")}</h3>
          <div
            className="choice-row"
            role="radiogroup"
            aria-label={t("home.interviewLang")}
          >
            {INTERVIEW_LANGS.map((opt) => {
              const on = settings.lang === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={t(`lang.${opt.id}.detail`)}
                  className={`choice-card ${on ? "is-on" : ""}`}
                  onClick={() => setInterviewLang(opt.id)}
                >
                  <span className="choice-card-eyebrow">{t(`lang.${opt.id}.eyebrow`)}</span>
                  <span className="choice-card-title">{t(`lang.${opt.id}.label`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold title">{t("home.answerLength")}</h3>
          <div
            className="choice-row"
            role="radiogroup"
            aria-label={t("home.answerLength")}
          >
            {ANSWER_LENGTHS.map((opt) => {
              const on = settings.answerLength === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={`${t(`length.${opt.id}.short`)} · ${t(`length.${opt.id}.hint`)}`}
                  className={`choice-card ${on ? "is-on" : ""}`}
                  onClick={() => patchSettings({ answerLength: opt.id })}
                >
                  <span className="choice-card-title">{t(`length.${opt.id}.label`)}</span>
                  <span className="choice-card-time">{t(`length.${opt.id}.short`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold title">{t("home.interviewerRole")}</h3>
          <p className="mb-2 text-xs mute">{t("home.interviewerRoleHint")}</p>
          <div
            className="choice-row choice-row--4"
            role="radiogroup"
            aria-label={t("home.interviewerRole")}
          >
            {INTERVIEWER_ROLES.map((opt) => {
              const on = settings.interviewerRole === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={t(`role.${opt.id}.hint`)}
                  className={`choice-card ${on ? "is-on" : ""}`}
                  onClick={() => patchSettings({ interviewerRole: opt.id })}
                >
                  <span className="choice-card-eyebrow">{t(`role.${opt.id}.eyebrow`)}</span>
                  <span className="choice-card-title">{t(`role.${opt.id}.label`)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="doc-twin mb-4 lg:mb-5">
        <DocumentField
          title={t("home.resume")}
          hint={t("home.resumeHint")}
          value={resume}
          sourceMeta={resumeMeta}
          onChange={(text, meta) => {
            setResume(text);
            setResumeMeta(meta || null);
          }}
          placeholder={t("home.resumePlaceholder")}
        />
        <DocumentField
          title={t("home.jd")}
          hint={t("home.jdHint")}
          value={jobTitle.trim() ? jobTitle : jd}
          onChange={handleJdChange}
          displayTitle={jobTitle}
          displaySubtitle={jobCompany}
          placeholder={t("home.jdPlaceholder")}
          allowUrl
        />
      </div>

      <section className="panel mb-4 space-y-3 p-4 sm:p-5 md:mb-5 md:space-y-4 md:p-6">
        <div className="focus-head">
          <div className="focus-head-top">
            <h2 className="display text-lg font-semibold title md:text-xl">
              {t("home.focusThemes")}
            </h2>
            <span className="focus-count inline-flex shrink-0">
              {t("home.focusSelectedPrefix") ? (
                <span className="focus-count-label !pl-2">
                  {t("home.focusSelectedPrefix")}
                </span>
              ) : null}
              <span className="focus-count-n">
                {(settings.focuses || []).length}
              </span>
              <span className="focus-count-label">
                {t("home.focusSelectedSuffix")}
              </span>
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed mute md:text-sm">
            {t("home.focusThemesHint")}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#4a7ff8]">
              {resume.trim() ||
              jd.trim() ||
              (settings.interviewerRole && settings.interviewerRole !== "any")
                ? t("home.suggested")
                : t("home.standardThemes")}
            </p>
            <FocusBubbles
              items={recommended}
              selectedIds={settings.focuses || []}
              onToggle={toggleFocus}
              tone="primary"
              t={t}
              label={
                resume.trim() ||
                jd.trim() ||
                (settings.interviewerRole && settings.interviewerRole !== "any")
                  ? t("home.suggested")
                  : t("home.standardThemes")
              }
            />
          </div>

          {extras.length ? (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8b939e]">
                {t("home.optionalExtras")}
              </p>
              <FocusBubbles
                items={extras}
                selectedIds={settings.focuses || []}
                onToggle={toggleFocus}
                tone="soft"
                t={t}
                label={t("home.optionalExtras")}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel mb-4 p-4 sm:p-5 md:mb-5 md:p-6">
        <h2 className="line-responsive display text-lg font-semibold title md:text-xl">
          {t("home.targetQs")}
        </h2>
        <p className="mt-1 text-xs leading-relaxed mute md:mt-1.5 md:text-sm">
          {t("home.targetQsHint")}
        </p>
        <textarea
          className="field mt-3 min-h-[88px] md:mt-4 md:min-h-[120px]"
          value={questionsRaw}
          onChange={(e) => setQuestionsRaw(e.target.value)}
          placeholder={targetPh}
          aria-label={t("home.targetQs")}
        />
        <div className="mt-3 flex flex-col gap-2.5 md:mt-4">
          <label className="flex items-center gap-2 text-sm ink">
              <input
                type="checkbox"
                checked={autoQuestions}
                onChange={(e) => setAutoQuestions(e.target.checked)}
                className="accent-check"
              />
              {t("home.autoInvent")}
            </label>
            <AnimatePresence initial={false}>
              {autoQuestions ? (
                <motion.div
                  key="invent-count"
                  className="count-tiles"
                  role="radiogroup"
                  aria-label={t("home.inventCount")}
                  initial={
                    reduce ? false : { opacity: 0, scale: 0.97 }
                  }
                  animate={{ opacity: 1, scale: 1 }}
                  exit={
                    reduce
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.97 }
                  }
                  transition={{
                    duration: reduce ? 0.14 : 0.18,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{ transformOrigin: "left center" }}
                >
                  <span className="count-tiles-label">
                    {t("home.inventCount")}
                  </span>
                  <div className="count-tiles-row">
                    {INVENT_COUNTS.map((n) => {
                      const on = inventCount === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          className={`count-tile ${on ? "is-on" : ""}`}
                          onClick={() => setInventCount(n)}
                        >
                          {on ? (
                            <motion.span
                              layoutId={
                                reduce ? undefined : "invent-count-thumb"
                              }
                              className="count-tile-thumb"
                              transition={{
                                duration: 0.18,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                            />
                          ) : null}
                          <span className="count-tile-num">{n}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

        <div className="mt-4 flex justify-center md:mt-5">
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading}
            onClick={generate}
          >
            {loading ? (
              <SpinnerGap size={16} weight="bold" className="animate-spin" />
            ) : (
              <MagicWand size={16} weight="bold" />
            )}
            {loading ? t("home.generating") : t("home.generate")}
          </button>
        </div>
        <AnimatePresence>
          {status.text ? (
            <motion.p
              key={status.text}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`mt-3 text-sm ${
                status.kind === "error"
                  ? "err"
                  : status.kind === "ok"
                    ? "ok"
                    : "warn"
              }`}
            >
              {status.text}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </section>

      <section className="panel p-4 sm:p-5 md:p-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3 md:mb-4">
          <div className="min-w-0 flex-1">
            <h2
              className="display text-lg font-semibold title md:text-xl"
              onClick={onPracticeSetSecretTap}
            >
              {t("home.questions")}
            </h2>
            <p className="mt-1 text-xs leading-relaxed mute md:mt-1.5 md:text-sm">
              {t("home.questionsHint")}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {qa.length ? (
              <button
                type="button"
                className="btn btn-clear shrink-0"
                onClick={clearAnswers}
                title={t("home.clearAnswersHint")}
                disabled={speaking || loading}
              >
                <Trash size={16} weight="bold" />
                {t("home.clearAnswers")}
              </button>
            ) : null}
            {showGenSecret && genSecretLabel ? (
              <span
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] leading-none tracking-tight text-[#c5cad1] sm:text-[11px]"
                title={genSecretLabel}
              >
                {genSecretLabel}
              </span>
            ) : null}
          </div>
        </div>
        <QaList
          key={qaEpoch}
          items={qa}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onPlayOne={playOne}
          onSaveAudio={(i) => exportAudio([i])}
          onCopy={async (i) => {
            await navigator.clipboard.writeText(`Q: ${qa[i].q}\n\nA: ${qa[i].a}`);
          }}
          playingIndex={playingIndex}
          loading={loading}
          loadingCount={
            3 +
            questions.filter((q) => q.trim()).length +
            (autoQuestions ? normalizeInventCount(inventCount) : 0)
          }
          exportingAudio={exportingAudio || exportingPdf}
        />
      </section>

      <div className="action-dock-wrap sticky z-20 mt-5 md:mt-8">
        <motion.div className="action-dock">
          <button
            type="button"
            className={`action-dock-speak ${speaking ? "action-dock-speak--active" : ""}`}
            aria-label={speaking ? t("home.restart") : t("home.speakLabel")}
            title={speaking ? t("home.restart") : t("home.speakLabel")}
            disabled={!qa.length}
            onClick={playSelected}
          >
            {speaking ? (
              <>
                <ArrowCounterClockwise size={16} weight="bold" />
                <span className="action-dock-badge">{selected.size}</span>
              </>
            ) : (
              <>
                <Play size={18} weight="bold" />
                <span className="action-dock-badge">{selected.size}</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="action-dock-save"
            disabled={!qa.length || exportingAudio || exportingPdf || speaking}
            onClick={() => exportAudio()}
            title={t("home.saveAudioHint")}
          >
            {exportingAudio ? (
              t("home.exportingAudioShort")
            ) : (
              <>
                <span className="action-dock-export-body">
                  <SpeakerHigh size={16} weight="bold" />
                  <span className="action-dock-export-label">
                    <span>{t("home.exportLine1")}</span>
                    <span>{t("home.exportAudioLabel")}</span>
                  </span>
                </span>
                <span className="action-dock-badge">
                  {selected.size || qa.length}
                </span>
              </>
            )}
          </button>
          <button
            type="button"
            className="action-dock-pdf"
            disabled={!qa.length || exportingAudio || exportingPdf || speaking}
            onClick={() => exportPdf()}
            title={t("home.savePdfHint")}
          >
            {exportingPdf ? (
              t("home.exportingPdfShort")
            ) : (
              <>
                <span className="action-dock-export-body">
                  <FilePdf size={16} weight="bold" />
                  <span className="action-dock-export-label">
                    <span>{t("home.exportLine1")}</span>
                    <span>{t("home.exportPdfLabel")}</span>
                  </span>
                </span>
                <span className="action-dock-badge">
                  {selected.size || qa.length}
                </span>
              </>
            )}
          </button>
        </motion.div>
        <AnimatePresence mode="wait" initial={false}>
          {audioNote.text ? (
            <motion.div
              key={audioNote.text}
              className={`action-dock-note ${
                audioNote.kind === "error"
                  ? "err flex items-center justify-between pointer-events-auto shadow-sm"
                  : audioNote.kind === "ok"
                    ? "ok"
                    : "mute"
              }`}
              role="status"
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              transition={{
                duration: 0.18,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <span>{audioNote.text}</span>
              {audioNote.kind === "error" && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="ml-3 flex items-center gap-1 rounded bg-black/10 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-inherit hover:bg-black/20 focus-visible:ring active:scale-95 dark:bg-white/10 dark:hover:bg-white/20"
                  title="Refresh page"
                >
                  <ArrowCounterClockwise size={14} weight="bold" />
                  Refresh
                </button>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {speaking ? (
          <div
            key="playback-fab"
            ref={fabElementRef}
            className={`playback-fab ${fabDragging ? "dragging" : ""} ${fabPos.dragged ? "playback-fab--placed" : "playback-fab--enter"}`}
            role="group"
            aria-label={t("home.playbackControls")}
            style={
              fabPos.dragged
                ? {
                    left: fabPos.left,
                    top: fabPos.top,
                    bottom: "auto",
                    right: "auto",
                  }
                : undefined
            }
            onPointerDown={onFabPointerDown}
          >
            <span className="playback-fab-label">
              {!audioReady && !audioPaused ? (
                <>
                  <SpinnerGap size={16} className="animate-spin" />
                  {preparePct > 0
                    ? preparePct >= 100 &&
                      prepareClip.clip === prepareClip.clips
                      ? t("home.preparingAudioCached")
                      : t("home.preparingAudioClip", {
                          n: preparePct,
                          clip: prepareClip.clip || 1,
                          clips: prepareClip.clips || 1,
                        })
                    : t("home.preparingAudio")}
                </>
              ) : audioPaused ? (
                t("home.paused")
              ) : (
                t("home.playingAudio")
              )}
            </span>
            <button
              type="button"
              className="playback-fab-btn playback-fab-toggle"
              disabled={!audioReady}
              aria-label={audioPaused ? t("home.resumePlay") : t("home.pause")}
              title={audioPaused ? t("home.resumePlay") : t("home.pause")}
              onClick={togglePause}
            >
              {audioPaused ? (
                <Play size={20} weight="fill" />
              ) : (
                <Pause size={20} weight="fill" />
              )}
            </button>
            <button
              type="button"
              className="playback-fab-btn playback-fab-stop"
              aria-label={t("home.stop")}
              title={t("home.stop")}
              onClick={haltPlayback}
            >
              <Square size={16} weight="fill" />
            </button>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {resetConfirmOpen ? (
          <motion.div
            key="reset-confirm"
            className="app-dialog-backdrop"
            role="presentation"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setResetConfirmOpen(false)}
          >
            <motion.div
              className="app-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="reset-confirm-title"
              aria-describedby="reset-confirm-body"
              initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="reset-confirm-title" className="app-dialog-title">
                {t("home.resetAllConfirmTitle")}
              </h2>
              <p id="reset-confirm-body" className="app-dialog-body">
                {t("home.resetAllConfirmBody")}
              </p>
              <div className="app-dialog-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setResetConfirmOpen(false)}
                >
                  {t("doc.cancel")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={resetAllContent}
                >
                  {t("home.resetAll")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      </div>

      <AnimatePresence>
        {showOnboarding ? (
          <OnboardingTour onFinish={() => setShowOnboarding(false)} />
        ) : null}
      </AnimatePresence>
    </Shell>
  );
}
