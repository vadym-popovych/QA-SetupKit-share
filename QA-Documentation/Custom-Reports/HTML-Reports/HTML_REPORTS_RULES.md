# HTML-Reports rules (paste into your workspace CLAUDE.md)

The **discipline-agnostic** way to turn any self-contained HTML QA artefact into a shareable
browser link. Load run reports, visual-diff galleries, accessibility scan summaries, coverage
dashboards — anything that renders as one HTML file. Machine-specific paths do NOT belong here;
mirror new rules of this kind here (+ into `CLAUDE.starter.md` and the workspace `CLAUDE.md`).

- **One hosting, all disciplines, project name never in the link.** A single private repo
  (`QA-Documents`) served by a static host (Cloudflare Pages → `<site>/<Type>/<date>/<file>`).
  The `<Type>` segment is the discipline or artefact kind (`Reports`, `Visual`, `A11y`,
  `Coverage`, …) — **not** the project. The project name must never appear in the path or the
  URL. One publisher serves every kit; nobody stands up their own.

- **The tool is env-driven and FAILS CLOSED.** [`publish-report.sh`](template/tools/publish-report.sh)
  needs two variables and refuses without them, on purpose:
  - `QA_DOCS_REPO_DIR` — local clone of your private reports repo;
  - `QA_DOCS_BASE_URL` — the site that serves it, no trailing slash. **No default** — a default
    would hand you a link to somebody else's site. A missing repo → an explanation + the clone
    command, never a raw `git fatal`. This is *never fake a Pass* applied to publishing: better a
    clear refusal than a link that quietly points at the wrong place.

- **Private by default; `public` is an explicit third argument.** Every published HTML is under
  `Private/<Type>/…` behind Basic Auth unless you pass `public`. When you publish privately, hand
  the owner the credentials link (`MCP-configurations/cloudflare/basic-auth.txt`, gitignored)
  **together with** the report link — a password-protected link with no password is not shareable.

- **Only `.html`, only dev/test data.** The tool publishes `.html` files only. ⚠️ Anything
  published outside `Private/…` is **link-accessible to anyone who has the URL** — search
  engines are kept away only by the `_headers` noindex (SETUP §0), not the reader — so **only
  dev/test-stand artefacts** ever go up: never production data, never secrets, never anything
  with real user PII. This is the same staging-only rule every execution kit follows, at the
  delivery layer.

- **Any discipline uses it the same way.** A kit that produces an HTML artefact calls the tool
  with its own `<Type>`; it does not re-implement publishing. New artefact kind → new `<Type>`
  segment, not a new tool. If a discipline needs the published link recorded, it goes in that
  round's LINKS section (same ethos as the load-testing LINKS rule).

- **Setup lives next door, not here.** Creating the Cloudflare API token and the Pages project is
  a one-time owner task documented in
  [`MCP-configurations/cloudflare/README.md`](../../../MCP-configurations/cloudflare/README.md) and
  [`SETUP.md`](SETUP.md); these rules govern *use*, that doc governs *setup*.

Published files live in the reports repo (outside any project); the per-project artefact is just
the tool (a pointer to the kit copy) plus the link recorded in the round's report.

## A shared link survives every rebuild

Universal invariant (Project-Configuration rule 10, owner's rule 15/07/2026): updating this
kit's artifact must keep the link the owner already shared. For this kit: republishing a report writes to the SAME repo path, which IS the URL — an updated report replaces the file at its path; a new path is a NEW report, not an update.
Trash-and-recreate looks identical in the UI and silently kills every saved link; if a
carrier genuinely cannot keep its link, say so in the hand-over message.
