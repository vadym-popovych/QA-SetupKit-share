# Reporting-and-Metrics — SETUP (Claude-followable)

Prerequisite: the artefacts the metrics read from — bug rows (Bug-Reports kit),
coverage.json (Traceability), plan files (Test-Strategy), run results. Missing
sources → the affected metrics report `n/a (source missing)`, never a guess.

## Procedure

### 1. Compute the metrics per round
Copy [`template/qa-metrics.mjs`](template/qa-metrics.mjs) →
`<Project>/QA-Reports/tools/`; point it at the project's Sheet ID + Test-Strategy
folder. Run after the round closes (playbook step "close the round"):
`node qa-metrics.mjs --round <plan-slug>` → `metrics-<round>.json` + console table.
Numbers come from counting artefacts — the script has NO estimation logic by design.

### 2. Metrics block into the round report
Append the computed table (+ delta vs previous round's JSON) to the plan file's
Results and the end-of-run report. Numbers that moved the wrong way get one line of
WHY (from the round's evidence, not speculation).

### 3. Trends tab (once per project, then append)
Create a `QA Trends` tab in the project's QA Sheet — house style per
[`template/REPORT_TAB_STYLE.md`](template/REPORT_TAB_STYLE.md) (shipped in this kit:
summary block + data table, numbers as REAL numbers, OVERFLOW_CELL + explicit column
widths). One row per round with the columns listed there; cells `qa-metrics.mjs`
computes come from its JSON, the rest (outflow, verdict) are filled from the plan's
Results. Charts (open-bugs stacked; coverage line) reference whole columns — append
rows, never rebuild charts.

### 4. Cycle summary at release
Fill [`template/CYCLE_SUMMARY.template.md`](template/CYCLE_SUMMARY.template.md) →
`<Project>/QA-Reports/cycle-<release>.md`; it is the release-candidate playbook's
DoD deliverable (step 6). Optionally mirror to a Google Doc in the project's Drive
reports folder (same pattern as load-testing run Docs).

### 5. Escape-rate follow-up (the only post-release step)
When the owner reports a production bug: file it (Bug-Reports kit), tag the cycle it
escaped from in the bug row, and increment the cycle summary's escape count — then
ask the strategy question: which scope/risk decision let it through? (feeds the
strategy Revision log).
