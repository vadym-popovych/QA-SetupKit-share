<!-- Copy to <Project>/Test-Strategy/plans/<YYYY-MM-DD>-<build>.md for each
     release/build/testing round. Fill "Planned" before the round; "Results" after.
     Plans are append-only history — never rewrite a past plan. -->

# <Project> — Test Plan — <build/release id>

| | |
|---|---|
| **Strategy version** | STRATEGY.md rev <date> (§9) |
| **Round** | <e.g. build 1.4 regression / release candidate 2> |
| **Time-box** | <e.g. 2 working days / 4 hours of agent time> |
| **Environment** | <staging URL, build number> |

## Planned

### What changed in this build
<!-- Diff-driven: changelog / PR list / owner's summary. Drives the selection below. -->

### Selected from the risk matrix
<!-- Which strategy units this round covers, and at what depth. Changed areas and
     risk ≥ 7 are non-negotiable; the rest fits the time-box in risk order. -->

| Unit | Risk | Depth this round | Regression | Why selected |
|------|-----:|------------------|------------|--------------|
| E1 | 9 | deep | core + impact | changed in this build + top risk |

<!-- Regression column: which slice of the regression view (Regression-Testing kit)
     hits this unit — core / impact / cadence / "—". Case-level detail below. -->

### Regression view for this round (Regression-Testing kit)
- **Core (every round):** <TC-ids of bug-derived + P0 cases; invariants always on>
- **Impact slice (changed areas):** <TC-ids, visual baselines, checklist pages>
- **Cadence slice (release-only, RC rounds):** <TC-ids or —>

### Exit criteria for THIS round
<!-- Inherit from strategy §6, narrowed to this round's selection. Agent-checkable. -->

### Known skips (planned "Not run")
<!-- What the time-box already excludes, with reasons. -->

## Results (fill after the round)

- **Stop condition fired:** <exit criteria met / time-box / diminishing returns / blocked>
- **Executed:** <units × depth actually done>
- **Not run:** <units + reasons — never silent>
- **Bugs filed:** <BUG-NNN list with severities>
- **Risk re-scores proposed:** <unit: 2→3 because …> → apply to STRATEGY.md §4 + §9
- **strategy.json updated:** plans[] entry for this round — `stopCondition` filled
- **Links:** <checklist tab, Runs row, run Doc, HTML report — every artefact clickable>
