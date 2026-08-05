# `postman` — Postman remote MCP

Hosted MCP server run **by Postman** — exposes your Postman **workspaces, collections,
environments, requests and example responses** so Claude can read a real API contract
(endpoints, auth, bodies, staging env) instead of guessing. Used by the API-testing and
load-testing kits to build test harnesses from the real definitions.

Like `figma-dev-mode/`, **this folder has no source code, no credentials** — the server
is hosted by Postman. It exists only to document the integration alongside the other MCPs.

## What's registered where

| Property | Value |
|----------|-------|
| Type | Remote streamable HTTP (hosted by Postman) |
| Endpoint (US) | `https://mcp.postman.com/mcp` — Full mode (`/minimal` = fewer tools, `/code` = code mode) |
| Endpoint (EU) | `https://mcp.eu.postman.com/mcp` — EU data residency |
| Registered in | `<workspace>/.mcp.json` (workspace root, project-scoped) |
| Auth (US) | **OAuth** — `/mcp` → `postman` → Authenticate → browser consent. No API key. |
| Auth (EU / local) | API key **required** — Postman → Settings → API keys → `Authorization: Bearer <key>` header |
| Restart after change | Yes — quit + reopen Claude Code, then `/mcp` to Authenticate |
| Docs | <https://learning.postman.com/docs/reference/postman-api/postman-mcp-server/postman-mcp-remote-server> |

Project-scoped snippet (already merged into the workspace `.mcp.json`) — **US, OAuth:**
```json
"postman": {
  "type": "http",
  "url": "https://mcp.postman.com/mcp"
}
```

**EU / API-key variant** (also works on US if you prefer a key over OAuth):
```json
"postman": {
  "type": "http",
  "url": "https://mcp.eu.postman.com/mcp",
  "headers": { "Authorization": "Bearer ${POSTMAN_API_KEY}" }
}
```

> Not sure US vs EU? If `https://mcp.postman.com/mcp` authenticates via OAuth, you're on
> US. If it rejects you, switch to the EU URL + API key.

## Enabling / authenticating

1. Ensure the snippet above is in the workspace `.mcp.json` (it is).
2. **Restart Claude Code** — remote MCP servers are only loaded at startup. Approve the
   project-scoped trust prompt.
3. `/mcp` → **postman** → **Authenticate** → finish the browser OAuth (US), or confirm
   the API key is picked up (EU).
4. Confirm `/mcp` shows `postman` = **connected**.

## Exposed tools (the ones we actually use)

Once connected, Claude reads an API by walking:

| Tool | Purpose |
|------|---------|
| `getAuthenticatedUser` | Resolve your user / team id (for "my workspaces"). |
| `getWorkspaces` | List workspaces (filter by `createdBy` = your id). |
| `getCollections` | Collections in a workspace (needs the workspace id). |
| `getCollection` | Full collection: endpoints, methods, headers, auth, bodies, test scripts (`model: "full"`). |
| `getEnvironments` / `getEnvironment` | Environment variables — base URL, tokens (⚠️ often blank on Dev). |
| `searchPostmanElements` | Search across accessible Postman elements. |

Typical read: `getAuthenticatedUser` → `getWorkspaces` → `getCollections{workspace}` →
`getCollection{collectionId, model:"full"}` → `getEnvironment{environmentId}`. Extract
base URL, auth scheme, per-endpoint method/path/body, response shapes — then hand off to
the API-testing or load-testing kit.

## Failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `postman` missing in `/mcp` | Snippet not in `.mcp.json`, or no restart | Add snippet, fully restart Claude Code. |
| Stuck "authenticating" (US) | OAuth blocked by corporate SSO | Use the EU URL + API-key header instead. |
| 401 / unauthorized on calls | Not authenticated or key missing/expired | Re-run `/mcp` → Authenticate, or refresh the API key. |
| Reads work but `base_url` blank | Collection uses a placeholder; real URL lives in an empty Dev environment | Ask the user for the staging/dev base URL. |
| Server dropped after adding another MCP | Adding servers can need a restart + re-Authenticate | Restart, `/mcp` → Authenticate. |

## Sharing with teammates

The JSON snippet is **safe to share** — no secrets, no machine-specific paths; it lives
in the project-scoped `<workspace>/.mcp.json`. Each
teammate authenticates with **their own** Postman account (OAuth on US, or their own API
key on EU) — the session/key is per-user and never travels in git.
