import { useEffect, useRef, useState } from "react";
import {
  DeviceMobile,
  DownloadSimple,
  Export,
  PlusSquare,
  X,
} from "@phosphor-icons/react";
import { useI18n } from "../lib/I18nContext";

const DISMISS_KEY = "briefroom_install_dismissed";
const SHOW_DELAY_MS = 1800;
const EXIT_MS = 280;
const EXIT_MS_REDUCED = 160;

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
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * PWA install / Add to Home Screen sheet.
 * Android/Chrome: one-tap via beforeinstallprompt.
 * iOS Safari: visual Share → Add to Home Screen steps.
 */
export default function InstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState(null);
  const [showIos, setShowIos] = useState(false);
  const [ready, setReady] = useState(false);
  const [exiting, setExiting] = useState(false);
  const exitTimer = useRef(0);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1" || isStandalone();
    } catch {
      return isStandalone();
    }
  });

  useEffect(() => {
    if (hidden || isStandalone()) return;

    const ios = isIos();
    // iOS never gets a real install prompt — always show Share steps,
    // even if a desktop/dev browser fires beforeinstallprompt under an iPhone UA.
    if (ios && !window.navigator.standalone) {
      setShowIos(true);
    }

    let onBip;
    if (!ios) {
      onBip = (e) => {
        e.preventDefault();
        setDeferred(e);
      };
      window.addEventListener("beforeinstallprompt", onBip);
    }

    const timer = setTimeout(() => setReady(true), SHOW_DELAY_MS);

    return () => {
      if (onBip) window.removeEventListener("beforeinstallprompt", onBip);
      clearTimeout(timer);
    };
  }, [hidden]);

  useEffect(
    () => () => {
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
    },
    []
  );

  const finalizeDismiss = () => {
    setHidden(true);
    setDeferred(null);
    setShowIos(false);
    setExiting(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const dismiss = () => {
    if (exiting || hidden) return;
    setExiting(true);
    const ms = prefersReducedMotion() ? EXIT_MS_REDUCED : EXIT_MS;
    if (exitTimer.current) window.clearTimeout(exitTimer.current);
    exitTimer.current = window.setTimeout(finalizeDismiss, ms);
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

  if (hidden || isStandalone() || !ready) return null;

  const ios = isIos();
  // Prefer iOS steps whenever we're on an iPhone/iPad — never show Android copy there.
  const isAndroidFlow = Boolean(deferred) && !ios;
  if (!isAndroidFlow && !showIos) return null;

  const brand = t("brand.name");

  return (
    <div
      className={`install-sheet${exiting ? " is-out" : ""}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="install-sheet-title"
      aria-describedby="install-sheet-hint"
    >
      <button
        type="button"
        className="install-sheet-close"
        onClick={dismiss}
        aria-label={t("install.dismiss")}
      >
        <X size={14} weight="bold" />
      </button>

      <div className="install-sheet-visual" aria-hidden>
        <div className="install-phone">
          <div className="install-phone-notch" />
          <div className="install-phone-grid">
            <span className="install-phone-dot" />
            <span className="install-phone-dot" />
            <span className="install-phone-dot" />
            <span className="install-phone-app is-live">
              <img
                src="/favicon.svg"
                alt=""
                width={28}
                height={28}
                className="install-phone-logo"
                draggable={false}
              />
            </span>
            <span className="install-phone-dot" />
            <span className="install-phone-dot" />
          </div>
          <div className="install-phone-dock">
            <span className="install-phone-dot is-dock" />
            <span className="install-phone-dot is-dock" />
            <span className="install-phone-dot is-dock" />
            <span className="install-phone-dot is-dock" />
          </div>
        </div>
        <div className="install-sheet-badge">
          <DeviceMobile size={12} weight="bold" />
          {isAndroidFlow ? t("install.badgeAndroid") : t("install.badgeIos")}
        </div>
      </div>

      <div className="install-sheet-copy">
        <p className="install-sheet-kicker">
          {isAndroidFlow ? t("install.kickerAndroid") : t("install.kickerIos")}
        </p>
        <h2 id="install-sheet-title" className="install-sheet-title">
          {isAndroidFlow
            ? t("install.titleAndroid", { brand })
            : t("install.titleIos", { brand })}
        </h2>
        <p id="install-sheet-hint" className="install-sheet-hint">
          {isAndroidFlow
            ? t("install.hintAndroid", { brand })
            : t("install.hintIos")}
        </p>
      </div>

      {isAndroidFlow ? (
        <button type="button" className="install-sheet-cta" onClick={install}>
          <DownloadSimple size={16} weight="bold" />
          {t("install.cta")}
        </button>
      ) : (
        <ol className="install-steps">
          <li className="install-step">
            <span className="install-step-icon" aria-hidden>
              <Export size={15} weight="bold" />
            </span>
            <span className="install-step-text">
              <strong>{t("install.step1Label")}</strong>
              <span>{t("install.step1Hint")}</span>
            </span>
          </li>
          <li className="install-step-arrow" aria-hidden>
            →
          </li>
          <li className="install-step">
            <span className="install-step-icon" aria-hidden>
              <PlusSquare size={15} weight="bold" />
            </span>
            <span className="install-step-text">
              <strong>{t("install.step2Label")}</strong>
              <span>{t("install.step2Hint")}</span>
            </span>
          </li>
        </ol>
      )}

      <button type="button" className="install-sheet-skip" onClick={dismiss}>
        {t("install.dismiss")}
      </button>
    </div>
  );
}
