# schemas — machine contracts between QA modules and agents

Cross-cutting infrastructure (underscore-prefixed, like `Rules-Guide/Roadmap/`): **JSON Schemas**
that define the shared shapes of QA data. Every module *emits* artefacts (test cases,
bugs, run results, coverage); these schemas are what lets another agent — or a script —
**validate and consume** them without parsing prose. This encodes the
**"Memory / Coverage" judgment** from [`../Roadmap/AI-QA-ROADMAP.md`](../Roadmap/AI-QA-ROADMAP.md):
composable multi-agent QA needs contracts, not vibes.

## The schemas

| Schema | Instance of | Where instances live |
|---|---|---|
| [`test-case.schema.json`](test-case.schema.json) | one test case (`TC-NNN`) | `<Project>/QA-Documentation/` (Test-Cases module, roadmap #4) |
| [`bug.schema.json`](bug.schema.json) | one defect (`BUG-NNN`) | rows in the team QA Sheet's `Bug Reports` tab |
| [`run-result.schema.json`](run-result.schema.json) | one test run (any discipline) | `<Project>/<Type>/results/` + `Runs` tab rows |
| [`checklist-row.schema.json`](checklist-row.schema.json) | one checklist check row | checklist Sheets (v5 template) |
| [`coverage.schema.json`](coverage.schema.json) | coverage snapshot vs strategy scope | `<Project>/Test-Strategy/` |
| [`strategy.schema.json`](strategy.schema.json) | `<Project>/Test-Strategy/strategy.json` | (formalizes the [Test-Strategy example](../../Testing-Planning/Test-Strategy-and-Planning/template/strategy.example.json)) |
| [`pagespeed-round.schema.json`](pagespeed-round.schema.json) | one ROUND of a PageSpeed report (env + tool + every page × platform measurement: all individual runs, the median that went into the cell, Core Web Vitals, optional owner-approved `budgets`) | `<Project>/Web-Performance/rounds/<round-id>.json` (produced by the [PageSpeed-report](../../QA-Documentation/Custom-Reports/PageSpeed-report/) collector) |
| [`bug-summary.schema.json`](bug-summary.schema.json) | one EDITION of a multi-site bug roll-up (`BS-<date>`: sites → pages → issues, the engagement's own `severityScale`, a required `status` per row, evidence with `hostRisk`) | `<Project>/QA-Documentation/bug-summary/bug-summary.json` (consumed by the [Bug-Summary](../../QA-Documentation/Custom-Reports/Bug-Summary/) builder) |
| [`link-ledger.schema.json`](link-ledger.schema.json) | the recorded identity of every re-creatable carrier in a project (`kind` + `key` → `id`/`gid`, with deliberate re-points kept in `adoptions[]`) | `<Project>/.link-ledger.json` (written and enforced by [`link-ledger.mjs`](../link-ledger/link-ledger.mjs)) |
| [`bug-spec.schema.json`](bug-spec.schema.json) | one developer-facing bug SPEC — the shared input of `redmine-bug.mjs` (Textile board ticket) AND `bug-row.mjs` (v2 one-cell Sheet row / candidates funnel); NOT the QA record — that is `bug.schema.json` | `<Project>/QA-Documentation/bugs/BUG-NNN.redmine.json` (templates: [Bug-Reports/template](../../QA-Documentation/Bug-Reports/template/)) |
| [`test-report.schema.json`](test-report.schema.json) | the NARRATIVE half of a client Test report (`environment` + `testDesign` as REQUIRED testimony, `alsoPerformed`); carries **no numbers** — the Test-results tables are derived from the `bug-summary` record at build time, so a count never lives in two places | `<Project>/QA-Documentation/test-report/` (consumed by the [Test-Report](../../QA-Documentation/Custom-Reports/Test-Report/) builder) |

**No `<Project>/Rules-Guide/schemas/` folder exists** — schemas live HERE only; *instances* live
wherever their module's convention puts them (table above).

## Validating

[`validate.mjs`](validate.mjs) — zero-dependency subset validator
(type / required / enum / pattern / items / minItems / properties):

```bash
node QA-SetupKit/Rules-Guide/schemas/validate.mjs QA-SetupKit/Rules-Guide/schemas/strategy.schema.json \
     <Project>/Test-Strategy/strategy.json
```

Exit 0 = valid; non-zero prints each violation. For full draft-2020-12 validation
(allOf/oneOf/$ref/formats) use `ajv` — but the subset covers these schemas entirely.

**Agent rule of thumb: validate on WRITE and on READ** — before persisting an artefact
you produced, and after loading one you're about to act on.

## Vocabulary lives in the enums

The schemas are the single source of controlled vocabulary. Don't invent values in
docs or Sheets ad hoc — **edit the schema first**, then use the value:

- **Checklist statuses:** `Passed / Failed / Skipped / ""` (empty = not-run/needs-human
  + comment — per the Test-Oracles reconciliation).
- **Bug severity:** `Critical / Major / Medium / Low` for general QA; `High / Info`
  additionally allowed for Security-Testing findings (that kit's historical scale).
- **Oracle types:** the 8 from [`Test-Oracles`](../../Testing-Planning/Test-Oracles/README.md).
- **Priorities — two scales, on purpose:** a BUG's `priority` is `P0–P3` (fix order, the
  owner's call); a TEST CASE's `priority` is `High / Medium / Low` (execution order,
  derived from the strategy depth bands: risk 7–9 → High, 4–6 → Medium, 1–3 → Low).
  They answer different questions and are never mixed in one column.
- **Stop conditions, depths, disciplines** — see each schema.

## Versioning

- **Additive by default:** new OPTIONAL fields may be added freely.
- **Breaking changes** (rename/remove/retype a field, narrow an enum) → bump the
  version suffix in the schema's `$id` (`…/test-case.v2.schema.json`) and add a row to
  the changelog below. Instances declare what they follow via their producing module's
  docs — keep old versions in the folder until no consumer reads them.

| Date | Schema | Change |
|------|--------|--------|
| 2026-07-07 | all | initial set (v1, unsuffixed) |
| 2026-07-08 | test-case | + `error-guessing` in the `technique` enum (additive) |
| 2026-07-08 | bug | + optional `severityBranch` (which tree branch fired) and `priorityProposed` (agent proposal flag) — additive |
| 2026-07-08 | bug | + `A11Y`, `LOCALIZATION`, `COMPAT` in the `tags` enum (additive — for the Accessibility / Localization / Compatibility kits) |
| 2026-07-12 | bug | + `layer` enum (`app`/`backend`/`frontend-web` → tracker subject prefixes `[BUG-App]`/`[BUG-BE]`/`[BUG-FE]`) + `boardStatus` enum (team-board workflow `To do`…`Fixed` = Bug Reports v2 tab column D) — separate from internal `status`; catches up with the 11–12/07 Redmine/v2-tab evolution that had skipped the "schema first" rule (additive) |
| 2026-07-08 | bug | + `reopened` in the `status` enum and optional `escapedFromCycle` (additive — reopen-rate & escape-rate metrics, Reporting-and-Metrics kit) |
| 2026-07-08 | test-case | + optional `traceability.bug` (regression-core selector) and `cadence` enum every-round/release-only (additive — Regression-Testing kit) |
| 2026-07-08 | run-result | + optional `results[]` of {caseId, verdict} — per-case outcomes for consecutive-green demotion evidence (additive — Regression-Testing kit) |
| 2026-07-12 | run-result | + `ci` in the `method` enum and `accessibility`/`visual-regression`/`regression`/`localization`/`compatibility`/`web` in the `discipline` enum — unattended gate runs need to record which discipline they ran (additive — CI-Integration kit; the six disciplines existed as kits since 08/07 but had no way to emit a run-result) |
| 2026-07-13 | all | **`additionalProperties: false`** on every fixed-shape object (20 objects across the 6 schemas) — a self-test found the contract didn't protect field NAMES: a bug with `invariantViolatd` (typo) + a garbage field validated VALID. Field names are load-bearing exactly like the ID patterns. `validate.mjs` now enforces it AND hard-fails on any schema keyword it doesn't implement (a silently-ignored keyword is a false promise). `$comment` stays allowed as the one reserved instance annotation. (breaking for any instance that carried undeclared fields) |
| 2026-07-13 | test-case | **BREAKING (v2)** — `priority` enum `P0/P1/P2/P3` → `High/Medium/Low` (owner's call: the executable Sheet is read by people running the round, and the tracker scale P0–P3 belongs to bugs, not cases). Derivation is unchanged in spirit and now mirrors the strategy DEPTH bands: risk 7–9 → High (deep), 4–6 → Medium (standard), 1–3 → Low (smoke). Same revision: `area` is now explicitly the **product module** (the band/grouping key), not a copy of the strategy unit — that lives in `traceability.strategyUnit`. `$id` bumped to `test-case.v2.schema.json`; no v1 file is kept because every instance (kit example + 26 <Project> cases) migrated in this same commit — nothing reads v1 |
| 2026-07-13 | strategy | + optional `modules[]` (ordered product-module names) — the band order for the Test-Cases Sheet and `TEST_CASES.md`; without it the tool falls back to first-seen order (additive) |
| 2026-07-13 | pagespeed-round | **new schema** — the machine contract of the PageSpeed report (QA-Documentation/Custom-Reports/PageSpeed-report). A lab score is a single noisy sample, so the artefact is built to make honesty structural: every individual run is kept (`runs[]`), the cell carries the MEDIAN, a measurement with fewer runs than the round's target is `not-run` (never a green number), `env` is part of the identity of every number (a staging-vs-prod delta is not a regression), and pass/fail exists ONLY where the round declares owner-approved `budgets` (`approvedBy` + `approvedOn`) — the 90/50 colour bands classify, they do not judge. Ships with `pagespeed-round.example.json` (validated by kit-lint L8) |
| 2026-07-14 | bug-summary | **new schema** — the machine contract of the Bug summary roll-up (QA-Documentation/Custom-Reports/Bug-Summary). Reverse-engineered from a real client document that could not answer its own headline question, so the schema makes the two fixes structural: **`status` is REQUIRED on every row** (the original buried its dispositions as prose in a Notes column, where no counter could see them — so the doc could not say how many issues were open, and a second "Left issues" list was being kept by hand and had already drifted from its source), and the enum keeps bug.schema's six lifecycle values while adding three a ROLL-UP needs and a record does not: `unknown` (the source states none — 286 of the reference's 309 rows; counted as still owed, never assumed fixed), `not-verified` (we did not re-check it; the debt stands — the same honesty as the checklist's Blocked), `reassigned` (accepted as an improvement, no longer a defect). `verified` is the ONLY status that means fixed; `fixed` means a developer said so. `severityScale` is a flat array carrying the CLIENT's scale (Critical/Major/Minor/Trivial ≠ the kit's), and it drives the Sheet geometry exactly as PLATFORMS drives the checklist — a severity outside it is counted by no column, so the builder refuses to build. `evidence[].hostRisk` marks links on hosts that expire (screencast.com/prnt.sc/Dropbox shares) — when the link dies the bug becomes unprovable. Ships with `bug-summary.example.json` (the owner's 309-issue reference, imported; validated by kit-lint L8) |
| 2026-07-15 | test-report | + optional `logoUrl` (publicly fetchable image URL for the page-header logo; the header skips the title page). Additive — same day as the initial schema, added during the visual-fidelity loop against the owner's reference |
| 2026-07-15 | test-report | **new schema** — the machine contract of the NARRATIVE half of the Test report (QA-Documentation/Custom-Reports/Test-Report). Deliberately carries **no numbers**: the Test results tables are derived at build time from the bug-summary record, so a count can never live in two places and drift. `environment` and `testDesign` are REQUIRED with no defaults — they are testimony about what actually happened (a generator that invents a device list writes fiction), and `alsoPerformed` exists so someone else's work (developer unit tests) is credited in the intro line without being testified to in a section. Ships with `test-report.example.json`, which pairs with `bug-summary.example.json` (same synthetic project) for an end-to-end dry run. Same commit: `bug-summary` and `test-report` added to kit-lint's L8 map — bug-summary's changelog row promised L8 validation but the example was silently skipped (`SCHEMA_OF` never learned the name): the exact silent-cap failure mode modules.json documents |
| 2026-07-13 | run-result | + optional `oracle` {`type` (the 8 Test-Oracles kinds), `source`} at the top level AND per-case in `results[]` — closes a cold-review gap: *"every verdict names its oracle"* was structurally inexpressible in the one artefact that records verdicts. Optional for backward-compat + so `blocked`/`aborted` runs stay valid, but a `pass`/`fail` run-result with no oracle is an incomplete artefact (TEST_ORACLES_RULES §"run-result oracle"). First `run-result.example.json` ships alongside (CI-Integration template) — L8 now validates it (additive) |
| 2026-08-03 | bug-summary | + `record` in the `moduleSource` enum — a module declared by a bug RECORD's own `component` field, which the enum could not express: it was written for the Redmine cascade, where every value describes something read off a BOARD. `bs-from-bugs.mjs` rolls up kit bug records instead, and had been emitting rows with **no** `moduleSource` and **no** `severitySource` at all, so provenance the schema demands was simply absent from half the ways a bug-summary gets built. Same commit fixes the larger defect behind it: that tool DROPPED every record whose `component` did not name a site and a page, against PLACEMENT_PLAYBOOK rule 1 — unplaceable records now go to `General` (`moduleSource: "unplaced"`, `pages[].unplaced: true`) and the grand total reconciles against the input count (additive) |
| 2026-08-05 | bug-spec | **new schema** — the machine contract of the developer-facing bug SPEC (QA-Documentation/Bug-Reports/template): ONE file consumed by TWO renderers, `redmine-bug.mjs` (the Textile board ticket) and `bug-row.mjs` (the v2 one-cell Sheet row / candidates funnel). Deliberately NOT `bug.schema.json`: the QA RECORD carries the internal taxonomy (severity, P0–P3, invariants, tags), while the spec carries only what a developer needs to reproduce — `subject`/`actual`/`expected` required, the exact three fields both tools already hard-required at run time. Closes the 05/08 audit's two `no-schema` loud-skips: `bug-spec.example.json` + `bug-spec-backend.example.json` were tool-consumed examples with no contract ("first in line: two tools consume it"); both now validate under kit-lint L8 (`SCHEMA_OF` learned both basenames → the one `bug-spec` schema) |
| 2026-08-05 | link-ledger | **new schema** — the machine contract of the per-project link ledger ([`Rules-Guide/link-ledger/`](../link-ledger/)). It exists for the one handover rule a human eye cannot check: "an update must land under the SAME link". A trashed-and-recreated Sheet, tab or Doc is indistinguishable in the UI from an updated one, while every shared link and `#gid=` reference to it is already dead — so the identity of each carrier is recorded, keyed by PURPOSE (`kind` + `key`), never by title (titles carry dates and change legitimately; ids must not). `gid` is checked alongside `id` because a rebuilt tab with a fresh gid kills shared links even when the spreadsheet is unchanged. `adoptions[]` keeps deliberate re-points instead of erasing them: a re-point is a decision someone made, and whoever still holds the old link deserves to be findable in the record. Instances hold real file ids, so they are PROJECT artefacts and never kit content; the kit ships only `link-ledger.example.json` (synthetic, validated by kit-lint L8) |
