import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { I18nProvider, useI18n } from "./lib/I18nContext";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";

const SITE_ORIGIN = "https://linecheck-ai.vercel.app";
const INDEX_ROBOTS = "index, follow, max-image-preview:large";
const NOINDEX_ROBOTS = "noindex, follow";

function ensureMeta(attr, key, value) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function ensureCanonical(href) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}

function useRouteMeta() {
  const { pathname } = useLocation();
  const { t, uiLang } = useI18n();
  const isSettings = pathname === "/settings";

  useEffect(() => {
    const brand = t("brand.name");
    const homeTitle = `${brand} — ${t("brand.docTitle")}`;
    const settingsTitle = `${t("settings.title")} — ${brand}`;
    const title = isSettings ? settingsTitle : homeTitle;
    const description = t("brand.metaDescription");
    const canonical = `${SITE_ORIGIN}/`;
    const locale = uiLang === "zh" ? "zh_CN" : "en_US";

    document.title = title;

    ensureMeta("name", "robots", isSettings ? NOINDEX_ROBOTS : INDEX_ROBOTS);
    ensureMeta("name", "description", description);
    ensureCanonical(canonical);

    // Keep share cards pointed at the public home URL (settings is noindex).
    ensureMeta("property", "og:url", canonical);
    ensureMeta("property", "og:title", homeTitle);
    ensureMeta("property", "og:description", description);
    ensureMeta("property", "og:locale", locale);
    ensureMeta("name", "twitter:title", homeTitle);
    ensureMeta("name", "twitter:description", description);
  }, [isSettings, t, uiLang]);
}

function AnimatedRoutes() {
  const location = useLocation();
  const reduce = useReducedMotion();
  useRouteMeta();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduce ? undefined : { opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </I18nProvider>
  );
}
