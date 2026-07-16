import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  FloppyDisk,
  Lock,
  LockOpen,
  SpeakerHigh,
} from "@phosphor-icons/react";
import {
  INTERVIEW_LANGS,
  normalizeSettings,
  pickDefaultPair,
  voicesForInterviewLang,
} from "../lib/settingsConfig";
import { DEFAULT_SYSTEM } from "../lib/prompt";
import { loadJson, saveJson } from "../lib/storage";
import { speakQa, voicesForLang } from "../lib/tts";
import { useI18n } from "../lib/I18nContext";
import Shell from "../components/Shell";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [settings, setSettings] = useState(() =>
    normalizeSettings(loadJson("settings", {}))
  );
  const [status, setStatus] = useState("");
  const [ttsOk, setTtsOk] = useState(null);
  const [testing, setTesting] = useState(false);
  const [promptUnlocked, setPromptUnlocked] = useState(false);

  useEffect(() => {
    const saveTimer = setTimeout(() => {
      saveJson("settings", normalizeSettings(settings));
    }, 250);
    return () => clearTimeout(saveTimer);
  }, [settings]);

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

  const patch = (partial) =>
    setSettings((s) => normalizeSettings({ ...s, ...partial }));

  return (
    <Shell>
      <header className="mb-5 max-w-3xl md:mb-8">
        <p className="label mb-2 md:mb-3">{t("settings.eyebrow")}</p>
        <h1 className="display text-[1.75rem] title md:text-4xl">
          {t("settings.title")}
        </h1>
      </header>

      <section className="panel max-w-3xl p-3.5 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          <div className="space-y-3">
            <Field label={t("settings.name")}>
              <input
                className="field"
                type="text"
                autoComplete="name"
                value={settings.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder={t("settings.namePlaceholder")}
              />
            </Field>
            <p className="text-xs mute">{t("settings.nameHint")}</p>
            <Field label={t("settings.gender")}>
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
            </Field>
            <p className="text-xs mute">{t("settings.genderHint")}</p>
            <Field label={t("settings.apiKey")}>
              <input
                className="field"
                type="password"
                autoComplete="off"
                value={settings.apiKey}
                onChange={(e) => {
                  patch({ apiKey: e.target.value });
                  if (e.target.value.trim()) setStatus(t("settings.keySaved"));
                }}
                placeholder={t("settings.apiKeyPlaceholder")}
              />
            </Field>
            {settings.apiKey?.trim() ? (
              <p className="text-xs ok">
                {t("settings.keyLoaded", {
                  preview: settings.apiKey.trim().slice(0, 6),
                  n: settings.apiKey.trim().length,
                })}
              </p>
            ) : (
              <p className="warn text-xs font-bold">
                {t("settings.noKey")}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Field label={t("settings.interviewLang")}>
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
            </Field>
            <p className="text-xs mute">
              {t("settings.interviewLangHint")}
            </p>
            <Field label={t("settings.voiceQ")}>
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
            </Field>
            <Field label={t("settings.voiceA")}>
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
            </Field>
            <p className="text-xs mute">
              {t("settings.voiceHint")}
            </p>
            {ttsOk === false ? (
              <p className="err text-xs font-bold">{t("settings.ttsOffline")}</p>
            ) : ttsOk === true ? (
              <p className="ok text-xs font-bold">{t("settings.ttsOnline")}</p>
            ) : null}
            <Field
              label={t("settings.rate", {
                rate: Number(settings.rate).toFixed(2),
              })}
            >
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.05"
                value={settings.rate}
                onChange={(e) => patch({ rate: Number(e.target.value) })}
                className="accent-check w-full"
              />
            </Field>
          </div>
        </div>

        <div className="mt-4 space-y-1.5 md:mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="label">{t("settings.systemPrompt")}</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="btn !px-2.5 !py-1.5 text-xs"
                aria-pressed={promptUnlocked}
                onClick={() => setPromptUnlocked((u) => !u)}
              >
                {promptUnlocked ? (
                  <Lock size={14} weight="bold" />
                ) : (
                  <LockOpen size={14} weight="bold" />
                )}
                {promptUnlocked ? t("settings.lock") : t("settings.unlock")}
              </button>
              <button
                type="button"
                className="btn !px-2.5 !py-1.5 text-xs"
                onClick={() => {
                  patch({ systemPrompt: DEFAULT_SYSTEM });
                  setPromptUnlocked(false);
                  setStatus(t("settings.promptRestored"));
                }}
              >
                <ArrowCounterClockwise size={14} weight="bold" />
                {t("settings.restoreDefault")}
              </button>
            </div>
          </div>
          <textarea
            className="field min-h-[72px] font-mono text-[11px] md:min-h-[80px] md:text-xs"
            readOnly={!promptUnlocked}
            value={settings.systemPrompt}
            onChange={(e) => {
              if (!promptUnlocked) return;
              patch({ systemPrompt: e.target.value });
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 md:mt-5">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              saveJson("settings", normalizeSettings(settings));
              setStatus(t("settings.saved"));
              navigate("/");
            }}
          >
            <FloppyDisk size={16} />
            {t("settings.saveBack")}
          </button>
          <button
            type="button"
            className="btn"
            disabled={testing}
            onClick={async () => {
              setTesting(true);
              setStatus(t("settings.playingSample"));
              try {
                const isEn = settings.lang === "en";
                await speakQa(
                  isEn
                    ? "Tell me about yourself."
                    : "请介绍一下你自己。",
                  isEn
                    ? "I lead delivery teams across markets with clear ownership."
                    : "我负责跨区域交付，强调结果与客户信任。",
                  {
                    rate: settings.rate,
                    voiceQ: settings.voiceQ,
                    voiceA: settings.voiceA,
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
            <SpeakerHigh size={16} />
            {testing ? t("settings.playing") : t("settings.testQa")}
          </button>
          <Link to="/" className="btn-ghost btn">
            <ArrowLeft size={16} />
            {t("settings.cancel")}
          </Link>
        </div>

        {status ? (
          <p className="mt-3 text-sm ok font-bold">{status}</p>
        ) : null}
      </section>
    </Shell>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
