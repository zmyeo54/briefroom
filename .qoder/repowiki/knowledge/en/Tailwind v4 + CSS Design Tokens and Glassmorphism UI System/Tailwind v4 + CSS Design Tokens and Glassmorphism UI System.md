---
kind: frontend_style
name: Tailwind v4 + CSS Design Tokens and Glassmorphism UI System
category: frontend_style
scope:
    - '**'
source_files:
    - src/index.css
    - package.json
---

The app uses Tailwind CSS v4 (via `@tailwindcss/vite`) with a single global stylesheet (`src/index.css`, ~4000 lines) that defines the entire visual system. There is no component-scoped CSS, SCSS, or CSS-in-JS — all styling lives in one file and is composed from utility classes plus a small set of hand-written BEM-style modifier classes for complex components.

**Design tokens** are declared via Tailwind's `@theme` block at the top of `index.css`: semantic font families (`--font-sans`, `--font-display`, `--font-mono`), a warm neutral palette (`--color-canvas`, `--color-panel`, `--color-line`, `--color-ink`, `--color-mute`), brand accent colors (`--color-accent`, `--color-accent-deep`, `--color-coral`, `--color-amber`, `--color-lavender`, `--color-navy`, `--color-sky`). These tokens are referenced throughout the CSS via `var(--color-*)` and `var(--font-*)`.

**Typography**: Outfit for Latin text, Noto Sans SC / PingFang SC / Hiragino Sans GB for CJK; JetBrains Mono for monospace. Chinese locale overrides (`html[lang="zh-CN"]`) tighten letter-spacing and bump weights to improve readability.

**Visual style**: A "dormi-style" glassmorphism aesthetic — frosted panels (`backdrop-filter: blur(18px) saturate(1.2)`), soft gradients, subtle inner highlights (`inset 0 1px 0 rgba(255,255,255,0.95)`), mesh-orb background blobs, and a grain overlay. Buttons use pill shapes (`border-radius: 999px`), primary buttons are dark gradient, danger/clear variants use coral/red accents.

**Responsive strategy**: Mobile-first with `min-width` breakpoints at 480/560/640/768/1024px. Safe-area insets (`env(safe-area-inset-* )`) are used extensively for notched devices. Landscape orientation gets dedicated layouts (e.g., install sheet switches to side-by-side grid). `prefers-reduced-motion` disables animations globally.

**Component-level CSS conventions**: Complex interactive pieces (install sheet, action dock, playback FAB, Q&A rows, onboarding mindmap) get their own `.class` blocks in `index.css` using a consistent naming scheme (`install-sheet-*`, `action-dock-*`, `playback-fab-*`, `qa-row-*`, `obv-*`). State is expressed via sibling modifiers (`.is-out`, `.is-live`, `.qa-row-playing`, `.qa-row-selected`, `.qa-row-pinned`).

**Animation & motion**: Keyframes are defined inline (`@keyframes install-sheet-in`, `mesh-drift`, `speaking-bar`, `gen-track`, etc.) with cubic-bezier easing curves. Framer Motion is also installed (`framer-motion`) and used by some React components for layout transitions, coexisting with CSS animations.

**Iconography**: Phosphor Icons via `@phosphor-icons/react`; SVG icons are also embedded inline as data URIs (dropdown arrow, PWA icon).

No design-system package, theme config file, or multi-file token architecture exists — everything is centralized in `src/index.css`.