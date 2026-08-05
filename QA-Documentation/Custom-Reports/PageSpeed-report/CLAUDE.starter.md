# PageSpeed-report starter rules — paste into YOUR workspace CLAUDE.md

## Web performance rounds — PageSpeed-report kit
- **Home:** `QA-SetupKit/QA-Documentation/Custom-Reports/PageSpeed-report/`. The web-performance
  report in the team's own Sheet format (page × platform × round). Triggers: "measure PageSpeed for
  the site", "run a PageSpeed round on staging", "update the PageSpeed Insights sheet", «заміряй
  швидкість сторінок», «прожени PageSpeed по лендінгу» → SETUP.md + `PAGESPEED_REPORT_RULES.md`.
- **Flow:** `pages.json` (pages carry a **`path`**, joined to `baseUrl` — not a `url`) → `psi-run.mjs`
  (PSI API, N runs per page × platform) → `rounds/<round-id>.json` (schema-valid — the source of
  truth) → `psi-sheet.mjs` → a **new round block appended to the right** in the Sheet. Rounds are
  never overwritten; previous ones carry over by (page id, platform). Artefacts →
  `<Project>/Web-Performance/` (tools = symlinks to the kit).
- **The two tools are driven differently — take the contract from `--help`, not from memory:**
  `psi-run.mjs` is **FLAG-driven** (`--round` · `--env` · `--label` · `--date` · `--pages` ·
  `--out-dir` · `--runs` · `--engine psi|lighthouse` · `--throttle-ms` · `--schemas` ·
  `--self-check`), e.g.
  `node tools/psi-run.mjs --round r7 --env staging --label "Points from 13/07/2026 (Stage)"`.
  `psi-sheet.mjs` is **ENV-driven** (`PROJECT_NAME` · `PAGES` · `ROUNDS_DIR` · `PS_TAB` · `PS_GID` ·
  `TARGET_SSID` · `SHEET_NAME` · `DRIVE_ROOT_FOLDER` · `DRIVE_CATEGORY` · `PS_ALLOW_DROP` ·
  `PS_ALLOW_ADOPT`) plus `--dry-run`.
- **Never point the builder at someone's hand-made tab and hope.** A tab this tool did not build
  (no `round:` notes) is refused — rebuilding it reproduces only what `rounds/` holds and silently
  drops the rest. Import that history into `rounds/` first, `--dry-run`, compare, and only then
  `PS_ALLOW_ADOPT=1`. The same instinct as "reference documents the owner gives you are read-only".
- **Not configured → lead the user through the setup, never improvise.** No PSI key / no Sheets
  OAuth → say what is missing, what it blocks, and walk them through SETUP.md (enable API → create
  key → restrict → paste into the gitignored `.token` → verify with one live call). Never quietly
  switch engine, drop to one run, or hand-copy a number from the pagespeed.web.dev UI — a number
  nobody can reproduce is worse than a blank cell.
- **The evidence link must be the report of the SAME run as the number.** `psi-run.mjs` stores the
  median run's raw Lighthouse Result (`rounds/<round>.lhr/`); `psi-report.mjs` renders **that** into
  the Lighthouse report + a full-page PNG, publishes it (`--upload '<cmd with {file}>'` /
  `$PSI_EVIDENCE_UPLOADER` — Mega, Drive, HTML-Reports…) and writes the link into the round; the
  Sheet's `Desktop`/`Mobile` cell becomes that link. **Never screenshot pagespeed.web.dev instead** —
  it re-analyses the page, so the picture shows a different load than the cell (measured on one page
  within an hour: UI 85 · median-of-3 90 · median-of-3 88). Both tools REFUSE when the linked
  report's score disagrees with the cell (`evidence.runScore`).
- **Reach for the free switches first:** `psi-run.mjs --self-check` (offline: parse/median/status
  logic) and `psi-sheet.mjs --dry-run` (validates every round + builds the whole tab, writes nothing
  to Google) cost **zero API quota** and prove the most. Run both before spending a live call.
- **Needs a free PSI API key** for the `psi` engine: `$PSI_API_KEY` → `$PSI_API_KEY_FILE` → the
  default `MCP-configurations/pagespeed/.token` (gitignored, found by walking up). Without a key the
  API returns **429 quota-exceeded** on Google's shared anonymous project — so the collector **fails
  closed** with the key instructions; a rejected key aborts before anything is written. Never print
  the key, never put it in a Sheet.
- **One run is noise:** `runsPerPage` = **3**, the cell carries the **MEDIAN**, every individual run
  stays in the JSON + the cell note. Fewer successful runs than target → **`not-run`**, never a
  green number.
- **Four cell states, and `0` is never written:** a score · **empty** = not run this round
  (temporary) · **`n/a`** = page doesn't exist there / unreachable by this tool (comment mandatory)
  · **`error`** = the tool failed (comment mandatory). A zero is a real score — using it for "we
  didn't measure" makes an absence look like a finding.
- **Report vs judge:** the 90/50 colour bands are Google's **classification**, not a pass/fail line.
  Pass/fail needs an owner-approved `budgets` block (`approvedBy` + `approvedOn`). **Raising a budget
  or re-baselining to make the doc green = fabrication** (same rule as visual-regression baselines).
- **Environment + engine are part of the number's identity.** A regression = same page + same
  platform + same env + same engine + same profile, ≥ 10 points down (or a CWV crossing its
  threshold). Staging vs prod, or local Lighthouse vs PSI, is a **category error**, not a finding —
  and a round never mixes engines.
- **Comment MANDATORY when:** score < 50 · dropped ≥ 10 pts vs the previous round in the same env ·
  page didn't return 200 / rendered empty · run count below target · cell is `n/a` or `error`.
- **Regressions are `PERFORMANCE` bug CANDIDATES, never auto-filed:** reproduce in a second round first,
  name which metric moved (LCP/TBT/CLS — "73 → 58, TBT 210 ms → 940 ms"), dedup (one root cause =
  one bug), severity by impact (core page + mobile + < 50 = Major), owner approves before filing.
- **Lab ≠ field:** PSI/Lighthouse is a synthetic single load; CrUX `loadingExperience` is real users.
  Record field data when it exists, **absent ≠ zero**, and never present a lab number as user
  experience.
- **A `pagespeed.web.dev` link is NOT evidence.** Shared PSI `/analysis/<id>` links expire after
  **30 days**, and they die the moment the analysed host goes away (both already happened to the
  reference document). The evidence is the **round JSON committed next to the report** (every run,
  the median, the metrics, the Lighthouse version, the timestamp, the env) — optionally plus a
  self-contained HTML view published through the HTML-Reports kit. A link may be *recorded* as a
  convenience; it is never *the record*.
- **Known gap (deliberate, not done):** the module emits **no `run-result` artefact**, and
  `ci-run-result.mjs` has no discipline for web performance — so **a CI perf gate has nothing
  machine-readable to consume here yet**. Do not call it CI-ready, and never hand-roll a green
  run-result to make a pipeline pass.

Full rules: `QA-SetupKit/QA-Documentation/Custom-Reports/PageSpeed-report/PAGESPEED_REPORT_RULES.md`.
Sheet layout/palette: same folder's `SHEET_TEMPLATE.md`. Sheets OAuth:
`QA-SetupKit/QA-Documentation/Checklist/MCP_SETUP.md`.
