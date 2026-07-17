import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MagicWand } from "@phosphor-icons/react";
import { useI18n } from "../lib/I18nContext";

const STEP_KEYS = [
  "qa.loading.read",
  "qa.loading.match",
  "qa.loading.draft",
  "qa.loading.polish",
];

export default function GenerateLoading({ count = 6 }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const steps = useMemo(() => STEP_KEYS.map((k) => t(k)), [t]);
  const [step, setStep] = useState(0);
  const cards = useMemo(
    () => Array.from({ length: Math.min(Math.max(count, 3), 6) }, (_, i) => i),
    [count]
  );

  useEffect(() => {
    if (reduce) return undefined;
    const id = setInterval(() => {
      setStep((s) => (s + 1) % steps.length);
    }, 2400);
    return () => clearInterval(id);
  }, [reduce, steps.length]);

  const message = steps[step] || steps[0];

  return (
    <div
      className="gen-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="gen-loading-head">
        <span className="gen-loading-icon" aria-hidden>
          <MagicWand size={18} weight="fill" />
        </span>
        <div className="gen-loading-copy min-w-0 flex-1">
          <p className="gen-loading-title">{t("qa.loading.title")}</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={reduce ? "static" : message}
              className="gen-loading-step"
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: reduce ? 0 : 0.28 }}
            >
              {message}
            </motion.p>
          </AnimatePresence>
        </div>
        <span className="gen-loading-dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </div>

      <div className="gen-loading-track" aria-hidden>
        <span className="gen-loading-track-fill" />
      </div>

      <ul className="gen-loading-list divide-y divide-[#e6e4df] overflow-hidden rounded-3xl border border-[#e6e4df] bg-white shadow-[0_10px_28px_-18px_rgba(32,32,32,0.2)]">
        {cards.map((i) => (
          <li
            key={i}
            className="gen-loading-row px-3 py-3 md:px-4 md:py-3.5"
            style={{ animationDelay: `${i * 0.12}s` }}
          >
            <div className="flex gap-3">
              <span className="gen-loading-chip mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="gen-loading-line w-8" />
                  {i < 3 ? <span className="gen-loading-pill w-16" /> : null}
                </div>
                <span
                  className={`gen-loading-line block ${i % 2 ? "w-[88%]" : "w-full"}`}
                />
                <span className="gen-loading-line block w-[72%] opacity-80" />
                <span className="gen-loading-line block w-[54%] opacity-60" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
