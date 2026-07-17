---
kind: frontend_style
name: Tailwind v4 + Custom CSS Design System
category: frontend_style
scope:
    - '**'
source_files:
    - src/index.css
    - package.json
---

The LineCheck frontend uses a hybrid styling approach centered on Tailwind CSS v4 with a single, comprehensive stylesheet (`src/index.css`) that defines the entire visual system. The project does not use a component library or SCSS — instead it combines Tailwind utility classes with hand-crafted BEM-style CSS classes for complex UI surfaces.

**Core system**
- **Tailwind v4** is imported via `@import "tailwindcss"` and configured through a `@theme` block in `src/index.css`, which declares all design tokens as CSS custom properties: fonts (`--font-sans`, `--font-display`, `--font-mono`), colors (`--color-canvas`, `--color-panel`, `--color-line`, `--color-ink`, `--color-mute`, `--color-accent`, `--color-accent-deep`, `--color-coral`, `--color-amber`, `--color-lavender`, `--color-navy`, `--color-sky`), and font families (Outfit for Latin, Noto Sans SC/PingFang/Hiragino for CJK).
- A global `html[lang="zh-CN"]` override swaps the font stack to prioritize CJK faces and adjusts line-height/letter-spacing for Chinese readability.
- Components compose Tailwind utilities (e.g. `text-lg`, `md:text-xl`, `mt-0.5`, `flex`, `gap-2`) with bespoke class names from the shared stylesheet.

**Custom CSS architecture**
The ~4000-line `src/index.css` is organized into cohesive surface areas rather than per-component files:
- **Global base**: typography scales, selection color, smooth scroll, safe-area insets, body defaults.
- **Shared primitives**: `.btn`, `.btn-primary`, `.btn-danger`, `.btn-clear`, `.btn-ghost`, `.field`, `.panel`, `.toolbar-glass`, `.app-dialog`, `.grain` (noise overlay), `.mesh-orb` (animated gradient blobs).
- **Layout shells**: `.shell-pad`, `.page-hero`, `.shell-banner` with responsive breakpoints at 480/560/640/768/1024px.
- **Feature surfaces**: install sheet (`.install-sheet*`), document twin cards (`.doc-card*`, `.doc-role-*`), Q&A rows (`.qa-row*`, `.speaking-indicator`), focus bubbles (`.focus-bubble*`, `.focus-count*`), action dock (`.action-dock*`), playback FAB (`.playback-fab*`), settings console (`.settings-*`).
- **Motion**: keyframes for shimmer, bubble drift/floating, QA playing pulse, install sheet transitions; all respect `prefers-reduced-motion: reduce`.

**Responsive strategy**
- Mobile-first with `min-width` media queries at standard Tailwind breakpoints plus custom ones (379px, 560px).
- Safe-area insets (`env(safe-area-inset-*)`) used throughout for iPhone notch/home-bar compatibility.
- Landscape-specific overrides for the install sheet and compact screens.
- Touch targets enforced at ≥44pt minimums.

**Animation & motion**
- Framer Motion is a dependency but most animations are pure CSS keyframes for performance; reduced-motion variants are consistently provided.
- Glassmorphism via `backdrop-filter: blur()` + saturate across panels, dialogs, toolbar, and floating elements.

**Developer conventions**
- Use Tailwind utilities for layout, spacing, and typography sizing; reserve custom CSS classes for interactive states, glass effects, and complex multi-part components.
- Reference design tokens exclusively through CSS variables defined in `@theme` — never hardcode hex values in new code.
- Follow the established naming: `btn-*`, `field`, `panel`, `display`, `title`, `mute`, `ok/warn/err/sky/line` color helpers, `doc-card-*`, `qa-row-*`, `focus-bubble-*`, `action-dock-*`, `settings-*`.
- Always provide `prefers-reduced-motion` alternatives for animated surfaces.