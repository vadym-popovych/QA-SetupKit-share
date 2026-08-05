# HTML-Reports starter rules — paste into YOUR workspace CLAUDE.md

## Publish any QA HTML to a link — HTML-Reports kit
- **Home:** `QA-SetupKit/QA-Documentation/Custom-Reports/HTML-Reports/`. The **discipline-agnostic** publisher:
  any self-contained HTML QA artefact (load report, visual-diff gallery, a11y summary, coverage
  dashboard) → browser link. Triggers: "share this HTML report", "publish the dashboard",
  "викинь звіт у браузер" → SETUP.md + `HTML_REPORTS_RULES.md`.
- **Flow:** `.html` → `publish-report.sh <file.html> [Type] [public]` → committed to ONE private
  repo → static host → `https://<site>/<Type>/<date>/<file>`. `<Type>` = the discipline/artefact
  kind (`Reports`/`Visual`/`A11y`/…), **never the project name** — the project must not leak into
  the link.
- **Env-driven, fails closed:** needs `QA_DOCS_REPO_DIR` + `QA_DOCS_BASE_URL` (no default for the
  URL — a default would print a link to someone else's site). Missing → an explanation, never a
  raw `git fatal`.
- **Private by default:** every publish is `Private/<Type>/…` behind Basic Auth unless you pass
  `public` as the 3rd arg; hand the owner the credentials link together with the report link.
- **Only `.html`, only dev/test data** (the site is link-accessible + noindexed).
- **Any discipline uses it the same way** — call the tool with your `<Type>`, never re-implement
  publishing; record the link in the round's LINKS section. Tool is a symlink to the kit copy
  (no project config → pointer, not fork, per Project-Configuration #9).

Full rules: `QA-SetupKit/QA-Documentation/Custom-Reports/HTML-Reports/HTML_REPORTS_RULES.md`.
Cloudflare token/Pages setup: `QA-SetupKit/MCP-configurations/cloudflare/README.md`.
