import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  UserCircle,
  Key,
  Translate,
  SpeakerHigh,
  Gauge,
  FloppyDisk,
  Play,
  ClipboardText,
  Trash,
  CheckCircle,
  WarningCircle,
  Question,
  Lightning,
} from "@phosphor-icons/react";
import {
  INTERVIEW_LANGS,
  AI_PROVIDER_ORDER,
  DEFAULT_AI_PROVIDER,
  PINNED_GEMINI_MODEL,
  getSavedApiKey,
  normalizeAiProvider,
  normalizeSettings,
  pickDefaultPair,
  resolveApiKey,
  voicesForInterviewLang,
} from "../lib/settingsConfig";
import { loadJson, saveJson } from "../lib/storage";
import { speakQa, speakText, TTS_VOICES, voicesForLang } from "../lib/tts";
import { useI18n } from "../lib/I18nContext";
import Shell from "../components/Shell";
import { resetOnboarding } from "../components/OnboardingTour";

const SECTION_DELAY = 0.08;

function voicePreviewLine(voiceId, role) {
  const lang = TTS_VOICES.find((v) => v.id === voiceId)?.lang;
  const zh = lang === "zh";
  if (role === "q") {
    return zh ? "请介绍一下你自己。" : "Tell me about yourself.";
  }
  return zh
    ? "我负责跨区域交付，强调结果与客户信任。"
    : "I lead delivery teams across markets with clear ownership.";
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * SECTION_DELAY,
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

function useBriefFlash(ms = 1600) {
  const [on, setOn] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = () => {
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), ms);
  };
  return [on, flash];
}

function SectionSaveBtn({ label, savedLabel, onClick }) {
  const [saved, flash] = useBriefFlash();
  return (
    <button
      type="button"
      className={`settings-section-save${saved ? " is-saved" : ""}`}
      aria-live="polite"
      onClick={() => {
        onClick();
        flash();
      }}
    >
      {saved ? (
        <CheckCircle size={14} weight="fill" />
      ) : (
        <FloppyDisk size={14} weight="bold" />
      )}
      {saved ? savedLabel : label}
    </button>
  );
}

function SaveAllBar({ label, savedLabel, onClick, className = "" }) {
  const [saved, flash] = useBriefFlash();
  return (
    <div className={`settings-actions ${className}`.trim()}>
      <button
        type="button"
        className={`settings-btn-save${saved ? " is-saved" : ""}`}
        aria-live="polite"
        onClick={() => {
          onClick();
          flash();
        }}
      >
        {saved ? (
          <CheckCircle size={16} weight="fill" />
        ) : (
          <FloppyDisk size={16} weight="bold" />
        )}
        {saved ? savedLabel : label}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [settings, setSettings] = useState(() =>
    normalizeSettings(loadJson("settings", {}))
  );
  const [status, setStatus] = useState("");
  const [saveToast, setSaveToast] = useState(0);
  const [ttsOk, setTtsOk] = useState(null);
  const [serverKey, setServerKey] = useState(null);
  const [testing, setTesting] = useState(false);
  const [previewing, setPreviewing] = useState(null); // "q" | "a" | null
  const [testProvider, setTestProvider] = useState(() =>
    normalizeAiProvider(
      normalizeSettings(loadJson("settings", {})).aiProvider
    )
  );
  const [apiTesting, setApiTesting] = useState(false);
  const [apiTest, setApiTest] = useState(null); // { ok, text }
  const saveGen = useRef(0);
  const keyInputRef = useRef(null);
  const toastTimer = useRef(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const voiceBusy = testing || Boolean(previewing);

  const previewVoice = async (role) => {
    const voice = role === "q" ? settings.voiceQ : settings.voiceA;
    setPreviewing(role);
    setStatus(t("settings.playing"));
    try {
      await speakText(voicePreviewLine(voice, role), {
        rate: settings.rate,
        voice,
      });
      setStatus(t("settings.testDone"));
      setTtsOk(true);
    } catch (e) {
      setStatus(e.message || "TTS test failed.");
      setTtsOk(false);
    } finally {
      setPreviewing(null);
    }
  };

  const saveNow = (msg) => {
    saveGen.current += 1; // cancel pending debounce
    saveJson("settings", normalizeSettings(settingsRef.current));
    setStatus(msg ?? t("settings.saved"));
    // Visible confirmation even when scrolled away from the bottom status line
    setSaveToast((n) => n + 1);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSaveToast(0), 1800);
  };

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Debounced autosave while editing
  useEffect(() => {
    const gen = ++saveGen.current;
    const saveTimer = setTimeout(() => {
      if (gen !== saveGen.current) return;
      saveJson("settings", normalizeSettings(settings));
    }, 250);
    return () => clearTimeout(saveTimer);
  }, [settings]);

  // Flush on leave (nav away / unmount) so a mid-debounce edit isn't dropped
  useEffect(() => {
    return () => {
      saveJson("settings", normalizeSettings(settingsRef.current));
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      const next = normalizeSettings(loadJson("settings", {}));
      setSettings((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        saveGen.current += 1;
        return next;
      });
    };
    window.addEventListener("briefroom-storage", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("briefroom-storage", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      fetch("/api/tts-health")
        .then((r) => {
          if (!r.ok) throw new Error("offline");
          return r.json();
        })
        .then(() => {
          if (!cancelled) setTtsOk(true);
        })
        .catch(() => {
          if (!cancelled) setTtsOk(false);
        });

    check();
    const id = setInterval(check, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chat")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setServerKey(Boolean(data?.hasKey));
      })
      .catch(() => {
        if (!cancelled) setServerKey(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = (partial) =>
    setSettings((s) => normalizeSettings({ ...s, ...partial }));

  const envKey = getSavedApiKey();
  const userKey = settings.apiKey?.trim() || "";

  const pasteKey = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setStatus(t("settings.pasteEmpty"));
        keyInputRef.current?.focus();
        return;
      }
      patch({ apiKey: text });
      setStatus(t("settings.keySaved"));
    } catch {
      setStatus(t("settings.pasteFailed"));
      keyInputRef.current?.focus();
    }
  };

  const clearKey = () => {
    patch({ apiKey: "" });
    setStatus(t("settings.keyCleared"));
  };

  const testApi = async () => {
    const provider = normalizeAiProvider(testProvider);
    setApiTesting(true);
    setApiTest(null);
    const started = Date.now();
    // Don't send the Gemini env key when probing DeepSeek/Antigravity —
    // those routes want an sk- paste or their own server env key.
    const pasted = String(settings.apiKey || "").trim();
    const apiKey =
      provider === "gemini" ? resolveApiKey(settings) : pasted;
    const headers = {
      "Content-Type": "application/json",
      "X-Linecheck-AI-Provider": provider,
      "X-Linecheck-AI-Enabled": provider,
    };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: settings.model || PINNED_GEMINI_MODEL,
          temperature: 0,
          max_tokens: 16,
          messages: [
            {
              role: "user",
              content: "Reply with exactly the word OK and nothing else.",
            },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      const ms = Date.now() - started;
      const label = t(`settings.aiProvider.${provider}`);
      const errMsg =
        data?.error?.message ||
        (Array.isArray(data) && data[0]?.error?.message) ||
        res.statusText ||
        String(res.status);
      if (!res.ok) {
        setApiTest({
          ok: false,
          text: t("settings.apiTestFail", {
            provider: label,
            detail: errMsg,
          }),
        });
        return;
      }
      const reply = String(
        data?.choices?.[0]?.message?.content || ""
      ).trim();
      setApiTest({
        ok: true,
        text: t("settings.apiTestOk", {
          provider: label,
          model: data?.model || "—",
          ms,
          reply: (reply || "OK").slice(0, 48),
        }),
      });
    } catch (e) {
      setApiTest({
        ok: false,
        text: t("settings.apiTestFail", {
          provider: t(`settings.aiProvider.${provider}`),
          detail: e?.message || "network error",
        }),
      });
    } finally {
      setApiTesting(false);
    }
  };

  const ratePct = Math.round(
    ((Number(settings.rate) - 0.7) / (1.3 - 0.7)) * 100
  );

  return (
    <Shell>
      <div className="settings-page">
        <div className="settings-grid-bg" aria-hidden />

        {/* Hero */}
        <motion.header
          className="settings-hero"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="settings-eyebrow">{t("settings.eyebrow")}</p>
          <h1 className="settings-title">
            {t("settings.title")}
            <span className="settings-title-accent">.</span>
          </h1>
        </motion.header>

        <SaveAllBar
          label={t("settings.saveAll")}
          savedLabel={t("settings.saved")}
          onClick={() => saveNow()}
          className="settings-actions--top"
        />

        {/* Identity Card */}
        <motion.section
          className="settings-section"
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <div className="settings-card">
            <div className="settings-card-header">
              <span className="settings-card-icon">
                <UserCircle size={16} weight="bold" />
              </span>
              <span className="settings-card-label">
                {t("settings.name")}
              </span>
              <SectionSaveBtn
                label={t("settings.save")}
                savedLabel={t("settings.saved")}
                onClick={() => saveNow()}
              />
            </div>
            <div className="settings-card-body">
              <div className="settings-row">
                <div className="settings-field-wrap">
                  <input
                    className="field"
                    type="text"
                    autoComplete="name"
                    value={settings.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    placeholder={t("settings.namePlaceholder")}
                  />
                </div>
                <p className="settings-row-hint">{t("settings.nameHint")}</p>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">
                  {t("settings.gender")}
                </span>
                <div className="settings-field-wrap">
                  <select
                    className="field"
                    value={settings.gender}
                    onChange={(e) => {
                      const gender = e.target.value;
                      patch({
                        gender,
                        ...pickDefaultPair(settings.lang, gender),
                      });
                    }}
                  >
                    <option value="male">{t("settings.gender.male")}</option>
                    <option value="female">{t("settings.gender.female")}</option>
                  </select>
                </div>
                <p className="settings-row-hint">{t("settings.genderHint")}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Language & Voice Card */}
        <motion.section
          className="settings-section"
          custom={1}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <div className="settings-card">
            <div className="settings-card-header">
              <span className="settings-card-icon">
                <Translate size={16} weight="bold" />
              </span>
              <span className="settings-card-label">
                {t("settings.interviewLang")}
              </span>
              <SectionSaveBtn
                label={t("settings.save")}
                savedLabel={t("settings.saved")}
                onClick={() => saveNow()}
              />
            </div>
            <div className="settings-card-body">
              <div className="settings-row">
                <span className="settings-row-label">Language</span>
                <div className="settings-field-wrap">
                  <select
                    className="field"
                    value={settings.lang}
                    onChange={(e) => {
                      const lang = e.target.value;
                      patch({
                        lang,
                        ...voicesForInterviewLang(
                          lang,
                          settings.voiceQ,
                          settings.voiceA,
                          settings.gender
                        ),
                      });
                    }}
                  >
                    {INTERVIEW_LANGS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {t(`lang.${l.id}.label`)} — {t(`lang.${l.id}.detail`)}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="settings-row-hint">
                  {t("settings.interviewLangHint")}
                </p>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">
                  {t("settings.voiceQ")}
                </span>
                <div className="settings-field-wrap settings-voice-row">
                  <select
                    className="field"
                    value={settings.voiceQ}
                    onChange={(e) => patch({ voiceQ: e.target.value })}
                  >
                    {voicesForLang(settings.lang).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="settings-voice-preview"
                    disabled={voiceBusy}
                    aria-label={t("settings.previewVoiceQ")}
                    title={t("settings.previewVoiceQ")}
                    onClick={() => previewVoice("q")}
                  >
                    <Play size={16} weight="fill" />
                  </button>
                </div>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">
                  {t("settings.voiceA")}
                </span>
                <div className="settings-field-wrap settings-voice-row">
                  <select
                    className="field"
                    value={settings.voiceA}
                    onChange={(e) => patch({ voiceA: e.target.value })}
                  >
                    {voicesForLang(settings.lang).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="settings-voice-preview"
                    disabled={voiceBusy}
                    aria-label={t("settings.previewVoiceA")}
                    title={t("settings.previewVoiceA")}
                    onClick={() => previewVoice("a")}
                  >
                    <Play size={16} weight="fill" />
                  </button>
                </div>
                <p className="settings-row-hint">{t("settings.voiceHint")}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Speaking Pace Card */}
        <motion.section
          className="settings-section"
          custom={2}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <div className="settings-card">
            <div className="settings-card-header">
              <span className="settings-card-icon">
                <Gauge size={16} weight="bold" />
              </span>
              <span className="settings-card-label">
                {t("settings.rate", {
                  rate: Number(settings.rate).toFixed(2),
                })}
              </span>
              <SectionSaveBtn
                label={t("settings.save")}
                savedLabel={t("settings.saved")}
                onClick={() => saveNow()}
              />
            </div>
            <div className="settings-card-body">
              <div className="settings-row">
                <input
                  type="range"
                  min="0.7"
                  max="1.3"
                  step="0.05"
                  value={settings.rate}
                  onChange={(e) => patch({ rate: Number(e.target.value) })}
                  className="settings-range"
                  style={{ "--range-pct": `${ratePct}%` }}
                />
              </div>
              <div className="settings-row">
                <button
                  type="button"
                  className="settings-btn-test"
                  disabled={voiceBusy}
                  onClick={async () => {
                    setTesting(true);
                    setStatus(t("settings.playingSample"));
                    try {
                      const isEn = settings.lang === "en";
                      const isZh = settings.lang === "zh";
                      await speakQa(
                        isEn
                          ? "Tell me about yourself."
                          : isZh
                            ? "请介绍一下你自己。"
                            : "Tell me about yourself. / 请介绍一下你自己。",
                        isEn
                          ? "I lead delivery teams across markets with clear ownership."
                          : isZh
                            ? "我负责跨区域交付，强调结果与客户信任。"
                            : "I lead delivery teams across markets with clear ownership.\n\n我负责跨区域交付，强调结果与客户信任。",
                        {
                          rate: settings.rate,
                          voiceQ: settings.voiceQ,
                          voiceA: settings.voiceA,
                          lang: settings.lang,
                        }
                      );
                      setStatus(t("settings.testDone"));
                      setTtsOk(true);
                    } catch (e) {
                      setStatus(e.message || "TTS test failed.");
                      setTtsOk(false);
                    } finally {
                      setTesting(false);
                    }
                  }}
                >
                  <Play size={16} weight="fill" />
                  {testing ? t("settings.playing") : t("settings.testQa")}
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* API & Region Card */}
        <motion.section
          className="settings-section"
          custom={3}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <div className="settings-card">
            <div className="settings-card-header">
              <span className="settings-card-icon">
                <Key size={16} weight="bold" />
              </span>
              <span className="settings-card-label">
                {t("settings.apiKey")}
              </span>
              <SectionSaveBtn
                label={t("settings.save")}
                savedLabel={t("settings.saved")}
                onClick={() => saveNow()}
              />
            </div>
            <div className="settings-card-body">
              <div className="settings-row">
                <div className="settings-field-wrap">
                  <input
                    ref={keyInputRef}
                    className="field"
                    type="password"
                    autoComplete="off"
                    value={settings.apiKey}
                    onChange={(e) => {
                      patch({ apiKey: e.target.value });
                      if (e.target.value.trim())
                        setStatus(t("settings.keySaved"));
                    }}
                    placeholder={t("settings.apiKeyPlaceholder")}
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <button
                    type="button"
                    className="settings-paste-btn"
                    onClick={pasteKey}
                  >
                    <ClipboardText size={13} weight="bold" />
                    {t("settings.pasteKey")}
                  </button>
                  {userKey ? (
                    <button
                      type="button"
                      className="settings-clear-btn"
                      onClick={clearKey}
                    >
                      <Trash size={13} weight="bold" />
                      {t("settings.clearKey")}
                    </button>
                  ) : null}
                </div>
                {userKey ? (
                  <p className="settings-key-status settings-key-status--ok">
                    <CheckCircle size={12} weight="fill" className="inline -mt-px mr-1" />
                    {t("settings.keyLoaded", {
                      preview: userKey.slice(0, 6),
                      n: userKey.length,
                    })}
                  </p>
                ) : envKey ? (
                  <p className="settings-key-status settings-key-status--ok">
                    <CheckCircle size={12} weight="fill" className="inline -mt-px mr-1" />
                    {t("settings.keyFromEnv")}
                  </p>
                ) : serverKey ? (
                  <p className="settings-key-status settings-key-status--ok">
                    <CheckCircle size={12} weight="fill" className="inline -mt-px mr-1" />
                    {t("settings.keyFromServer")}
                  </p>
                ) : (
                  <p className="settings-key-status settings-key-status--warn">
                    <WarningCircle size={12} weight="fill" className="inline -mt-px mr-1" />
                    {t("settings.noKey")}
                  </p>
                )}
              </div>
              <div className="settings-row">
                <span className="settings-row-label">
                  {t("settings.aiProviders")}
                </span>
                <div className="flex flex-col gap-2.5 mt-1">
                  {(
                    [
                      ["antigravity", "antigravityEnabled"],
                      ["gemini", "geminiEnabled"],
                      ["deepseek", "deepseekEnabled"],
                    ]
                  ).map(([id, flag]) => {
                    const flags = {
                      geminiEnabled: settings.geminiEnabled !== false,
                      deepseekEnabled: settings.deepseekEnabled !== false,
                      antigravityEnabled: settings.antigravityEnabled !== false,
                    };
                    const enabledCount = Object.values(flags).filter(Boolean).length;
                    return (
                      <label
                        key={id}
                        className="flex items-center gap-2 text-sm ink"
                      >
                        <input
                          type="checkbox"
                          className="accent-check"
                          checked={flags[flag]}
                          onChange={(e) => {
                            const on = e.target.checked;
                            if (!on && enabledCount <= 1) return;
                            const next = {
                              [flag]: on,
                              aiProviderManual: true,
                            };
                            if (!on && settings.aiProvider === id) {
                              const stillOn = [
                                [
                                  "antigravity",
                                  flag === "antigravityEnabled"
                                    ? on
                                    : flags.antigravityEnabled,
                                ],
                                ["gemini", flag === "geminiEnabled" ? on : flags.geminiEnabled],
                                ["deepseek", flag === "deepseekEnabled" ? on : flags.deepseekEnabled],
                              ].find(([, en]) => en)?.[0];
                              if (stillOn) next.aiProvider = stillOn;
                            }
                            patch(next);
                          }}
                        />
                        {t(`settings.aiProvider.${id}`)}
                      </label>
                    );
                  })}
                </div>
                <p className="settings-row-hint">{t("settings.aiProvidersHint")}</p>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">
                  {t("settings.aiProvider")}
                </span>
                <div className="settings-field-wrap">
                  <select
                    className="field"
                    value={settings.aiProvider || DEFAULT_AI_PROVIDER}
                    onChange={(e) =>
                      patch({
                        aiProvider: e.target.value,
                        aiProviderManual: true,
                      })
                    }
                  >
                    <option
                      value="antigravity"
                      disabled={settings.antigravityEnabled === false}
                    >
                      {t("settings.aiProvider.antigravity")}
                    </option>
                    <option
                      value="gemini"
                      disabled={settings.geminiEnabled === false}
                    >
                      {t("settings.aiProvider.gemini")}
                    </option>
                    <option
                      value="deepseek"
                      disabled={settings.deepseekEnabled === false}
                    >
                      {t("settings.aiProvider.deepseek")}
                    </option>
                  </select>
                </div>
                <p className="settings-row-hint">{t("settings.aiProviderHint")}</p>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">
                  {t("settings.apiTest")}
                </span>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <div className="settings-field-wrap" style={{ flex: "1 1 10rem" }}>
                    <select
                      className="field"
                      value={testProvider}
                      onChange={(e) => {
                        setTestProvider(e.target.value);
                        setApiTest(null);
                      }}
                    >
                      {AI_PROVIDER_ORDER.map((id) => (
                        <option key={id} value={id}>
                          {t(`settings.aiProvider.${id}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="settings-paste-btn"
                    disabled={apiTesting}
                    onClick={testApi}
                  >
                    <Lightning size={13} weight="fill" />
                    {apiTesting
                      ? t("settings.apiTestRunning")
                      : t("settings.apiTestBtn")}
                  </button>
                </div>
                {apiTest ? (
                  <p
                    className={`settings-key-status ${
                      apiTest.ok
                        ? "settings-key-status--ok"
                        : "settings-key-status--warn"
                    }`}
                  >
                    {apiTest.ok ? (
                      <CheckCircle
                        size={12}
                        weight="fill"
                        className="inline -mt-px mr-1"
                      />
                    ) : (
                      <WarningCircle
                        size={12}
                        weight="fill"
                        className="inline -mt-px mr-1"
                      />
                    )}
                    {apiTest.text}
                  </p>
                ) : (
                  <p className="settings-row-hint">{t("settings.apiTestHint")}</p>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Status & Actions */}
        <motion.section
          className="settings-section"
          custom={4}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <div className="settings-card">
            <div className="settings-card-header">
              <span className="settings-card-icon">
                <SpeakerHigh size={16} weight="bold" />
              </span>
              <span className="settings-card-label">TTS Engine</span>
            </div>
            <div className="settings-card-body">
              <div className="settings-row">
                <div className="flex items-center gap-2">
                  {ttsOk === false ? (
                    <>
                      <span className="settings-status-dot settings-status-dot--err" />
                      <span className="settings-status-text err">
                        {t("settings.ttsOffline")}
                      </span>
                    </>
                  ) : ttsOk === true ? (
                    <>
                      <span className="settings-status-dot settings-status-dot--ok" />
                      <span className="settings-status-text ok">
                        {t("settings.ttsOnline")}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="settings-status-dot settings-status-dot--idle" />
                      <span className="settings-status-text" style={{ color: "#c49a3c" }}>
                        Checking…
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Welcome Tour */}
        <motion.section
          className="settings-section"
          custom={5}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <div className="settings-card">
            <div className="settings-card-header">
              <span className="settings-card-icon">
                <Question size={16} weight="bold" />
              </span>
              <span className="settings-card-label">
                {t("settings.replayTour")}
              </span>
            </div>
            <div className="settings-card-body">
              <div className="settings-row">
                <p className="settings-row-hint" style={{ marginBottom: 8 }}>
                  {t("settings.replayTourHint")}
                </p>
                <button
                  type="button"
                  className="settings-btn-test"
                  onClick={() => {
                    resetOnboarding();
                    navigate("/");
                  }}
                >
                  <Play size={16} weight="fill" />
                  {t("settings.replayTourBtn")}
                </button>
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="settings-actions">
            <button
              type="button"
              className="settings-btn-save"
              onClick={() => {
                saveNow();
                navigate("/");
              }}
            >
              <FloppyDisk size={16} weight="bold" />
              {t("settings.saveBack")}
            </button>
          </div>

          <AnimatePresence>
            {status ? (
              <motion.p
                className="settings-status-msg"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                {status}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </motion.section>

        <AnimatePresence>
          {saveToast > 0 ? (
            <motion.div
              key={saveToast}
              className="settings-save-toast"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              <CheckCircle size={16} weight="fill" />
              {t("settings.saved")}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </Shell>
  );
}
