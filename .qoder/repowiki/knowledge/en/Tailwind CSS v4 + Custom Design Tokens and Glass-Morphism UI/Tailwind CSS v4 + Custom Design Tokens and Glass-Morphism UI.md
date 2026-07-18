---
kind: frontend_style
name: Tailwind CSS v4 + Custom Design Tokens and Glass-Morphism UI
category: frontend_style
scope:
    - '**'
source_files:
    - src/index.css
    - vite.config.js
    - package.json
    - src/components/Shell.jsx
---

The LineCheck frontend uses **Tailwind CSS v4** (via `@tailwindcss/vite` plugin) as its sole styling system, with all design tokens, fonts, colors, and global styles declared in a single `src/index.css`. There is no separate Tailwind config file — configuration lives entirely inside the CSS `@theme` block. Components are styled by composing utility classes directly in JSX alongside a small set of hand-written component-level CSS classes for complex layouts and animations.

### System and approach
- **Styling engine**: Tailwind CSS v4 (`@import "tailwindcss"`) loaded through Vite via `@tailwindcss/vite`.
- **No CSS-in-JS or component libraries**: Styling is purely CSS/Utility-first; React components receive class strings rather than style objects.
- **Iconography**: `@phosphor-icons/react` provides consistent SVG icons used throughout the UI.
- **Animation**: `framer-motion` is available but only minimal CSS `@keyframes` are used for install-sheet transitions and subtle micro-interactions.
- **Build-time**: Tailwind is processed at build time by Vite; there is no runtime CSS parser.

### Key files
- `src/index.css` — the entire design system: `@theme` token definitions, base resets, typography, color utilities, button/field/dialog/panel primitives, glass-morphism toolbar, responsive padding helpers, CJK font overrides, and animation keyframes (~4000 lines).
- `vite.config.js` — registers `@tailwindcss/vite` plugin and dev proxy.
- `package.json` — declares `tailwindcss` ^4.3.3, `@tailwindcss/vite` ^4.3.3, `@phosphor-icons/react`, `framer-motion`.
- `src/components/Shell.jsx` — representative example of utility-first composition mixed with custom classes like `toolbar-glass`, `nav-chip`, `choice-seg-btn`.

### Architecture and conventions
1. **Design tokens live in `@theme`**
   - Fonts: `--font-sans` / `--font-display` (Outfit + Noto Sans SC), `--font-mono` (JetBrains Mono). A `html[lang="zh-CN"]` override swaps Outfit out for pure CJK faces.
   - Colors: semantic tokens `--color-canvas`, `--color-panel`, `--color-line`, `--color-ink`, `--color-mute`, `--color-accent` (#4a7ff8 blue), `--color-coral`, `--color-amber`, `--color-lavender`, `--color-navy`, `--color-sky`.
2. **Global base layer** sets smooth scrolling, safe-area-aware `min-height: 100dvh`, antialiased text rendering, and an `overflow-x: clip` root to contain decorative orbs.
3. **Responsive strategy** is mobile-first with `@media (min-width: ...)` breakpoints (480/640/768/1024px) plus landscape-specific rules for short viewports. Safe-area insets (`env(safe-area-inset-*)`) are used extensively for PWA home-screen ergonomics.
4. **Component primitives** are defined as reusable CSS classes rather than Tailwind variants:
   - `.btn`, `.btn-primary`, `.btn-danger`, `.btn-clear`, `.btn-ghost`
   - `.field` (input/select with custom arrow, focus ring, disabled/read-only states)
   - `.panel` (glass card), `.app-dialog` / `.app-dialog-backdrop` (modal sheet)
   - `.toolbar-glass` (floating pill toolbar with backdrop blur)
   - `.install-sheet`, `.shell-pad`, `.page-hero` (layout shells)
5. **Typography tokens**: `.display` (tight tracking, display weight), `.label` (mono, uppercase, amber), `.ink/.title/.mute/.faint/.ok/.warn/.err/.sky/.line` color helpers.
6. **Glass-morphism aesthetic**: heavy use of `backdrop-filter: blur() saturate()` with semi-transparent white backgrounds and inset top highlights on panels, dialogs, and the toolbar.
7. **Accessibility**: `prefers-reduced-motion` disables animations; `focus-visible` outlines use accent color; touch targets respect Apple HIG minimum heights (2.75rem / 44pt); `aria-*` attributes are present on interactive elements.
8. **CJK support**: dedicated `html[lang="zh-CN"]` blocks adjust line-height, letter-spacing, and force Noto Sans SC across every text-bearing class listed explicitly.
9. **Decorative background**: a fixed `.grain` overlay applies a subtle SVG noise texture at low opacity for visual warmth.

### Rules developers should follow
- **Do not create new CSS files** — add tokens to `@theme` in `src/index.css` and write component styles as utility-class compositions in JSX. Only introduce a new CSS class when the layout/animation complexity justifies it.
- **Use the token variables** (`var(--color-accent)`, `var(--font-sans)`, etc.) instead of hard-coded hex values so theme changes stay centralized.
- **Follow the existing primitive palette**: prefer `.btn-primary` / `.btn-clear` / `.btn-ghost` over inventing new button variants; use `.field` for inputs, `.panel` for cards, `.app-dialog` for modals.
- **Keep breakpoints consistent**: reuse the established 480/640/768/1024 scale and always wrap mobile-safe paddings with `max(..., env(safe-area-inset-*, 0px))`.
- **Respect reduced motion**: any new animation must be wrapped in `@media (prefers-reduced-motion: reduce)`.
- **Icons from Phosphor**: import from `@phosphor-icons/react` and keep sizes consistent (18–36px range used in Shell).
- **No Tailwind config file**: if you need a new token or variant, extend it via the `@theme` block in `index.css`.