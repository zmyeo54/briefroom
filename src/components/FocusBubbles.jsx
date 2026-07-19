import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const BUBBLE_META = [
  { size: 128, delay: 0, dur: 3.4, driftDur: 8.4, driftX: 11, driftY: -13, driftRot: 4.5 },
  { size: 144, delay: 0.45, dur: 4.1, driftDur: 9.6, driftX: -10, driftY: -11, driftRot: -3.5 },
  { size: 120, delay: 0.9, dur: 3.7, driftDur: 7.8, driftX: 9, driftY: 12, driftRot: 5 },
  { size: 136, delay: 0.2, dur: 4.4, driftDur: 10.2, driftX: -12, driftY: 10, driftRot: -4 },
  { size: 124, delay: 1.1, dur: 3.9, driftDur: 8.8, driftX: 8, driftY: -14, driftRot: 3.5 },
  { size: 140, delay: 0.65, dur: 4.2, driftDur: 9.4, driftX: -9, driftY: -9, driftRot: -5.5 },
  { size: 116, delay: 0.35, dur: 3.5, driftDur: 7.4, driftX: 13, driftY: 11, driftRot: 4 },
  { size: 132, delay: 0.8, dur: 4.6, driftDur: 10.8, driftX: -11, driftY: 13, driftRot: -3 },
];

export default function FocusBubbles({
  items,
  selectedIds,
  onToggle,
  label,
  tone = "primary",
  t,
}) {
  const reduce = useReducedMotion();
  const selected = selectedIds || [];
  const rootRef = useRef(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "40px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const live = !reduce && inView;

  return (
    <div
      ref={rootRef}
      className="focus-bubbles"
      role="group"
      aria-label={label}
    >
      {items.map((opt, i) => {
        const on = selected.includes(opt.id);
        const meta = BUBBLE_META[i % BUBBLE_META.length];
        const size = meta.size;

        return (
          <span
            key={opt.id}
            className={
              live
                ? "focus-bubble-float focus-bubble-float--live"
                : "focus-bubble-float"
            }
            style={{
              "--float-delay": `${meta.delay}s`,
              "--float-dur": `${meta.dur}s`,
              "--drift-dur": `${meta.driftDur}s`,
              "--float-amp": `${10 + (i % 4) * 3}px`,
              "--drift-x": `${meta.driftX}px`,
              "--drift-y": `${meta.driftY}px`,
              "--drift-rot": `${meta.driftRot}deg`,
            }}
          >
            <motion.button
              type="button"
              aria-pressed={on}
              className={`focus-bubble focus-bubble--${tone} ${on ? "is-on" : ""}`}
              style={{
                "--bubble-size": `${size}px`,
                width: "var(--bubble-size)",
                height: "var(--bubble-size)",
                zIndex: on ? 2 : 1,
              }}
              onClick={() => onToggle(opt.id)}
              initial={false}
              animate={{ scale: on ? 1.04 : 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              whileHover={
                reduce
                  ? undefined
                  : {
                      scale: on ? 1.12 : 1.08,
                      transition: { type: "spring", stiffness: 280, damping: 18 },
                    }
              }
              whileTap={{ scale: 0.94 }}
            >
              <span className="focus-bubble-glow" aria-hidden />
              <span className="focus-bubble-sheen" aria-hidden />
              <span className="focus-bubble-label">{t(`focus.${opt.id}.label`)}</span>
              <span className="focus-bubble-hint">{t(`focus.${opt.id}.hint`)}</span>
            </motion.button>
          </span>
        );
      })}
    </div>
  );
}
