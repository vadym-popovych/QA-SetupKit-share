# HTML-Reports — SETUP (Claude-followable)

Turn any self-contained HTML QA artefact — from **any** discipline — into a shareable browser
link. This is the discipline-agnostic publisher: load reports, visual-diff galleries, a11y
summaries, coverage dashboards all use the same flow. Rules: [`HTML_REPORTS_RULES.md`](HTML_REPORTS_RULES.md).

## 0 · One-time setup (owner, once per machine)

You need a private repo the site serves, and a static host pointed at it.

1. **A private reports repo.** One repo for ALL projects (the project name must never leak into a
   link). Create it and clone it:
   ```bash
   git clone git@github.com:<you>/QA-Documents.git ~/qa-public-reports
   ```
2. **A static host** pointed at that repo. The reference setup is **Cloudflare Pages** (free,
   pretty URLs, optional Basic Auth). Create the Pages project and the API token per
   [`../../../MCP-configurations/cloudflare/README.md`](../../../MCP-configurations/cloudflare/README.md),
   then connect the **Cloudflare Pages GitHub App** to the private repo: **no build command,
   output directory `/`** → pretty URLs (no `.html`), auto-deploy on every push.
   - **Add a `_headers` file** at the repo root with `X-Robots-Tag: noindex, nofollow` so a
     leaked link never gets search-indexed.
   - **The alternatives are not equivalents (verified 09/07/2026).** GitHub Pages on the Free
     plan requires the serving repo to stay PUBLIC — flipping it private **DELETES the Pages
     site**; private-repo Pages needs GitHub Pro. Netlify works but its free tier caps
     bandwidth (100 GB/mo) and puts password protection behind a paywall.
3. **Export the two variables** (put them in your shell profile so every project's tool works):
   ```bash
   export QA_DOCS_REPO_DIR=~/qa-public-reports
   export QA_DOCS_BASE_URL=https://<your-site>      # e.g. https://<your-site>.pages.dev, no trailing slash
   ```
   The tool **refuses to run** without these — by design (it will not print a link to a site you
   don't own). If either is missing you get an explanation, not a stack trace.
4. **Basic Auth (optional but default-on).** On Cloudflare Pages it is a Pages Functions
   middleware (`<repo>/functions/_middleware.js` — it lives in the reports repo, not this kit)
   that raises the browser's own login dialog; the credentials live ONLY in the Pages
   project's **secret env vars
   `BASIC_USER`/`BASIC_PASS`** plus a local **gitignored** creds file
   (`MCP-configurations/cloudflare/basic-auth.txt`) — never in the repo itself. Published files
   go under `Private/…` behind the login; share the creds-file link alongside any private
   report link. Need true access control (named users, not one shared password) → **Cloudflare
   Access** adds it on top, free up to 50 users.

## 1 · Publish (any discipline, any HTML)

```bash
# copy tools/publish-report.sh into <Project>/<Discipline>/tools/ (or symlink it — see below)
./publish-report.sh <file.html> [Type] [public]
```

- `<file.html>` — a self-contained HTML file (a `YYYY-MM-DD` prefix in the name sets the date
  folder; otherwise today).
- `[Type]` — the artefact kind / discipline segment: `Reports` (default), `Visual`, `A11y`,
  `Coverage`, … — **not** the project name.
- `[public]` — omit for a password-protected link (the default); pass `public` for an open one.

It copies the file into `<repo>/<Type>/<date>/`, commits, pushes, and prints the browser link
(the host auto-deploys in ~30–60 s). For a private publish it also prints where the credentials
live — share both links.

```bash
./publish-report.sh results/2026-07-12-load.html Reports          # → <site>/Private/Reports/2026-07-12/2026-07-12-load
./publish-report.sh runs/2026-07-12/visual-diff.html Visual       # a visual-regression gallery
./publish-report.sh a11y/summary.html A11y public                 # an open link
```

## 2 · Wire it into a discipline

- Copy (or **symlink**, per Project-Configuration convention #9 — the tool has no project config,
  so a symlink to the kit copy is correct and drift-free)
  [`template/tools/publish-report.sh`](template/tools/publish-report.sh) into the discipline's
  `tools/`.
- Produce the HTML however that discipline does (k6-reporter, a Playwright HTML report, a
  hand-built dashboard), then publish it with its own `<Type>`.
- Record the returned link in the round's report LINKS section.
