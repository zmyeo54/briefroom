import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { I18nProvider } from "./lib/I18nContext";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";

const INDEX_ROBOTS = "index, follow, max-image-preview:large";
const NOINDEX_ROBOTS = "noindex, follow";

function useSettingsRobots() {
  const { pathname } = useLocation();
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = pathname === "/settings" ? NOINDEX_ROBOTS : INDEX_ROBOTS;
  }, [pathname]);
}

function AnimatedRoutes() {
  const location = useLocation();
  const reduce = useReducedMotion();
  useSettingsRobots();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduce ? undefined : { opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
