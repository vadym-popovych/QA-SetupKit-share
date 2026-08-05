<!-- Copy to <Project>/QA-Reports/cycle-<release>.md at release-candidate close.
     This IS the DoD deliverable of PLAYBOOK_release-candidate step 6 — the document
     the owner ships with. Every number computed (qa-metrics.mjs), every claim linked. -->

# <Project> — Release QA summary — <release/version>

| | |
|---|---|
| **Cycle** | <first build date> → <RC date>, <N> rounds (plans: <links>) |
| **Strategy** | STRATEGY.md rev <date>, coverage snapshot <asOf> |
| **Verdict** | <READY / READY-WITH-RISK (waivers below) / NOT READY> |

## Quality picture
- **Open bugs at RC:** <N Critical / N Major / N Medium / N Low> (release gate: 0 Crit/Major or waived)
- **Cycle totals:** filed <N>, fixed+verified <N>, reopen rate <N%>
- **Coverage vs strategy:** <N/M units covered (risk-weighted N%)>; gaps: <empty / list>
- **Trend:** <one line from the Trends tab — stabilizing or not, with the inflow/outflow numbers>

## What ships with known risk (waivers — each owner-signed)
| Risk | Waiver | Owner decision date |
|------|--------|---------------------|

## Oracle & process notes
- Oracle misses this cycle (false alarms / missed bugs → adjustments): <list or —>
- Quarantined cases (coverage holes, per Regression-Testing): <TC-NNN list + bug-on-the-test or —>
- Strategy re-scores applied: <from plan Results / Revision log>
- Escape follow-up slot: <fill when/if prod bugs surface — bug id + which decision let it through>

## LINKS
<!-- Every artefact clickable: plans, Trends tab, bug sheet, coverage.json, run docs/reports. -->
- Plans: … · Trends tab: … · Bug Reports tab: … · coverage.json: … · run reports: …
