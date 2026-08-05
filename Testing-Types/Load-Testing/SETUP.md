# Load-Testing kit — SETUP (for Claude)

**Audience: Claude running in a teammate's IDE** who added the shared `QA-SetupKit/`
folder and wants to set up the same k6 load-testing configuration **for their own
project**. Follow this top to bottom. Nothing here is specific to <Project> — the
concrete, filled-in example lives in `<workspace>/<Project>/Load-Testing/` on the author's
machine (not shipped in this kit).

> Golden rule: **test staging/dev only, never production.** LLM-backed or paid APIs
> cost money per request — start with the smoke test, cap stress `PEAK`.

---

## 0. Auto-detection (run FIRST)

Check what's already present and only set up what's missing:

| Need | Check | If missing → |
|------|-------|--------------|
| **k6** | `k6 version` | §1 install |
| **Postman MCP** | `.mcp.json` has a `postman` entry AND `/mcp` shows it `connected` | §2 connect |
| **Node** (for the user seeder, optional) | `node -v` | install Node 18+ |
| **Grafana Cloud** (optional, for dashboards) | `k6 cloud login -s` shows a token | §5 |
| **Target API's Postman collection** | ask the user which workspace/collection | — |

If a prerequisite is missing, STOP and walk the user through the relevant section
below — don't silently improvise endpoints.

---

## 1. Install k6

```bash
brew install k6        # macOS
# linux: see https://grafana.com/docs/k6/latest/set-up/install-k6/
```
Verify: `k6 version`.

Why k6 (not JMeter): plain-JS scenarios (version-controllable, CI-friendly),
first-class p95/p99 + custom metrics, no GUI/JVM. Locust (Python) is the fallback for
very code-heavy user flows.

---

## 2. Connect the Postman MCP (so Claude reads the real API)

The Postman MCP is a **hosted remote server** — no local source, per-user auth. It
lets Claude read the target API's Postman collection (endpoints, auth, bodies,
environments) instead of guessing.

1. Add it to the project/workspace `.mcp.json` (canonical snippet:
   [`../../MCP-configurations/README.md`](../../MCP-configurations/README.md) §5):
   ```json
   {
     "mcpServers": {
       "postman": { "type": "http", "url": "https://mcp.postman.com/mcp" }
     }
   }
   ```
   - **US account:** URL above, auth via **OAuth** (no API key).
   - **EU account:** use `https://mcp.eu.postman.com/mcp` and a Postman **API key**
     (mandatory on EU + local) sent as `Authorization: Bearer <key>`.
2. **Restart Claude Code** — MCP servers are only loaded at startup. Approve the trust
   prompt.
3. `/mcp` → **postman** → **Authenticate** → finish the browser flow.
4. Confirm `/mcp` shows `postman` = `connected`.

Then, to read the API: ask the user which Postman **workspace** + **collection** hold
their API, and use the Postman MCP tools (`getWorkspaces` → `getCollections` →
`getCollection model:full` → `getEnvironments`/`getEnvironment`) to extract base URL,
auth scheme, endpoints, request bodies and example responses.

> No Postman collection? You can still write scenarios from an OpenAPI spec or by
> asking the user for the endpoints — but Postman-MCP-driven is the intended path.

---

## 3. Scaffold the harness for THIS project

1. Copy the template into the project's parent folder as `<Project>/Load-Testing/`
   (per-project convention: one `<Project>/` folder at the workspace root, one subfolder
   per testing type — see `QA-SetupKit/Rules-Guide/Project-Configuration/`):
   ```bash
   mkdir -p <workspace>/<Project>
   cp -R QA-SetupKit/Testing-Types/Load-Testing/template <workspace>/<Project>/Load-Testing
   cd <workspace>/<Project>/Load-Testing && chmod +x run.sh
   ```
2. Fill in the TODOs using what you read from Postman:
   - **`config.js`** — `BASE_URL` (staging/dev), `AUTH_MODE`
     (`none|static|login|firebase`), auth fields, real `createPayload()`, thresholds
     tuned to the agreed SLA.
   - **`lib/auth.js`** — usually no edits; pick the `AUTH_MODE` in config. It supports
     a static token, a login endpoint, or Firebase, plus an optional user pool.
   - **`scenarios/*.js`** — replace placeholder paths (`/items`, `/items/:id/status`)
     with the real endpoints, and match the real flow: **synchronous** (create returns
     the result), **async** (create returns an id → poll status → fetch result), or
     **SSE**. The templates assume async; delete the poll block if sync.
3. **Confirm the flow shape and targets with the user** before running: sync vs async
   vs SSE, target concurrent users (VUS), latency SLA (p95/p99), acceptable error rate.

### Per-account limits → user pool (if applicable)
If the API caps resources per user (rate limits, "N active jobs", quotas), bind
**1 VU = 1 account**: provide a gitignored `users.json`
(`[{"email","password"}, ...]`, see `users.example.json`) and run with
`-e USERS_FILE=$PWD/users.json`. If there's a dev "create test user" endpoint, finalize
the two TODOs in `seed-users.mjs` and let it generate the pool automatically.

---

## 4. Run (two methods)

```bash
# Sanity first — 1 VU
./run.sh local scenarios/smoke.js

# Load — ramp to target
./run.sh local scenarios/load.js  -e VUS=20

# Stress — find the breaking point (start small!)
./run.sh local scenarios/stress.js -e PEAK=50
```
`local` = free & unlimited, terminal output. `cloud` = same run streamed to Grafana
dashboards (see §5). Progression is always **smoke → load → stress**.

---

## 5. Grafana Cloud dashboards (optional)

Nice web charts + sharing. Compute stays local; only metric ingest counts toward the
free tier.

1. Create a free **Grafana Cloud** account → open your **stack** (`https://<slug>.grafana.net`).
2. In the stack: **Testing & synthetics → Performance → Settings → Access →
   Personal token** → copy it. Note your stack slug.
3. Authenticate the CLI once (keeps the token in k6's config, not git):
   ```bash
   k6 cloud login --token <TOKEN> --stack https://<slug>.grafana.net
   ```
4. Stream a run: `./run.sh cloud scenarios/load.js -e VUS=20` → the run appears in the
   k6 app with graphs. (`.../a/k6-app/runs/<id>`.)

> Treat the token as a secret — don't paste it in chat or commit it. `k6 cloud login`
> stores it locally.

---

## 6. Report

Report throughput, p95/p99 (heavy vs light via tags), concurrency ceiling, breaking
point + recovery. File failures/regressions as `BUG-NNN` in the team's QA Google Sheet,
same convention as the checklist/emulator kits. Keep `users.json`, tokens and result
artifacts **out of git**.

---

See [`LOAD_TESTING_RULES.md`](LOAD_TESTING_RULES.md) for the condensed rules to paste
into the workspace `CLAUDE.md`, and [`README.md`](README.md) for the concept overview.

## Publishing HTML reports

The k6-reporter HTML run report is published like any other QA HTML — through the
**discipline-agnostic** publisher, now its own kit:
[`QA-Documentation/Custom-Reports/HTML-Reports/`](../../QA-Documentation/Custom-Reports/HTML-Reports/SETUP.md).

The publisher lives in that kit and is called from there — this template does NOT ship a copy
(a doc that promised a `tools/publish-report.sh` symlink the scaffold never created sent a fresh
teammate to a missing file; corrected 28/07/2026):

```bash
QA_SETUPKIT=/path/to/your/QA-SetupKit   # the absolute path of your kit clone
PUB="$QA_SETUPKIT/QA-Documentation/Custom-Reports/HTML-Reports/template/tools/publish-report.sh"
"$PUB" results/2026-07-12-load.html Reports          # private (Basic Auth) by default
"$PUB" results/2026-07-12-load.html Reports public   # explicitly public

# optional convenience — link it into this project's tools/ once, then call ./tools/publish-report.sh
ln -s "$PUB" tools/publish-report.sh
```

Needs `QA_DOCS_REPO_DIR` + `QA_DOCS_BASE_URL` (fail-closed); full rules and one-time host setup:
[`HTML-Reports/HTML_REPORTS_RULES.md`](../../QA-Documentation/Custom-Reports/HTML-Reports/HTML_REPORTS_RULES.md).

