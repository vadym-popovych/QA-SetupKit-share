# Test report — the rules

The discipline behind the end-of-engagement Test report. The document layout is in
[`DOC_TEMPLATE.md`](DOC_TEMPLATE.md); how to run the tool is in [`SETUP.md`](SETUP.md). This file
is about what the document may and may not claim.

## 1 · Two halves, two sources of truth — never crossed

- **Results are DERIVED.** Every number in the Test results tables is computed at build time from
  the Bug-Summary record. Never type a count into the Doc, never "fix" a table by hand — fix the
  record and rebuild. A hand-edited count looks identical to a computed one and is wrong within a
  week. When the Doc and the record disagree, **the record wins** (the same chain as
  Bug-Reports → Bug-Summary: the record wins over every projection of it).
- **Narrative is TESTIMONY.** Devices, browsers, testing types, scope intent — these are facts
  about what actually happened, supplied by whoever ran the engagement. The agent never invents
  them: no default device list exists, and the tool **fails closed** on a missing environment.
  If you don't know what was on the desk, ask the owner — that is not a gap in the kit, it is the
  point of it.

## 2 · Reproduce, don't redesign

The default output is the owner's reference document: title block, section order, plain
semicolon-terminated lists (not bullets), the exact table palette and merges — all read out of the
reference `.docx` XML ([`DOC_TEMPLATE.md`](DOC_TEMPLATE.md) lists the palette and the deliberate
departures). Kit additions are **opt-in flags, off by default** (`TR_RESULTS_NOTE`) — offer them,
never impose them. Same rule as Bug-Summary, learned the same way.

## 3 · Honesty invariants

- **Only what was performed.** `testDesign` lists the testing types that actually ran. Work done
  by someone else (developer unit tests) goes in `alsoPerformed`: named in the intro line, given
  no Goal/Process/Completion section — **credit without testimony**.
- **A page with zero issues still renders.** The record says it was tested; omitting the table
  would hide coverage. Zeros are evidence, not noise.
- **`General` renders last** within its site — it is Bug-Summary's placement-debt band, and the
  report inherits its meaning unchanged.
- **The severity scale is the client's** and comes from the record. Palette is assigned by rank,
  never by name — the builder does not assume Critical/Major/Minor/Trivial.
- **Completion criteria must survive the tables.** If the criteria say *"All identified defects
  have been addressed"* while the record still holds open issues, the build warns: the claim and
  the tables sit two pages apart in the same document. Reword the criteria (the config overrides
  library text per type) or reconcile the record — do not ship the contradiction.
- **Scope may exceed results, never trail them.** The Objective inventory defaults to the record's
  pages. An override may ADD planned-but-clean areas (the honest direction); the build warns if it
  DROPS a page that has counted bugs.
- **Dates:** the title-page date is the report's real issue date, `dd/mm/yyyy`. A placeholder for
  a not-yet-issued report is `<dd/mm/yyyy>` — the workspace-wide future-date convention.

## 4 · Severity provenance follows the record

The record carries `severitySource` per row (Bug-Summary rules). If any counted severity is
`agent-proposed`, the build warns — and because THIS document is the one that leaves the team, the
rule is stronger here: **say it in the message where you hand over the link** (*"N of M severities
are hypotheses, not the owner's triage — validate before this goes to the client"*), and repeat it
on every rebuild until the record says `owner`. A client-facing statistic built on an unvalidated
guess is the exact thing SEVERITY_PLAYBOOK exists to prevent.

## 5 · Validation is literal

Both inputs are machine artefacts: validate `report-config.json` against
[`test-report.schema.json`](../../../Rules-Guide/schemas/test-report.schema.json) and the summary
against `bug-summary.schema.json` **in the same turn** you write or read them (SCHEMAS_RULES). The
tool re-checks the load-bearing parts (project match, scale coverage, environment presence) and
refuses rather than degrades.

## 6 · Reference documents are read-only

If the client hands you *their* report format as a reference, you import its structure into config
and templates and build **beside** it — you never point a generator at their document, and you
never edit it. (Group-wide rule; it has already prevented one near-miss in PageSpeed-report.)

## 7 · Verify by RENDER, not by attributes

Learned the expensive way, on this very kit: the generator's output was verified by reading
styles/merges/sizes back through the API — and reported as "matching the reference" — while the
owner had to be the eyes, three screenshots in a row. **Structure-clean ≠ render-clean** (the
same trap as working-tree-clean ≠ clone-clean in kit-lint). An attribute diff cannot see
pagination, headers/footers, vertical rhythm, or what a font actually looks like on the page.

- A new visual document type does not "match the reference" until the **page-by-page RENDER of
  both** has been compared by eye: your doc via Drive `files.export` → PDF; a `.docx` reference
  via `files.copy` (conversion) → export → trash the copy (the original stays read-only).
  The kit ships the pipeline: `node tools/tr-render.mjs <driveFileId> <out-prefix>` → PDF +
  per-page PNGs (it handles the convert-copy dance itself, and works for ANY Drive doc).
- **An owner's visual complaint is a bug report about the RENDER.** Answering it with another
  attribute check is forbidden — re-render and look.
- The owner's screenshots are the trigger, never the verification loop — the eyes must be yours.
- Narrow exception: purely tabular Sheets verified by a cell-level diff against the REFERENCE
  itself (Bug-Summary's fidelity proof). A diff against your own spec proves nothing about the
  reference. Docs/HTML/PDF: always render.

## 8 · Delivery

- The Doc lands in `ClaudeProjects/<Project>/QA Documentation/Test Reports/` — never Drive root.
- **A shared link survives a rebuild.** A same-titled rebuild updates the SAME document in
  place (body wiped and re-written; headers recreated) — the Docs analogue of the Sheets
  fixed-gid rule: the owner shares the link once, and every rebuild after that lands under it.
  Different editions (a different date in the title) still get their own documents, so an
  engagement's history of reports survives.
- The hand-over message carries: the doc link, the folder link, every build warning, and the
  one-click TOC note. A link handed over without its warnings is a warning suppressed.
