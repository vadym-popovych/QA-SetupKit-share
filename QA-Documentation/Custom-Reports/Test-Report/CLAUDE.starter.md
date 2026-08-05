# Test report — CLAUDE.md starter block

Paste into your `CLAUDE.md`. Full rules:
[`QA-Documentation/Custom-Reports/Test-Report/TEST_REPORT_RULES.md`](TEST_REPORT_RULES.md) ·
canonical Doc: [`DOC_TEMPLATE.md`](DOC_TEMPLATE.md).

---

## Test report (end-of-engagement document) — QA-SetupKit

- **Home:** `QA-SetupKit/QA-Documentation/Custom-Reports/Test-Report/`. Triggers — *"make the test
  report for the client"*, *"final report for the sprint"*, *"the document with scope, devices and
  the bug tables"* → [`SETUP.md`](SETUP.md) + [`TEST_REPORT_RULES.md`](TEST_REPORT_RULES.md).
- **What it is:** the formal narrative Google Doc a client receives at the end of a sprint or
  engagement — Purpose · Test Objective (scope) · Environment & Tools · Test Design (per performed
  type: Goal / Process / Completion Criteria) · **Test results** (severity-count tables per module,
  per site, plus a grand total). Chain of ownership: Bug-Reports owns the RECORD → Bug-Summary owns
  the COUNTS → Test-Report tells the STORY. When any two disagree, the more primary one wins.
- **The flow:** `report-config.json` (narrative facts, schema
  `Rules-Guide/schemas/test-report.schema.json`) + `bug-summary.json` (the numbers record) →
  `tools/tr-doc.mjs` → Google Doc in `<Drive root>/<Project>/QA Documentation/Test Reports/`.
  Artefacts → `<Project>/QA-Documentation/test-report/`.
- **Numbers are DERIVED, narrative is TESTIMONY.** Every count in the tables is computed from the
  Bug-Summary record at build time — never typed, never hand-fixed in the Doc; fix the record and
  rebuild. Devices, testing types and scope come from the config and are facts about what actually
  happened: the tool **fails closed** on a missing environment (there is no default device list),
  and only ACTUALLY performed types get a section — someone else's work goes in `alsoPerformed`,
  credited in the intro line without testimony.
- **Refusals:** config project ≠ record project · a severity outside the record's `severityScale`
  (no column would count it) · empty environment. **Warnings — repeat them when handing over the
  link:** agent-proposed severities in a client-facing statistic · Completion Criteria claiming
  "all defects addressed" while the record holds open issues · a scope override that drops a page
  with counted bugs.
- **Reproduce, don't redesign:** default output = the owner's reference document (palette, merges,
  plain semicolon lists — read from its `.docx` XML, see `DOC_TEMPLATE.md`). Kit additions are
  opt-in flags, off by default (`TR_RESULTS_NOTE`). A page with zero issues still renders — zeros
  are coverage evidence. `General` renders last (it is Bug-Summary's placement-debt band).
- **Validation is literal:** `validate.mjs test-report <config>` and `validate.mjs bug-summary
  <record>` in the same turn you touch them.
