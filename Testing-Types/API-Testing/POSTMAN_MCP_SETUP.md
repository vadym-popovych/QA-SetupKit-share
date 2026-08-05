# Postman MCP — setup (start here)

The **Postman MCP** lets Claude read your API's real Postman collection — endpoints,
auth scheme, request bodies, environments, example responses — so tests are built from
the actual contract instead of guesses. This is the first thing to set up before any
API test work.

> One Postman MCP connection serves both this **API-Testing** kit and the
> **Load-Testing** kit. If you already connected it for load testing, skip to §4
> (Verify) and §5 (Read a collection).

---

## 0. Auto-detection (check first)

| Check | Command / where | If missing → |
|-------|-----------------|--------------|
| MCP registered | `.mcp.json` has a `postman` entry | §1 |
| MCP connected | `/mcp` shows `postman` = `connected` | §2–3 |
| Which collection | ask the user for the Postman **workspace** + **collection** name | §5 |

---

## 1. Register the server in `.mcp.json`

The Postman MCP is a **hosted remote server** (no local source, per-user auth). Add it
to the project (or workspace) `.mcp.json`:

```json
{
  "mcpServers": {
    "postman": { "type": "http", "url": "https://mcp.postman.com/mcp" }
  }
}
```

- **US account:** URL above, auth via **OAuth** (no API key needed).
- **EU account:** use `https://mcp.eu.postman.com/mcp` **and** a Postman **API key**
  (mandatory on EU + local), sent as an `Authorization: Bearer <key>` header. Get a key
  from Postman → *Settings → API keys*.

Canonical per-MCP guide (tools, read workflow, failure modes):
[`../../MCP-configurations/postman/README.md`](../../MCP-configurations/postman/README.md).
Index entry + ready-to-copy `.mcp.json.template`:
[`../../MCP-configurations/README.md`](../../MCP-configurations/README.md) §5.

> Not sure US vs EU? If `https://mcp.postman.com/mcp` authenticates via OAuth, you're
> on US. If it rejects you, switch to the EU URL + API key.

## 2. Restart Claude Code

New MCP servers are only loaded **at startup**. Fully restart Claude Code (not just a
new window), and approve the project-scoped MCP trust prompt.

## 3. Authenticate

Run **`/mcp`** → select **postman** → **Authenticate** → complete the browser flow
(OAuth), or confirm the API key is picked up (EU).

## 4. Verify

`/mcp` should show `postman` = **connected**. Quick sanity via the MCP tools:
`getAuthenticatedUser` (returns your user/team) → then `getWorkspaces`.

## 5. Read a collection (the actual starting point)

Ask the user which **workspace** + **collection** hold the API, then walk the MCP:

1. `getWorkspaces` (filter by `createdBy` = your user id) → find the workspace ID.
2. `getCollections { workspace }` → find the collection ID.
3. `getCollection { collectionId, model: "full" }` → full endpoints, methods, headers,
   auth, request bodies, test scripts.
4. `getEnvironments { workspace }` → `getEnvironment { environmentId }` → base URL and
   variables (⚠️ these are often **empty on Dev** — confirm the real staging/dev base
   URL with the user if so).

From that, extract for the test suite: **base URL, auth scheme, per-endpoint
method/path/body, and the response shapes**. Then build CRUD / flow / contract checks
(scope in [`README.md`](README.md)) — the round flow and the runnable suite template are in
[`SETUP.md`](SETUP.md).

---

## Troubleshooting

- **`postman` not in `/mcp`** → `.mcp.json` missing the entry, or you didn't restart.
- **Stuck "authenticating"** → OAuth blocked by corporate SSO → use the EU URL + API-key
  header instead.
- **Reads work but base URL is blank** → the collection uses a placeholder and the real
  URL lives in an environment that's empty; ask the user for the staging/dev base URL.
- **Server dropped after adding another MCP** → adding servers can require a restart +
  re-`Authenticate`; the local `google-sheets`/`figma` servers may just need a
  reconnect.

## Security
Test **staging/dev only** — API tests mutate data. Never point CRUD/flow suites at
production. Keep API keys and tokens out of git; pass them at runtime, not in committed
files.
