import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  ArrowRight,
  ArrowLeft,
  FileText,
  MagicWand,
  SpeakerHigh,
  FilePdf,
  Brain,
  Play,
  CheckCircle,
  Link,
  UploadSimple,
  ClipboardText,
  DownloadSimple,
} from "@phosphor-icons/react";
import { useI18n } from "../lib/I18nContext";
import BrandLogo from "./BrandLogo";

const ONBOARDING_KEY = "briefroom_onboarding_done_v1";

/**
 * OnboardingTour — 5-step guided walkthrough for first-time users.
 * Covers: documents, generation, practice/export audio/PDF, and mindmap.
 */
export default function OnboardingTour({ onFinish }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  const steps = [
    { kicker: t("onboard.step0Kicker"), title: t("onboard.step0Title"), body: t("onboard.step0Body"), visual: "welcome" },
    { kicker: t("onboard.step1Kicker"), title: t("onboard.step1Title"), body: t("onboard.step1Body"), visual: "docs" },
    { kicker: t("onboard.step2Kicker"), title: t("onboard.step2Title"), body: t("onboard.step2Body"), visual: "generate" },
    { kicker: t("onboard.step3Kicker"), title: t("onboard.step3Title"), body: t("onboard.step3Body"), visual: "practice" },
    { kicker: t("onboard.step4Kicker"), title: t("onboard.step4Title"), body: t("onboard.step4Body"), visual: "mindmap" },
  ];

  const total = steps.length;
  const current = steps[step];
  const isFirst = step === 0;
  const isLast = step === total - 1;

  const finish = () => {
    try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch { /* ignore */ }
    onFinish?.();
  };

  const next = () => { if (isLast) finish(); else setStep((s) => s + 1); };
  const prev = () => { if (!isFirst) setStep((s) => s - 1); };

  const ease = [0.16, 1, 0.3, 1];

  return (
    <motion.div
      className="onboard-backdrop"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? undefined : { opacity: 0 }}
      transition={{ duration: 0.25, ease }}
    >
      <motion.div
        className="onboard-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t("onboard.ariaLabel")}
        initial={reduce ? false : { opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? undefined : { opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.32, ease }}
      >
        {/* Close button */}
        <button type="button" className="onboard-close" aria-label={t("onboard.skip")} title={t("onboard.skip")} onClick={finish}>
          <X size={18} weight="bold" />
        </button>

        {/* Progress bar */}
        <div className="onboard-progress-bar">
          <motion.div
            className="onboard-progress-fill"
            animate={{ width: `${((step + 1) / total) * 100}%` }}
            transition={{ duration: 0.35, ease }}
          />
        </div>

        {/* Step content */}
        <div className="onboard-body">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="onboard-step"
              initial={reduce ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease }}
            >
              <div className="onboard-visual-wrap">
                <OnboardingVisual kind={current.visual} t={t} />
              </div>
              <div className="onboard-text">
                <p className="onboard-kicker">{current.kicker}</p>
                <h2 className="onboard-title">{current.title}</h2>
                <p className="onboard-desc">{current.body}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="onboard-nav">
          {!isFirst ? (
            <button type="button" className="btn onboard-back" onClick={prev}>
              <ArrowLeft size={16} weight="bold" />
              {t("onboard.back")}
            </button>
          ) : <span />}
          <button type="button" className="btn btn-primary onboard-next" onClick={next}>
            {isLast ? (
              <><CheckCircle size={16} weight="bold" />{t("onboard.finish")}</>
            ) : (
              <>{t("onboard.next")}<ArrowRight size={16} weight="bold" /></>
            )}
          </button>
        </div>

        <p className="onboard-skip-hint">{t("onboard.skipHint")}</p>
      </motion.div>
    </motion.div>
  );
}

/* ─── Visual illustrations ─── */

const BRANCH_COLORS = ["#c49a3c", "#4a7ff8", "#ff7648", "#c5b4e3", "#4a9ff8"];

function OnboardingVisual({ kind, t }) {
  if (kind === "welcome") {
    return (
      <div className="obv obv--welcome">
        <div className="obv-welcome-glow" aria-hidden />
        <BrandLogo size={72} className="obv-logo" title={t("brand.name")} />
        <p className="obv-welcome-brand display">{t("brand.name")}</p>
        <p className="obv-welcome-sub">{t("brand.tagline")}</p>
        <div className="obv-welcome-feats">
          <span className="obv-feat obv-feat--blue"><SpeakerHigh size={14} weight="fill" />{t("onboard.featAudio")}</span>
          <span className="obv-feat obv-feat--amber"><FilePdf size={14} weight="fill" />{t("onboard.featPdf")}</span>
          <span className="obv-feat obv-feat--coral"><Brain size={14} weight="fill" />{t("onboard.featMindmap")}</span>
        </div>
      </div>
    );
  }

  if (kind === "docs") {
    return (
      <div className="obv obv--docs">
        <div className="obv-docs-card obv-docs-card--resume">
          <div className="obv-docs-icon obv-docs-icon--blue"><FileText size={20} weight="duotone" /></div>
          <div className="obv-docs-info">
            <span className="obv-docs-label">{t("onboard.visualResume")}</span>
            <span className="obv-docs-hint">{t("onboard.visualResumeHint")}</span>
          </div>
        </div>
        <div className="obv-docs-plus"><span>+</span></div>
        <div className="obv-docs-card obv-docs-card--jd">
          <div className="obv-docs-icon obv-docs-icon--coral"><FileText size={20} weight="duotone" /></div>
          <div className="obv-docs-info">
            <span className="obv-docs-label">{t("onboard.visualJd")}</span>
            <span className="obv-docs-hint">{t("onboard.visualJdHint")}</span>
          </div>
        </div>
        <div className="obv-docs-methods">
          <span className="obv-method"><UploadSimple size={12} weight="bold" />{t("onboard.methodUpload")}</span>
          <span className="obv-method"><Link size={12} weight="bold" />{t("onboard.methodLink")}</span>
          <span className="obv-method"><ClipboardText size={12} weight="bold" />{t("onboard.methodPaste")}</span>
        </div>
      </div>
    );
  }

  if (kind === "generate") {
    return (
      <div className="obv obv--generate">
        <div className="obv-gen-wand">
          <MagicWand size={28} weight="duotone" />
          <span className="obv-gen-sparkle obv-gen-sparkle--1" aria-hidden />
          <span className="obv-gen-sparkle obv-gen-sparkle--2" aria-hidden />
          <span className="obv-gen-sparkle obv-gen-sparkle--3" aria-hidden />
        </div>
        <div className="obv-gen-cards">
          {[
            { q: "Tell me about yourself", color: "#c49a3c" },
            { q: "Why this role?", color: "#4a7ff8" },
            { q: "A challenge you faced", color: "#ff7648" },
          ].map((item, i) => (
            <div key={i} className="obv-gen-card" style={{ animationDelay: `${i * 0.18}s`, "--card-accent": item.color }}>
              <span className="obv-gen-card-dot" style={{ background: item.color }} />
              <span className="obv-gen-card-q">{item.q}</span>
              <span className="obv-gen-card-a">{t("onboard.visualAiAnswer")}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "practice") {
    return (
      <div className="obv obv--practice">
        {/* Simulated action dock */}
        <div className="obv-practice-dock">
          <div className="obv-practice-btn obv-practice-btn--play">
            <Play size={18} weight="fill" />
            <span>{t("onboard.visualPlay")}</span>
            <span className="obv-practice-badge">5</span>
          </div>
          <div className="obv-practice-btn obv-practice-btn--audio">
            <SpeakerHigh size={16} weight="duotone" />
            <div className="obv-practice-export">
              <span>{t("onboard.visualExport")}</span>
              <span className="obv-practice-sub">{t("onboard.visualMp3")}</span>
            </div>
            <span className="obv-practice-badge">5</span>
          </div>
          <div className="obv-practice-btn obv-practice-btn--pdf">
            <FilePdf size={16} weight="duotone" />
            <div className="obv-practice-export">
              <span>{t("onboard.visualExport")}</span>
              <span className="obv-practice-sub">{t("onboard.visualPdfLabel")}</span>
            </div>
            <span className="obv-practice-badge">5</span>
          </div>
        </div>
        <p className="obv-practice-hint">{t("onboard.visualPracticeHint")}</p>
      </div>
    );
  }

  if (kind === "mindmap") {
    return (
      <div className="obv obv--mindmap">
        {/* Accurate mindmap replica */}
        <div className="obv-mm">
          {/* SVG connections */}
          <svg className="obv-mm-svg" aria-hidden viewBox="0 0 340 180">
            <path d="M 90 90 C 130 90, 130 30, 170 30" stroke="#c49a3c" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
            <path d="M 90 90 C 130 90, 130 70, 170 70" stroke="#4a7ff8" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
            <path d="M 90 90 C 130 90, 130 110, 170 110" stroke="#ff7648" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
            <path d="M 90 90 C 130 90, 130 150, 170 150" stroke="#c5b4e3" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
          </svg>

          {/* Center node — amber gradient like real mindmap */}
          <div className="obv-mm-center">
            <span className="obv-mm-center-text">{t("onboard.mmTopic")}</span>
            <span className="obv-mm-center-zh">{t("onboard.mmTopicZh")}</span>
          </div>

          {/* Branch cards — matching real MindmapTree structure */}
          <div className="obv-mm-branches">
            {[
              { label: t("onboard.mmBranch1Label"), labelZh: t("onboard.mmBranch1LabelZh"), detail: t("onboard.mmBranch1Detail"), color: "#c49a3c" },
              { label: t("onboard.mmBranch2Label"), labelZh: t("onboard.mmBranch2LabelZh"), detail: t("onboard.mmBranch2Detail"), color: "#4a7ff8" },
              { label: t("onboard.mmBranch3Label"), labelZh: t("onboard.mmBranch3LabelZh"), detail: t("onboard.mmBranch3Detail"), color: "#ff7648" },
              { label: t("onboard.mmBranch4Label"), detail: t("onboard.mmBranch4Detail"), color: "#c5b4e3" },
            ].map((b, i) => (
              <div key={i} className="obv-mm-branch" style={{ "--branch-color": b.color }}>
                <div className="obv-mm-branch-header">
                  <span className="obv-mm-branch-dot" style={{ background: b.color }} />
                  <span className="obv-mm-branch-label">{b.label}</span>
                </div>
                {b.labelZh ? <span className="obv-mm-branch-zh">{b.labelZh}</span> : null}
                <span className="obv-mm-branch-detail">{b.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Methodology legend */}
        <div className="obv-mm-legend">
          <div className="obv-mm-legend-item">
            <span className="obv-mm-legend-swatch obv-mm-legend-swatch--center" />
            <span>{t("onboard.mmLegendCenter")}</span>
          </div>
          <div className="obv-mm-legend-item">
            <span className="obv-mm-legend-swatch obv-mm-legend-swatch--branch" />
            <span>{t("onboard.mmLegendBranch")}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/** Check if onboarding has been completed */
export function isOnboardingDone() {
  try { return localStorage.getItem(ONBOARDING_KEY) === "1"; } catch { return false; }
}

/** Reset onboarding so it shows again next visit */
export function resetOnboarding() {
  try { localStorage.removeItem(ONBOARDING_KEY); } catch { /* ignore */ }
}
