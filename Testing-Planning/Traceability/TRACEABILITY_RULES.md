# Traceability rules (paste into your workspace CLAUDE.md)

Reusable rules for the RTM/coverage layer. Machine-specific paths do NOT belong here.
Mirror new rules of this kind here (+ into `CLAUDE.starter.md` and the workspace
`CLAUDE.md`) so they travel with the kit.

- **The RTM is a projection, never a source.** Every cell derives from artefacts
  (strategy.json, case JSONs, run results, bug rows). A missing link is fixed AT THE
  SOURCE (add `traceability.strategyUnit` to the case, `bugs[]` to the run, `INV-N`
  to the bug) — never by hand-editing the RTM table. A full rebuild must reproduce
  the same table.

- **Coverage states are mechanical:** `covered` = target depth + latest pass + no open
  bugs; `partial` = below depth OR latest run failed OR passed-with-open-bugs; `not-run` = no run this
  cycle (skip reason required); `blocked` = attempted, stopped (reason required).
  No judgment calls hidden in the states — the judgment lives in the strategy.
  **"Mechanical" is enforced, not asserted (28/07/2026):** run
  [`template/tools/coverage-check.mjs`](template/tools/coverage-check.mjs) after every refresh —
  it re-derives the snapshot from strategy + cases + runs and reds on a `covered` row whose run
  failed or was blocked, a stale risk, a hidden `gaps[]` escalation, a reasonless skip or an orphan
  case. Without `--cases`/`--runs` it exits 3 (incomplete), never 0. A claim of mechanical
  derivation that nothing re-derives is just a table someone maintained by hand.

- **`gaps[]` is the escalation list:** risk ≥ 7 units not `covered`. Non-empty gaps →
  owner decides (extend / descope / ship-with-risk); never silently shipped. Empty
  gaps + full RTM = the evidence for "exit criteria met".

- **Read before re-testing:** before deriving cases or running tests for an area,
  check the RTM — `lastRun` + verdict answers "did we already test this?". Duplicated
  effort is a traceability failure, not diligence.

- **Orphans are defects:** a case tracing to no scope unit, a bug with no invariant,
  a run with no plan — each goes into the RTM's orphan sections AND gets fixed at the
  source. The orphan sections should trend to empty.

- **Refresh cadence:** after every round (with the plan's Results) and before
  approving the next plan. `coverage.json` validates against
  `Rules-Guide/schemas/coverage.schema.json` on every write.

- **Artefacts co-locate with the strategy:** `<Project>/Test-Strategy/RTM.md` +
  `coverage.json`. No separate `<Project>/Traceability/` folder. Kit folder holds
  templates/rules only.
