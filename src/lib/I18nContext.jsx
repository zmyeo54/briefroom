import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_UI_LANG, normalizeUiLang, translate } from "./i18n";
import { normalizeSettings, voicesForInterviewLang } from "./settingsConfig";
import { loadJson, saveJson } from "./storage";

const I18nContext = createContext({
  uiLang: DEFAULT_UI_LANG,
  setUiLang: () => {},
  t: (key, vars) => translate(DEFAULT_UI_LANG, key, vars),
});

export function I18nProvider({ children }) {
  const [uiLang, setUiLangState] = useState(() =>
    normalizeUiLang(normalizeSettings(loadJson("settings", {})).uiLang)
  );

  const setUiLang = useCallback((next) => {
    const lang = normalizeUiLang(next);
    const cur = loadJson("settings", {});
    // App language ↔ practice language stay in sync (EN↔English, 中文↔Mandarin)
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
    setUiLangState(lang);
    try {
      document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = uiLang === "zh" ? "zh-CN" : "en";
    const brand = translate(uiLang, "brand.name");
    const tag = translate(uiLang, "brand.tagline");
    document.title = `${brand} — ${tag}`;
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
