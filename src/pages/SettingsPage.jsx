import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardText,
  FloppyDisk,
  SpeakerHigh,
  Trash,
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

  return (
    <Shell>
      <header className="page-hero mb-6 md:mb-10">
        <p className="label mb-2 md:mb-3">{t("settings.eyebrow")}</p>
        <h1 className="display text-[1.75rem] title sm:text-3xl md:text-4xl">
          {t("settings.title")}
        </h1>
      </header>

      <section className="panel p-4 sm:p-5 md:p-6">
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
                ref={keyInputRef}
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
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn text-xs" onClick={pasteKey}>
                <ClipboardText size={14} weight="bold" />
                {t("settings.pasteKey")}
              </button>
              {userKey ? (
                <button
                  type="button"
                  className="btn-ghost btn text-xs"
                  onClick={clearKey}
                >
                  <Trash size={14} weight="bold" />
                  {t("settings.clearKey")}
                </button>
              ) : null}
            </div>
            {userKey ? (
              <p className="text-xs ok">
                {t("settings.keyLoaded", {
                  preview: userKey.slice(0, 6),
                  n: userKey.length,
                })}
              </p>
            ) : envKey ? (
              <p className="text-xs ok">{t("settings.keyFromEnv")}</p>
            ) : serverKey ? (
              <p className="text-xs ok">{t("settings.keyFromServer")}</p>
            ) : (
              <p className="warn text-xs font-bold">{t("settings.noKey")}</p>
            )}
            <Field label={t("settings.aiRegion")}>
              <select
                className="field"
                value={settings.aiRegion}
                onChange={(e) =>
                  patch({ aiRegion: e.target.value, aiRegionManual: true })
                }
              >
                <option value="global">{t("settings.aiRegion.global")}</option>
                <option value="greater-china">
                  {t("settings.aiRegion.greaterChina")}
                </option>
              </select>
            </Field>
            <p className="text-xs mute">{t("settings.aiRegionHint")}</p>
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
            <p className="text-xs mute">{t("settings.interviewLangHint")}</p>
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
            <p className="text-xs mute">{t("settings.voiceHint")}</p>
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

        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center md:mt-5">
          <button
            type="button"
            className="btn btn-primary w-full sm:w-auto"
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
            className="btn w-full sm:w-auto"
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
            <SpeakerHigh size={16} />
            {testing ? t("settings.playing") : t("settings.testQa")}
          </button>
        </div>

        {status ? (
          <p className="mt-3 text-center text-sm ok font-bold">{status}</p>
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
