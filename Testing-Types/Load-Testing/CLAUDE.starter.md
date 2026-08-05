# CLAUDE.starter — Load-Testing kit

Copy the block below into your workspace `CLAUDE.md` (once) after adding the shared
`QA-SetupKit/` folder to your IDE. It tells your Claude to use this kit for any
load/stress-testing request in your own project.

---

## API load / stress testing — Load-Testing kit

- When I ask to **load test / stress test an API**, find its **breaking point**, or
  measure **p95/p99 under load** → follow
  [`QA-SetupKit/Testing-Types/Load-Testing/SETUP.md`](QA-SetupKit/Testing-Types/Load-Testing/SETUP.md).
  Run its **Auto-detection first**; if k6, the Postman MCP, or the target Postman
  collection is missing, walk me through SETUP before writing anything.
- **k6 is the tool** (`brew install k6`) — never default to JMeter.
- **Read my API via the Postman MCP** (endpoints/auth/bodies/staging) before writing
  scenarios — don't invent endpoints. New MCP → restart Claude Code + `/mcp` → Authenticate.
- **Staging/dev only, never production.** Smoke test first, cap stress `PEAK`, back off
  on 429/409. Confirm sync/async/SSE + target VUs + SLA with me first.
- **Scaffold from `QA-SetupKit/Testing-Types/Load-Testing/template/`** into `<Project>/Load-Testing/` and
  fill the TODOs. Progression: smoke → load → stress.
- **Two run methods** via `run.sh`: `local` (free/unlimited) and `cloud`
  (`k6 run -o cloud` → Grafana Cloud dashboards, one-time `k6 cloud login`).
- **Secrets never in git** (`users.json`, tokens); pass at runtime via `-e KEY=value`.
- **Report** p95/p99, concurrency ceiling, breaking point; file failures as `BUG-NNN`.
- **After EVERY run, append a row to the `Runs` tab** of the project's report Sheet
  (run id, scenario, VUs, error rate, p95 per endpoint, e2e metric, 409/402/429/5xx,
  thresholds, link, verdict). Use `--summary-export`; the tab's embedded charts
  auto-populate from the columns. Aborted runs get a row too, marked as aborted.
  Apply **text wrap to the whole tab** (headers + data) on every Sheets artefact.
  **Optional: publish the HTML run report to a browser link** — the publisher is its own
  discipline-agnostic kit (`QA-Documentation/Custom-Reports/HTML-Reports/`), NOT part of
  Load-Testing, and this kit ships no copy of it: read
  `HTML-Reports/HTML_REPORTS_RULES.md` and call its `publish-report.sh`. Two things hold
  whatever you publish: it is **private by default** (an explicit `public` argument opts
  out), and a password-protected publication hands the owner the document link and the
  credentials-file link **together** — one without the other is not a delivery. The open
  part of the site is link-accessible, so dev/test-stand data only, never production.
  **Recreated tabs pin a FIXED gid**: idempotent delete+`addSheet` builders must pass
  a constant `addSheet.properties.sheetId` (and look up the stale copy by gid OR
  title) — otherwise every rebuild mints a new gid and all shared `#gid=...` links die.
- **Reports come in 3 variants:** Sheets `Runs` tab (cross-run trends) + per-run
  self-contained HTML (`handleSummary()` + k6-reporter → `results/<run-id>.html`) +
  Grafana Cloud dashboard (`run.sh cloud`; free tier caps tests at 3600s).
- **Plus a Google-Doc narrative report per run**, filed into a Drive date-folder
  `ClaudeProjects/<Project>/Load Testing/Reports/<YYYY-MM-DD>` (folders auto-created;
  root name overridable via `DRIVE_ROOT_FOLDER`): Purpose ·
  Run config · Key metrics · Bug findings (`BUG-NNN`, mark REPRODUCED) · Artifacts
  & links · Next steps. Idempotent (trash prior same-named Doc). Render it with the
  kit's generic `write-run-doc.mjs` (`PROJECT_NAME` + `RUN_DOC_CONTENT=./run-doc.json`
  — the tool carries no run data; see `run-doc.example.json`). Add the Doc link to LINKS.

The full condensed rules live in
[`QA-SetupKit/Testing-Types/Load-Testing/LOAD_TESTING_RULES.md`](QA-SetupKit/Testing-Types/Load-Testing/LOAD_TESTING_RULES.md).
