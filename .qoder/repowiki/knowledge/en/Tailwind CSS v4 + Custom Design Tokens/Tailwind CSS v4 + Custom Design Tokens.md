---
kind: frontend_style
name: Tailwind CSS v4 + Custom Design Tokens
category: frontend_style
scope:
    - '**'
source_files:
    - src/index.css
    - package.json
---

The app uses Tailwind CSS v4 (via `@tailwindcss/vite` plugin) with a single global stylesheet (`src/index.css`) that defines the entire visual system. There is no separate `tailwind.config.js`; configuration lives in the CSS file itself via the `@theme` block, which centralizes design tokens.

**Design tokens and theme**
- Fonts: `--font-sans` / `--font-display` default to Outfit for Latin and Noto Sans SC for CJK; `--font-mono` is JetBrains Mono. A `html[lang="zh-CN"]` override swaps the font stack so Chinese text renders consistently without serif fallbacks.
- Colors: semantic tokens `--color-canvas`, `--color-panel`, `--color-line`, `--color-ink`, `--color-mute`, `--color-accent`/`--color-accent-deep`, plus accent hues coral, amber, lavender, navy, sky.
- Base styles set smooth scrolling, safe-area insets (`env(safe-area-inset-* )`), antialiased text, and `text-size-adjust: 100%` to prevent iOS zoom-on-focus.

**Component-level CSS classes**
The stylesheet ships a rich library of hand-tuned utility classes used across components:
- Layout shells: `.shell-pad`, `.page-hero`
- UI primitives: `.btn`, `.btn-primary`, `.btn-danger`, `.btn-clear`, `.btn-ghost`, `.field`, `.panel`, `.toolbar-glass`, `.app-dialog` / `.app-dialog-backdrop`
- Typography helpers: `.display`, `.label`, `.ink`, `.mute`, `.faint`, `.ok`, `.warn`, `.err`, `.sky`, `.line`
- Install-prompt sheet: `.install-sheet`, `.install-phone`, `.install-step`, `.install-sheet-cta`, etc., with landscape-specific overrides
- Accessibility: `prefers-reduced-motion` media queries disable animations; focus-visible outlines are defined on buttons.

**Responsive strategy**
- Mobile-first breakpoints at 480px, 640px, 768px, 1024px.
- Safe-area padding adapts per breakpoint using `max()` with `env(safe-area-inset-*)`.
- Landscape orientation gets dedicated grid layouts for the install sheet.
- Text wrapping switches between `white-space: nowrap` (desktop ≥1024px) and pretty-wrapping on smaller screens via `.line-responsive`.

**Animation and motion**
- Framer Motion is available as a runtime dependency for React component animations.
- CSS keyframes handle micro-interactions (install sheet enter/exit, phone-app pulse) with reduced-motion fallbacks.

**No other styling layer**
There are no additional CSS modules, Sass files, styled-components, or inline style libraries beyond Tailwind utilities and this single stylesheet. Components compose these classes directly in JSX.