# Visual-Regression rules (paste into your workspace CLAUDE.md)

Reusable rules for visual regression QA. Machine-specific paths do NOT belong here.
Mirror new rules of this kind here (+ into `CLAUDE.starter.md` and the workspace
`CLAUDE.md`) so they travel with the kit.

- **Baselines are golden masters** (Test-Oracles discipline applies verbatim):
  updated ONLY on owner-confirmed intended change, logged in `BASELINES.md`
  (page, build, date, approver). Re-baselining to green a red diff without that
  confirmation = fabricating a Pass.

- **Determinism before coverage:** a flaky diff suite gets ignored within a week.
  Fixed viewport, animations off, fonts awaited, dynamic data seeded/mocked, variable
  regions masked. Noise → fix the capture, NEVER raise the threshold to hide it.

- **A human looks at every over-threshold diff.** The pixel diff is a DETECTOR, not a
  judge: verdicts are intended (→ re-baseline) / unintended (→ `BUG-NNN` tagged `UI`,
  diff PNG as evidence) / noise (→ fix determinism). The agent proposes the
  classification; re-baselining is a 🟡 gate.

- **Baseline by risk, not wall-to-wall:** risk ≥ 7 screens/states first; every
  baseline is a maintenance liability (each intended redesign must re-bless it).
  Don't baseline what nobody would act on.

- **One canonical copy:** screenshots live in `<Project>/Visual-Regression/`
  (`golden/` committed-or-Drive'd + `BASELINES.md`; `current/`/`diff/` per-run,
  gitignored). Test-Oracles' `golden/` references these — no duplicates.
