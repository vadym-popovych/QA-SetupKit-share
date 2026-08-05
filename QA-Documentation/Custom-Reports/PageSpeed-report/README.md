# PageSpeed report — web-performance rounds in the owner's Sheet format

🟡 **stable** — built, reviewed, and the **collection half is now proven live**: with a real PSI API
key, a 3-run round against a live URL came back through the PSI v5 payload and wrote a schema-valid
round file (Lighthouse **13.4.0**). What is still **unverified**, and why this is not 🟢:

- the **publish path has never written to a real Google document** — `psi-sheet.mjs` has been
  exercised against fixtures and `--dry-run`, never against a live Sheet;
- the **`--engine lighthouse` local fallback is untested**;
- no **real project round** has gone end-to-end (collect → Sheet → read by a human who acted on it),
  which is what 🟢 costs.

Expect to fix small things on first use — and fix them *in the kit*.

The document type: a **page-load performance report**, one row pair per page (Desktop + Mobile), one
4-column block per **round**, appended to the right as the site is measured again. Reverse-engineered
from the owner's real "PageSpeed Insights Results" spreadsheet, so the team opens something it
already recognises — with the things the original could not say now written down: how many runs are
behind a number, which environment produced it, and what the score is made of.

The Sheet cell keeps the **Performance score** (byte-for-byte the owner's format). The Core Web
Vitals — LCP / TBT / CLS / FCP / SI, plus CrUX field metrics when they exist — ride in the **cell
note** and in the round **JSON**, because *"73"* alone cannot tell anyone what regressed.

## The flow in one line

[`pages.json`](template/pages.example.json) → [`psi-run.mjs`](template/tools/psi-run.mjs) →
`rounds/<round-id>.json` (valid against
[`pagespeed-round.schema.json`](../../../Rules-Guide/schemas/pagespeed-round.schema.json)) →
[`psi-sheet.mjs`](template/tools/psi-sheet.mjs) → a **new round block** in the Sheet (previous rounds
carried over by page id + platform; never overwritten).

Each score in that chain is the **median of N runs** (default 3). Fewer successful runs than the
configured target → the cell stays `not-run`, never a green number. That single rule is most of what this
kit is for; the rest are in [`PAGESPEED_REPORT_RULES.md`](PAGESPEED_REPORT_RULES.md).

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | one-time setup: PSI API key, Sheets OAuth, `pages.json`, the two commands, troubleshooting |
| [`PAGESPEED_REPORT_RULES.md`](PAGESPEED_REPORT_RULES.md) | **the discipline** — sampling, the four cell states, budgets vs colour bands, what counts as a regression, lab vs field |
| [`SHEET_TEMPLATE.md`](SHEET_TEMPLATE.md) | the canonical Sheet: layout · widths · palette · header merges · conditional-format bands · the invariants the tab encodes |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | paste block for a teammate's workspace `CLAUDE.md` |
| [`template/pages.example.json`](template/pages.example.json) | the page inventory: sections, pages, URLs, platforms, runs per page |
| [`template/tools/psi-report.mjs`](template/tools/psi-report.mjs) | the evidence: renders the **stored median run** into the Lighthouse report the Sheet's `Desktop`/`Mobile` cell links to (+ a full-page PNG), publishes it with any uploader, writes the link back into the round. It never re-measures the page — a fresh analysis is a different load, and its report would contradict the cell. Needs `npm install` in [`template/tools/`](template/tools/package.json) |
| [`template/tools/psi-run.mjs`](template/tools/psi-run.mjs) | the collector — PSI API, N runs per page × platform, median, writes the schema-valid round JSON |
| [`template/tools/psi-sheet.mjs`](template/tools/psi-sheet.mjs) | the Sheet builder — appends the round block, fixed gid, idempotent rebuild |
| [`../../../Rules-Guide/schemas/pagespeed-round.schema.json`](../../../Rules-Guide/schemas/pagespeed-round.schema.json) | the machine contract for a round (validate on write — the round JSON is the source of truth, the Sheet is a projection) |

## Where the artefacts live

```
<Project>/Web-Performance/
├── pages.json              # the page inventory (from pages.example.json)
├── rounds/<round-id>.json  # one schema-valid file per round — the source of truth
└── tools/                  # symlinks to the kit's psi-run.mjs / psi-sheet.mjs (no fork)
```

The Sheet is the human view; the round JSONs are what an agent reads, diffs and audits. Kit folder
holds templates and rules only — never a project's pages or scores.

## Who feeds it, and what it is not

- **[Web-Testing](../../../Testing-Types/Web-Testing/)** is the natural caller: a web round already
  visits every page across viewports, and a PageSpeed round is the performance slice of the same
  page inventory. Run it as part of a web round, or on its own cadence per release.
- **Not [Load-Testing](../../../Testing-Types/Load-Testing/).** Load-testing asks *how many users the
  backend survives* (throughput, latency under concurrency, k6). This asks *how fast one page loads
  for one user* (lab page-load performance, Lighthouse). Different question, different tool,
  different failure mode — a site can pass one and fail the other badly.
- Regressions leave here as **`PERFORMANCE` bug candidates** for
  [Bug-Reports](../../Bug-Reports/BUG_REPORTS_RULES.md) — reproduced in a second round first, never
  auto-filed.
- The oracle is a threshold/differential one, per
  [Test-Oracles](../../../Testing-Planning/Test-Oracles/TEST_ORACLES_RULES.md): a score is judged
  only against an **owner-approved budget** or against **the same page's previous round in the same
  environment**. Google's 90/50 colour bands are a *classification*, not a pass/fail line.
- **The evidence is the round JSON, never a `pagespeed.web.dev` link.** Shared PSI `/analysis/<id>`
  links expire after 30 days and die with the analysed host — both already happened to the very
  document this module was reverse-engineered from. A published HTML view of a round, if you want a
  link a human can open, goes through [`../HTML-Reports/`](../HTML-Reports/) like every other QA
  HTML — self-contained, and this kit does not re-implement publishing.
- **No `run-result` artefact yet** (deliberate, queued): nothing here feeds
  [CI-Integration](../../../Testing-Planning/CI-Integration/)'s `ci-run-result.mjs`, so a CI perf
  gate has nothing machine-readable to consume. Stated as a gap, not dressed up as done.
