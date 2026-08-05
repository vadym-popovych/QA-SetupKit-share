<!-- Copy to <Project>/Test-Strategy/RTM.md. This table is a PROJECTION harvested
     from artefacts (strategy.json, cases/*.json, run results, Bug Reports tab) —
     fix missing links at the SOURCE, never by editing cells here. -->

# <Project> — Requirements Traceability Matrix

| | |
|---|---|
| **Strategy revision** | <STRATEGY.md rev date> |
| **Refreshed** | <YYYY-MM-DD> (after round <plan file>) |
| **Machine form** | `coverage.json` — gaps: <N> |

## The matrix (one row per scope unit)

| Unit | Risk | Target depth | Cases | Checklist | Last run (verdict) | Bugs (open/total) | State |
|------|-----:|--------------|-------|-----------|--------------------|-------------------|-------|
| S1 Login | 6 | standard | TC-001..009 | Login page: statused | 2026-07-10-build14-checklist (pass) | 0/2 | covered |
| E1 POST /books | 9 | deep | TC-010..024 | — | 2026-07-10-load (fail) | 2/3 | partial |

<!-- State legend (mechanical, from TRACEABILITY_RULES.md): covered = target depth +
     latest pass + no open bugs · partial = below depth OR passed-with-open-bugs ·
     not-run = no run this cycle (reason!) · blocked = attempted, stopped (reason!) -->

## Gaps (risk ≥ 7 not covered — the escalation list)
<!-- EVERY risk ≥ 7 matrix row not at `covered` MUST have a row here (e.g. E1 above). -->
| Unit | Risk | State | Why | Owner decision |
|------|-----:|-------|-----|----------------|
| E1 POST /books | 9 | partial | load run failed thresholds; BUG-002/BUG-003 open | <pending> |

## Orphans (defects in artefacts — fix at source, then remove from here)
- **Cases tracing to no scope unit:** <TC-NNN list or —>
- **Bugs with no invariant reference:** <BUG-NNN list or —>
- **Runs with no plan reference:** <run-id list or —>

## Refresh log
| Date | After | Delta | By |
|------|-------|-------|-----|
| <YYYY-MM-DD> | <plan/round> | <e.g. E1 partial→covered; +TC-025..027> | <who> |
