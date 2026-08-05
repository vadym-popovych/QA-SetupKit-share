# Custom-Reports — report formats the kit did not invent, and report delivery

A sub-group of [`QA-Documentation/`](../README.md) for everything report-shaped that is **not one of
the kit's canonical QA document types** (Checklist · Test Case · Bug Report). Two kinds of member
live here, and both are "custom" in the same sense: the *format* or the *channel* comes from
outside the kit, and the kit's job is to reproduce it faithfully while adding the discipline the
original never carried.

- **A format the client or the owner already uses.** We do not replace a team's report with a
  nicer one they will not read. We rebuild theirs — same columns, same palette, same round
  structure — and then encode the honesty invariants the original spreadsheet had no way to state
  ("a score with one run behind it is noise", "an empty cell is not a zero"). Members:
  **PageSpeed-report**, reverse-engineered from a real "PageSpeed Insights Results" Sheet, plus a
  collector that gathers the numbers itself instead of asking a human to paste them; and
  **Bug-Summary**, reverse-engineered from a real client bug roll-up whose dispositions lived as
  prose in a Notes column — so it could not say how many issues were still open, and a second list
  was being maintained by hand to compensate; and **Test-Report**, reverse-engineered from the
  owner's end-of-engagement `.docx` — the narrative document a client actually receives, whose
  results tables are **derived from the Bug-Summary record** rather than typed a second time.
- **Report delivery.** How a finished report reaches a human. **HTML-Reports** lives here (moved
  from `QA-Documentation/HTML-Reports/` on 13/07/2026): publishing is not a document *type*, it is
  what you do *with* one — so it belongs beside the custom formats, not among Checklist and
  Bug-Reports.

If a future artefact is a real QA document type (a thing with its own derivation discipline, like a
test case), it does **not** belong here — it gets its own folder one level up, in
[`QA-Documentation/`](../README.md).

### Bug-Summary vs Bug-Reports — the boundary

The first question anyone asks. **[Bug-Reports](../Bug-Reports/README.md) owns the RECORD**: one bug,
with its repro, expected, actual, evidence, severity branch and tracker id. **Bug-Summary owns the
REPORT**: it *counts* those records, per page and per site, for someone who will never open a single
one of them. Different reader, different lifetime, different geometry — and the roll-up is *derived*
from the records ([`bs-from-bugs.mjs`](Bug-Summary/template/tools/bs-from-bugs.mjs)), which is exactly
why it belongs on this side of the line rather than growing a second contract inside Bug-Reports.

When the two disagree, **the record wins.**

## Members

This table is a **generated projection** of the folder list (`kit-lint` L12 keeps it honest; a
member folder added without a row here fails the lint — the folder column is the key).

<!-- kit:generated:members source=QA-Documentation/Custom-Reports -->
| Folder | Member | Status | What it is |
|---|---|---|---|
| [`PageSpeed-report/`](PageSpeed-report/) | **PageSpeed report** (web-performance rounds in the owner's Sheet format: page × platform × round, PSI score in the cell, Core Web Vitals in the note + JSON; ships its own collector) | 🟡 stable — live PSI collection verified (schema-valid round, Lighthouse 13.4.0); the **Sheet publish path has never written to a real doc**, and the `--engine lighthouse` fallback is untested | [README](PageSpeed-report/README.md), [SETUP.md](PageSpeed-report/SETUP.md), [PAGESPEED_REPORT_RULES.md](PageSpeed-report/PAGESPEED_REPORT_RULES.md), [SHEET_TEMPLATE.md](PageSpeed-report/SHEET_TEMPLATE.md), [CLAUDE.starter.md](PageSpeed-report/CLAUDE.starter.md), template (`pages.example.json` + `psi-run.mjs` + `psi-sheet.mjs`) |
| [`HTML-Reports/`](HTML-Reports/) | **HTML Reports** (discipline-agnostic publisher: any self-contained QA HTML → shareable link via one private repo + static host; the project name never appears in the URL) | 🟢 battle-tested | [README](HTML-Reports/README.md), [SETUP.md](HTML-Reports/SETUP.md), [HTML_REPORTS_RULES.md](HTML-Reports/HTML_REPORTS_RULES.md), [CLAUDE.starter.md](HTML-Reports/CLAUDE.starter.md), template (`publish-report.sh`) |
| [`Bug-Summary/`](Bug-Summary/) | **Bug summary** (multi-site roll-up of known issues: site → page → issue, severity counters everywhere, a derived "Left issues" list; counts bugs, does not report them) | 🟡 stable — reproduces the owner's real client document cell-for-cell (2 sites, 38 pages, 309 issues); **no roll-up has yet been built from live kit bug records**, and no team has worked a full fix-and-re-verify cycle through the Status column | [README](Bug-Summary/README.md), [SETUP.md](Bug-Summary/SETUP.md), [BUG_SUMMARY_RULES.md](Bug-Summary/BUG_SUMMARY_RULES.md), [SHEET_TEMPLATE.md](Bug-Summary/SHEET_TEMPLATE.md), [CLAUDE.starter.md](Bug-Summary/CLAUDE.starter.md), template (`bug-summary.example.json` + `bs-sheet.mjs` + `bs-from-bugs.mjs` + `bs-import-sheet.mjs`) |
| [`Test-Report/`](Test-Report/) | **Test report** (the end-of-engagement narrative Google Doc: Purpose · Objective/scope · Environment · Test Design per performed type · Test results tables **derived from the Bug-Summary record** — narrative is testimony from the config, numbers are computed, never typed) | 🟡 stable — reproduces the owner's reference `.docx` (palette/merges read from its XML); smoke-run on the synthetic example pair, not yet field-run on a real engagement | [README](Test-Report/README.md), [SETUP.md](Test-Report/SETUP.md), [TEST_REPORT_RULES.md](Test-Report/TEST_REPORT_RULES.md), [DOC_TEMPLATE.md](Test-Report/DOC_TEMPLATE.md), [CLAUDE.starter.md](Test-Report/CLAUDE.starter.md), template (`test-report.example.json` + `tr-doc.mjs`) |
<!-- /kit:generated -->

Badges mean what they mean in the root [`README.md`](../../README.md): 🟢 = driven end-to-end on a
real project, 🔴 = draft, 🟡 = complete and reviewed but not yet field-run.

## Convention for adding a third

1. **Own subfolder** named after the format or the channel (`PageSpeed-report/`, `HTML-Reports/`).
   Never mix two formats in one folder — the folder IS the boundary, same as one level up.
2. **Full kit contract**, because every member here is a `kit`-class module, not a loose doc:
   `README.md` (what it is + the flow in one line + a Files table) · `SETUP.md` (one-time setup,
   runnable, fails-closed on missing config) · `<TYPE>_RULES.md` (the discipline: what the format
   can and cannot claim) · `CLAUDE.starter.md` (the paste block, naming its own RULES file).
   Templates and tools go under `template/`.
3. **Reproduce, don't redesign.** If the format came from the client, match it byte-for-byte
   (columns, widths, colours, header merges) and put the kit's additions where they cost the owner
   nothing: cell notes, a machine-readable JSON beside the Sheet, a schema in
   [`Rules-Guide/schemas/`](../../Rules-Guide/schemas/). A "better" layout nobody recognises is a
   report nobody opens.
4. **No project data in the kit.** No client URLs, page names, Sheet ids or ticket numbers — tools
   are env-driven and fail closed with an explanation when config is missing (kit rule L3).
5. **Register it in three places**, or it does not exist:
   - the root [`README.md`](../../README.md) "Pick your direction" table (with a maturity badge);
   - the kit → folder map in
     [`Rules-Guide/Project-Configuration/README.md`](../../Rules-Guide/Project-Configuration/README.md)
     (where its per-project artefacts land);
   - [`Rules-Guide/kit-lint/modules.json`](../../Rules-Guide/kit-lint/modules.json) — this group is
     declared there so kit-lint discovers its members and holds each to the kit contract. Check
     your new folder is covered by that declaration.
6. **Then prove it:** `node Rules-Guide/kit-lint/kit-lint.mjs` from the kit root — links resolve,
   the tools you tell people to run actually ship, no author-machine paths, the form is complete.
7. **Link stability from day one.** The new type's generator must keep a shared link stable
   across rebuilds — fixed gid for a Sheets tab, update-in-place for a Doc, same path for
   published HTML, `files.update` on the same fileId for Drive files (Project-Configuration
   rule 10) — and its `*_RULES.md` must SAY so in its own "A shared link survives every
   rebuild" section, because a teammate entering through this kit's SETUP may never open the
   cross-cutting rule. Every existing doc-producing kit carries the section since 15/07/2026;
   a new one without it is incomplete.
8. **Prove fidelity by RENDER, not by attributes.** Reading styles back through an API verifies
   your spec, not the page. A visual document (Doc/HTML/PDF) "matches the reference" only after a
   page-by-page render of BOTH has been compared by eye — and an owner's visual complaint is
   answered with a new render, never with another attribute check. The narrow exception is a
   purely tabular Sheet with a cell-level diff against the reference itself (that is how
   Bug-Summary earned its badge). Learned on Test-Report, three owner-screenshots deep.
