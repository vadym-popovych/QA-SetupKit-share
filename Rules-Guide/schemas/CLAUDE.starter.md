# schemas starter rules — paste into YOUR workspace CLAUDE.md

## Machine contracts — schemas
- **Home for QA data contracts:** `QA-SetupKit/Rules-Guide/schemas/` — JSON Schemas for test-case
  (`TC-NNN`), bug (`BUG-NNN`), run-result, checklist-row, coverage, strategy.json, pagespeed-round.
  Instances live in each module's project folder, never in `Rules-Guide/schemas/`.
- **Validate on write and on read — literally, every time:** when writing or loading a
  machine artefact, RUN `node QA-SetupKit/Rules-Guide/schemas/validate.mjs <shorthand> <file>`
  in the same turn (shorthands: `bug` / `test-case` / `run-result` / `checklist-row` / `pagespeed-round` /
  `coverage` / `strategy`; zero-dep). Exit 1 lists violations — report them, never
  silently fix.
- **Enums are the vocabulary:** statuses (`Passed/Failed/Skipped/""`), severities
  (`Critical/Major/Medium/Low`, `+High/Info` for security), oracle types, priorities (`P0–P3` for bugs, `High/Medium/Low` for test cases).
  New value → edit schema first (additive) + changelog row, then use.
- **Evolution:** additive = free; breaking → version-suffixed `$id` + changelog + keep
  the old schema until no consumer reads it.

Full rules: `QA-SetupKit/Rules-Guide/schemas/SCHEMAS_RULES.md`.
