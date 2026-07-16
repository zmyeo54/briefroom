import { motion, useReducedMotion } from "framer-motion";

const BUBBLE_META = [
  { size: 128, delay: 0, dur: 3.4 },
  { size: 144, delay: 0.45, dur: 4.1 },
  { size: 120, delay: 0.9, dur: 3.7 },
  { size: 136, delay: 0.2, dur: 4.4 },
  { size: 124, delay: 1.1, dur: 3.9 },
  { size: 140, delay: 0.65, dur: 4.2 },
  { size: 116, delay: 0.35, dur: 3.5 },
  { size: 132, delay: 0.8, dur: 4.6 },
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

  return (
    <div className="focus-bubbles" role="group" aria-label={label}>
      {items.map((opt, i) => {
        const on = selected.includes(opt.id);
        const meta = BUBBLE_META[i % BUBBLE_META.length];
        const size = meta.size;

        return (
          <span
            key={opt.id}
            className={
              reduce
                ? "focus-bubble-float"
                : "focus-bubble-float focus-bubble-float--live"
            }
            style={{
              "--float-delay": `${meta.delay}s`,
              "--float-dur": `${meta.dur}s`,
              "--float-amp": `${10 + (i % 4) * 3}px`,
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
