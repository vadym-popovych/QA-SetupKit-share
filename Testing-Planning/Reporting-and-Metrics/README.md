# Reporting-and-Metrics kit

Home for the **QA reporting layer**: what gets measured, how numbers are computed
(mechanically, from artefacts — never estimated), and the standard report formats.
Every other kit produces raw records (bug rows, run rows, coverage snapshots); this
kit turns them into the answers owners actually ask: *"how is quality trending?"*,
*"are we ready?"*, *"where do bugs come from?"*.

> **Anti-vanity rule:** every metric must have a DECISION it informs. "Number of test
> cases written" informs nothing → not tracked. "Open Critical/Major count" gates the
> release → tracked. If no decision consumes a metric, drop it.

## The metric set (computed from existing artefacts)

| Metric | Formula (source) | Decision it informs |
|---|---|---|
| Open bugs by severity | count `Bug Reports` rows, `status: open`, per severity | release gate (exit criteria) |
| Bug inflow vs outflow | filed vs fixed+verified per round (bug rows) | is the build stabilizing? |
| Coverage vs strategy | `covered / total units`, weighted by risk (coverage.json) | where to spend the next round |
| Gap count (risk ≥ 7) | `gaps[]` length (coverage.json) | escalation list size — must trend to 0 |
| Reopen rate | rows with `status: reopened` / (verified + reopened) — enum extended 08/07/2026 | fix quality; regression-case gaps |
| Escape rate | rows with `escapedFromCycle = <cycle>` / all bugs of that cycle (field added 08/07/2026) | did the strategy scope miss? |
| Run health per discipline | pass/fail verdicts + thresholds crossed (run-results, `Runs` tab) | flaky infra vs product decay |
| Round throughput | units executed at mapped depth per round (plan Results) | time-box calibration |

## Report formats (three, mirroring the load-testing precedent)

1. **Round report** (every playbook run) — the standard end-of-run report the
   playbooks already mandate: executed/skipped/stop-condition + bugs + LINKS. This
   kit adds the **metrics block** to it (the table above, delta vs previous round).
2. **Cycle/release QA summary** — the release-candidate playbook's step 6 DoD
   deliverable (the Test-Strategy §8 output): bugs by severity over the cycle,
   coverage vs strategy, known risks shipped (waivers), oracle misses, escape-rate
   follow-up slot.
3. **Trends tab in the QA Sheet** — one row per round (append-only), house style per
   the workspace report-tab rules; charts reference whole columns and auto-populate
   (same pattern as the load-testing `Runs` tab — numbers as REAL numbers).

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | Wiring the metrics: compute script + Trends tab + report templates |
| [`REPORTING_RULES.md`](REPORTING_RULES.md) | Reusable rules |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Paste block for a teammate's workspace `CLAUDE.md` |
| [`template/qa-metrics.mjs`](template/qa-metrics.mjs) | Compute the metric set from artefacts (zero-invention) |
| [`template/CYCLE_SUMMARY.template.md`](template/CYCLE_SUMMARY.template.md) | Release QA summary skeleton |
| [`template/REPORT_TAB_STYLE.md`](template/REPORT_TAB_STYLE.md) | Self-contained house style for the Trends tab |

## Where results go

`<Project>/QA-Reports/`: computed `metrics-<round>.json` + cycle summaries; the
Trends tab lives in the project's QA Sheet. Round reports stay in their plan files —
this kit only standardizes the metrics block inside them.
