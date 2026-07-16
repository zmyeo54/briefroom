import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MagicWand,
  SpeakerHigh,
  Stop,
  DownloadSimple,
  FloppyDisk,
} from "@phosphor-icons/react";
import DocumentField from "../components/DocumentField";
import FocusBubbles from "../components/FocusBubbles";
import QaList from "../components/QaList";
import Shell from "../components/Shell";
import { pinMandatoryFirst } from "../lib/mandatoryQuestions";
import {
  ANSWER_LENGTHS,
  DEFAULT_FOCUSES,
  normalizeFocuses,
  partitionFocuses,
  suggestFocusesFromText,
} from "../lib/interviewModes";
import { buildUserPrompt, DEFAULT_SYSTEM } from "../lib/prompt";
import {
  extractCandidateName,
  applyCandidateNameToItems,
} from "../lib/candidate";
import {
  INTERVIEW_LANGS,
  interviewLangLabel,
  normalizeSettings,
  voicesForInterviewLang,
} from "../lib/settingsConfig";
import { useI18n } from "../lib/I18nContext";
import { loadJson, saveJson } from "../lib/storage";
import { speakQa, stopSpeech, exportMergedQaAudio } from "../lib/tts";

function readSettings() {
  return normalizeSettings(loadJson("settings", {}));
}

export default function HomePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(readSettings);
  const [resume, setResume] = useState(() => loadJson("draft", {}).resume || "");
  const [jd, setJd] = useState(() => loadJson("draft", {}).jd || "");
  const [questionsRaw, setQuestionsRaw] = useState(
    () => loadJson("draft", {}).questions || ""
  );
  const [autoQuestions, setAutoQuestions] = useState(
    () => loadJson("draft", {}).autoQuestions !== false
  );

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
  const [status, setStatus] = useState({ text: "", kind: "" });
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [speaking, setSpeaking] = useState(false);
  const [exportingAudio, setExportingAudio] = useState(false);
  const [audioNote, setAudioNote] = useState({ text: "", kind: "" });

  const questions = useMemo(
    () =>
      questionsRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [questionsRaw]
  );

  // Pick up settings after visiting /settings
  useEffect(() => {
    const refresh = () => setSettings(readSettings());
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
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

  const candidateName = useMemo(() => {
    const fromSettings = String(settings.name || "").trim();
    if (fromSettings) return fromSettings;
    return extractCandidateName(resume);
  }, [settings.name, resume]);

  const flash = (text, kind = "") => setStatus({ text, kind });

  const patchSettings = (partial) => {
    const next = normalizeSettings({ ...readSettings(), ...partial });
    saveJson("settings", next);
    setSettings(next);
  };

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
    () => suggestFocusesFromText({ resume, jd }),
    [resume, jd]
  );

  const { recommended, extras } = useMemo(
    () => partitionFocuses(settings.focuses, suggestedFocuses),
    [settings.focuses, suggestedFocuses]
  );

  // Standard focuses first; auto-refresh locally when resume/JD is attached or changes (no API)
  useEffect(() => {
    const hasDocs = Boolean(resume.trim() || jd.trim());
    const key = hasDocs
      ? [
          resume.trim().length,
          jd.trim().length,
          resume.trim().slice(0, 80),
          jd.trim().slice(0, 80),
          suggestedFocuses.join(","),
        ].join("|")
      : "empty";
    const prev = sessionStorage.getItem("briefroom_focus_auto");
    if (prev === key) return;
    sessionStorage.setItem("briefroom_focus_auto", key);
    patchSettings({
      focuses: hasDocs ? suggestedFocuses : [...DEFAULT_FOCUSES],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedFocuses, resume, jd]);

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

  const saveDraft = () => {
    saveJson("draft", { resume, jd, questions: questionsRaw, autoQuestions });
    flash(t("home.flash.draft"), "ok");
  };

  async function generate() {
    const latest = readSettings();
    setSettings(latest);

    if (!latest.apiKey.trim()) {
      flash(t("home.flash.needKey"), "error");
      navigate("/settings");
      return;
    }
    if (!resume.trim() || !jd.trim()) {
      flash(t("home.flash.needDocs"), "error");
      return;
    }

    setLoading(true);
    flash(t("home.flash.generating"));
    stopSpeech();
    setSpeaking(false);
    setPlayingIndex(-1);

    const userContent = buildUserPrompt({
      resume,
      jd,
      questions,
      lang: latest.lang,
      autoQuestions,
      answerLength: latest.answerLength,
      focuses: latest.focuses,
      candidateName:
        String(latest.name || "").trim() || extractCandidateName(resume),
      gender: latest.gender,
    });

    try {
      const body = {
        model: latest.model,
        temperature: 0.6,
        messages: [
          { role: "system", content: latest.systemPrompt || DEFAULT_SYSTEM },
          { role: "user", content: userContent },
        ],
      };
      let res = await fetch(`${latest.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${latest.apiKey.trim()}`,
        },
        body: JSON.stringify({ ...body, response_format: { type: "json_object" } }),
      });
      let data = await res.json().catch(() => ({}));
      if (
        !res.ok &&
        /response_format|json_object|unknown/i.test(data?.error?.message || "")
      ) {
        res = await fetch(`${latest.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${latest.apiKey.trim()}`,
          },
          body: JSON.stringify(body),
        });
        data = await res.json().catch(() => ({}));
      }
      if (!res.ok) {
        throw new Error(data?.error?.message || res.statusText || "API error");
      }

      const content = data.choices?.[0]?.message?.content || "";
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        const m = content.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("Model did not return JSON");
        parsed = JSON.parse(m[0]);
      }

      const raw = (parsed.items || parsed.qa || parsed.answers || [])
        .map((x) => ({
          q: String(x.q || x.question || "").trim(),
          a: String(x.a || x.answer || "").trim(),
        }))
        .filter((x) => x.q && x.a);

      if (!raw.length) throw new Error("No Q&A parsed from response");

      const named = applyCandidateNameToItems(
        raw,
        String(latest.name || "").trim() || extractCandidateName(resume)
      );
      const items = pinMandatoryFirst(named, latest.lang, questions);
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
      flash(`Generate failed: ${e.message}`, "error");
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
      stopSpeech();
      setSpeaking(true);
      setPlayingIndex(i);
      try {
        await speakQa(qa[i].q, qa[i].a, {
          rate: latest.rate,
          voiceQ: latest.voiceQ,
          voiceA: latest.voiceA,
          lang: latest.lang,
        });
      } catch (e) {
        flash(e.message || "TTS failed.", "error");
      } finally {
        setPlayingIndex(-1);
        setSpeaking(false);
      }
    },
    [qa]
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
    stopSpeech();
    setSpeaking(true);
    try {
      for (const i of indices) {
        setPlayingIndex(i);
        const preface =
          latest.lang === "zh"
            ? `第${i + 1}题。`
            : latest.lang === "both"
              ? `Question ${i + 1}. / 第${i + 1}题。`
              : `Question ${i + 1}.`;
        await speakQa(qa[i].q, qa[i].a, {
          rate: latest.rate,
          voiceQ: latest.voiceQ,
          voiceA: latest.voiceA,
          preface,
          lang: latest.lang,
        });
      }
    } catch (e) {
      flash(e.message || "TTS failed.", "error");
    } finally {
      setPlayingIndex(-1);
      setSpeaking(false);
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
      <header className="mb-5 md:mb-8">
        <p className="label mb-2 md:mb-3">{t("home.eyebrow")}</p>
        <h1 className="display text-[1.75rem] title sm:text-3xl md:text-4xl">
          Briefroom
        </h1>
        <p className="line-responsive mt-2 max-w-[36ch] text-sm leading-snug mute md:mt-3 md:max-w-none md:text-base md:leading-relaxed">
          {t("home.tagline")}
        </p>
      </header>

      <section className="panel mb-4 space-y-5 p-3.5 md:mb-5 md:space-y-6 md:p-6">
        <div>
          <p className="label mb-1.5">{t("home.prepLabel")}</p>
          <h2 className="display text-lg title md:text-2xl">
            {t("home.prepTitle")}
          </h2>
          <p className="mt-1 max-w-[54ch] text-xs leading-relaxed mute md:mt-1.5 md:text-sm">
            {t("home.prepHint")}
          </p>
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
      </section>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:mb-5 lg:grid-cols-2 lg:gap-4">
        <DocumentField
          title={t("home.resume")}
          hint={t("home.resumeHint")}
          value={resume}
          onChange={setResume}
          placeholder={t("home.resumePlaceholder")}
        />
        <DocumentField
          title={t("home.jd")}
          hint={t("home.jdHint")}
          value={jd}
          onChange={setJd}
          placeholder={t("home.jdPlaceholder")}
          allowUrl
        />
      </div>
      {candidateName ? (
        <p className="mb-4 -mt-2 text-xs mute md:mb-5">
          {settings.name?.trim()
            ? t("home.nameFromSettings", { name: candidateName })
            : t("home.nameFromResume", { name: candidateName })}
        </p>
      ) : null}

      <section className="panel mb-4 space-y-3 p-3.5 md:mb-5 md:space-y-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="display text-lg font-semibold title md:text-xl">
              {t("home.focusThemes")}
            </h2>
            <p className="mt-1 text-xs leading-relaxed mute md:text-sm">
              {t("home.focusThemesHint")}
            </p>
            <span className="focus-count mt-2.5 inline-flex">
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
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#4a7ff8]">
              {resume.trim() || jd.trim()
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
                resume.trim() || jd.trim()
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

      <section className="panel mb-4 p-3.5 md:mb-5 md:p-6">
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
          placeholder={t("home.targetPlaceholder")}
        />
          <label className="mt-3 flex items-center gap-2 text-sm ink md:mt-4">
            <input
              type="checkbox"
              checked={autoQuestions}
              onChange={(e) => setAutoQuestions(e.target.checked)}
              className="accent-check"
            />
            {t("home.autoInvent")}
          </label>

        <div className="mt-4 flex flex-wrap gap-2 md:mt-5">
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading}
            onClick={generate}
          >
            <MagicWand size={16} weight="bold" />
            {loading ? t("home.generating") : t("home.generate")}
          </button>
          <button type="button" className="btn" onClick={saveDraft}>
            <FloppyDisk size={16} />
            {t("home.saveDraft")}
          </button>
          <button
            type="button"
            className="btn-ghost btn"
            onClick={() => {
              setQa([]);
              saveJson("qa", []);
              setSelected(new Set());
              flash(t("home.flash.cleared"), "ok");
            }}
          >
            {t("home.clearAnswers")}
          </button>
        </div>
        {status.text ? (
          <p
            className={`mt-3 text-sm ${
              status.kind === "error"
                ? "err"
                : status.kind === "ok"
                  ? "ok"
                  : "warn"
            }`}
          >
            {status.text}
          </p>
        ) : null}
      </section>

      <section className="panel p-3.5 md:p-6">
        <div className="mb-3 flex items-end justify-between gap-3 md:mb-4">
          <div>
            <h2 className="display text-lg font-semibold title md:text-xl">
              {t("home.questions")}
            </h2>
            <p className="mt-1 text-xs leading-relaxed mute md:mt-1.5 md:text-sm">
              {t("home.questionsHint")}
            </p>
          </div>
          <span className="focus-count focus-count--stack inline-flex shrink-0">
            <span className="focus-count-n">{qa.length}</span>
            <span className="focus-count-label">{t("home.itemsLabel")}</span>
          </span>
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
            flash(t("home.flash.copied"), "ok");
          }}
          playingIndex={playingIndex}
          loading={loading}
          exportingAudio={exportingAudio}
        />
      </section>

      <div className="action-dock-wrap sticky bottom-3 z-20 mt-5 md:bottom-4 md:mt-8">
        <motion.div layout className="action-dock">
          <button
            type="button"
            className="action-dock-speak"
            disabled={!qa.length || speaking}
            onClick={playSelected}
          >
            <SpeakerHigh size={17} weight="bold" />
            {t("home.speak", { n: selected.size })}
          </button>
          <button
            type="button"
            className="action-dock-stop"
            aria-label={t("home.stop")}
            title={t("home.stop")}
            onClick={() => {
              stopSpeech();
              setSpeaking(false);
              setPlayingIndex(-1);
            }}
          >
            <Stop size={18} weight="fill" />
          </button>
          <button
            type="button"
            className="action-dock-save"
            disabled={!qa.length || exportingAudio || speaking}
            onClick={() => exportAudio()}
            title={t("home.saveAudioHint")}
          >
            <DownloadSimple size={15} weight="bold" />
            {exportingAudio
              ? t("home.exportingAudioShort")
              : t("home.saveAudio", {
                  n: selected.size || qa.length,
                })}
          </button>
        </motion.div>
        {audioNote.text ? (
          <p
            className={`action-dock-note ${
              audioNote.kind === "error"
                ? "err"
                : audioNote.kind === "ok"
                  ? "ok"
                  : "mute"
            }`}
            role="status"
          >
            {audioNote.text}
          </p>
        ) : null}
      </div>
    </Shell>
  );
}
