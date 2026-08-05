# Test report — the end-of-engagement narrative document

🟡 **stable** — the generator reproduces the owner's reference `.docx` structure (palette, merges and
geometry read from its XML, not from a screenshot) and has been smoke-run end to end on the synthetic
example pair; it has not yet been field-run on a real engagement.

The document: **the report a client actually receives at the end of a sprint or engagement** — what
was tested, on which devices, with which types of testing, and what was found. A formal, signed,
narrative Google Doc; the thing that gets attached to the final invoice email.

It is the third member of a chain, and the boundaries matter:

| Document | Owns | Reader |
|---|---|---|
| [Bug-Reports](../../Bug-Reports/README.md) | the **record** of one bug | a developer fixing it |
| [Bug-Summary](../Bug-Summary/README.md) | the **counts** of all bugs, per module | a lead scanning damage |
| **Test-Report** | the **story of the engagement** — scope, environment, method, and those counts | the client |

The Test results section of this document IS the Bug-Summary data, rendered as Doc tables — it is
**derived from the same record** (`bug-summary.json`), never re-typed. When report and record
disagree, **the record wins** — same rule as everywhere else in this group.

## The flow in one line

`report-config.json` (narrative facts, [`test-report.schema.json`](../../../Rules-Guide/schemas/test-report.schema.json))
\+ `bug-summary.json` (the numbers record) → [`tr-doc.mjs`](template/tools/tr-doc.mjs) → a Google Doc
in `Test Reports/` under the project's Drive folder.

## The two halves — and why the config cannot carry numbers

- **Narrative** (Purpose · Objective · Environment · Test Design) comes from the config, because the
  record cannot know which devices were on the desk or which testing types were performed. These are
  **facts about what actually happened** — the environment section has no default, and the tool fails
  closed without it: a generator that invents a device list writes fiction.
- **Results** (all tables) come from the record, because a count typed into a narrative document
  stops being true the moment the record changes — and nobody notices, since the tables *look* the
  same either way.

## What it will not let you do

| Refusal / warning | Because |
|---|---|
| config `project` ≠ record `project` → **refuses to build** | a narrative married to another engagement's numbers |
| a severity outside the record's `severityScale` → **refuses** | no column would count it (same refusal as Bug-Summary) |
| missing/empty `environment.groups` → **refuses** | the environment is testimony; there is no default device list |
| agent-proposed severities in the record → **warned on every build** | every statistic in a client-facing document is built out of them |
| Completion Criteria claim "all defects addressed" while the record holds open issues → **warned** | the tables would contradict the claim two pages later |
| an `objective.scope` override that drops a page with counted bugs → **warned** | the scope would claim less than the results show |

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | prerequisites, first build, where artefacts land |
| [`TEST_REPORT_RULES.md`](TEST_REPORT_RULES.md) | the discipline — read before the first edition |
| [`DOC_TEMPLATE.md`](DOC_TEMPLATE.md) | the canonical Doc: sections, tables, palette, merges — and the deliberate departures |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | paste-block for a teammate's `CLAUDE.md` |
| [`template/test-report.example.json`](template/test-report.example.json) | synthetic config — pairs with Bug-Summary's example for an end-to-end dry run |
| [`template/tools/tr-doc.mjs`](template/tools/tr-doc.mjs) | the generator (three-pass Docs API build: text → tables → fill/style/merge) |
| [`template/tools/tr-render.mjs`](template/tools/tr-render.mjs) | the EYES of RULES §7 — any Drive doc → PDF → per-page PNGs (a non-native reference is exported through an auto-trashed convert-copy; the original stays read-only) |
| [`template/tools/render-pdf.swift`](template/tools/render-pdf.swift) | the PNG renderer behind it (macOS CoreGraphics, no brew deps; `pdftoppm` is used instead when present) |
| [`template/tools/pdf-page-text.swift`](template/tools/pdf-page-text.swift) | per-page TEXT of a PDF (macOS PDFKit, no brew deps; `pdftotext` is used instead when present) — used to find which page a heading actually landed on |
| [`template/tools/tr-docx.mjs`](template/tools/tr-docx.mjs) | ⚠️ **IN DEVELOPMENT — `tr-doc.mjs` above is still the generator.** The next-generation build: a .docx imported to Drive with conversion, so the report carries a real Table of Contents and real footer page numbers (neither of which the Docs API can insert). Its layout loop renders the document and measures the render until both agree — TOC numbers baked from real pages, no orphaned headings, no table broken across a page. Awaiting the owner's validation before it replaces `tr-doc.mjs`. |

Artefacts land in `<Project>/QA-Documentation/test-report/` — never in the kit.

## The honesty line

> **This is the one document the client keeps.** Every number in it is computed from the record at
> build time; every narrative claim in it is the owner's testimony from the config. The generator's
> job is to make sure the two halves cannot contradict each other silently — and to warn out loud
> when they do.
