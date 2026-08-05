# Test-Cases — SETUP (Claude-followable)

How to derive a test-case suite for a project. Prerequisites: none hard — spec
sources as available (Figma MCP, Postman MCP, strategy scope table, bug history).

## Procedure

1. **Pick the areas.** From the strategy risk matrix: risk ≥ 7 units first (they're
   the ones that get cases at all — see the rules). No strategy yet → offer to build
   one (Test-Strategy-and-Planning kit) or take the owner's top-3 flows.

2. **Per area, pick techniques by input type** (table in [`README.md`](README.md)):
   fields → EP + BVA; condition combos (auth × role × tier) → decision table; statused
   flows → state transition; many params → pairwise; E2E flows → use-case; then one
   error-guessing pass from bug history + Test-Data fixtures (recorded as
   `technique: "error-guessing"` — a schema enum value).

3. **Derive mechanically, show your work.** For EP/BVA list the partitions/boundaries
   FIRST, then emit one case per class/boundary. For decision tables show the table,
   then one case per rule column. The derivation artefact goes into `TEST_CASES.md`
   above the cases it produced — that's the coverage evidence.

4. **Write cases as JSON** (`cases/TC-NNN.json`), one per case, schema-valid:
   `node QA-SetupKit/Rules-Guide/schemas/validate.mjs QA-SetupKit/Rules-Guide/schemas/test-case.schema.json <file>`.
   Number TC-NNN sequentially per project. Each case: oracle (type+source), technique,
   priority mapped from unit risk (7–9→High, 4–6→Medium, 1–3→Low), traceability
   (figmaNode / endpoint / strategyUnit / BUG-NNN for regression cases).

5. **Generate the human view.** Fill [`template/test-cases.template.md`](template/test-cases.template.md)
   → `<Project>/QA-Documentation/test-cases/TEST_CASES.md`: per-area sections, each
   with its derivation evidence + a case table projected FROM the JSONs.

6. **Owner review gate:** short summary (areas covered, technique per area, case
   count, what's deliberately checklist-only) → approval → the suite is live.

7. **Keep it alive:** bug fixed → regression case (`traceability.bug` → BUG-NNN);
   spec changed → re-derive that area's cases (don't patch blindly); regression
   selection per release is defined by the Regression-Testing kit (core =
   bug-derived cases + P0 + invariants, plus the impact/cadence slices).

## Run the harness (every time you touch the cases)

1. Copy [`template/tools/tc.mjs`](template/tools/tc.mjs) → `<Project>/QA-Documentation/test-cases/tools/`.
2. `node tools/tc.mjs` — validates every case against the schema, regenerates `TEST_CASES.md`
   (a projection — never edit it by hand), and reports coverage gaps against the strategy.
3. **Treat `gaps` output as a worklist, not a warning.** A unit at risk ≥ 6 with no case is either
   a case you owe, or a scope decision the owner has to make explicitly.
4. **Publish the executable view:** `PROJECT_NAME=<Project> node tools/tc.mjs sheet` — one tab,
   one band per module, one repeatable section per round, with the `Status` dropdown
   (`Passed/Failed/Skipped/Blocked`). The JSONs stay the source of truth; the Sheet is where a round
   is actually run and tracked. Mobile app? Point `PUBSPEC` at the manifest so `Latest version`
   records the build; web app → leave it unset and the cell stays empty.
   Needs `mcp-sheets` OAuth ([MCP-configurations](../../MCP-configurations/README.md)).
   **Layout, palette and the rules the tab enforces: [SHEET_TEMPLATE.md](SHEET_TEMPLATE.md).**
