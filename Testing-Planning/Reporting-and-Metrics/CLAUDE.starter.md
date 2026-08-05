# Reporting-and-Metrics starter rules — paste into YOUR workspace CLAUDE.md

## QA reporting & metrics — Reporting-and-Metrics kit
- **Home:** `QA-SetupKit/Testing-Planning/Reporting-and-Metrics/`. Requests "як тренд якості",
  "QA звіт по релізу", "метрики раунду" → follow the kit's `SETUP.md`.
- **Computed, never estimated:** every number counts artefacts (bug rows,
  coverage.json, plan Results, run verdicts); missing source → `n/a`, not a guess.
- **Every metric names its decision** (release gate, next-round focus…); no vanity
  counts — coverage-vs-strategy and open-severity are the quality signals, not
  "N cases written". Deltas vs previous round + one line of WHY on regressions.
- **Three formats:** metrics block in each round report · append-only `QA Trends`
  tab (house style, real numbers, charts on whole columns) · cycle QA summary at
  release (DoD deliverable: severities, coverage, waivers, oracle misses, escapes).
- **Escapes feed the strategy:** prod-found bug → tag escaped cycle → "which
  scope/risk decision let it through?" → strategy Revision log.
- **Artefacts → `<Project>/QA-Reports/`**; Trends tab in the project's QA Sheet.

Full rules: `QA-SetupKit/Testing-Planning/Reporting-and-Metrics/REPORTING_RULES.md`.
