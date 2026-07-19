# Skills Catalog

This project has **56 registered skills** — 9 from Vercel and 47 imported from Cursor.

## How to Use a Skill

To activate a skill, use the `use_skill` tool with the exact skill name:

```
<use_skill>
<skill_name>skill-name-here</skill_name>
</use_skill>
```

For example:
```
<use_skill>
<skill_name>ponytail</skill_name>
</use_skill>
```

Some skills accept arguments (e.g. `ponytail` supports `lite`, `full`, `ultra`).

---

## Vercel Skills

| Skill | Description |
|---|---|
| `deploy-to-vercel` | Deploy projects to Vercel |
| `vercel-cli-with-tokens` | Use Vercel CLI with tokens |
| `vercel-composition-patterns` | Vercel composition patterns |
| `vercel-optimize` | Optimize Vercel deployments |
| `vercel-react-best-practices` | React best practices |
| `vercel-react-native-skills` | React Native skills |
| `vercel-react-view-transitions` | React view transitions |
| `web-design-guidelines` | Web design guidelines |
| `writing-guidelines` | Writing guidelines |

---

## Cursor Skills

### 🐴 Ponytail Suite
*Minimalist, lazy coding philosophy — write the least code that works.*

| Skill | Description |
|---|---|
| `ponytail` | Forces the laziest solution that actually works. Supports: `lite`, `full` (default), `ultra` |
| `ponytail-audit` | Whole-repo audit for over-engineering — ranked list of what to delete/simplify |
| `ponytail-debt` | Harvest every `ponytail:` comment into a debt ledger |
| `ponytail-gain` | Show ponytail's measured impact as a compact scoreboard |
| `ponytail-help` | Quick-reference card for all ponytail modes and commands |
| `ponytail-review` | Code review focused exclusively on over-engineering — finds what to delete |

### 🔍 Code Review & Quality

| Skill | Description |
|---|---|
| `code-review` | Review changes since a fixed point along Standards and Spec axes |
| `codebase-design` | Shared vocabulary for designing deep modules |
| `diagnosing-bugs` | Diagnosis loop for hard bugs and performance regressions |
| `improve-codebase-architecture` | Scan codebase for deepening opportunities, present as HTML report |
| `migrate-to-shoehorn` | Migrate test files from `as` type assertions to `@total-typescript/shoehorn` |

### 🧪 Development Workflow

| Skill | Description |
|---|---|
| `implement` | Implement a piece of work based on a spec or set of tickets |
| `prototype` | Build a throwaway prototype to answer a design question |
| `tdd` | Test-driven development — red-green-refactor |
| `research` | Investigate a question against high-trust primary sources |
| `scaffold-exercises` | Create exercise directory structures with sections, problems, solutions |
| `teach` | Teach the user a new skill or concept |

### 🎨 UI/UX & Design

| Skill | Description |
|---|---|
| `interaction-design` | Design microinteractions, motion design, transitions, feedback patterns |
| `mobile-responsiveness` | Audit and fix mobile / responsive UI |

### 📋 Planning & Process

| Skill | Description |
|---|---|
| `handoff` | Compact the current conversation into a handoff document for another agent |
| `to-spec` | Turn the current conversation into a spec and publish to issue tracker |
| `to-tickets` | Break a plan/spec into tracer-bullet tickets with blocking edges |
| `triage` | Move issues and PRs through a state machine of triage roles |
| `wayfinder` | Plan a huge chunk of work as a shared map of decision tickets |
| `grill-me` | A relentless interview to sharpen a plan or design |
| `grill-with-docs` | Grill + create ADRs and glossary docs |
| `grilling` | Grill the user relentlessly about a plan, decision, or idea |

### 🧑‍💼 Career & Coaching

| Skill | Description |
|---|---|
| `interview-coach` | High-rigor interview coaching — structured prep, transcript analysis, drills |
| `ask-matt` | Ask which skill or flow fits your situation (router over skills) |

### 🛡️ Git & Pre-commit

| Skill | Description |
|---|---|
| `git-guardrails-claude-code` | Set up Claude Code hooks to block dangerous git commands |
| `resolving-merge-conflicts` | Resolve in-progress git merge/rebase conflicts |
| `setup-pre-commit` | Set up Husky pre-commit hooks with lint-staged, type checking, tests |

### 🧩 Domain & Architecture

| Skill | Description |
|---|---|
| `domain-modeling` | Build and sharpen a project's domain model / ubiquitous language |
| `setup-matt-pocock-skills` | Configure repo for engineering skills — issue tracker, triage labels |

### 🛠️ Cursor Tooling

| Skill | Description |
|---|---|
| `babysit` | (Cursor tooling) |
| `create-hook` | Create a Cursor hook |
| `create-rule` | Create a Cursor rule |
| `create-skill` | Create a new skill |
| `create-subagent` | Create a subagent |
| `migrate-to-skills` | Migrate to skills format |
| `sdk` | Cursor SDK tooling |
| `shell` | Shell tooling |
| `split-to-prs` | Split work into PRs |
| `statusline` | Status line tooling |
| `update-cli-config` | Update CLI configuration |
| `update-cursor-settings` | Update Cursor settings |
| `writing-great-skills` | Reference for writing and editing skills well |

---

## Built-in Skills (always available)

These are built into the system and don't need to be registered — just mention the task and I'll use them automatically:

**Marketing:** ads, cold-email, social, SEO, CRO, analytics, content-strategy, copywriting, emails, SMS, referrals, pricing, offers, launches, PR, competitor-profiling, product-marketing, marketing-plan, marketing-ideas, marketing-psychology, marketing-council, marketing-loops, co-marketing, community-marketing, lead-magnets, free-tools, directory-submissions, popups, signup, onboarding, churn-prevention, paywalls, sales-enablement, revops, prospecting, customer-research, ab-testing, ad-creative, ai-seo, aso, schema, programmatic-seo, seo-audit, site-architecture, public-relations, video, image, copy-editing, customer-email-draft-threads, customer-support-verification

**Design & Frontend:** frontend-design, tailwindcss, animation-systems, gsap, threejs, webgl-landing-steering, glass-dark-ui, skeuomorphic-ui, minimalist-ui, industrial-brutalist-ui, high-end-visual-design, design-taste-frontend, apple-design, baseline-ui, beautiful-shadows, cinematic-gsap-lenis-motion-system, cinematic-scroll-storytelling, and many more design system skills

**Development:** fixing-accessibility, fixing-metadata, fixing-motion-performance, mobile-responsiveness, performance-profiling, playwright, pdf, image-to-code, netlify-deploy, swiftui-pro, swiftui-debugging

---

## Quick Reference

To use any skill, just tell me what you want to do. I'll automatically pick the right skill. But if you want to force a specific skill, say:

> "Use ponytail" or "Activate code-review"

And I'll invoke it via `use_skill`.