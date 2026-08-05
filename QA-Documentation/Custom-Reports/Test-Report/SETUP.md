# Test report — setup

## Trigger phrases

Say any of these and the agent should land here:

- *"make the test report for the client"* · *"final report for the sprint/engagement"*
- *"the document with scope, devices, testing types and the bug tables"*
- *"turn the bug summary into the end-of-engagement report"*

## Prerequisites

| Need | Why | Check |
|---|---|---|
| **Node 18+** | the tool is plain `.mjs` | `node -v` |
| **Google Sheets MCP (OAuth)** | the document is a Google Doc; the same OAuth covers Docs + Drive | `MCP-configurations/mcp-sheets/token.json` exists — else [MCP_SETUP.md](../../Checklist/MCP_SETUP.md) |
| **A Bug-Summary record** | the Test results tables are derived from it | `bug-summary.json` — else [Bug-Summary/SETUP.md](../Bug-Summary/SETUP.md) first |
| **poppler** (step 4, and `tr-docx.mjs`) | step 4 renders the doc to per-page PNGs; the in-development docx engine reads page text to find split tables | `pdftoppm -v` / `pdftotext -v`. **macOS:** optional — each tool falls back to the bundled `render-pdf.swift` / `pdf-page-text.swift` (CoreGraphics, PDFKit). **Linux/Windows:** required — those frameworks are Apple-only, so there is no fallback and step 4 fails without poppler |

No other accounts or keys. This kit **collects nothing**: both inputs already exist by the time a
test report is due.

## 1. Get the numbers record

The Test results section is built from a `bug-summary.json`
([`bug-summary.schema.json`](../../../Rules-Guide/schemas/bug-summary.schema.json)). If you don't
have one, build it first — the [Bug-Summary kit](../Bug-Summary/README.md) has four ways (kit bug
records, Redmine, an existing sheet, any tracker export). **Do not hand-write counts; the whole
point is that they are computed.**

## 2. Write the narrative config

Copy [`template/test-report.example.json`](template/test-report.example.json) to
`<Project>/QA-Documentation/test-report/report-config.json` and fill in the facts of YOUR
engagement:

- `environment.groups` — the devices/browsers **actually used** (model, OS version, viewport).
  Required; there is no default. Ask the owner if you were not the one testing.
- `testDesign` — only the types **actually performed** (`smoke`/`functional`/`ui`/`acceptance`/
  `regression` ship library text; `custom` supplies its own). Work someone else did goes in
  `alsoPerformed` — credited in the intro line, no section.
- `date` is `dd/mm/yyyy`; `project` must match the record's `project` (the build refuses otherwise).

Validate both inputs before building (SCHEMAS_RULES — validation is literal):

```bash
node QA-SetupKit/Rules-Guide/schemas/validate.mjs test-report report-config.json
node QA-SetupKit/Rules-Guide/schemas/validate.mjs bug-summary bug-summary.json
```

## 3. Build the Doc

```bash
PROJECT_NAME=<Project> \
TR_CONFIG=<Project>/QA-Documentation/test-report/report-config.json \
TR_SUMMARY=<Project>/QA-Documentation/bug-summary/bug-summary.json \
node QA-SetupKit/QA-Documentation/Custom-Reports/Test-Report/template/tools/tr-doc.mjs
```

Prints `{ documentId, docLink, folderLink, warnings }`. The doc lands in Drive under
`ClaudeProjects/<Project>/QA Documentation/Test Reports/` (root name override:
`DRIVE_ROOT_FOLDER`). A same-titled doc is **updated in place** — the documentId and any
shared link stay stable across rebuilds; a new title (new edition date) makes a new doc.

Optional: `TR_TITLE` (title override) · `TR_RESULTS_NOTE=1` (adds one honest line under Test
results: how many counted issues are not verified fixed — **opt-in**, the default output is the
owner's format).

## 4. Look at it before anyone else does

Fidelity is proven by RENDER, not by API attributes ([`TEST_REPORT_RULES.md`](TEST_REPORT_RULES.md) §7):

```bash
node QA-SetupKit/QA-Documentation/Custom-Reports/Test-Report/template/tools/tr-render.mjs <documentId> ./render/report
```

→ `report.pdf` + `report-pNN.png`, one per page — open them and compare against the reference
with your own eyes before handing anything over.

## 5. Hand it over — with the warnings

The build prints warnings for a reason: agent-proposed severities, "all defects addressed" claims
that the record contradicts, scope overrides that drop pages with bugs. **Repeat them in the message
where you hand over the link** — see [`TEST_REPORT_RULES.md`](TEST_REPORT_RULES.md). A native Table
of Contents cannot be inserted through the API: one click, **Insert → Table of contents**, if the
owner wants it.

## Where artefacts land

```
<Project>/QA-Documentation/test-report/
  report-config.json        # the narrative half (schema-validated)
  tools/tr-doc.mjs          # symlink to the kit copy — pointer, not fork
```

The live document stays in Google Docs; the record stays wherever Bug-Summary keeps it
(`<Project>/QA-Documentation/bug-summary/`).
