# QA-Documentation — QA document types

Home for every kind of QA documentation in this toolkit. **Each document type gets its
own subfolder** — anything related to that type (templates, generators, rules, setup
docs) lives inside its folder and nowhere else.

## Document types

| Type | Folder | Status | What's inside |
|------|--------|--------|---------------|
| **Checklist** (Google-Sheets checklists generated from Figma designs) | [`Checklist/`](Checklist/) | ✅ Active | [README](Checklist/README.md), [MCP_SETUP.md](Checklist/MCP_SETUP.md), [CHECKLIST_RULES.md](Checklist/CHECKLIST_RULES.md), templates: [`checklist-web/`](Checklist/checklist-web/) (25 cols) + [`checklist-mobile/`](Checklist/checklist-mobile/) (28 cols) |
| **Test Case** (technique-derived cases: EP/BVA/decision-table/state-transition/pairwise → an executable Google-Sheets round tracker) | [`Test-Cases/`](Test-Cases/) | ✅ Active | [README](Test-Cases/README.md), [SETUP.md](Test-Cases/SETUP.md), [TEST_CASES_RULES.md](Test-Cases/TEST_CASES_RULES.md), [SHEET_TEMPLATE.md](Test-Cases/SHEET_TEMPLATE.md) (the Sheet template: layout · palette · invariants), [CLAUDE.starter.md](Test-Cases/CLAUDE.starter.md), templates (schema-valid JSON + suite doc + `tc.mjs` harness) |
| **Bug Report** (severity decision tree, repro discipline, dedup; bugs stay `BUG-NNN` rows in the QA Sheet) | [`Bug-Reports/`](Bug-Reports/) | ✅ Active | [README](Bug-Reports/README.md), [SETUP.md](Bug-Reports/SETUP.md), [BUG_REPORTS_RULES.md](Bug-Reports/BUG_REPORTS_RULES.md), [CLAUDE.starter.md](Bug-Reports/CLAUDE.starter.md), template (schema-valid example) |
| **Custom Reports** (the GROUP that holds the report-shaped types — a format the client or the owner already uses, plus report delivery; an index folder, not a type itself) | [`Custom-Reports/`](Custom-Reports/) | ✅ Active — per-member maturity is badged in the group README | [README](Custom-Reports/README.md): the Members table (every member, its folder, its badge and its files) lives there |

**Policy for group folders: one row here, the members in the group's own README.** A type that
lives inside a group folder is listed once — in that group's index README — and this table carries
only the group row. Until 28/07/2026 the members were also enumerated here, and the copy drifted:
two of the four `Custom-Reports/` members (Bug-Summary, Test-Report) were missing, and the two rows
that did exist carried a second copy of the maturity badge that nobody kept in step with the group
README. A member's badge belongs in exactly two places — the root [`README.md`](../README.md)
"Pick your direction" table (that is the registration kit-lint L5 checks) and the group's index
README (the detail). Do not re-add member rows here.

## Convention for adding a new document type

1. Create a new subfolder here named after the type (e.g. `Test-Cases/`, `Bug-Reports/`).
2. Everything related to that type goes INTO that subfolder: `README.md` (what it is +
   how to use), templates, generator scripts, a `<TYPE>_RULES.md` once rules stabilize,
   and a `CLAUDE.starter.md` if teammates need workspace rules for it.
3. Add the type to the table above **if it sits directly in `QA-Documentation/`**; a type inside a
   group folder goes into that group's index README instead (see the policy note above). Either
   way, if it's a shareable direction of its own, add it to the root
   [`QA-SetupKit/README.md`](../README.md) "Pick your direction" table — that is where kit-lint L5
   looks, and it accepts a sub-kit registered through its group's row.
4. If the new type belongs to a family that already has a group folder (today:
   [`Custom-Reports/`](Custom-Reports/) — the report-shaped types), create it INSIDE that
   group and give it a row in the group's index README, not here. A new group of types gets its
   own folder here with an index `README.md` and a single row in the table above, and must
   be declared in [`Rules-Guide/kit-lint/modules.json`](../Rules-Guide/kit-lint/modules.json)
   twice: as a discovery root in `groups` (so the types inside it are held to the full kit
   contract) and as `"group"` in `overrides` (so the index folder itself owes only its
   README). Skip that and the lint walks straight past the new types while printing "clean".

Never mix document types in one folder — the folder IS the type boundary.
