---
kind: frontend_style
name: Tailwind v4 Design Tokens, Glass UI & Mobile-First CSS
category: frontend_style
scope:
    - '**'
source_files:
    - src/index.css
    - vite.config.js
    - package.json
---

The frontend styling system is built on Tailwind CSS v4 (via @tailwindcss/vite plugin) with a single global stylesheet (src/index.css) that defines design tokens, component primitives, and page-level layout rules. There is no separate Tailwind config file — all configuration lives in the CSS @theme block.

What system/approach is used:
- Tailwind CSS v4 as the utility-first engine, imported via @import "tailwindcss".
- CSS custom properties declared in an @theme block serve as the canonical design token layer (colors, fonts, spacing).
- Mobile-first responsive breakpoints using standard Tailwind media queries; safe-area insets (env(safe-area-inset-*)) are used extensively for iPhone notch/home-indicator compatibility.
- Glassmorphism / frosted-glass aesthetic: panels, toolbars, dialogs, and action docks use backdrop-filter: blur() + semi-transparent backgrounds with subtle borders and inner highlights.
- Framer Motion (framer-motion) provides component-level animations; CSS @keyframes handle micro-interactions (shimmer skeletons, speaking bars, mesh-orb drift).
- Phosphor Icons (@phosphor-icons/react) supplies the icon set.

Key files and packages:
- src/index.css — single source of truth for tokens, base styles, component primitives (.btn, .field, .panel, .toolbar-glass, .action-dock-*, .qa-row-*, etc.), and responsive rules.
- vite.config.js — registers @tailwindcss/vite plugin and dev proxy routes.
- package.json — declares tailwindcss ^4.3.3, @tailwindcss/vite ^4.3.3, framer-motion, @phosphor-icons/react, plus React/Vite tooling.

Architecture and conventions:
1. Design tokens live in one place. The @theme block at the top of index.css centralizes fonts (--font-sans/--font-display Outfit + Noto Sans SC fallback chain, --font-mono JetBrains Mono) and semantic colors (--color-canvas, --color-panel, --color-line, --color-ink, --color-mute, --color-accent, --color-accent-deep, --color-coral, --color-amber, --color-lavender, --color-navy, --color-sky).
2. Component primitives over inline styles. Reusable visual building blocks are exposed as BEM-style classes (.btn, .btn-primary, .btn-danger, .btn-clear, .btn-ghost; .field; .panel; .app-dialog; .toolbar-glass; .action-dock-*; .nav-chip; .doc-card-*; .skeleton; .mesh-orb). Components compose these rather than writing ad-hoc CSS.
3. i18n-aware typography overrides. An html[lang="zh-CN"] selector reassigns font stacks and tightens letter-spacing/line-height for CJK text, ensuring consistent rendering across languages.
4. Safe-area-first mobile layout. Every sticky/fixed element uses max(..., env(safe-area-inset-*, 0px)) so content clears notches and home indicators on iOS.
5. Reduced-motion support. @media (prefers-reduced-motion: reduce) disables animations for skeleton shimmer, mesh-orb drift, QA playing pulse, and install-sheet transitions.
6. Glass UI pattern. Panels and floating controls share a recipe: rounded corners (border-radius: 999px or 20-28px), translucent white background, thin border with alpha, layered box-shadows (outer soft shadow + inset highlight), and backdrop-filter: blur(16-18px) saturate(1.15+).

Rules developers should follow:
- Add new colors/fonts via @theme, never hardcode hex values in components.
- Use primitive classes (.btn, .field, .panel, .toolbar-glass, .action-dock-*) instead of writing per-component CSS.
- Wrap fixed/sticky elements with safe-area padding using env(safe-area-inset-*).
- Respect reduced motion — any new animation must be gated by prefers-reduced-motion: reduce.
- Keep responsive breakpoints mobile-first and rely on Tailwind's default scale; avoid arbitrary pixel values when a Tailwind spacing token suffices.
- For CJK text, prefer the existing html[lang="zh-CN"] overrides rather than duplicating font stacks.