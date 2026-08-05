# Bug summary — the bugs FOUND, per module

🟢 **validated** (14/07) — the canonical Sheet is frozen in [`SHEET_TEMPLATE.md`](SHEET_TEMPLATE.md). The
generator reproduces the owner's real client document cell-for-cell (proven by a cell-level diff, not by
eye), and the Redmine importer has been run read-only against a live board. Still unproven: no team has yet
worked a full round through the optional Status column.

The document: **a retrospective roll-up of the bugs FOUND in an engagement** — how many, at what severity,
broken down by module. The thing a client opens at the end to ask *"what did you find?"*

```
№ │ Summary │ Severity │ Notes ││ Critical │ Major │ Minor │ Trivial ││ Total count of issues
```

It is a **report, not a tracker**: the bugs it counts are usually fixed and closed by the time anyone reads
it. It is also **not a bug report** — a bug RECORD (repro, expected, actual, evidence) is owned by
[Bug-Reports](../../Bug-Reports/README.md). This document *counts* those records. When the two disagree,
**the record wins.**

## The flow in one line

`bug-summary.json` (valid against
[`bug-summary.schema.json`](../../../Rules-Guide/schemas/bug-summary.schema.json)) →
[`bs-sheet.mjs`](template/tools/bs-sheet.mjs) → the `Statistic` tab.

The JSON is the record; the tab is a projection of it. Four ways to get the JSON:

| Source | Tool | When |
|---|---|---|
| kit bug records (`BUG-NNN.json`) | [`bs-from-bugs.mjs`](template/tools/bs-from-bugs.mjs) | the bugs live in the kit |
| **a Redmine board** | [`bs-from-redmine.mjs`](template/tools/bs-from-redmine.mjs) | **read-only**; reads BOTH shapes — see below |
| an existing spreadsheet | [`bs-import-sheet.mjs`](template/tools/bs-import-sheet.mjs) | a client hands you "the format we use" — **read-only on their document** |
| any other tracker | write the JSON | export and map it yourself |

## Reproduce, don't redesign

The default output **is** the owner's document: same columns, same palette, same fonts, same borders, same
per-module numbering, same formulas. Verified by a cell-level diff against his reference — widths, row
heights, row groups, frozen rows, borders, colours, formulas and the severity dropdown all match.

Everything the kit has to offer beyond that is an **opt-in flag**, off by default
(`BS_STATUS_COLUMN` · `BS_ID_COLUMN` · `BS_PAGE_TOTALS` · `BS_RECONCILE` · `BS_CELL_NOTES`). Offer them;
never impose them. The first version of this kit "improved" the severity column into a colour ramp of its
own invention and was told, correctly, that the colours had drifted.

The departures that DO ship on by default were each asked for by the owner and generalised back into the
generator — see [`SHEET_TEMPLATE.md`](SHEET_TEMPLATE.md): auto-fitting rows so a bug's text is readable in
full (the reference pins every row to 21px and clips it) · severity colours as conditional-format **rules**
(the reference paints all four severities the same green, so the one column a reader scans for danger tells
them nothing) · a definition of each severity as a note on its label.

## What it will not let you do

| Refusal / warning | Because |
|---|---|
| a severity outside `severityScale` → **refuses to build** | no counter would count it: the bug vanishes from every total while sitting in plain sight |
| module bands that don't cover every issue → **refuses to build** | a row outside every band is counted by nothing — an under-report |
| an **agent-proposed** severity → noted on its cell, counted on the header, warned on every build | the tracker has no severity field, so a machine may propose one — but every statistic here is built out of those values, and a guess must never pass as triage |
| evidence on `screencast.com` / `prnt.sc` / Dropbox shares → `hostRisk: expiring` | when the link dies the bug is unprovable, and the row becomes a number nobody can check. **295 of the reference's 309 rows** rest on such links |
| a tab this tool did not write → **refuses to overwrite** | a hand-maintained tab is a document, not a cache |

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | what to install, how to run it, first roll-up |
| [`BUG_SUMMARY_RULES.md`](BUG_SUMMARY_RULES.md) | the rules — read before the first edition |
| [`SHEET_TEMPLATE.md`](SHEET_TEMPLATE.md) | the canonical Sheet: geometry · palette · formulas · invariants |
| [`SEVERITY_PLAYBOOK.md`](SEVERITY_PLAYBOOK.md) | **how an agent rates severity** — the scale, the two lines that carry it, worked examples, the procedure, and the obligation to ask the owner to validate |
| [`PLACEMENT_PLAYBOOK.md`](PLACEMENT_PLAYBOOK.md) | **how an agent decides which module a bug belongs to** — the cascade, the inference rules, and what must stay in `General` |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | paste-block for a teammate's `CLAUDE.md` |
| [`template/bug-summary.example.json`](template/bug-summary.example.json) | a real 309-issue roll-up (the owner's reference, imported) — the fidelity fixture |
| [`template/severity-rubric.example.md`](template/severity-rubric.example.md) | **the owner's calibration of the severity scale** — worked examples an agent rates against, and it wins over the tree's defaults |
| [`template/tools/bs-sheet.mjs`](template/tools/bs-sheet.mjs) | the generator (+ the derived tab) |
| [`template/tools/bs-from-bugs.mjs`](template/tools/bs-from-bugs.mjs) | roll up kit bug records into a summary |
| [`template/tools/bs-import-sheet.mjs`](template/tools/bs-import-sheet.mjs) | import an existing sheet (read-only on the source) |
| [`template/tools/bs-from-redmine.mjs`](template/tools/bs-from-redmine.mjs) | pull a Redmine board (read-only) — checklist containers **and** standalone bug issues |
| [`template/tools/bs-evidence.mjs`](template/tools/bs-evidence.mjs) | **fetch the evidence so a severity can be SEEN, not guessed** — screenshots, and screen **recordings** sampled into a contact sheet (the browser decodes them; no ffmpeg) |

Artefacts land in `<Project>/QA-Documentation/bug-summary/` — never in the kit.

## The honesty line

> **A severity is the unit every statistic in this document is built out of.**
> The tracker records none — so it is a human's judgement, or an agent's *hypothesis*, and the document
> says which. A default severity would be a lie with a number attached.

## Pulling from Redmine — what the board actually looks like

Measured on a real board (read-only), because the shape is not what anyone assumes:

- **Most bugs are not Redmine issues.** They live as **checklist items inside container issues** — one
  container per module (`[BUGS] User profile`, `[BUG] Home screen`, `[pixel-perfect] Settings`), with an
  **empty description**. On the reference board: **19 containers holding 110 bugs**, plus 29 standalone bug
  issues. A tool that walks `/issues.json` alone sees a fraction of them.
- **The checklist is reachable, but not where you look:** `GET /issues/<id>/checklists.json`. There is no
  `/checklists.json` collection endpoint (404), and `?include=checklists` on the issue returns **nothing**.
- **Redmine has no severity field.** Not core, not custom; `priority` sits at its default on nearly every
  bug, so it is noise, not a proxy. `bs-from-redmine.mjs` therefore **writes a triage file and exits 3**
  rather than inventing one. There is no `--assume-minor`, and there never will be.
- **The module comes from a CASCADE**, and every row records which step placed it (`moduleSource`) — so a
  reader can tell a fact from a judgement: the owner's `MODULE_MAP` → the container's subject → the issue's
  own subject → the parent (never a QA activity like *"Smoke/Regression testing"* — that would have filed
  55 of 125 bugs under a module that does not exist) → **the bug's own wording** (*"The Notifications screen
  shows hardcoded mock data"*) → **an agent reading it and deciding** → `General`.
  **Read [`PLACEMENT_PLAYBOOK.md`](PLACEMENT_PLAYBOOK.md) before placing anything.** It is the part that is
  easy to do badly and impossible to notice afterwards.
- **What it refuses to decide for you:** two containers can name the same screen twice (`Settings screen`
  vs `The Settings screen (UI/UX)`), and a container's subject can read like a *defect* rather than a module
  (`Rating stars jump when text area expands`). Both are **flagged**, never auto-merged — that is a product
  judgement. Record your call in `MODULE_MAP`.
