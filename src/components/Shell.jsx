import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { GearSix, House } from "@phosphor-icons/react";
import { useI18n } from "../lib/I18nContext";
import { UI_LANGS } from "../lib/i18n";
import { loadJson } from "../lib/storage";
import { normalizeSettings } from "../lib/settingsConfig";
import BrandLogo from "./BrandLogo";
import InstallPrompt from "./InstallPrompt";

export default function Shell({ children }) {
  const { pathname } = useLocation();
  const { uiLang, setUiLang, t } = useI18n();
  const [settings, setSettings] = useState(() =>
    normalizeSettings(loadJson("settings", {}))
  );

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

  const hasKey = Boolean(settings.apiKey?.trim());
  const brandName = t("brand.name");

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip">
      <span
        className="mesh-orb"
        style={{ width: 340, height: 340, top: -90, right: -80 }}
        aria-hidden
      />
      <span
        className="mesh-orb mesh-orb--sm"
        style={{ width: 220, height: 220, bottom: 80, left: -70 }}
        aria-hidden
      />

      <div className="shell-pad relative z-10 mx-auto max-w-[1100px] pb-20 pt-0 md:pb-24">
        <header className="shell-banner">
          <div className="toolbar-glass">
            <Link
              to="/"
              className="toolbar-brand group flex shrink-0 items-center gap-2 rounded-full px-0.5 py-0.5 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(74,127,248,0.45)]"
            >
              <BrandLogo size={28} className="toolbar-logo shrink-0 md:hidden" title={brandName} />
              <BrandLogo size={32} className="toolbar-logo hidden shrink-0 md:block" title={brandName} />
              <span className="toolbar-brand-name display whitespace-nowrap text-[1rem] font-semibold title tracking-tight md:text-[1.15rem]">
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
                  <House size={16} weight={pathname === "/" ? "fill" : "bold"} />
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
                    size={16}
                    weight={pathname === "/settings" ? "fill" : "bold"}
                  />
                  <span className="nav-chip-label">{t("nav.settings")}</span>
                  {!hasKey ? (
                    <span className="pin-badge toolbar-key-badge ml-0.5 normal-case tracking-wide">
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
