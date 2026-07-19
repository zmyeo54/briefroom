import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { GearSix, House } from "@phosphor-icons/react";
import { useI18n } from "../lib/I18nContext";
import { UI_LANGS } from "../lib/i18n";
import { loadJson, saveJson } from "../lib/storage";
import {
  aiProviderForGeo,
  getSavedApiKey,
  normalizeSettings,
  resolveApiKey,
} from "../lib/settingsConfig";
import BrandLogo from "./BrandLogo";
import InstallPrompt from "./InstallPrompt";

export default function Shell({ children }) {
  const { pathname } = useLocation();
  const { uiLang, setUiLang, t } = useI18n();
  const [settings, setSettings] = useState(() =>
    normalizeSettings(loadJson("settings", {}))
  );
  const [serverKey, setServerKey] = useState(false);

  useEffect(() => {
    const refresh = () => setSettings(normalizeSettings(loadJson("settings", {})));
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("briefroom-storage", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("briefroom-storage", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chat")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setServerKey(Boolean(data?.hasKey));
        const country = data?.country;
        if (!country) return;
        const current = normalizeSettings(loadJson("settings", {}));
        const nextProvider = aiProviderForGeo(country, current);
        if (nextProvider === current.aiProvider) return;
        saveJson(
          "settings",
          normalizeSettings({ ...current, aiProvider: nextProvider })
        );
      })
      .catch(() => {
        if (!cancelled) setServerKey(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasKey = Boolean(resolveApiKey(settings) || serverKey || getSavedApiKey());
  const brandName = t("brand.name");

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip">
      <span
        className="mesh-orb"
        style={{ width: 300, height: 300, top: -70, right: -30 }}
        aria-hidden
      />
      <span
        className="mesh-orb mesh-orb--sm"
        style={{ width: 200, height: 200, bottom: 90, left: -30 }}
        aria-hidden
      />

      <div className="shell-pad relative z-10 mx-auto max-w-5xl pt-0">
        <header className="shell-banner">
          <div className="toolbar-glass">
            <Link
              to="/"
              className="toolbar-brand group flex shrink-0 items-center gap-2.5 rounded-full px-0.5 py-0.5 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(74,127,248,0.45)]"
            >
              <BrandLogo size={32} className="toolbar-logo shrink-0 md:hidden" title={brandName} />
              <BrandLogo size={36} className="toolbar-logo hidden shrink-0 md:block" title={brandName} />
              <span className="toolbar-brand-name display whitespace-nowrap font-semibold title">
                {brandName}
              </span>
            </Link>

            <div className="toolbar-actions">
              <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Primary">
                <Link
                  to="/"
                  className={`nav-chip ${pathname === "/" ? "nav-chip-active" : ""}`}
                  aria-current={pathname === "/" ? "page" : undefined}
                  aria-label={t("nav.home")}
                  title={t("nav.home")}
                >
                  <House size={18} weight={pathname === "/" ? "fill" : "bold"} aria-hidden />
                  <span className="nav-chip-label">{t("nav.home")}</span>
                </Link>
                <Link
                  to="/settings"
                  className={`nav-chip ${pathname === "/settings" ? "nav-chip-active" : ""}`}
                  aria-current={pathname === "/settings" ? "page" : undefined}
                  aria-label={t("nav.settings")}
                  title={t("nav.settings")}
                >
                  <GearSix
                    size={18}
                    weight={pathname === "/settings" ? "fill" : "bold"}
                    aria-hidden
                  />
                  <span className="nav-chip-label">{t("nav.settings")}</span>
                  {!hasKey ? (
                    <span className="pin-badge toolbar-key-badge ml-0.5 normal-case">
                      {t("nav.keyNeeded")}
                    </span>
                  ) : null}
                </Link>
              </nav>

              <div
                className="choice-seg toolbar-lang"
                role="group"
                aria-label={t("nav.uiLang")}
              >
                {UI_LANGS.map((opt) => {
                  const on = uiLang === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`choice-seg-btn toolbar-lang-btn ${on ? "is-on" : ""}`}
                      aria-pressed={on}
                      title={opt.native}
                      onClick={() => setUiLang(opt.id)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        <main id="main">{children}</main>
        <InstallPrompt />
      </div>
    </div>
  );
}
