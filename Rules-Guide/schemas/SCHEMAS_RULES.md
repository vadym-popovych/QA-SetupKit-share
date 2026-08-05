# schemas rules (paste into your workspace CLAUDE.md)

Reusable rules for the machine-contract layer. Mirror new rules of this kind here
(+ into `CLAUDE.starter.md` and the workspace `CLAUDE.md`) so they travel with the kit.

- **Validate on write AND on read — LITERALLY (activated 12/07/2026).** Every time the
  agent writes or loads a machine artefact it RUNS the validator in the same turn —
  not "knows the rules", runs the command:
  `node QA-SetupKit/Rules-Guide/schemas/validate.mjs <shorthand> <file>` (shorthand
  resolves to the sibling schema: `bug` · `test-case` · `run-result` · `checklist-row` · `pagespeed-round` ·
  `coverage` · `strategy` · `bug-summary` · `test-report`). Exit 0 = valid; exit 1 prints one violation per line —
  report them, never silently "fix"; exit 2 = usage/IO error. Artefact → schema map:
  `TC-NNN.json` → `test-case` · bug row object → `bug` · `coverage.json` → `coverage` ·
  `strategy.json` → `strategy` · run summary → `run-result` · checklist row → `checklist-row` ·
  PageSpeed round file (`<Project>/Web-Performance/rounds/<round-id>.json`) → `pagespeed-round` ·
  bug-summary edition → `bug-summary` · test-report config → `test-report`.

- **Enums are the vocabulary — schema first, use second.** Statuses, severities, oracle
  types, priorities, disciplines, stop conditions come FROM the schemas. Need a new
  value? Edit the schema (additive), note it in the README changelog, THEN use it.
  Never let a doc or Sheet introduce a value the schema doesn't know.

- **ID patterns are load-bearing:** `BUG-NNN`, `TC-NNN`, `INV-N`, run-id
  `YYYY-MM-DD-<slug>` — encoded as `pattern` in the schemas; cross-references between
  artefacts (bug → invariant violated, case → strategy unit, run → bugs filed) use
  these IDs, so breaking the pattern breaks traceability.

- **Additive evolution.** New optional fields — fine. Breaking change → new `$id` with
  a version suffix + changelog row + keep the old schema until no consumer reads it.
  A schema change that would invalidate existing project artefacts is a BREAKING change
  even if it "looks small".

- **Instances never live in `Rules-Guide/schemas/`.** Schemas here; instances in the producing
  module's project folder (see the README table). No `<Project>/Rules-Guide/schemas/` ever.

- **Sheets are a projection, not the contract.** When an artefact's canonical home is a
  Google Sheet (bug rows, checklist rows, Runs rows), the schema defines the ROW shape;
  column order/formatting belong to the Sheet template. Scripts that write Sheets
  build rows FROM schema-valid objects — not the other way around.
