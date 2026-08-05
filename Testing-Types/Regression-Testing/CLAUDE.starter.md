# Regression-Testing starter rules — paste into YOUR workspace CLAUDE.md

## Regression testing — Regression-Testing kit
- **Home:** `QA-SetupKit/Testing-Types/Regression-Testing/`. Requests "прожени регрес", "перевір що
  нічого не зламалось", "verify the fix" → follow the kit's `SETUP.md`.
- **Regression = selection over existing artefacts**, not a separate suite: CORE
  (bug-derived `TC-NNN` + P0 cases + invariants — re-runs every round) + IMPACT slice
  (changed RTM units → their cases, visual baselines, checklist pages) + CADENCE
  slice (release-only demotions). Selection recorded in the plan's table with a
  `regression` marker.
- **Fix verification:** `verified` = original repro green on the fixed build
  (Bug-Reports owns the term); same round — ensure the regression case exists
  (create if missing) + run it + same-component siblings; any red = `reopened`
  with comparison.
- **Hygiene:** green ≥ 6 runs on unchanged area → demote to release-only (never
  silent delete); flaky case → fix in one round or quarantine + bug ON the test
  (listed in cycle summary as a coverage hole); recurrences strengthen the existing
  case, no near-twins.

Full rules: `QA-SetupKit/Testing-Types/Regression-Testing/REGRESSION_RULES.md`.
