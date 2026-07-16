import { useEffect, useState } from "react";
import { DownloadSimple, X } from "@phosphor-icons/react";
import { useI18n } from "../lib/I18nContext";

const DISMISS_KEY = "briefroom_install_dismissed";

function isStandalone() {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.navigator.standalone === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function isIos() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * PWA install / Add to Home Screen prompt.
 * Chrome/Android: native beforeinstallprompt.
 * iOS Safari: short Share → Add to Home Screen tip.
 */
export default function InstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState(null);
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1" || isStandalone();
    } catch {
      return isStandalone();
    }
  });

  useEffect(() => {
    if (hidden || isStandalone()) return;

    const onBip = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    if (isIos() && !window.navigator.standalone) {
      setShowIos(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, [hidden]);

  const dismiss = () => {
    setHidden(true);
    setDeferred(null);
    setShowIos(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    dismiss();
  };

  if (hidden || isStandalone()) return null;
  if (!deferred && !showIos) return null;

  return (
    <div className="install-banner" role="region" aria-label={t("install.title")}>
      <div className="install-banner-copy">
        <p className="install-banner-title">{t("install.title")}</p>
        <p className="install-banner-hint">
          {deferred
            ? t("install.hintAndroid", { brand: t("brand.name") })
            : t("install.hintIos")}
        </p>
      </div>
      <div className="install-banner-actions">
        {deferred ? (
          <button type="button" className="btn btn-primary !py-1.5 !text-xs" onClick={install}>
            <DownloadSimple size={14} weight="bold" />
            {t("install.cta")}
          </button>
        ) : null}
        <button
          type="button"
          className="btn-ghost btn !px-2 !py-1.5"
          onClick={dismiss}
          aria-label={t("install.dismiss")}
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
