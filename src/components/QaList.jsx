import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  CheckSquare,
  Square,
  SpeakerHigh,
  Copy,
  CaretDown,
  PushPin,
  DownloadSimple,
} from "@phosphor-icons/react";
import { useI18n } from "../lib/I18nContext";

export default function QaList({
  items,
  selected,
  onToggle,
  onToggleAll,
  onPlayOne,
  onSaveAudio,
  onCopy,
  playingIndex,
  loading,
  exportingAudio,
}) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(() => new Set());
  const [copiedIdx, setCopiedIdx] = useState(-1);

  useEffect(() => {
    if (copiedIdx < 0) return undefined;
    const id = setTimeout(() => setCopiedIdx(-1), 1800);
    return () => clearTimeout(id);
  }, [copiedIdx]);

  const allSelected = items.length > 0 && items.every((_, i) => selected.has(i));
  const someSelected = items.some((_, i) => selected.has(i));

  const toggleOpen = (i) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleCopy = async (i) => {
    await onCopy?.(i);
    setCopiedIdx(i);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-3xl border border-dashed border-[#e6e4df] bg-[#f7f6f3] px-4 py-8 text-center md:px-6 md:py-10">
        <p className="display text-lg title md:text-xl">{t("qa.emptyTitle")}</p>
        <p className="mute mx-auto mt-2 max-w-[40ch] text-xs leading-relaxed md:text-sm">
          {t("qa.emptyHint")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn text-xs" onClick={onToggleAll}>
          {allSelected ? (
            <CheckSquare size={16} weight="fill" className="text-[#4a7ff8]" />
          ) : (
            <Square size={16} />
          )}
          {allSelected ? t("qa.deselectAll") : t("qa.selectAll")}
        </button>
        <span className="focus-count inline-flex">
          <span className="focus-count-n">
            {selected.size}
            <span className="focus-count-den">/{items.length}</span>
          </span>
          <span className="focus-count-label">{t("qa.selectedSuffix")}</span>
          {!someSelected ? (
            <span className="focus-count-hint">{t("qa.pickHint")}</span>
          ) : null}
        </span>
      </div>

      <ul className="divide-y divide-[#e6e4df] overflow-hidden rounded-3xl border border-[#e6e4df] bg-white shadow-[0_10px_28px_-18px_rgba(32,32,32,0.2)]">
        <AnimatePresence initial={false}>
          {items.map((item, i) => {
            const on = selected.has(i);
            const playing = playingIndex === i;
            const expanded = open.has(i);
            const pinned = Boolean(item.pinned);

            return (
              <motion.li
                key={`${item.mandatoryId || i}-${item.q.slice(0, 24)}`}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : {
                        delay: Math.min(i * 0.03, 0.24),
                        type: "spring",
                        stiffness: 140,
                        damping: 18,
                      }
                }
                className={`px-3 py-2.5 transition md:px-4 md:py-3 ${
                  playing
                    ? "qa-row-playing"
                    : on
                      ? "qa-row-selected"
                      : pinned
                        ? "qa-row-pinned"
                        : "bg-white"
                }`}
              >
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="mt-0.5 shrink-0 text-[#8b939e] transition hover:text-[#4a7ff8]"
                    onClick={() => onToggle(i)}
                    aria-label={on ? "Deselect" : "Select"}
                    aria-pressed={on}
                  >
                    {on ? (
                      <CheckSquare size={24} weight="fill" className="text-[#4a7ff8]" />
                    ) : (
                      <Square size={24} weight="bold" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 text-left"
                      onClick={() => toggleOpen(i)}
                      aria-expanded={expanded}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="faint font-mono text-xs font-medium tabular-nums">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {pinned ? (
                            <span className="pin-badge">
                              <PushPin size={10} weight="fill" />
                              {item.pinKind === "target" ? t("qa.addon") : t("qa.mustAsk")}
                            </span>
                          ) : null}
                        </div>
                        <p className="title mt-1 text-sm font-semibold tracking-tight">
                          {item.q}
                        </p>
                      </div>
                      <CaretDown
                        size={18}
                        weight="bold"
                        className={`mt-1 shrink-0 text-[#8b939e] transition ${
                          expanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {expanded ? (
                        <motion.div
                          key="body"
                          initial={reduce ? false : { height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={reduce ? undefined : { height: 0, opacity: 0 }}
                          transition={{ duration: reduce ? 0 : 0.2 }}
                          className="overflow-hidden"
                        >
                          {item.a?.trim() ? (
                            <p className="ink mt-3 max-w-[70ch] whitespace-pre-wrap text-sm leading-relaxed">
                              {item.a}
                            </p>
                          ) : (
                            <p className="warn mt-3 text-sm font-medium">
                              {t("qa.noAnswer")}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-2 pb-1">
                            <button
                              type="button"
                              className="btn text-xs"
                              disabled={!item.a?.trim()}
                              onClick={() => onPlayOne(i)}
                            >
                              <SpeakerHigh size={15} weight="bold" />
                              {t("qa.speak")}
                            </button>
                            <button
                              type="button"
                              className="btn text-xs"
                              disabled={
                                !item.a?.trim() ||
                                exportingAudio ||
                                typeof onSaveAudio !== "function"
                              }
                              onClick={() => onSaveAudio?.(i)}
                            >
                              <DownloadSimple size={15} weight="bold" />
                              {t("qa.saveAudio")}
                            </button>
                            <button
                              type="button"
                              className="btn-ghost btn text-xs"
                              disabled={!item.a?.trim()}
                              onClick={() => handleCopy(i)}
                            >
                              <Copy size={15} weight="bold" />
                              {copiedIdx === i ? t("qa.copied") : t("qa.copy")}
                            </button>
                            <AnimatePresence>
                              {copiedIdx === i ? (
                                <motion.span
                                  key="copied"
                                  initial={reduce ? false : { opacity: 0, x: -4 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.18 }}
                                  className="ok text-xs font-semibold"
                                >
                                  {t("home.flash.copied")}
                                </motion.span>
                              ) : null}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
