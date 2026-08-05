# mcp-sheets — Google Sheets MCP server

Local MCP server that exposes Google Sheets / Drive / Docs operations to Claude Code.
Every checklist generator (`*/generate_via_api.mjs`) reuses this server's OAuth client
to write spreadsheets into YOUR Google Drive.

This is the **single canonical copy** for the whole shared `QA-SetupKit/` folder —
there is deliberately no second copy inside the Checklist kit. All kits point here.

**Important:** the OAuth token bound to this server determines whose Drive the
checklists land in. Each user MUST run their own first-time setup — **never share or
copy `token.json` / `credentials.json`** (they are gitignored here; if you received
this folder with those files present, delete them and create your own).

---

## First-time setup

> **Legend:** 🤖 = Claude can do this for you automatically. 👤 = you must do this yourself (browser / Cloud Console).

You'll need:
- **Node.js 18+**
- A **Google account** (the Drive where checklists will be created)
- A **Google Cloud project** with the Sheets + Drive + Docs APIs enabled

### 1. 🤖 Install dependencies

```sh
cd <path-to>/QA-SetupKit/MCP-configurations/mcp-sheets
npm install
```

Creates `node_modules/` (~100 MB), gitignored.

### 2. 👤 Get OAuth client credentials

Cloud Console UI — Claude can't do it. You need an OAuth 2.0 Client ID of type
"Desktop app".

1. Open <https://console.cloud.google.com/>
2. Create a new project (or pick an existing one). Free tier is fine.
3. Enable APIs: **Google Sheets API**, **Google Drive API**, **Google Docs API**
4. APIs & Services → OAuth consent screen:
   - User type: **External**
   - Fill the bare minimum (app name, your email, support email)
   - Scopes: `.../auth/spreadsheets`, `.../auth/drive`, `.../auth/documents`
   - Test users: add your own Google account email
   - **Recommended:** publish the app to **Production** afterwards — in Testing
     status Google expires refresh tokens after 7 days (`invalid_grant`).
5. APIs & Services → Credentials → **Create credentials** → **OAuth client ID** →
   type **Desktop app** → Create → **Download JSON**.
6. Rename to `credentials.json` and place it in THIS directory (next to `server.mjs`).

### 3. Authorize your Google account

🤖 Claude runs:
```sh
node server.mjs --auth
```
👤 A browser opens (`http://localhost:3456/...`) — sign in with the Google account
whose Drive should receive the checklists and approve the permissions.
🤖 On success `token.json` is written next to `server.mjs` (gitignored, user-specific).

### 4. 🤖 Register the server in `.mcp.json`

At your workspace root — copy [`../.mcp.json.template`](../.mcp.json.template) and fix
the absolute path to `server.mjs` for your machine. 👤 Then restart Claude Code (or
`/mcp`) — Claude can't reload its own MCP connections.

---

## Re-authorization

Token expired / switch account:
```sh
node server.mjs --auth
```
Overwrites `token.json`. The server also auto-refreshes the short-lived access token
from the stored refresh token on every start — re-auth is only needed when the
**refresh token itself** dies (`invalid_grant`, e.g. 7-day Testing-status expiry).

---

## Troubleshooting

- **"Cannot locate google-sheets MCP server" from a generator** — generators walk up
  from `cwd` to find `.mcp.json`; make sure it exists at/above the project dir and
  points at THIS `server.mjs`.
- **"No token.json at …"** — run `node server.mjs --auth`.
- **403 from Google API** — consent screen in "Testing" and your account isn't in Test
  users.
- **`Auth error: invalid_grant` on start** — refresh token expired/revoked → re-run
  `--auth`; to stop it recurring, publish the OAuth app to Production.

---

## What's safe to share / commit

| File | Share? | Commit? |
|------|--------|---------|
| `server.mjs`, `package.json`, `package-lock.json`, `.gitignore`, `README.md` | yes | yes |
| `node_modules/` | no | no (gitignored) |
| `credentials.json` | **no** | **no** (gitignored) — issue your own |
| `token.json` | **no** | **no** (gitignored) — generate your own |
