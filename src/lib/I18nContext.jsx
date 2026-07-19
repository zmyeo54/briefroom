import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_UI_LANG, deviceUiLang, normalizeUiLang, translate } from "./i18n";
import { normalizeSettings, voicesForInterviewLang } from "./settingsConfig";
import { loadJson, saveJson } from "./storage";

const I18nContext = createContext({
  uiLang: DEFAULT_UI_LANG,
  setUiLang: () => {},
  t: (key, vars) => translate(DEFAULT_UI_LANG, key, vars),
});

/** Persist uiLang (+ practice lang / voices). Used for toggle and first-visit seed. */
function writeUiLang(lang, cur = loadJson("settings", {})) {
  const practiceLang = lang === "zh" ? "zh" : "en";
  const patch = {
    uiLang: lang,
    lang: practiceLang,
    ...voicesForInterviewLang(
      practiceLang,
      cur.voiceQ,
      cur.voiceA,
      cur.gender
    ),
  };
  const merged = normalizeSettings({ ...cur, ...patch });
  saveJson("settings", merged);
  return lang;
}

function resolveInitialUiLang() {
  const raw = loadJson("settings", {}) || {};
  // Only auto-detect when the user has never chosen (or been seeded) a UI lang.
  if (Object.prototype.hasOwnProperty.call(raw, "uiLang")) {
    return normalizeUiLang(raw.uiLang);
  }
  return writeUiLang(deviceUiLang(), raw);
}

export function I18nProvider({ children }) {
  const [uiLang, setUiLangState] = useState(resolveInitialUiLang);

  const setUiLang = useCallback((next) => {
    const lang = writeUiLang(normalizeUiLang(next));
    setUiLangState(lang);
    try {
      document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = uiLang === "zh" ? "zh-CN" : "en";
    const refresh = () => {
      const lang = normalizeUiLang(
        normalizeSettings(loadJson("settings", {})).uiLang
      );
      setUiLangState(lang);
    };
    window.addEventListener("briefroom-storage", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("briefroom-storage", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [uiLang]);

  const t = useCallback(
    (key, vars) => translate(uiLang, key, vars),
    [uiLang]
  );

  const value = useMemo(
    () => ({ uiLang, setUiLang, t }),
    [uiLang, setUiLang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
