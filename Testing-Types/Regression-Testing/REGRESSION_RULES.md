# Regression-Testing rules (paste into your workspace CLAUDE.md)

Reusable rules for the regression discipline. Machine-specific paths do NOT belong
here. Mirror new rules of this kind here (+ into `CLAUDE.starter.md` and the
workspace `CLAUDE.md`) so they travel with the kit.

- **Regression is a selection, not a suite:** the view is built per round from
  existing artefacts — core (bug-derived cases + P0 + invariants) + impact slice
  (changed RTM units → their cases/visual/checklist) + cadence slice (release-only
  demotions). Recorded in the plan's selection table with a `regression` marker.

- **The core is non-negotiable:** every bug-derived case re-runs every round on its
  area and every release everywhere; invariants assert in every run of every
  discipline. If the core feels too big, fix flaky/duplicate cases — don't skip the
  core.

- **Fix verification:** `verified` is set by the Bug-Reports rule (original repro
  green on the fixed build). In the SAME round, ensure the regression case exists
  (create if missing) and run it + same-component siblings; any red → `reopened`
  with a comparison to the original failure.

- **Demote by evidence, never delete silently:** green ≥ 6 consecutive runs on an
  unchanged area → `cadence: "release-only"` in the case JSON; evidence comes from
  run-results' per-case `results[]` (no recorded results → manual owner-confirmed
  demotion only). Deletion is an owner decision (it's coverage descoping).

- **Flaky = broken:** an intermittent regression case is fixed within one round or
  quarantined (`status: draft` + a bug ON the test). Quarantined cases are listed in
  the cycle summary as coverage holes. A suite that cries wolf protects nothing.

- **One failure signature = one case:** recurrences strengthen the existing case
  (Bug-Reports dedup ethos applied to tests).
