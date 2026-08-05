# HTML-Reports — publish any QA HTML to a shareable link

The **discipline-agnostic** publisher. Any self-contained HTML QA artefact — a load run report, a
visual-diff gallery, an accessibility summary, a coverage dashboard — becomes a browser link
through one shared flow, with the project name never in the URL.

Extracted from Load-Testing on 12/07/2026: publishing an HTML report to a static host is not a
load-testing concern, it is a **delivery** concern every discipline shares. Load-Testing was just
the first kit to need it.

## The flow in one line

Self-contained `.html` → [`publish-report.sh`](template/tools/publish-report.sh) → committed to a
private repo → served by a static host → `https://<site>/<Type>/<date>/<file>`.

- **One hosting for every project**, project name never in the link.
- **`<Type>` is the discipline/artefact kind** (`Reports`, `Visual`, `A11y`, `Coverage`, …).
- **Private by default** (Basic Auth); `public` is an explicit opt-out.
- **Dev/test data only** — the site is link-accessible and noindexed.

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | one-time host + repo setup, then how to publish from any discipline |
| [`HTML_REPORTS_RULES.md`](HTML_REPORTS_RULES.md) | the rules (env-driven, fail-closed, private-by-default, staging-only) |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | paste block for a teammate's workspace `CLAUDE.md` |
| [`template/tools/publish-report.sh`](template/tools/publish-report.sh) | the publisher — env-driven, fails closed without `QA_DOCS_REPO_DIR` / `QA_DOCS_BASE_URL` |

Cloudflare token + Pages project setup lives in
[`../../../MCP-configurations/cloudflare/README.md`](../../../MCP-configurations/cloudflare/README.md)
(setup); these docs govern use.

## Who uses it

| Discipline | HTML it publishes | `<Type>` |
|---|---|---|
| [`Load-Testing`](../../../Testing-Types/Load-Testing/) | k6-reporter run report (`handleSummary`) | `Reports` |
| [`Visual-Regression`](../../../Testing-Types/Visual-Regression-Testing/) | diff gallery | `Visual` |
| [`Accessibility`](../../../Testing-Types/Accessibility-Testing/) | axe summary | `A11y` |
| any future kind | any self-contained HTML | its own segment |

A discipline that produces an HTML artefact **calls** this tool; it never re-implements
publishing. New kind of artefact → new `<Type>` segment, not a new tool.
