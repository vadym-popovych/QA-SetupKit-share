# Test-Cases starter rules — paste into YOUR workspace CLAUDE.md

## Test cases — QA-Documentation/Test-Cases kit
- **Home:** `QA-SetupKit/QA-Documentation/Test-Cases/`. When asked to "write test
  cases", "створити тест-кейси", derive a suite → follow the kit's `SETUP.md`.
- **Cases are DERIVED, not invented:** every case names its technique — schema enum
  verbatim: equivalence-partitioning / boundary-value / decision-table /
  state-transition / pairwise / use-case / error-guessing / exploratory / other —
  + spec source; show the
  derivation (partitions, boundaries, tables) in `TEST_CASES.md` as coverage evidence.
- **Write like a human, stay decidable:** titles/steps/expected in plain living language (the
  tester reads them, not a parser) — but never at the cost of the detail that makes the check
  judgeable: endpoint, status code, field, exact boundary, the invariant it guards.
- **JSON is canonical:** one `TC-NNN.json` per case in
  `<Project>/QA-Documentation/test-cases/cases/`, valid against
  `QA-SetupKit/Rules-Guide/schemas/test-case.schema.json` (validate on write); `TEST_CASES.md`/Sheets are
  regenerated projections. Every case declares its oracle (type + source).
- **Scope by risk:** cases for strategy units risk ≥ 7 first; every fixed bug → a
  regression case tracing to its `BUG-NNN`; low-risk areas may stay checklist-only.
  Priority is `High/Medium/Low` and maps from risk along the depth bands (7–9 → High,
  4–6 → Medium, 1–3 → Low). `P0–P3` is the BUG scale — never mix them in one column.
- **`area` = the product module** (e.g. `Subscription & Entitlement`), which is what
  groups the Sheet bands and `TEST_CASES.md` sections; the strategy unit lives in
  `traceability.strategyUnit`. Band order: `strategy.json` → `modules[]`.
- **The Sheet is the executable view:** `PROJECT_NAME=<Project> node tools/tc.mjs sheet`
  builds/refreshes the tab from the JSONs (idempotent — same doc, same gid; a rebuild carries
  every round's statuses over by case id, so it never wipes a round). Canonical layout:
  `QA-SetupKit/QA-Documentation/Test-Cases/SHEET_TEMPLATE.md` — one band per module, one
  section per round. `Status` (Sheet-only) is `Passed/Failed/Skipped/Blocked` — **Blocked** =
  could not run (environment), still owed; **Skipped** = deliberately not run. Neither becomes
  `Passed` at round end, and `Not run cases` counts what is still owed.
- **Run the harness, don't eyeball it:** `node tools/tc.mjs` (from `<Project>/QA-Documentation/test-cases/`) validates every case against the schema, regenerates `TEST_CASES.md` as a PROJECTION (never hand-edit it), and reports **units at risk ≥ 6 with no case** + orphan cases. That gap count IS the coverage claim; "N cases written" is not.

Full rules: `QA-SetupKit/QA-Documentation/Test-Cases/TEST_CASES_RULES.md`.
