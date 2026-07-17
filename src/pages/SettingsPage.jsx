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
} from "@phosphor-icons/react";
import {
  INTERVIEW_LANGS,
  getSavedApiKey,
  normalizeSettings,
  pickDefaultPair,
  voicesForInterviewLang,
} from "../lib/settingsConfig";
import { loadJson, saveJson } from "../lib/storage";
import { speakQa, voicesForLang } from "../lib/tts";
import { useI18n } from "../lib/I18nContext";
import Shell from "../components/Shell";
import { resetOnboarding } from "../components/OnboardingTour";

const SECTION_DELAY = 0.08;

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

export default function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [settings, setSettings] = useState(() =>
    normalizeSettings(loadJson("settings", {}))
  );
  const [status, setStatus] = useState("");
  const [ttsOk, setTtsOk] = useState(null);
  const [serverKey, setServerKey] = useState(null);
  const [testing, setTesting] = useState(false);
  const saveGen = useRef(0);
  const keyInputRef = useRef(null);

  useEffect(() => {
    const gen = ++saveGen.current;
    const saveTimer = setTimeout(() => {
      if (gen !== saveGen.current) return;
      saveJson("settings", normalizeSettings(settings));
    }, 250);
    return () => clearTimeout(saveTimer);
  }, [settings]);

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
                <div className="settings-field-wrap">
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
                </div>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">
                  {t("settings.voiceA")}
                </span>
                <div className="settings-field-wrap">
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
                  {t("settings.aiRegion")}
                </span>
                <div className="settings-field-wrap">
                  <select
                    className="field"
                    value={settings.aiRegion}
                    onChange={(e) =>
                      patch({ aiRegion: e.target.value, aiRegionManual: true })
                    }
                  >
                    <option value="global">
                      {t("settings.aiRegion.global")}
                    </option>
                    <option value="greater-china">
                      {t("settings.aiRegion.greaterChina")}
                    </option>
                  </select>
                </div>
                <p className="settings-row-hint">{t("settings.aiRegionHint")}</p>
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
                saveJson("settings", normalizeSettings(settings));
                setStatus(t("settings.saved"));
                navigate("/");
              }}
            >
              <FloppyDisk size={16} weight="bold" />
              {t("settings.saveBack")}
            </button>
            <button
              type="button"
              className="settings-btn-test"
              disabled={testing}
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
      </div>
    </Shell>
  );
}
