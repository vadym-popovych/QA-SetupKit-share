# Traceability kit — RTM & coverage memory

Home for the **requirement-traceability discipline**: keeping the chain
**requirement (strategy scope unit) → test case → run → bug** connected via the ID
patterns the schemas already encode (`S1/E1…`, `TC-NNN`, run-id, `BUG-NNN`, `INV-N`),
and answering the two questions execution kits can't answer alone:

1. **"What is NOT covered?"** — gap analysis: scope units (especially risk ≥ 7) with
   no cases, no runs, or failed-and-unresolved state.
2. **"Am I duplicating?"** — memory: what was already tested, when, with what verdict.

This encodes the **"Memory / Coverage" judgment** from
[`../../Rules-Guide/Roadmap/AI-QA-ROADMAP.md`](../../Rules-Guide/Roadmap/AI-QA-ROADMAP.md).

It was a pure *documentation discipline* until 28/07/2026, when an external audit made the obvious
point: this kit calls its coverage states "mechanical" and promises that "a full rebuild must
reproduce the same table", and nothing in the kit checked either claim. A hand-maintained RTM
drifts in exactly one direction — toward `covered`. So the discipline now ships one tool,
[`template/tools/coverage-check.mjs`](template/tools/coverage-check.mjs), which re-derives the
snapshot from the artefacts and reports every disagreement.

## The chain (all links already exist in the schemas)

```
STRATEGY scope unit (S1/E1/R1/I1, risk, target depth)     strategy.schema.json
   ↑ traceability.strategyUnit                            test-case.schema.json
TEST CASE (TC-NNN, technique, oracle)
   ↑ planRef / metrics                                     run-result.schema.json
RUN (YYYY-MM-DD-slug, verdict, stopCondition)
   ↑ bugs[]                                                run-result.schema.json
BUG (BUG-NNN, invariantViolated → INV-N)                   bug.schema.json
   ↑ regression case traces back                           test-case.schema.json
```

The RTM is a PROJECTION of those links into one table; the coverage snapshot
([`Rules-Guide/schemas/coverage.schema.json`](../../Rules-Guide/schemas/coverage.schema.json)) is its
machine-readable form. Nothing is entered twice — if a link is missing, fix the
artefact (add `traceability` to the case, `bugs[]` to the run), don't hand-edit the RTM.

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | Build/refresh procedure: harvest links → RTM.md + coverage.json → gap report |
| [`TRACEABILITY_RULES.md`](TRACEABILITY_RULES.md) | Reusable rules |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Paste block for a teammate's workspace `CLAUDE.md` |
| [`template/RTM.template.md`](template/RTM.template.md) | RTM table skeleton |
| [`template/coverage.example.json`](template/coverage.example.json) | Schema-valid coverage snapshot example |
| [`template/tools/coverage-check.mjs`](template/tools/coverage-check.mjs) | Proves the snapshot against strategy + cases + runs (membership · risk arithmetic · depth · states vs runs · reasons · `gaps[]` completeness · orphans). Exit 0 consistent · 1 inconsistent · 2 usage · **3 incomplete** (run without `--cases`/`--runs`: the artefacts agree but every `covered` row is unproven — not a pass) |

## Deliverables & where they live

RTM and coverage are **planning-layer views**, so they co-locate with the strategy
(no separate project folder — consistent with the
[`schemas` README](../../Rules-Guide/schemas/README.md) placement table):

```
<Project>/Test-Strategy/
├── STRATEGY.md · strategy.json · plans/        # Test-Strategy kit
├── RTM.md                                      # this kit: the human traceability table
└── coverage.json                               # this kit: machine snapshot (coverage.schema.json)
```

## When it earns its keep

- **Before a round:** the plan's "Selected from the risk matrix" is sanity-checked
  against coverage.json — units at risk ≥ 7 that are `not-run`/`partial` are
  non-negotiable inclusions; `gaps[]` IS the escalation list.
- **After a round:** refresh RTM + coverage from the round's artefacts; the strategy's
  Revision log and the coverage snapshot must tell the same story.
- **On "did we already test this?"** — read RTM.md before re-deriving or re-running
  anything; the `lastRun` + verdict answers it.
