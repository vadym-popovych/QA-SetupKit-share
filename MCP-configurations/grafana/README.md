# `grafana` — Grafana MCP (`mcp-grafana`)

Official Grafana MCP server. Lets Claude read/query a Grafana instance — **dashboards,
datasources, Prometheus/Loki metrics, annotations, incidents/alerting** — and render
panels to PNG. Closes the load-testing loop: k6 streams runs into Grafana Cloud
(`../../Testing-Types/Load-Testing/`), and this MCP lets Claude read those dashboards/metrics back and
fold them into a report.

Unlike Postman/Figma there is **no hosted remote URL** — you run the `mcp-grafana`
process **locally** and just point it at the target instance:
- **Local Grafana:** `GRAFANA_URL=http://localhost:3000`
- **Grafana Cloud (their admin):** `GRAFANA_URL=https://<stack-slug>.grafana.net`

Same binary, same auth (a **service account token**); only the URL + where you make the
token differ. This folder documents the integration — **no source, no secrets** (the
token is passed at runtime / via env, never committed).

## What's registered where

| Property | Value |
|----------|-------|
| Type | Local process, stdio by default (also `sse` / `streamable-http` on port 8000) |
| Command | `uvx mcp-grafana` (needs [`uv`](https://docs.astral.sh/uv/)); or Docker / binary / `go install` |
| Target (local) | `GRAFANA_URL=http://localhost:3000` |
| Target (cloud) | `GRAFANA_URL=https://<stack-slug>.grafana.net` (e.g. our `<grafana-stack>`) |
| Auth | `GRAFANA_SERVICE_ACCOUNT_TOKEN=<token>` (preferred; `GRAFANA_API_KEY` is deprecated) |
| Optional | `GRAFANA_ORG_ID` (multi-org), `GRAFANA_SERVICE_ACCOUNT_TOKEN_FILE` (re-read per request, for rotation) |
| Registered in | workspace `<workspace>/.mcp.json` — **live on this machine** (see "Current live setup"); kept out of `.mcp.json.template` because it needs a token |
| Restart after change | Yes — quit + reopen Claude Code, then `/mcp` |
| Docs | <https://github.com/grafana/mcp-grafana> |

## Current live setup (Vadym's machine, 01/07/2026) ✅

Configured and verified connected. What's in place:

- **`.mcp.json` entry** (workspace root) — `uvx mcp-grafana`, `GRAFANA_URL` =
  `https://<grafana-stack>.grafana.net`, and the token supplied via
  **`GRAFANA_SERVICE_ACCOUNT_TOKEN_FILE`** pointing at `.token` in THIS folder
  (file-based so the secret never sits inside the JSON; re-read on every request →
  token rotation works without restart).
- **`.token`** — service-account token created in the stack's *Administration → Users
  and access → Service accounts*; written by Vadym himself (`printf '%s' '<token>' > .token`,
  `chmod 600`), so it never passed through chat. **Gitignored** via [`.gitignore`](.gitignore).
- **Binary support confirmed**: the shipped `mcp-grafana` binary reads
  `GRAFANA_SERVICE_ACCOUNT_TOKEN_FILE` (checked via `strings` before wiring it up).
- **Live check passed**: `list_datasources` returned the stack's 13 datasources,
  including **`grafanacloud-k6`** (`k6-datasource` — where our k6 cloud runs land),
  `grafanacloud-prom` (Prometheus, default), Loki, Tempo, Pyroscope.

This closes the load-testing loop: k6 `./run.sh cloud ...` streams a run into the stack →
Claude reads the results back through this MCP (k6 datasource / PromQL) → report.

## Install (pick one)

```bash
# A) uvx (recommended — needs `uv`: brew install uv)
uvx mcp-grafana --help

# B) Docker
docker pull grafana/mcp-grafana

# C) Go
GOBIN="$HOME/go/bin" go install github.com/grafana/mcp-grafana/cmd/mcp-grafana@latest
```

## Get a service account token

**Grafana Cloud (their admin):** open your stack → **Administration → Users and access →
Service accounts** → **Add service account** → role (start with *Viewer*; *Editor* for
render/query) → **Add token** → copy it.
**Local Grafana:** same path under **Administration → Service accounts**.

> The token is a secret — don't paste it in chat or commit it. Prefer env / a token file.

## `.mcp.json` snippet (opt-in; add to workspace root `<workspace>/.mcp.json`)

Point at Grafana Cloud (our stack) — token supplied via env, not inline:
```json
"grafana": {
  "command": "uvx",
  "args": ["mcp-grafana"],
  "env": {
    "GRAFANA_URL": "https://<grafana-stack>.grafana.net",
    "GRAFANA_SERVICE_ACCOUNT_TOKEN": "${GRAFANA_SERVICE_ACCOUNT_TOKEN}"
  }
}
```
For a local instance swap `GRAFANA_URL` to `http://localhost:3000`. Export the token in
your shell (`export GRAFANA_SERVICE_ACCOUNT_TOKEN=...`) or use
`GRAFANA_SERVICE_ACCOUNT_TOKEN_FILE` instead of inlining it.

Then: **restart Claude Code** → `/mcp` shows `grafana` = connected.

## Transport modes

| Mode | Use | Port |
|------|-----|------|
| `stdio` (default) | Local Claude Code integration | — |
| `sse` | Remote HTTP | 8000 |
| `streamable-http` | Multi-client HTTP | 8000 |

Launch non-stdio with `-t`: `mcp-grafana -t streamable-http`.

## Exposed tools (highlights)

- **Dashboards:** search, get by UID, summaries, deeplinks, render panel/dashboard → PNG.
- **Datasources:** list / query. Panel queries are disabled by default
  (`--enabled-tools runpanelquery`).
- **Metrics:** Prometheus (PromQL, metadata, histogram percentiles), Loki (LogQL, labels,
  log patterns). This is where **k6 Cloud run metrics** live, so Claude can read p95/p99
  etc. back out.
- **Ops:** incidents, alerting rules/routing, OnCall, annotations, snapshots.
- Some categories are off by default — enable with `--enabled-tools admin,clickhouse,...`.

## Failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `grafana` missing in `/mcp` | Snippet not added, or no restart | Add snippet, fully restart Claude Code. |
| `command not found: uvx` | `uv` not installed | `brew install uv`, or use the Docker/binary variant. |
| 401 / forbidden | Token missing/expired or too little RBAC | Recreate the service-account token; raise its role. |
| Connects but no data | Wrong `GRAFANA_URL` or org | Verify the stack URL (`https://<slug>.grafana.net`) and `GRAFANA_ORG_ID`. |

## Sharing with teammates

The snippet is shareable (no secrets), but each teammate points `GRAFANA_URL` at **their
own** stack and supplies **their own** service-account token via env. Kept out of
`.mcp.json.template` on purpose so no one inherits a token-less broken entry.
