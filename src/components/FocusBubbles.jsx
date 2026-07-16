import { motion, useReducedMotion } from "framer-motion";

/** Soft size & drift variety so the field feels like a bubble cluster. */
const BUBBLE_META = [
  { size: 112, dx: 4, dy: -7, dur: 5.2 },
  { size: 128, dx: -5, dy: -9, dur: 6.1 },
  { size: 104, dx: 3, dy: -6, dur: 4.8 },
  { size: 120, dx: -4, dy: -8, dur: 5.7 },
  { size: 108, dx: 5, dy: -5, dur: 5.4 },
  { size: 124, dx: -3, dy: -10, dur: 6.4 },
  { size: 100, dx: 4, dy: -6, dur: 4.6 },
  { size: 116, dx: -6, dy: -7, dur: 5.9 },
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
          <motion.button
            key={opt.id}
            type="button"
            aria-pressed={on}
            className={`focus-bubble focus-bubble--${tone} ${on ? "is-on" : ""}`}
            style={{
              "--bubble-size": `${size}px`,
              width: "var(--bubble-size)",
              height: "var(--bubble-size)",
            }}
            onClick={() => onToggle(opt.id)}
            initial={false}
            animate={
              reduce
                ? { scale: on ? 1.04 : 1 }
                : {
                    y: [0, meta.dy, 0, Math.abs(meta.dy) * 0.45, 0],
                    x: [0, meta.dx, 0, -meta.dx * 0.6, 0],
                    scale: on ? 1.05 : 1,
                  }
            }
            transition={
              reduce
                ? { type: "spring", stiffness: 320, damping: 24 }
                : {
                    y: {
                      duration: meta.dur,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.22,
                    },
                    x: {
                      duration: meta.dur * 1.15,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.18,
                    },
                    scale: { type: "spring", stiffness: 280, damping: 22 },
                  }
            }
            whileHover={reduce ? undefined : { scale: on ? 1.1 : 1.07 }}
            whileTap={{ scale: 0.94 }}
          >
            <span className="focus-bubble-glow" aria-hidden />
            <span className="focus-bubble-sheen" aria-hidden />
            <span className="focus-bubble-label">{t(`focus.${opt.id}.label`)}</span>
            <span className="focus-bubble-hint">{t(`focus.${opt.id}.hint`)}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
