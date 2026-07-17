---
kind: logging_system
name: No centralized logging system
category: logging_system
scope:
    - '**'
---

This repository does not implement a structured or centralized logging system. There is no dedicated logger framework (pino, winston, bunyan, debug, etc.), no log-level configuration, and no shared logging utility. The frontend (`src/`) contains zero `console.*` calls — user-facing errors are surfaced via UI state rather than logs. Server-side code in `api/` and scripts under `scripts/` uses ad-hoc `console.log`, `console.error`, `console.warn`, and `console.assert` statements directly, with no consistent format, level strategy, or sink configuration. These calls serve as informal diagnostics only and are not part of any logging architecture.