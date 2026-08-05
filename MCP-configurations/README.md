# MCP configurations

Single index of every MCP server used in this workspace — where it's configured, what it does, and how to re-bind it on a new machine. **§1–§6 are the MCP servers; §7–§10 are the non-MCP API integrations that share this folder** — listed here because that is where a reader looks for "how does the kit talk to service X", and an integration missing from the index is an integration a teammate never finds.

Every folder in this directory, one row each — this table is a **generated projection** of the
folder list (`kit-lint` L12 keeps it honest; a folder added without a row here fails the lint).
The two claude.ai connectors (§3, §4) are server-side and have no folder, so they live only in
their sections below.

<!-- kit:generated:integrations source=MCP-configurations -->
| Folder | § | Role |
|---|---|---|
| [`mcp-sheets/`](mcp-sheets/) | §1 | `google-sheets` local MCP server — Sheets/Drive/Docs write (source + OAuth) |
| [`figma-dev-mode/`](figma-dev-mode/) | §2 | Figma Desktop Dev-Mode MCP — guide only, the server lives in Figma.app |
| [`postman/`](postman/) | §5 | Postman remote MCP — guide only, hosted by Postman |
| [`grafana/`](grafana/) | §6 | Grafana MCP (`mcp-grafana`) — guide + gitignored service-account `.token` |
| [`mega/`](mega/) | §7 | Mega.nz evidence uploads — shell wrappers + gitignored `credentials.json` |
| [`cloudflare/`](cloudflare/) | §8 | Cloudflare Pages API token for publishing HTML reports — gitignored `.token` |
| [`redmine/`](redmine/) | §9 | Redmine REST API key for bug filing — gitignored `.token` |
| [`pagespeed/`](pagespeed/) | §10 | PageSpeed Insights API key for the PSI collector — gitignored `.token` |
<!-- /kit:generated -->

## 1. `google-sheets` — local Node server (Sheets + Drive + Docs write)

Used by every checklist generator (`*/generate_via_api.mjs`) to create / edit Google Sheets and Docs in **your** Drive via REST APIs.

| Property | Value |
|----------|-------|
| Type | Local stdio MCP server (Node) |
| Source | [`mcp-sheets/server.mjs`](mcp-sheets/server.mjs) |
| Registered in | `<workspace>/.mcp.json` (workspace root) |
| OAuth client | `mcp-sheets/credentials.json` — Google Cloud OAuth client (Desktop type) |
| OAuth token | `mcp-sheets/token.json` — bound to **owner@example.com**'s Drive |
| Re-auth | `cd mcp-sheets && node server.mjs --auth` — opens browser consent on `localhost:3456` |
| Restart after change | Yes — quit + reopen Claude Code, or run `/mcp` |

**Workspace `.mcp.json` (canonical):**
```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "node",
      "args": ["<workspace>/QA-SetupKit/MCP-configurations/mcp-sheets/server.mjs"],
      "env": {}
    }
  }
}
```

`.mcp.json` itself MUST stay at workspace root (`<workspace>/.mcp.json`) — Claude Code only discovers it from cwd. Only the server **source folder** lives here.

**This is the only copy** (Vadym, 01/07/2026 — the former duplicate inside the Checklist kit was removed). The whole `QA-SetupKit/` folder is what gets shared with teammates, so every kit references THIS folder. Setup guide for a new user: [`mcp-sheets/README.md`](mcp-sheets/README.md). Secrets (`credentials.json`, `token.json`) are gitignored here and must never be copied to a teammate — each user creates their own via `node server.mjs --auth`.

## 2. `figma-dev-mode-mcp-server` — Figma Desktop (Dev Mode)

Reads the current Figma selection / file metadata / screenshots from the running Figma Desktop app. See [`figma-dev-mode/README.md`](figma-dev-mode/README.md) for the full guide.

| Property | Value |
|----------|-------|
| Type | SSE (Server-Sent Events) — local |
| Endpoint | `http://127.0.0.1:3845/sse` |
| Process | `Figma.app` (hosts the server itself — no separate Node process) |
| Doc folder | [`figma-dev-mode/`](figma-dev-mode/) — README only, no source code |
| Registered in | `<workspace>/.mcp.json` (workspace root — same as `google-sheets`) |
| Enabled in | Figma Desktop → right sidebar → Inspect → MCP → Server status: Enabled |
| Requires | Figma Desktop running + Dev / Full seat (Professional+ plan) |
| Restart after change | Yes — quit + reopen Claude Code |

**Snippet in workspace `.mcp.json`:**
```json
"figma-dev-mode-mcp-server": {
  "type": "sse",
  "url": "http://127.0.0.1:3845/sse"
}
```

Quick smoke test from terminal: `curl -N http://127.0.0.1:3845/sse` — should stream, not `Connection refused`.

No secrets — share the snippet freely with teammates; their Figma Desktop handles their own auth.

## 3. `claude.ai Figma` connector — cloud

Read access to Figma files via claude.ai's hosted connector (separate from #2 above; useful when Figma Desktop isn't running).

| Property | Value |
|----------|-------|
| Type | Hosted (claude.ai cloud) |
| Configured at | <https://claude.ai/settings/connectors> |
| Requires | Figma OAuth sign-in (in browser) |
| File in this repo | None — server-side |

## 4. `claude.ai Google Drive` connector — cloud

Read access to Google Drive files (Docs / Sheets / etc.) via claude.ai's hosted connector. Used for reading shared spec docs.

| Property | Value |
|----------|-------|
| Type | Hosted (claude.ai cloud) |
| Configured at | <https://claude.ai/settings/connectors> |
| Requires | Google OAuth sign-in (in browser) |
| File in this repo | None — server-side |

## 5. `postman` — Postman remote MCP (read collections for load/API testing)

Reads Postman **collections, environments and example requests** so a test harness (e.g. the k6 load tests in `<Project>/Load-Testing/`, or the API-testing kit) can be generated from the real API definitions instead of guessing endpoints. See [`postman/README.md`](postman/README.md) for the full guide (exposed tools, read workflow, failure modes, sharing).

| Property | Value |
|----------|-------|
| Type | Remote streamable HTTP (hosted by Postman) |
| Endpoint (US) | `https://mcp.postman.com/mcp` — Full mode (`/minimal` = fewer tools, `/code` = code mode) |
| Endpoint (EU) | `https://mcp.eu.postman.com/mcp` — EU data residency |
| Doc folder | [`postman/`](postman/) — README only, no source code |
| Registered in | `<workspace>/.mcp.json` (workspace root) |
| Auth (US) | **OAuth** — run `/mcp` → `postman` → Authenticate → browser consent. No API key needed. |
| Auth (EU / local) | API key **required** — Postman → Settings → API keys → add header `Authorization: Bearer <key>` |
| Restart after change | Yes — quit + reopen Claude Code, then `/mcp` to Authenticate |

**Snippet in workspace `.mcp.json` (US, OAuth):**
```json
"postman": {
  "type": "http",
  "url": "https://mcp.postman.com/mcp"
}
```

EU / API-key variant and everything else: [`postman/README.md`](postman/README.md). No source code in this repo — it's a hosted server; the OAuth session / API key is per-user, so teammates authenticate with their own Postman account.

## 6. `grafana` — Grafana MCP (`mcp-grafana`, read dashboards/metrics)

Reads a Grafana instance — dashboards, datasources, Prometheus/Loki metrics, renders panels to PNG. Closes the load-testing loop: k6 streams runs into Grafana Cloud, this MCP reads them back for reporting. **Opt-in** (needs a service-account token) — full guide in [`grafana/README.md`](grafana/README.md).

| Property | Value |
|----------|-------|
| Type | Local process (stdio; `sse`/`streamable-http` on 8000) — **no hosted URL** |
| Command | `uvx mcp-grafana` (or Docker / binary / `go install`) |
| Target | `GRAFANA_URL` = `http://localhost:3000` (local) or `https://<slug>.grafana.net` (Cloud) |
| Doc folder | [`grafana/`](grafana/) — README only, no source code |
| Auth | `GRAFANA_SERVICE_ACCOUNT_TOKEN` / `..._TOKEN_FILE` — made in Grafana **Admin → Service accounts** |
| Registered in | `<workspace>/.mcp.json` — **live** (token via `GRAFANA_SERVICE_ACCOUNT_TOKEN_FILE` → gitignored [`grafana/.token`](grafana/)); kept OUT of `.mcp.json.template` — needs a per-user token |
| Restart after change | Yes — quit + reopen Claude Code, then `/mcp` |

**Snippet (Cloud, token via gitignored file — as configured live):**
```json
"grafana": {
  "command": "uvx",
  "args": ["mcp-grafana"],
  "env": {
    "GRAFANA_URL": "https://<grafana-stack>.grafana.net",
    "GRAFANA_SERVICE_ACCOUNT_TOKEN_FILE": "<workspace>/QA-SetupKit/MCP-configurations/grafana/.token"
  }
}
```
Verified live 01/07/2026: `list_datasources` → 13 sources incl. **`grafanacloud-k6`** (k6 cloud runs) and `grafanacloud-prom`. Full guide + current-setup details: [`grafana/README.md`](grafana/README.md).

---

## Non-MCP integrations (§7–§10) — same folder, same secret convention

The four below are plain HTTPS APIs (or a CLI wrapper) that kit tools call directly: nothing about them goes into `.mcp.json`, and no Claude Code restart is involved. They share one convention — **one folder per service, one gitignored secret the owner writes himself, one README** — so the setup reads the same way every time. No secret travels with the kit and none is ever pasted into chat; each teammate creates their own by the steps in the folder's README. All four are opt-in: set up only the one the task at hand needs.

## 7. `mega` — Mega.nz evidence uploads

Uploads QA evidence (screenshots, screen recordings) and prints a public shared link. `--evidence` writes the canonical host-side layout `Attachments/<Project>/<Screenshots|Screen records>/<dd.mm.yyyy>/`, which external tracker tickets link to instead of carrying attachments. Full guide: [`mega/README.md`](mega/README.md).

| Property | Value |
|----------|-------|
| Type | Shell wrapper around MEGAcmd (`brew install megacmd`) — no server, nothing in `.mcp.json` |
| Source | [`mega/mega-upload.sh`](mega/mega-upload.sh), [`mega/mega-auth.sh`](mega/mega-auth.sh) |
| Secret | `mega/credentials.json` — account email + password; gitignored, the owner writes it himself |
| One-time auth | `./mega-auth.sh` — logs in, session persists in `~/.megaCmd`; re-run only after an explicit logout or a password change |
| Usage | `./mega-upload.sh <file> <remote-folder> [--name <name>]` — **the remote folder is required, there is no default** (a placeholder default silently misfiled uploads into a literal placeholder folder; removed 28/07/2026). `--check` prints account + storage |
| Used by | evidence flow in [`EMULATOR_RULES.md`](../Testing-Types/App-Emulators-configurations/EMULATOR_RULES.md) §6; the `--upload` hook of the PageSpeed report renderer `psi-report.mjs` |

## 8. `cloudflare` — API token for Pages (publishing HTML reports)

A token, not a server: the HTML-Reports kit uses it against the Cloudflare REST API / wrangler to manage the Pages project that serves published QA reports (create/configure the project, read deployments). Full guide: [`cloudflare/README.md`](cloudflare/README.md).

| Property | Value |
|----------|-------|
| Type | Cloudflare REST API token |
| Doc folder | [`cloudflare/`](cloudflare/) — README only, no source code |
| Secret | `cloudflare/.token`, gitignored — plus `cloudflare/basic-auth.txt` (also gitignored) when a published report is password-protected |
| Created at | dash.cloudflare.com → My Profile → API Tokens → Create Token → Custom token → Permissions **Account · Cloudflare Pages · Edit**, scoped to your account |
| Consumed as | `CLOUDFLARE_API_TOKEN` |
| Used by | [`HTML_REPORTS_RULES.md`](../QA-Documentation/Custom-Reports/HTML-Reports/HTML_REPORTS_RULES.md) — the repo and site URL are per-user env (`QA_DOCS_REPO_DIR`, `QA_DOCS_BASE_URL`), never hardcoded in the kit |

## 9. `redmine` — team bug tracker over its REST API

Files and updates bugs on a Redmine board from per-bug JSON specs, so the tracker ticket and the internal QA Sheet render from the same source. The instance URL is a per-team value. The workflow itself (Textile format, dedup against the board, evidence links, the post-only-on-request gate) lives in [`REDMINE_WORKFLOW.md`](../QA-Documentation/Bug-Reports/REDMINE_WORKFLOW.md); folder guide: [`redmine/README.md`](redmine/README.md).

| Property | Value |
|----------|-------|
| Type | Redmine REST API, personal API key |
| Doc folder | [`redmine/`](redmine/) — README only, no source code |
| Secret | `redmine/.token` — the API key, ONE line, gitignored; the owner pastes it himself |
| Created at | `<redmine-host>/my/account` → right sidebar → **API access key** → *Show* |
| Consumed as | header `X-Redmine-API-Key: <key>` on every request |
| Used by | [`Bug-Reports/template/tools/redmine-bug.mjs`](../QA-Documentation/Bug-Reports/template/tools/redmine-bug.mjs) |
| Verify | `curl -s -H "X-Redmine-API-Key: $(cat .token)" https://<redmine-host>/users/current.json` |

## 10. `pagespeed` — PageSpeed Insights API key

A free Google API key for the PageSpeed collector. Anonymous calls do not work in practice — the shared quota is exhausted and the API answers `429 Quota exceeded` — so the collector requires a key of its own and **refuses to run without one rather than reporting zeros**. Full guide, including the 2-minute key flow: [`pagespeed/README.md`](pagespeed/README.md).

| Property | Value |
|----------|-------|
| Type | Google PageSpeed Insights API key (free, no billing) |
| Doc folder | [`pagespeed/`](pagespeed/) — README only, no source code |
| Secret | `pagespeed/.token` — the key, one line, no quotes; gitignored |
| Created at | Google Cloud Console → APIs & Services → Library → *PageSpeed Insights API* → Enable → Credentials → API key (restrict it to that one API) |
| Read order | `PSI_API_KEY` → the file named by `PSI_API_KEY_FILE` → the default path above |
| Quota with a key | 25,000 queries/day, 240/minute — far above a report round (pages × platforms × runs) |
| Used by | the [PageSpeed-report](../QA-Documentation/Custom-Reports/PageSpeed-report/) collector `psi-run.mjs` |

---

## Reusing this canonical folder from another project (Vadym's machine)

When you start a new project anywhere on this machine that needs the same MCPs, **do not copy `mcp-sheets/` into it**. Point a fresh `.mcp.json` at THIS folder instead — one OAuth token, one `node_modules/`, no drift.

Steps for a new project at, say, `~/Code/NewThing/`:

1. Copy [`.mcp.json.template`](.mcp.json.template) → `~/Code/NewThing/.mcp.json`, then **replace the `/ABSOLUTE/PATH/TO/` placeholder** with the real absolute path to `server.mjs` on your machine (the template ships anonymized — same instruction as [mcp-sheets/README §4](mcp-sheets/README.md); the Figma SSE snippet is already in place).
2. Open `~/Code/NewThing/` in Claude Code (or your IDE) → approve the project-scoped `.mcp.json` trust prompt on first launch.
3. Done — `/mcp` should show both `google-sheets` and `figma-dev-mode-mcp-server` connected, using the same Drive account as this workspace.

If the absolute path here ever moves, update both `<workspace>/.mcp.json` AND [`.mcp.json.template`](.mcp.json.template) so future projects keep working.

For teammate handoffs (different machine / different Google account) the flow is the same canonical folder: the teammate clones the whole `QA-SetupKit/`, then follows [mcp-sheets/README §First-time setup](mcp-sheets/README.md) to create their OWN OAuth client and token. There is no separate server copy to hand out — the former duplicate inside the Checklist kit was deliberately removed (see the note above: this folder is the only copy).

---

## New-machine bootstrap order

1. **Clone the workspace** (the whole `QA-SetupKit/` — the kit is the unit of sharing; there is no smaller starter bundle with its own server copy).
2. **`google-sheets`** (this folder):
   - `cd QA-SetupKit/MCP-configurations/mcp-sheets && npm install`
   - Create your own OAuth client in Google Cloud Console (Desktop type), download as `credentials.json` into `mcp-sheets/`.
   - `node server.mjs --auth` → browser consent → writes `token.json` bound to YOUR Google account.
   - Verify `<workspace>/.mcp.json` absolute path matches your clone location.
3. **`figma-dev-mode-mcp-server`**: enable toggle in Figma Desktop → snippet is already in workspace `.mcp.json` (§2), nothing else to add.
4. **claude.ai connectors** (§3, §4): one-time OAuth in browser.
5. Quit + reopen Claude Code → `/mcp` to confirm all servers `connected`.
6. **§7–§10 are deliberately NOT part of this bootstrap** — set one up the first time a kit asks for it (evidence upload, report publishing, bug filing, a PageSpeed round). Each is one gitignored secret file created from its own folder README, and none of them needs a restart.

## Useful checks

```bash
# Is the workspace MCP file pointing at this folder?
grep mcp-sheets <workspace>/.mcp.json

# Can the server start standalone?
node <workspace>/QA-SetupKit/MCP-configurations/mcp-sheets/server.mjs --help 2>&1 | head -5

# Is Figma MCP listening?
curl -N http://127.0.0.1:3845/sse | head -3
```
