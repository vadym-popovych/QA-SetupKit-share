# Test-Cases rules (paste into your workspace CLAUDE.md)

Reusable rules for test-case design. Machine-specific paths do NOT belong here.
Mirror new rules of this kind here (+ into `CLAUDE.starter.md` and the workspace
`CLAUDE.md`) so they travel with the kit.

- **Cases are DERIVED, not invented.** Every case names its `technique` — the
  authoritative list is the schema enum in `QA-SetupKit/Rules-Guide/schemas/test-case.schema.json`:
  equivalence-partitioning / boundary-value / decision-table / state-transition /
  pairwise / use-case / error-guessing / exploratory / other — and its spec source in
  `traceability`. A case
  that can't say which technique produced it and from what spec is a guess — fine for
  exploratory charters, not for the suite.

- **Schema-valid JSON is the source of truth:** one `TC-NNN.json` per case, valid
  against `QA-SetupKit/Rules-Guide/schemas/test-case.schema.json` (validate on write). `TEST_CASES.md` and
  any Sheets view are projections regenerated from the JSONs, never edited alone.

- **Write for the person running the round, not for a parser.** Titles, steps and expected
  results read as plain, living language — what a tester actually does and sees ("the last
  unlock works, and the counter never goes below zero"), not schema-speak. That is a style
  rule, NOT a licence to drop precision: wherever the technical detail is what makes the
  check decidable — endpoint, status code, field name, exact boundary value, the invariant
  it guards — it stays in the text. A case a human can't follow is dead weight; a case that
  reads nicely but can't be judged is worse.

- **Every case declares its oracle** (`oracle.type` + `source`) per the Test-Oracles
  discipline — a case whose expected result can't be decided objectively gets
  `oracle.type: "human"` and says exactly what a human must look at.

- **Coverage is claimable only via technique:** "EP+BVA applied to all fields of the
  form" is a coverage claim; "10 cases written" is not. When reporting suite coverage,
  state technique × area, and list what was deliberately NOT derived (same
  skips-are-recorded ethos as the strategy).

- **Where cases come from, in order:** (1) strategy scope units at risk ≥ 7 — deep
  areas get cases FIRST; (2) every bug fixed → a regression case reproducing it
  (traceability → the BUG-NNN); (3) new features per release plan. Low-risk areas may
  stay checklist-only — don't manufacture cases for the sake of counts.

- **Priorities inherit from the strategy:** case priority is `High / Medium / Low` and
  maps from the strategy unit's risk along the SAME bands as test depth — risk 7–9 →
  `High` (deep), 4–6 → `Medium` (standard), 1–3 → `Low` (smoke) — unless the owner
  overrides. Don't re-litigate risk per case. This is not the bug scale: a BUG's
  priority is `P0–P3` (fix order, the owner's call). The two never share a column, and
  the e2e tags mirror the case scale (`@high`/`@medium`/`@low`, UI-Automation kit).

- **`area` is the product module, and it is the grouping key.** One band per area in the
  Sheet, one section per area in `TEST_CASES.md` — e.g. `Subscription & Entitlement`,
  not `E3`. The strategy unit belongs in `traceability.strategyUnit`; putting it in
  `area` shatters one feature across the screen/endpoint/role/integration axes and the
  executable view stops reading like the product. Band ORDER comes from
  `strategy.json` → `modules[]`; an area missing from that list still renders (after the
  listed ones), so a new case is never silently swallowed by an "Other" bucket.

- **A rebuild must never wipe a round.** `Status` and `Comments` are typed into the Sheet —
  they exist nowhere else — so `tc.mjs sheet` reads them back and re-attaches them **by case
  id** before it rewrites the tab, and says how many cells it carried. Without that, adding
  one case to the suite would silently erase everything the team had run. (It also means the
  Sheet can be regenerated mid-round: new cases appear, executed ones keep their verdicts.)

- **The Sheet is the executable view, the JSONs are the source.** `tc.mjs sheet`
  regenerates the tab from `cases/*.json` (idempotent — same document, same tab gid, so
  shared links survive); the layout, palette and the invariants it encodes are specified in
  [`SHEET_TEMPLATE.md`](SHEET_TEMPLATE.md) — **the canonical template, don't improvise a new
  one per project**. Deliberately compact: `Priority · Summary · Preconditions · Steps ·
  Expected result · Status · Comments`, one band per module, one repeatable **section per
  round** (a new round fills the next section, it never overwrites the last one's verdicts),
  a per-module Passed/Failed counter and a `Not run cases` count that never lets an
  untouched case read as anything else. **`technique` / `oracle` / `traceability` are NOT columns**
  (they would drown the doc the team actually runs rounds in) — but they are never
  dropped: they stay in the case JSON and `TEST_CASES.md`, and ride into the Sheet as a
  **cell note on the Summary**, so any row can still answer "which technique derived this,
  and what decides its verdict?". Run status lives ONLY in the Sheet (`Status` dropdown):
  `Passed / Failed / Skipped / Blocked`. **`Blocked` ≠ `Skipped`**: blocked = we could
  not run it (environment, missing credits, dependency down) and it stays owed;
  skipped = we deliberately will not run it. Neither is ever upgraded to `Passed`
  because the round ended. `status` in the JSON is a different thing — the case's
  lifecycle (`draft`/`ready`/`deprecated`).

- **Artefacts land in `<Project>/QA-Documentation/test-cases/`** (`cases/*.json` +
  `TEST_CASES.md`). Kit folder holds templates/rules only.

## A shared link survives every rebuild

Universal invariant (Project-Configuration rule 10, owner's rule 15/07/2026): updating this
kit's artifact must keep the link the owner already shared. For this kit: tc.mjs sheet rebuilds the SAME file under the SAME fixed gid (TC_GID), carrying every round's statuses by case id — a rebuild never mints a new spreadsheet or tab.
Trash-and-recreate looks identical in the UI and silently kills every saved link; if a
carrier genuinely cannot keep its link, say so in the hand-over message.
