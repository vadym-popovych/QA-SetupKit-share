# Reporting-and-Metrics rules (paste into your workspace CLAUDE.md)

Reusable rules for QA reporting. Machine-specific paths do NOT belong here. Mirror
new rules of this kind here (+ into `CLAUDE.starter.md` and the workspace
`CLAUDE.md`) so they travel with the kit.

- **Metrics are computed, never estimated.** Every number counts artefacts (bug
  rows, coverage.json, plan Results, run verdicts). Source missing → `n/a (source
  missing)`, not a guess. The compute script contains no estimation logic by design.

- **Every metric names the decision it informs** (release gate, next-round focus,
  time-box calibration…). A metric no decision consumes is vanity — drop it. Never
  report case/test COUNTS as quality evidence; coverage-vs-strategy and open-severity
  counts are the quality signals.

- **Deltas over absolutes:** each round's metrics block shows the change vs the
  previous round; a number that moved the wrong way gets one line of WHY from the
  round's evidence, not speculation.

- **Three formats, fixed:** metrics block in every round report · `QA Trends` tab
  (append-only, house style, real numbers, charts on whole columns) · cycle QA
  summary at release (the DoD deliverable — includes waivers, oracle misses, and an
  escape-rate follow-up slot).

- **Escapes feed back into the strategy:** every production-found bug is tagged with
  the cycle it escaped and triggers the question "which scope/risk decision let it
  through?" → strategy Revision log. Escape rate is the ultimate test of the
  strategy, not of the testers.

- **Artefacts → `<Project>/QA-Reports/`** (`metrics-<round>.json`, cycle summaries);
  the Trends tab lives in the project's QA Sheet. Round reports stay in plan files.

## A shared link survives every rebuild

Universal invariant (Project-Configuration rule 10, owner's rule 15/07/2026): updating this
kit's artifact must keep the link the owner already shared. For this kit: the QA Trends tab is append-only under one fixed gid; cycle summaries that get regenerated are rewritten at the SAME location, never re-created beside the old one.
Trash-and-recreate looks identical in the UI and silently kills every saved link; if a
carrier genuinely cannot keep its link, say so in the hand-over message.
