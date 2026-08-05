# Load-Testing rules (paste into your workspace CLAUDE.md)

Reusable QA rules for API load/stress testing. Machine-specific paths/accounts do
NOT belong here — keep those in your own workspace notes.

- **Home for API load/stress testing:** the shared `QA-SetupKit/Testing-Types/Load-Testing/` kit.
  When the user asks to "load test / stress test the API", "find the breaking point",
  "check p95/p99 under load", or similar → follow
  [`QA-SetupKit/Testing-Types/Load-Testing/SETUP.md`](SETUP.md). Run its
  Auto-detection FIRST; if a prerequisite is missing (k6, Postman MCP, target Postman
  collection), STOP and walk the user through SETUP before writing scenarios.

- **Tool of choice is k6** (`brew install k6`) — plain-JS scenarios, first-class
  p95/p99, thresholds, CI-friendly. **Do NOT default to JMeter.** Locust (Python) is
  the fallback only for very code-heavy user flows.

- **Read the API, don't guess.** Use the **Postman MCP** to read the real collection
  (endpoints, auth, bodies, staging environment) before writing scenarios. New MCP
  servers need a Claude Code **restart** + `/mcp` → Authenticate. No collection →
  OpenAPI spec or ask the user; never invent endpoints.

- **Staging/dev only, never production.** LLM-backed or paid APIs cost money per
  request → prefer a mocked/cheap mode, always run the **smoke test first**, cap stress
  `PEAK`, back off on 429/409. Confirm the flow shape (sync / async-poll / SSE) and the
  target VUs + latency SLA with the user before running.
- **The ceiling you find is the TARGET's, not the generator's.** k6 on one laptop can outrun most
  staging backends, so a run's real limit is set by the system under test and its economics — backend
  capacity, paid-generation cost per request, per-account quotas — never by k6. Say WHICH limit you
  hit; «k6 could not push more» is almost never the finding. A run that stops at a quota or a cost cap
  is a completed measurement of that limit, not a failed load test.

- **Scaffold from the kit template, don't hand-roll.** Copy
  `QA-SetupKit/Testing-Types/Load-Testing/template/` into the workspace as `<Project>/Load-Testing/` and
  fill the TODOs (base URL, `AUTH_MODE`, real payload, endpoints). Progression is always
  **smoke → load → stress**.

- **Per-user limits → account pool.** If the API caps resources per user, bind
  1 VU = 1 account via a **gitignored** `users.json` (`-e USERS_FILE=$PWD/users.json`).
  Use `seed-users.mjs` against a dev create-user endpoint to populate it.

- **Vary request payloads across VUs (Vadym, 03/07/2026).** When the API GENERATES
  content (LLM books, images, docs) and you want realistic, non-duplicate output
  across a pool, don't send one hard-coded body from every VU — keep a set of
  distinct payload variants and pick by `(__VU-1) + perVuCounter` so each account
  and each repeat differs. Keep one axis constant (e.g. language) if downstream
  analysis needs comparability. Reference: `<Project>/Load-Testing/lib/book-variants.js`.

- **Two run methods** (`run.sh`): `local` = free & unlimited, terminal; `cloud` =
  `k6 run -o cloud`, executes locally but streams metrics to **Grafana Cloud k6**
  dashboards. Cloud needs a one-time `k6 cloud login --token <t> --stack <slug>`; the
  free tier limits only metric **ingest**, not the load generation.

- **Secrets never travel.** No tokens, passwords, `users.json`, or Grafana tokens in
  git. Pass base URLs/tokens at runtime via `-e KEY=value`; store the Grafana token via
  `k6 cloud login` (local config).

- **Report** throughput, p95/p99 (heavy vs light via k6 tags), concurrency ceiling,
  breaking point + recovery. File failures as `BUG-NNN` in the team QA Google Sheet,
  same convention as the checklist/emulator kits.

- **Run log after EVERY run (Vadym, 03/07/2026).** The project's load-testing report
  (Google Sheet) keeps a **`Runs` tab** — one row per run, appended IMMEDIATELY after
  every k6 run (including aborted ones — mark them as such in the notes). Columns:
  Run ID (`YYYY-MM-DD-<scenario>-NN`), date, scenario, method (local/cloud), generation
  mode (real/mock), VUs, duration, iterations done/planned, total requests, error rate %,
  p95 per tagged endpoint (create/poll/unlock/…), business e2e metric (e.g.
  `chapter1_ready_duration`), domain counters (unlocks, follow-ups), 409/402/429/5xx
  counts, thresholds pass/fail, Grafana/summary link, verdict & notes, bug links.
  Capture the numbers with `--summary-export=results/<run-id>.json`.

- **The tab's charts read WHOLE columns — never rebuild them per run.** The embedded
  charts (latency p95 per endpoint across runs; stacked 409/402/429/5xx per run)
  reference entire columns, so they auto-populate as rows are appended. Cloud runs
  additionally link the Grafana Cloud k6 run URL for time-series drill-down.

- **Formatting: wrap + vertical-middle on the WHOLE tab (Vadym, 03/07/2026).** Apply text
  wrapping (`wrapStrategy: WRAP`) to the whole tab (headers + data) at creation time —
  long notes/links must never overflow into neighbouring cells — and
  `verticalAlignment: MIDDLE` to the ENTIRE used range, no exceptions. Both apply to every
  Sheets artefact any kit tool creates, not only the `Runs` tab (house-style
  `OVERFLOW_CELL` tabs and v5 checklists override WRAP, but vertical-middle still applies).
  The kit generators already default to it in code (`tc.mjs`, `bs-sheet.mjs`, `tr-doc.mjs`);
  the rule is written down so NEW tools inherit it too (recorded 16/07).
- **CF and data-validation ranges get HEADROOM.** Hang status/severity rules on the whole column
  with room to grow (`C2:C200`), never on the rows that exist today — a tab that grows past the range
  renders the new row COLOURLESS, which reads as a colour bug rather than a range bug. And make the
  dictionary itself a DROPDOWN, so a value outside the palette cannot be entered and therefore cannot
  sit colourless and unnoticed.
- **Someone else's document — formatting only, and reversibly.** Never change values, structure or
  wording in a doc you do not own: restyle only, from a script that also implements `--revert`, and
  only after they agree. Their approval of a style is binding — do not re-revert it on a later round.

- **Conditional-format thresholds with decimals follow the DOCUMENT's locale.** A `uk_UA`
  sheet needs `'2,5'` (comma); sending `'2.5'` makes the Sheets API return 400. Same family
  as formula argument separators (`;` vs `,`) — the document's locale owns both.

- **Metric cells must be REAL numbers** (`valueInputOption: USER_ENTERED` / numeric
  values) — writing them as strings via `RAW` makes the embedded charts silently
  render empty ("add a series to start visualizing").

- **Every time/quantity cell must be human-readable (Vadym, 03/07/2026)** — no bare
  `184358.00` anywhere: durations ≥ 1 min (run Duration, e2e metrics) → store
  `seconds/86400` + duration numberFormat (`TIME`, `[m]"m" ss"s"`, or
  `[h]"h" mm"m" ss"s"` for hours) so the cell shows `3m 04s` while remaining
  numeric/sortable; sub-minute chart-fed latency columns (p95 per endpoint) keep
  ms VALUES but get numberFormat `#,##0" ms"` (displays `1 870 ms`, charts still
  read the number); request/chapter counters get `#,##0`.

- **Recreated tabs must pin a FIXED gid (Vadym, 09/07/2026).** An idempotent tab
  builder that does delete+`addSheet` WITHOUT an explicit `sheetId` gets a new random
  gid on every rebuild — every previously shared `#gid=...` link (yours, teammates',
  in run reports) silently dies. Always pass a constant
  `addSheet.properties.sheetId = <FIXED_GID>` and, before deleting, look the stale
  copy up by that gid OR by title (covers a hand-renamed tab) — the tab URL then
  survives any number of rebuilds. Caveat: gid-permanence covers the TAB link;
  `range=`-links to specific cells still shift meaning if a rebuild moves rows.
  Applies to every regenerated Sheets artefact (report tabs, analysis tabs), any kit.

- **Reports in 3 variants (Vadym, 03/07/2026).** Every load-testing report must be
  producible in all three forms — they answer different questions and complement,
  not replace, each other: **1) the Google Sheets `Runs` tab** — cross-run history
  (trends between runs/builds, regressions, team/client-facing summary; the embedded
  charts auto-populate) · **2) a self-contained HTML file per run** · **3) the
  Grafana Cloud k6 dashboard**. A graceful stop (single SIGINT) still produces all
  three artefacts — k6 runs `handleSummary`, writes `--summary-export` and finalizes
  the cloud run.

- **Per-run HTML: wrap `htmlReport(data)` in try/catch.** k6 `handleSummary()` +
  [k6-reporter](https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js)
  → `results/<run-id>.html`: charts, checks, thresholds in one offline file —
  attach to an email/ticket, no accesses required. The try/catch is mandatory
  because a reporter failure must never kill the real summary — the reporter
  chokes on zero-traffic runs.

- **Grafana Cloud variant: the free tier caps test duration at 3600s.** `run.sh
  cloud` (`k6 run -o cloud`) gives time-series drill-down INSIDE one run —
  p95/p99 over time, per-tag latency, VUs overlay, side-by-side run comparison.
  ⚠️ For scenarios longer than an hour pass a `MAX_DURATION`-style override.

- **End every run report with a LINKS section (Vadym, 03/07/2026).** List every
  doc created/updated that run — the Runs tab, the HTML report, the Grafana Cloud
  run URL (cloud only), the narrative Doc, and any content/analysis docs — so the
  reader can open each without hunting.

- **Optional 4th variant — a browser link for the per-run HTML (Vadym, 09/07/2026).**
  Publishing is not a load-testing concern: the self-contained HTML goes up through the
  discipline-agnostic
  [`HTML-Reports`](../../QA-Documentation/Custom-Reports/HTML-Reports/HTML_REPORTS_RULES.md)
  kit — one shared private repo served by a static host, path `<Type>/<YYYY-MM-DD>/<file>`,
  the project name never in the domain OR the path (opaque codes / a separate
  neutrally-named site if several projects must coexist); load-testing runs publish under
  `<Type>` = `Reports`. Private (Basic Auth) by default, `public` an explicit opt-out, and
  a private publication hands the owner the document link AND the creds-file link
  together. **This kit ships no publisher copy** — call the tool from that kit (its SETUP
  §1 · Publish), and add the returned link to the run's LINKS section.

- **Host choice, Basic Auth and noindex are HTML-Reports knowledge, not load-testing
  (moved 28/07/2026).** The Cloudflare Pages reference setup (GitHub App connection, the
  `_headers` noindex, the Basic Auth middleware, Cloudflare Access), the outside-`Private/`
  exposure warning and the measured GitHub Pages / Netlify trade-offs all live in
  [`HTML-Reports SETUP`](../../QA-Documentation/Custom-Reports/HTML-Reports/SETUP.md) §0 +
  its RULES. This kit only calls the publisher and records the returned link.

- **Google-Doc narrative report per run → Drive date-folder (Vadym, 07/07/2026).**
  IN ADDITION to the 3 variants above, after every run write ONE narrative
  **Google Doc** and file it into a **Drive date-folder**
  `ClaudeProjects / <Project> / Load Testing / Reports / <YYYY-MM-DD>` (folders
  auto-created; the `ClaudeProjects` root keeps agent output out of the user's own
  Drive folders — override the root name with `DRIVE_ROOT_FOLDER`). The `Runs` tab
  stays the cross-run history; this Doc is the human-readable per-run write-up to
  attach to a ticket/email or hand to the team. ALWAYS add this Doc link to the
  run's LINKS section.

- **The narrative Doc: standard sections, idempotent re-runs.** Sections: **Purpose ·
  Run configuration · Key metrics · Bug findings (`BUG-NNN`, mark REPRODUCED where
  applicable) · Artifacts & links · Next steps**. Make it idempotent — trash any
  prior same-named Doc in the folder before recreating so re-runs don't pile up
  duplicates.

- **The narrative renderer is generic — it carries NO run data.** The kit ships
  `template/tools/write-run-doc.mjs`: you write THIS run's numbers into a JSON
  content file and point the tool at it —
  `PROJECT_NAME=<Project> RUN_DOC_CONTENT=./run-doc.json node tools/write-run-doc.mjs`
  (content shape: `template/tools/run-doc.example.json`). A project supplies its own
  content each run; nothing project-specific is baked into the tool.

## A shared link survives every rebuild

Universal invariant (Project-Configuration rule 10, owner's rule 15/07/2026): updating this
kit's artifact must keep the link the owner already shared. For this kit: the Runs tab is one fixed tab appended forever; per-run HTML keeps its results/<run-id>.html path; the narrative run doc is UPDATED IN PLACE by title (write-run-doc.mjs) — a re-run of the same run-id never changes any link.
Trash-and-recreate looks identical in the UI and silently kills every saved link; if a
carrier genuinely cannot keep its link, say so in the hand-over message.
