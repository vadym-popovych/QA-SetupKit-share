# Test-Cases Sheet — the template

The executable view of a case suite: the tab a person actually runs a round in. Built by
[`template/tools/tc.mjs`](template/tools/tc.mjs) `sheet` from the case JSONs — never by hand, and
never edited into shape afterwards (a hand-edit is lost on the next rebuild; the JSONs are the
source of truth).

```bash
PROJECT_NAME=Acme node tools/tc.mjs sheet          # from <Project>/QA-Documentation/test-cases/
```

`tc.mjs` is a kit tool — run the kit's copy (or an unmodified sync of it); never fork a
per-project variant, or the project drifts away from the template these rules and the
linter describe.

## Shape

Two kinds of column. The **case** (A..H) is written once — it is what the case IS. Everything a
**round** records is a 9-column *section*, repeated to the right, one per round (`TC_ROUNDS`,
default 3). A new round never overwrites the last one's verdicts; it fills the next section. Same
convention as the checklist's platform blocks.

```
 A        B        C:D            E:G     H                 │ I       J:M       N   O:P        Q │ R … (round 2)
 Priority Summary  Preconditions  Steps   Expected result   │ Status  Comments  ·   Result     · │ …
└──────────── the case: written once ────────────────────┘ └──── round 1: what a run records ───┘
```

- **Header block — 6 rows** (frozen, together with the case columns A..H, so scrolling right into
  round 3 never leaves you wondering which case a status belongs to):
  1. Title — `Test cases / Up to date according to <Month Year>` (the checklist's convention: the doc
     says how fresh it is). Per section: `Available statuses / summary counters` + `Checked <date>`
     (round 1 gets today; unused rounds read `dd/mm/yyyy`).
  2–4. `Project:` · `Latest version:` (the build the round ran against — see env) · `Responsible:`;
     the priority counters (`High`/`Medium`/`Low` + `Total`); per section the four status counters
     and `Not run cases: N`.
  5. A thin (15px) divider rule.
  6. Column headers.
- **Module band** — 2 merged rows per module, exactly like the checklist's page band: the module
  name (from the case's `area`, ordered by `strategy.json` → `modules[]`), a flag cell that fires
  **"Not all issues are resolved!"** while any case in the module is `Failed`, and the module's
  Passed/Failed counters. The result mirror repeats the band title as a formula (`=$A<row>`), so
  renaming a module updates both.
- **Case row** — priority · `TC-NNN — title` · preconditions · numbered steps · expected result,
  then per round: the `Status` dropdown, free `Comments`, and a result mirror.

## What is deliberately NOT a column

`technique`, `oracle` and `traceability` are **not columns** — they would drown the doc the team
runs rounds in. They are not lost: they stay in the case JSON and `TEST_CASES.md`, and ride into the
Sheet as a **note on the Summary cell**. Hover any case and it still answers *"which technique
derived this, and what decides its verdict?"*.

## The rules the tab enforces

- **Status is the only thing the JSONs don't carry** — `Passed / Failed / Skipped / Blocked`.
  **`Blocked` ≠ `Skipped`**: blocked = *could not* run (environment, missing credits, dependency
  down) and the case stays owed; skipped = *will not* run. Neither is ever upgraded to `Passed`
  because a round ended.
- **`Not run cases: N`** is computed as total minus the four statuses — never `COUNTA` of the status
  column (the band rows carry a formula there, and COUNTA would count them as "run", under-reporting
  what is still owed). A case nobody touched must never read as anything but not-run.
- **The per-row result mirror is honest**: `=IF(I9="","",I9)` — empty until the row is actually run.
  (The template this was modelled on guarded it with `COUNTIF(rng,"<>") = COUNTA(rng)`, which is a
  tautology — both count non-empty cells — so it fabricated a status. Don't reintroduce that.)
- **Dropdowns live on case rows only.** A status you can set on a module heading is a status that
  means nothing.
- **A rebuild never wipes a round.** Statuses and comments exist only in the Sheet, so `sheet` reads
  them back and re-attaches them **by case id** before rewriting — for every round, not just the
  latest — and reports how many cells it carried. If it cannot read the previous tab it says so
  loudly: a silent failure there means a round's verdicts vanish and nobody finds out.
  ⚠️ Don't edit the tab *while* a rebuild runs — the read-then-write window is real.
- **Rebuilds are idempotent in the strong sense**: same document, same tab gid, so shared `#gid=`
  links survive. Invalid cases are refused outright — a tidy Sheet built from invalid cases is a
  well-formatted lie.

## Palette

| Element | Background | Text |
|---|---|---|
| Title · meta rows | `#134f5c` | `#efefef` / `#d9d9d9` |
| Section labels (`Cases counter by Priority`, `Total`), module flag when it fires | `#146c8b` | `#efefef` |
| `Check status` header | `#699ebf` | `#000000` |
| `Total / module counter` | `#3d85c6` | `#000000` |
| `Not run cases`, column headers (16pt) | `#45818e` | `#000000` |
| Divider row, module bands, `Comments` header, `Skipped` | `#d9d9d9` | `#000000` |
| Priority — High · Medium · Low | `#f6b26b` · `#a4c2f4` · `#d9ead3` | `#000000` |
| Status — Passed · Failed · Blocked | `#d9ead3` · `#f4cccc` · `#8e7cc3` | `#38761d` · `#d31414` · `#351c75` |

## Env contract

| Env | Meaning |
|---|---|
| `PROJECT_NAME` | **required** — names the doc and its Drive folder |
| `TC_ROUNDS` | round sections to lay out (default 3) |
| `BUILD_VERSION` / `PUBSPEC` | the build the round ran against → `Latest version`. Given verbatim, or parsed from a manifest (`version: 1.2.3+45` → `Build 1.2.3 (45)`). Neither set — a web app, typically — leaves the cell **empty**: a round pinned to a version nobody can verify is worse than one that admits it doesn't know which build it saw. |
| `RESPONSIBLE` | header meta (free text) |
| `SHEET_NAME` / `TC_TAB` / `TC_GID` | doc title · tab title · fixed tab id (default `810001`) so shared links survive a rebuild |
| `TARGET_SSID` | build the tab INTO an existing doc (the demo/validation path) instead of the project's own file |
| `DRIVE_ROOT_FOLDER` / `DRIVE_CATEGORY` | Drive placement — `ClaudeProjects` / `Test-Cases` by default; never the Drive root |
