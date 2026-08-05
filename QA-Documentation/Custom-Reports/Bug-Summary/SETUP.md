# Bug summary — setup

## Trigger phrases

Say any of these and the agent should land here:

- *"build a bug summary across the sites"* · *"roll up all the bugs we found"*
- *"how many issues are still open?"* · *"what's left / what did we not fix?"*
- *"a summary sheet for the client — bugs per page"*
- *"import this bug sheet and rebuild it properly"*

## Prerequisites

| Need | Why | Check |
|---|---|---|
| **Node 18+** | the tools are plain `.mjs` | `node -v` |
| **Google Sheets MCP (OAuth)** | the document is a Sheet | `MCP-configurations/mcp-sheets/token.json` exists — else [MCP_SETUP.md](../../Checklist/MCP_SETUP.md) |

Nothing else. No API keys, no accounts: unlike the PageSpeed report, this document **collects nothing** —
its input is bugs you have already found.

## 1. Get a summary JSON

Pick the source you actually have.

**A. The bugs live in the kit** (`<Project>/QA-Documentation/bug-reports/BUG-*.json`):

```bash
BUGS_DIR=<Project>/QA-Documentation/bug-reports \
PROJECT_NAME=Acme \
SEVERITIES="Critical,Major,Minor,Trivial" \
SEVERITY_MAP='{"Low":"Minor","Info":"Trivial"}' \
node tools/bs-from-bugs.mjs -o bug-summary.json
```

Bug records name their place through `component` = `"<site>/<page>"` (e.g. `consumer/landing`). A bug
whose component says nothing about where it lives is **never filed under a guess — and never dropped
either**: it goes to a **`General`** band (counted, rendered last, one per site, flagged
`unplaced: true`), and the run lists every record that landed there. `General` is a debt you shrink by
fixing `component` on the records. `MODULE_FALLBACK=0` leaves those bugs out instead — the grand total
then under-reports what was found, so the tool says exactly that and exits non-zero.

One thing does stop the build: a severity outside `SEVERITIES`. It cannot be emitted, `General` is
about place rather than severity, and dropping it would under-report — so fix it with `SEVERITY_MAP`
and re-run.

**B. Someone hands you an existing sheet** ("this is the format we use"):

```bash
SOURCE_SSID=<spreadsheetId> SOURCE_TAB=Statistic PROJECT_NAME=Acme \
node tools/bs-import-sheet.mjs -o bug-summary.json
```

> **The source document is READ-ONLY.** The importer opens it to read and has no write path at all.
> Never point the *builder* at someone's document — build your own beside it.

**B2. The bugs live on a Redmine board:**

```bash
REDMINE_URL=https://your-redmine REDMINE_PROJECT_ID=<project id> \
node tools/bs-from-redmine.mjs --dry-run          # what it finds, what it refuses
```

Read-only. It reads **both** shapes: the **checklist containers** (where most bugs actually live —
`GET /issues/<id>/checklists.json`) and standalone bug issues. Then:

- it writes `severity-triage.json` and **exits 3**, because Redmine has no severity field and the tool will
  not invent one. Rate the rows (a human → `severitySource: owner`; an agent → `agent-proposed` **plus**
  `severityRationale` naming the decision-tree branch), then re-run with `SEVERITY_FILE=…`.
  **Read [`SEVERITY_PLAYBOOK.md`](SEVERITY_PLAYBOOK.md) before rating anything** — it is the scale, the two
  lines that carry it, the worked examples and the procedure.
  **Rate against the owner's calibration, not the tree alone** — copy
  [`template/severity-rubric.example.md`](template/severity-rubric.example.md) to
  `<Project>/QA-Documentation/bug-summary/severity-rubric.md`, fill it with his worked examples, and read it
  before rating. The tree says *which branch*; only the owner can say **how sensitive** the scale is.
  **And ask him to validate the result** — every rebuild, until `severitySource` says `owner`;
- bugs whose module cannot be determined are **listed, not filed** — place them via `MODULE_MAP` or fix the
  board;
- module names that look like the same screen twice, and containers whose subject reads like a *defect*
  rather than a module, are **flagged for your call**, never auto-merged;
- bugs it cannot place go to **`General`** and are written to `placement-triage.json`.

**Then place them: [`PLACEMENT_PLAYBOOK.md`](PLACEMENT_PLAYBOOK.md).** It is the step that decides whether
the per-module counts mean anything, and it is the one an agent will get wrong on instinct — by tidying
`General` away with guesses. Read it before you touch `PLACEMENT_FILE`.

**C. The bugs live in another tracker** — export and write the JSON by hand against
[`bug-summary.schema.json`](../../../Rules-Guide/schemas/bug-summary.schema.json). Start from
[`template/bug-summary.example.json`](template/bug-summary.example.json).

Validate it — always, in the same step:

```bash
node ../../../Rules-Guide/schemas/validate.mjs bug-summary bug-summary.json
```

## 2. Look at it before you publish it

```bash
SUMMARY=./bug-summary.json node tools/bs-sheet.mjs --dry-run
```

Prints the geometry, the reconciliation plan, and **the warnings that matter**: rows with no evidence,
rows resting on evidence links that expire, rows whose status is `unknown`. Touches no Google.

## 3. Publish

```bash
SUMMARY=./bug-summary.json PROJECT_NAME=Acme node tools/bs-sheet.mjs
```

Creates (or refreshes) two tabs — **Bug summary** and the derived **Left issues** — in
`ClaudeProjects / <Project> / QA Documentation /` in Drive. To put them inside an existing document
instead, add `TARGET_SSID=<spreadsheetId>`.

A rebuild **carries over the Status and Notes the team typed on the tab** (matched by stable id) and
prints every one that disagrees with the JSON — write those back into the JSON, which is the record.

## 3b. Validate the severities — on the tab, then back into the record

The severities the importer produced are the **agent's hypothesis**, and every count on the tab is built
out of them. A human has to go through them. He does that **in the Sheet** — the Severity column is a
dropdown, and each cell carries a note naming the decision-tree branch that produced its rating — not by
hand-editing a 230-entry JSON.

That leaves his triage living **only on the tab**, which is where it would die. Read it back:

```bash
SUMMARY=./bug-summary.json TARGET_SSID=<id> BS_TAB="Statistic" \
node tools/bs-severities-from-sheet.mjs --dry-run      # what changed, what did not. Writes nothing.

… -o ./severities.json                                 # write it into the record
```

Then re-run `bs-from-redmine` with `SEVERITY_FILE=./severities.json` and rebuild. `severitySource` now says
`owner`, and the agent-proposed warning clears itself — because it is no longer true.

**The tool will not promote an unchanged row to `owner` on its own.** It cannot tell *"he read this and
agreed with me"* from *"he never got to this row"* — both leave the cell exactly as the agent wrote it, and
guessing would fabricate a human triage for every row nobody looked at. Rows the owner **changed** become
`owner` automatically; rows he left alone stay `agent-proposed` until he asserts, with `--reviewed-all`,
that he went through every one. **The assertion is his. The flag is how he makes it.**

> A rebuild does not destroy what is on the tab: `bs-sheet` reads the previous tab back, **carries** the
> severities, statuses and notes typed on it, and **prints every one that disagrees with the JSON** so it
> gets written back. (It did not always. The carry-over was documented, allocated, handed to the builder —
> and never populated, so every rebuild silently wiped the team's edits and reported nothing. If your copy
> of `bs-sheet.mjs` has a `carried` map that nothing ever calls `.set()` on, it still does.)

## 4. Work it

The document is used, not admired:

1. Re-test a fixed bug **against its original repro** → set its Status to `verified` on the tab.
   It leaves the outstanding count and disappears from **Left issues** by itself.
2. `fixed` ≠ `verified`. A developer saying "done" moves it to `fixed`, and it is **still counted as
   owed** until QA re-checks it.
3. Could not re-check something? `not-verified` — never a silent `verified`, never an empty cell.
4. The reconciliation cell (top of the Total column) must read **`reconciled`**. If it does not, a row
   is outside every page band and is being counted by nothing. Fix it before anyone reads the totals.

## Where things live

```
<Project>/QA-Documentation/bug-summary/
  bug-summary.json        the record (schema-valid)
  tools/                  copies of the kit tools, if the project needs local tweaks
```

Read [`BUG_SUMMARY_RULES.md`](BUG_SUMMARY_RULES.md) before the first edition — it is short, and every
rule in it is a fix for something that went wrong in a real client document.
