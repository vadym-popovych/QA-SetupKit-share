# Traceability starter rules — paste into YOUR workspace CLAUDE.md

## Traceability (RTM & coverage) — Traceability kit
- **Home:** `QA-SetupKit/Testing-Planning/Traceability/`. The chain requirement (strategy unit) → test
  case → run → bug is kept connected via the schema ID patterns (`S1/E1`, `TC-NNN`,
  run-id, `BUG-NNN`, `INV-N`). Artefacts: `<Project>/Test-Strategy/RTM.md` +
  `coverage.json` (valid against `Rules-Guide/schemas/coverage.schema.json`).
- **RTM is a projection, never a source:** every cell derives from artefacts; missing
  links are fixed at the source (case/run/bug), never by editing the table. Orphans
  (case→no unit, bug→no invariant, run→no plan) are defects — log AND fix at source.
- **Coverage states are mechanical:** covered / partial / not-run(+reason) /
  blocked(+reason). **`gaps[]` = risk ≥ 7 units not covered → escalation list**, owner
  decides (extend / descope / ship-with-risk). Empty gaps + full RTM = "exit criteria
  met" evidence.
- **Read the RTM before re-testing anything** — `lastRun` + verdict answers "did we
  already test this?". Refresh after every round and before approving the next plan.

Full rules: `QA-SetupKit/Testing-Planning/Traceability/TRACEABILITY_RULES.md`.
