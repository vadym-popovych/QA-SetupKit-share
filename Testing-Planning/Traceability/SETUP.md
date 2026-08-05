# Traceability — SETUP (Claude-followable)

How to build and keep the RTM + coverage snapshot for a project. Prerequisite: a
Test-Strategy exists (`<Project>/Test-Strategy/strategy.json`) — the scope units are
the RTM's rows. No strategy → build that first (Test-Strategy-and-Planning kit).

## Build / refresh procedure

1. **Harvest the links** (read, don't invent):
   - scope units + risks + target depths ← `strategy.json` (`scope.in`, `riskMatrix`)
   - cases per unit ← `<Project>/QA-Documentation/test-cases/cases/*.json`
     (`traceability.strategyUnit`)
   - runs per unit ← run-result artefacts (`planRef`, discipline, verdict,
     `stopCondition`) + the Sheet's `Runs` tab
   - bugs per unit ← `Bug Reports` tab rows (component → unit; `status`)
   - checklist state per unit ← the checklist Sheet's per-page counters

2. **Fill the RTM** — copy [`template/RTM.template.md`](template/RTM.template.md) →
   `<Project>/Test-Strategy/RTM.md` (or refresh in place). One row per scope unit;
   orphans (cases pointing at no unit, bugs with no invariant) go into the dedicated
   sections at the bottom — an orphan is a defect in the artefact, fix it at the source.

3. **Derive each unit's coverage state** (mechanical, no judgment):
   - `covered` — executed at target depth this cycle, latest verdict pass, no open bugs
   - `partial` — executed below target depth, OR latest run failed, OR passed but with open bugs
   - `not-run` — no run this cycle (must carry the recorded skip reason)
   - `blocked` — attempted, stopped by environment/accounts (reason required)

4. **Write `coverage.json`** (shape: [`template/coverage.example.json`](template/coverage.example.json)),
   `gaps[]` = ids of risk ≥ 7 units not at `covered`. Validate:
   `node QA-SetupKit/Rules-Guide/schemas/validate.mjs QA-SetupKit/Rules-Guide/schemas/coverage.schema.json <file>`.

5. **Prove it before you believe it** — schema-valid only means well-shaped, not true:

   ```bash
   node QA-SetupKit/Testing-Planning/Traceability/template/tools/coverage-check.mjs \
     --strategy <Project>/Test-Strategy/strategy.json \
     --coverage <Project>/Test-Strategy/coverage.json \
     --cases    <Project>/QA-Documentation/test-cases/cases \
     --runs     <Project>/<wherever run-result.json artefacts live>
   ```

   It re-derives what the snapshot claims and reports every disagreement: units present in one
   artefact and missing from the other, a risk that no longer matches the strategy (or does not
   equal likelihood × impact), a target depth that drifted, a `covered` unit whose run failed or
   was blocked or that no case implements, a not-run/blocked with no reason, a `gaps[]` that is
   missing an escalation or padded with a non-gap, and cases tracing outside the scope.

   **Run it with `--cases` and `--runs`.** Without them it exits **3 — incomplete**, because the
   state checks are exactly the ones that cannot run; the artefacts may agree and every `covered`
   row still be unproven. A 3 is not a pass.

6. **Report the gaps.** `gaps[]` non-empty → surface to the owner with the strategy's
   escalation options (extend / descope / ship-with-risk). An empty gaps list next to
   a full RTM is the "done" evidence the exit criteria ask for — and it is evidence only
   if step 5 was green, not merely if the file validates.

## Cadence

Refresh at minimum: after every testing round (same moment as the plan's Results
section) and before approving the next plan. Cheap refreshes (one round's delta)
beat rebuilding from scratch — but a full rebuild must reproduce the same table
(everything derives from artefacts; if it doesn't, an artefact lost a link).
