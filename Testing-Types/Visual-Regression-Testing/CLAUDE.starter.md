# Visual-Regression starter rules — paste into YOUR workspace CLAUDE.md

## Visual regression — Visual-Regression-Testing kit
- **Home:** `QA-SetupKit/Testing-Types/Visual-Regression-Testing/`. Requests "порівняй з еталоном",
  "чи не поїхала верстка", "visual diff" → follow the kit's `SETUP.md`.
- **Golden-master oracle on pixels:** Playwright/Maestro screenshots diffed with
  pixelmatch vs `golden/` baselines. Determinism first (viewport, animations off,
  fonts awaited, seeded data, masks) — noise → fix capture, never raise thresholds.
- **Baselines update ONLY on owner-confirmed intended change** (🟡 gate), logged in
  `BASELINES.md` (page/build/date/approver). Silent re-baseline = fabricated Pass.
- **A human looks at every over-threshold diff:** intended → re-baseline · unintended
  → `BUG-NNN` tagged `UI` with the diff PNG · noise → fix determinism.
- **Baseline by risk** (≥ 7 screens first). Artefacts →
  `<Project>/Visual-Regression/` (`golden/` + `BASELINES.md`; `current/`/`diff/`
  gitignored per run).

Full rules: `QA-SetupKit/Testing-Types/Visual-Regression-Testing/VISUAL_REGRESSION_RULES.md`.
