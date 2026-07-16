import { motion, useReducedMotion } from "framer-motion";

/**
 * Each bubble gets a unique orbit — bigger travel + staggered timing
 * so the field feels alive, not locked to a grid.
 */
const BUBBLE_META = [
  { size: 128, path: { x: [0, 14, -8, 10, 0], y: [0, -18, -6, -22, 0] }, rot: [-2, 3, -1, 2, -2], dur: 7.2 },
  { size: 144, path: { x: [0, -16, 6, -12, 0], y: [0, -22, -10, -16, 0] }, rot: [2, -3, 1.5, -2, 2], dur: 8.6 },
  { size: 120, path: { x: [0, 10, 18, -6, 0], y: [0, -14, -24, -8, 0] }, rot: [-1.5, 2.5, -3, 1, -1.5], dur: 6.4 },
  { size: 136, path: { x: [0, -12, 8, -18, 0], y: [0, -20, -4, -26, 0] }, rot: [1, -2, 3, -1.5, 1], dur: 9.1 },
  { size: 124, path: { x: [0, 16, -4, 12, 0], y: [0, -12, -20, -6, 0] }, rot: [-2.5, 1, -2, 2.5, -2.5], dur: 7.8 },
  { size: 140, path: { x: [0, -10, -18, 8, 0], y: [0, -24, -8, -18, 0] }, rot: [2, -1, 2.5, -3, 2], dur: 8.2 },
  { size: 116, path: { x: [0, 8, -14, 6, 0], y: [0, -16, -22, -10, 0] }, rot: [-1, 3, -2, 1.5, -1], dur: 6.8 },
  { size: 132, path: { x: [0, -18, 4, -10, 0], y: [0, -10, -26, -14, 0] }, rot: [2.5, -2, 1, -2.5, 2.5], dur: 9.4 },
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
        const breathe = on ? [1.04, 1.1, 1.05, 1.09, 1.04] : [1, 1.045, 0.98, 1.03, 1];

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
              zIndex: on ? 2 : 1,
            }}
            onClick={() => onToggle(opt.id)}
            initial={false}
            animate={
              reduce
                ? { scale: on ? 1.04 : 1, x: 0, y: 0, rotate: 0 }
                : {
                    x: meta.path.x,
                    y: meta.path.y,
                    rotate: meta.rot,
                    scale: breathe,
                  }
            }
            transition={
              reduce
                ? { type: "spring", stiffness: 320, damping: 24 }
                : {
                    x: {
                      duration: meta.dur,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.35,
                    },
                    y: {
                      duration: meta.dur * 1.12,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.28,
                    },
                    rotate: {
                      duration: meta.dur * 1.25,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.4,
                    },
                    scale: {
                      duration: meta.dur * 0.85,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.2,
                    },
                  }
            }
            whileHover={
              reduce
                ? undefined
                : {
                    scale: on ? 1.14 : 1.1,
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
        );
      })}
    </div>
  );
}
