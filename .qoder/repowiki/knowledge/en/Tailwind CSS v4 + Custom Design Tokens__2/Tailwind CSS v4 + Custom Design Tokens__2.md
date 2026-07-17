---
kind: frontend_style
name: Tailwind CSS v4 + Custom Design Tokens
category: frontend_style
scope:
    - '**'
source_files:
    - src/index.css
    - vite.config.js
    - package.json
    - src/main.jsx
---

The project uses Tailwind CSS v4 (via @tailwindcss/vite plugin) as its sole styling system, with all styles centralized in a single large stylesheet (src/index.css) that imports Tailwind and declares the app's design tokens via the new @theme block. There is no component-scoped CSS, CSS-in-JS library, or separate utility framework — components compose their appearance almost entirely from Tailwind utility classes plus a small set of hand-written BEM-style class names for complex UI chrome.

What is used:
- Tailwind CSS v4 (tailwindcss@^4.3.3, @tailwindcss/vite@^4.3.3) configured through Vite's plugin pipeline (vite.config.js).
- A single global stylesheet (src/index.css, ~4000 lines) that imports Tailwind (@import "tailwindcss"), declares design tokens inside an @theme block (fonts, colors, etc.), and defines application-wide base styles, responsive breakpoints, animations, and reusable visual primitives (.btn, .btn-primary, .btn-danger, .btn-clear, .btn-ghost, .field, .panel, .toolbar-glass, .app-dialog, .install-sheet, .grain, color/utility classes like .ink, .mute, .sky, .ok, .warn, .err).
- Framer Motion (framer-motion) for animation; no other animation library is present.
- Phosphor Icons (@phosphor-icons/react) for iconography.

Key files:
- src/index.css — design tokens (@theme), base styles, component-level CSS primitives, responsive rules, keyframe animations.
- vite.config.js — registers @tailwindcss/vite plugin so Tailwind v4 processes index.css.
- package.json — lists tailwindcss and @tailwindcss/vite under devDependencies; no SCSS/Sass/PostCSS plugins beyond Tailwind.
- src/main.jsx — entry point that imports ./index.css.

Architecture and conventions:
- Token-driven: All colors, fonts, and spacing are declared once in @theme and consumed via Tailwind utilities or custom classes that reference them.
- Mobile-first responsive strategy: Breakpoints are applied via Tailwind's md:/lg: prefixes in JSX and via @media blocks in index.css for layout-sensitive pieces (safe-area insets, install sheet grid reflow, landscape orientation).
- Glassmorphism / soft UI: Repeated use of backdrop-filter blur/saturate on panels, toolbars, and dialogs, combined with subtle borders and layered box-shadows to create translucent surfaces.
- BEM-ish primitives: Complex UI elements (dialogs, sheets, phone mockups) get dedicated class names (.app-dialog, .install-sheet, .install-phone-*) rather than being fully composed from utilities; these live in index.css and are referenced by components.
- CJK typography: The @theme block sets Outfit for Latin and Noto Sans SC as primary CJK font; html[lang="zh-CN"] overrides swap the font stack and adjust letter-spacing/line-height specifically for Chinese text.

Rules developers should follow:
1. Declare new tokens in @theme inside src/index.css before using them in components — do not hardcode hex values in JSX.
2. Prefer Tailwind utilities for layout, spacing, typography, and color; only write a new CSS class when the composition is too complex or needs shared keyframes/animations.
3. Use the existing primitive classes (.btn, .btn-primary, .btn-danger, .btn-clear, .btn-ghost, .field, .panel, .toolbar-glass, .app-dialog) rather than reinventing button/input/card styles.
4. Keep responsive changes mobile-first — add md:/lg: prefixes in JSX and wrap any bespoke CSS in @media (min-width: ...) blocks mirroring Tailwind's breakpoints.
5. Respect reduced motion: Any new @keyframes should be wrapped in @media (prefers-reduced-motion: reduce) to disable or simplify animations.
6. Do not introduce new CSS frameworks (no Sass, styled-components, Emotion, etc.) — Tailwind v4 is the single source of truth for styling.