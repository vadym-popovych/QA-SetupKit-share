# Reporting-and-Metrics — SETUP (Claude-followable)

Prerequisite: the artefacts the metrics read from — bug rows (Bug-Reports kit),
coverage.json (Traceability), plan files (Test-Strategy), run results. Missing
sources → the affected metrics report `n/a (source missing)`, never a guess.

## Procedure

### 1. Compute the metrics per round
Copy [`template/qa-metrics.mjs`](template/qa-metrics.mjs) → `<Project>/QA-Reports/tools/`,
or POINTER it there (a symlink to this canonical, Convention #9) and pass the project's
paths by env — the tool takes both. Run after the round closes (playbook step "close the
round"): `node qa-metrics.mjs --round <plan-slug>` → `metrics-<round>.json` + console
table. Numbers come from counting artefacts — the script has NO estimation logic by design.

**Two bug sources; the output always names which one it used (`bugSource`):**

| Env | Use it when |
|---|---|
| `BUG_SUMMARY=<path/to/bug-summary.json>` | the project keeps a Bug-Summary record. Preferred — no network, and it is the kit's own canonical roll-up |
| `QA_SHEET_ID=<id>` (+ optional `QA_BUGS_RANGE`) | bugs live in a `Bug Reports` tab of the project QA Sheet |

A project whose bug tab was retired in favour of a bug-summary record is the normal case,
not an exception: reading only the Sheet would report a live project as "source missing".

**Pointer contract** — a symlinked copy resolves `import.meta.url` to the KIT, so pass
`QA_REPORTS_DIR=<Project>/QA-Reports` (where the metrics file is written) and `COVERAGE=`
the project's `coverage.json`. Without them a pointered run writes the project's metrics
into the kit.

**Reasoned `n/a` names the missing FIELD, not just the artefact** — e.g. inflow against a
record with no `reportedAt`, or reopen rate against a board that never marks `verified`
(where a reopen is not *zero*, it is unobservable). Severity provenance rides with the
numbers: if any severity is `agent-proposed`, the run warns and the JSON records it — a
statistic built out of hypotheses has to say so wherever it lands.

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
