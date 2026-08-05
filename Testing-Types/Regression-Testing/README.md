# Regression-Testing kit

Home for the **regression discipline** — making sure what worked KEEPS working, at a
cost that doesn't grow linearly with the product. Regression is not a separate test
type; it's a SELECTION strategy over artefacts the other kits already maintain:
cases (Test-Cases), checklist rows, invariants (Test-Oracles), visual baselines
(Visual-Regression). This kit defines what gets re-run WHEN, and how the suite stays
lean.

## The regression core (what always re-runs)

1. **Every bug-derived case** — a `TC-NNN` tracing to a fixed `BUG-NNN` re-runs every
   round on the affected area, every release everywhere. A fixed bug without a
   regression case is a rule violation (Bug-Reports kit), so the core grows exactly
   as fast as bugs get fixed.
2. **Invariants** — asserted in EVERY run of every discipline by design (Test-Oracles
   rule); they are the cheapest regression net and need no selection.
3. **High-priority cases** (risk 7–9 areas) — the suite's spine, re-run each round.

## Selection beyond the core (impact-based)

| Trigger | What re-runs |
|---|---|
| New build (routine) | core + P1 cases on CHANGED areas (changelog/PR → RTM units) |
| Fix verification | the bug's original repro + its regression case + siblings in the same component |
| Release candidate | core + High/Medium everywhere + full visual baseline set + checklist regression pass |
| Dependency/platform bump | core + Compatibility kit's matrix on affected surfaces |

"Changed areas" come from the RTM (Traceability) — the same impact-select the
new-build playbook already does; this kit just names the regression subset precisely.

## Keeping the suite lean (the part everyone skips)

- **Retire by evidence:** a case that hasn't failed in N (default 6) consecutive
  runs on an UNCHANGED area drops to release-only cadence — set `cadence:
  "release-only"` in the case JSON (schema field). The evidence source is the
  run-results' per-case `results[]` (count consecutive `pass` verdicts across run
  files); where runs don't populate `results[]`, demotion degrades to a manual
  owner-confirmed call. Never silently delete — demote.
- **Flaky = broken:** a regression case that flakes gets fixed or quarantined
  (`status: draft` + a bug on the test itself) within one round — a flaky suite
  trains everyone to ignore red.
- **One failure signature = one case:** don't accumulate near-duplicate regression
  cases per bug recurrence; strengthen the existing case (Bug-Reports dedup ethos).

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | Wiring: build the regression view from existing artefacts, per-trigger selection |
| [`REGRESSION_RULES.md`](REGRESSION_RULES.md) | Reusable rules |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Paste block for a teammate's workspace `CLAUDE.md` |

No template/ — the artefacts belong to other kits; this kit contributes selection
queries over them (documented in SETUP), not new file shapes.

## Where results go

Regression runs are ordinary rounds: plan file + run results + RTM refresh. The
regression SELECTION for a round is recorded in the plan file's `Regression` column
plus its "Regression view for this round" subsection (both are part of
`TEST_PLAN.template.md` — core / impact / cadence slices with TC-ids).
