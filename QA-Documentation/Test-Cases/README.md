# Test-Cases — test-case design & derivation

Home for the **test-case document type**: how cases are DERIVED from a spec
(Figma / Postman / requirements) using named test-design techniques — instead of
invented ad hoc — and stored in a machine-readable shape agents can execute and audit.

> **For an AI agent** the technique IS the value: "apply boundary-value analysis to
> this field" is a repeatable procedure with defensible coverage; "think of some
> tests" is not. Cases carry their `technique` and `oracle` explicitly (schema:
> [`Rules-Guide/schemas/test-case.schema.json`](../../Rules-Guide/schemas/test-case.schema.json)).

## The techniques (pick per input type, not by taste)

| Technique | Use when | Procedure in one line |
|---|---|---|
| **Equivalence partitioning** | any input with classes of sameness | split the domain into classes where behaviour must be identical → 1 case per class (valid + invalid classes) |
| **Boundary-value analysis** | ordered/numeric/length-limited inputs | for each boundary B test B−1, B, B+1 (min/max, empty/full, 0/1/many) |
| **Decision table** | combinations of conditions → different outcomes | enumerate condition combinations, collapse impossible ones, 1 case per rule column |
| **State transition** | flows with modes/statuses (book: active→completed; auth: logged-out→in) | draw states + events; cover every valid transition + key invalid ones |
| **Pairwise / combinatorial** | many parameters, full cartesian explodes | cover every PAIR of parameter values at least once (tooling or careful table) |
| **Use-case / scenario** | end-to-end business flows | main success scenario + each extension/exception branch |
| **Error guessing** | after the systematic ones — experience layer | attack list from bug history + Test-Data's boundary/injection fixtures (recorded as `technique: "error-guessing"` — in the schema enum) |

Derivation sources map: Figma screen → EP/BVA on each field + state transition on
screen states; Postman endpoint → EP/BVA on params + decision table on auth×role×
subscription; business flow → use-case + state transition.

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | Derivation procedure: spec → techniques → cases → review |
| [`TEST_CASES_RULES.md`](TEST_CASES_RULES.md) | Reusable rules |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Paste block for a teammate's workspace `CLAUDE.md` |
| [`template/test-case.example.json`](template/test-case.example.json) | Schema-valid example case |
| [`template/test-cases.template.md`](template/test-cases.template.md) | Human-readable suite doc skeleton |

## Deliverables & where they live

```
<Project>/QA-Documentation/test-cases/
├── TEST_CASES.md          # human-readable suite (per-area sections, from template)
└── cases/*.json           # one schema-valid JSON per case (TC-NNN.json) — the source of truth
```

The JSON is canonical (agents execute/audit it); the MD and any Sheets view are
projections. Relationship to checklists: a checklist row is a lightweight check;
a test case is the fuller artefact (preconditions, steps, technique, traceability) —
high-risk areas (risk ≥ 7) get cases, the rest may stay checklist-only.

## The harness (`template/tools/tc.mjs`)

The kit's rules make three promises. Until 12/07/2026 nothing checked any of them, which is how a
case set quietly becomes "some JSON files someone wrote once".

```bash
node tools/tc.mjs            # validate + index + gaps  (run from <Project>/QA-Documentation/test-cases/)
node tools/tc.mjs validate   # every case is schema-valid — or the suite is not a source of truth
node tools/tc.mjs index      # regenerate TEST_CASES.md (a PROJECTION; never hand-edited)
node tools/tc.mjs gaps       # the one that earns its keep (below)

PROJECT_NAME=Acme node tools/tc.mjs sheet   # the executable Google-Sheets view (validates first)
```

**`sheet`** builds the tab a human actually runs the round in — the full layout, palette and the
rules it enforces are specified in **[SHEET_TEMPLATE.md](SHEET_TEMPLATE.md)**. Columns are deliberately few —
`Priority · Summary · Preconditions · Steps · Expected result · Status · Comments` (+ a per-row
result mirror and per-module Passed/Failed counters) — with one band per module (`area`, ordered by
`strategy.json` → `modules[]`) and a **`Not run`** counter so an untouched case can never read as
anything else. `technique` / `oracle` / `traceability` are **not columns**: they stay in the JSON
and `TEST_CASES.md`, and ride into the Sheet as a **note on the Summary cell** — compact for the
team, still answerable for any row. The one column the JSONs deliberately don't carry is the run
**Status** dropdown (`Passed / Failed / Skipped / **Blocked**`). `Blocked` = *could not* run (environment, missing
credits, dependency down) and the case stays owed; `Skipped` = *will not* run. Neither is ever
upgraded to `Passed` because the round ended. Re-running is idempotent in the strong sense — same
document id, same tab gid, so shared links survive. It refuses to publish a suite that isn't
schema-valid: a tidy Sheet built from invalid cases is just a well-formatted lie.

| Env | Meaning |
|---|---|
| `PROJECT_NAME` | **required** — names the doc and its Drive folder |
| `SHEET_NAME` / `TC_TAB` | doc title (default `<Project> — Test Cases`) / tab title (default `Test Cases`) |
| `TARGET_SSID` | write the tab INTO an existing doc (demo/validation path) instead of the project's own file |
| `TC_GID` | fixed tab id so shared `#gid=` links survive a rebuild (default `810001`) |
| `DRIVE_ROOT_FOLDER` / `DRIVE_CATEGORY` | Drive placement — `ClaudeProjects` / `Test-Cases` by default; never the Drive root |
| `BUILD_VERSION` / `PUBSPEC` | the build the round ran against → "Latest version". Given verbatim, or parsed from a manifest (`version: 1.2.3+45` → `Build 1.2.3 (45)`). Neither set — e.g. a web app — leaves the cell **empty**: a round pinned to a version nobody can verify is worse than one that admits it doesn't know. |
| `RESPONSIBLE` | header meta (free text) |

**`gaps` reads the strategy** and reports every scope unit at **risk ≥ 6 with no case pointing at
it**, plus every case pointing at a unit the strategy doesn't have (an orphan). That number is the
honest coverage claim. *"26 cases written"* is not a coverage claim — *"every unit at risk ≥ 6 has
a case, derived by a named technique"* is.

First run on a real project (<Project>, 12/07/2026) immediately surfaced two units at risk 6 with
no case at all — including the free-user paywall path, the one that gives generation away for free
if it breaks.
