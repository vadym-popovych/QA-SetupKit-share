# MCP Setup — what Claude needs to read your Figma & write Google Sheets

This is the **single source of truth** for MCP setup in this kit. If you are a new teammate, complete this guide once. If you are Claude, **always check this file's prerequisites before doing any checklist work** — if anything is missing, walk the user through it.

There are **three MCP integrations** to set up. They are independent — you can skip the ones you don't need, but the recommended set below is the same as what the kit's author uses today.

| # | MCP | What it lets Claude do | Where it lives | Required for checklists? |
|---|-----|------------------------|----------------|--------------------------|
| 1 | **`google-sheets` (local)**         | Create / edit Google Sheets and Docs in YOUR Drive via Sheets+Docs+Drive REST APIs. Used by `generate_via_api.mjs` in every checklist project. | `QA-SetupKit/MCP-configurations/mcp-sheets/` (you run a local Node server) | **Yes — required** |
| 2 | **Figma Dev Mode (local)**          | Read your **current selection** in Figma Desktop (metadata, screenshot, design context). Lets you say "make a checklist for what I selected". | Figma Desktop app → Preferences | Strongly recommended |
| 3 | **claude.ai Figma + Drive connectors** | Read Figma files by URL (no Desktop needed) + browse Google Drive without local OAuth. | claude.ai web UI → Connections | Optional, but nice to have |

> **Legend:** 🤖 Claude can do this for you automatically. 👤 You must do this yourself in a browser / app UI.

---

## Before you start

Run these checks (Claude does this automatically at the start of every checklist session — see "Auto-detection" at the bottom):
**Never build on a missing prerequisite.** Do not generate or run a script that will crash without the
setup (a generator with no `token.json`, a capture with no browsers installed), and never present its
failure — or a step you skipped — as success. A missing check is reported and fixed, never worked
around with output that merely looks like a result.

| Check | Pass condition | What to do if it fails |
|-------|----------------|------------------------|
| `<workspace>/.mcp.json` exists and has `mcpServers["google-sheets"]` pointing at a real `server.mjs` | File exists, path resolves | Go to **§1** |
| `QA-SetupKit/MCP-configurations/mcp-sheets/node_modules/` exists | Folder exists | Run `npm install` in `QA-SetupKit/MCP-configurations/mcp-sheets/` — Claude can do it |
| `QA-SetupKit/MCP-configurations/mcp-sheets/credentials.json` exists | File exists | Go to **§1.2** (Cloud Console, browser-only) |
| `QA-SetupKit/MCP-configurations/mcp-sheets/token.json` exists | File exists | Run `node server.mjs --auth` in `QA-SetupKit/MCP-configurations/mcp-sheets/` |
| Figma MCP tools resolve (try `get_metadata` with no nodeId on the current selection) | Returns metadata | Go to **§2** or **§3** |
| Google Drive claude.ai connector resolves (try listing recent files) | Returns files | Go to **§3** |

If any check fails, the FIRST thing Claude does is offer to fix it — not just shrug and ask for a URL.

---

## §1 — `google-sheets` local MCP (required)

Full step-by-step is in [`mcp-sheets/README.md`](../../MCP-configurations/mcp-sheets/README.md). One-paragraph summary:

1. 🤖 `npm install` inside `QA-SetupKit/MCP-configurations/mcp-sheets/`.
2. 👤 Create a Google Cloud project + OAuth Client ID ("Desktop app") with Sheets API + Drive API enabled. Download as `credentials.json`, drop next to `server.mjs`. *(Browser-only.)*
3. 🤖 `node server.mjs --auth` — 👤 sign in in the browser that opens. `token.json` is written.
4. 🤖 Create `<workspace>/.mcp.json` from [`.mcp.json.example`](.mcp.json.example), with the absolute path to `server.mjs` plugged in.
5. 👤 Restart Claude Code (or `/mcp` in Claude Code) so the new server is picked up.

After this, every checklist generator (`generate_via_api.mjs`) works.

---

## §2 — Figma Dev Mode MCP (strongly recommended)

This is what lets you say "create a checklist for **what I'm selecting in Figma right now**" — Claude reads your current selection directly from Figma Desktop, no URL needed.

### Setup

1. 👤 Install / update **Figma Desktop** (`https://www.figma.com/downloads/`).
2. 👤 In Figma Desktop, open a **design file** (the menu doesn't appear in non-design contexts).
3. 👤 Top-left **Figma menu → Preferences → Enable Dev Mode MCP Server**.
   - You should see a confirmation message that the local server is running on `http://127.0.0.1:3845`.
4. 👤 Restart Claude Code (or `/mcp`) — Claude auto-discovers it via the well-known local endpoint.

No `.mcp.json` entry needed — the local server is auto-discovered by Claude Code when Figma Desktop has it enabled.

### How Claude uses it

When you say "what I selected in Figma" or "this design", Claude calls (in order):
1. `mcp__figma-dev-mode-mcp-server__get_metadata` (no nodeId → current selection) — XML tree of the selected node
2. `mcp__figma-dev-mode-mcp-server__get_screenshot` (no nodeId → current selection) — PNG of what you see
3. `mcp__figma-dev-mode-mcp-server__get_design_context` (no nodeId → current selection) — reference code + variables

### Troubleshooting

- **"No selection"** — make sure you have a node/frame selected in Figma Desktop (not just have the file open).
- **MCP tool not appearing in Claude Code** — Figma Desktop must be running AND the toggle must be on. Restart Claude Code after toggling.
- **Result too large (>token limit)** — Claude saves the output to a tool-results file; query it with `jq` instead of re-reading.

---

## §3 — claude.ai connectors (optional)

For reading Figma files by URL (when Desktop isn't running) and browsing Google Drive, you can also enable the claude.ai-managed connectors. These are zero-local-config — they live in claude.ai itself.

### Setup

1. 👤 Open <https://claude.ai/settings/connectors> (or claude.ai → your profile → Connections).
2. 👤 Enable **Figma** — sign in with your Figma account, approve the OAuth prompt.
3. 👤 Enable **Google Drive** — sign in with the same Google account whose Drive holds your projects, approve the OAuth prompt. (This also covers Google Docs read.)
4. 👤 Restart Claude Code (or `/mcp`) — connectors are auto-pulled into your session.

### What they add

- `mcp__claude_ai_Figma__*` — read any Figma file by URL (`get_design_context`, `get_metadata`, `get_screenshot`, …) without needing Figma Desktop running.
- `mcp__claude_ai_Google_Drive__*` — `list_recent_files`, `search_files`, `read_file_content`, `create_file`, `copy_file`, … on YOUR Drive. Covers Docs (read & create) and other Drive files. The local `google-sheets` MCP from §1 already handles **writing** to Sheets/Docs — the claude.ai Drive connector is for **browsing & reading** other Drive content.

### Trade-offs vs the local Figma Dev Mode

| | Dev Mode (local) | claude.ai Figma connector |
|---|------------------|---------------------------|
| Needs Figma Desktop open | yes | no |
| Reads "current selection" | yes | no (needs URL with `?node-id=`) |
| Works on files you don't own / can only view | no (requires edit access in Desktop) | yes (any file you can open in browser) |
| Best for | active design sessions, fast iteration | one-off lookups, files from teammates |

Use both — they complement each other.

---

## Auto-detection (for Claude)

When this `CLAUDE.md` is loaded in a fresh workspace, run all of these checks ONCE at the start of any checklist-related conversation, in parallel:

```text
1. Does `<workspace>/.mcp.json` exist and contain mcpServers["google-sheets"]?
2. Does `<workspace>/QA-SetupKit/MCP-configurations/mcp-sheets/node_modules/` exist?
3. Does `<workspace>/QA-SetupKit/MCP-configurations/mcp-sheets/credentials.json` exist?
4. Does `<workspace>/QA-SetupKit/MCP-configurations/mcp-sheets/token.json` exist?
5. Does the workspace `CLAUDE.md` include the rules block from `Checklist/CHECKLIST_RULES.md`?
6. Does any `mcp__figma*` tool resolve (try `get_metadata` with no nodeId)?
7. Does any `mcp__claude_ai_Google_Drive__*` tool resolve (try `list_recent_files`)?
```

**If all required checks (1–5) pass:** the kit is already configured. **Skip setup entirely and silently** — do NOT re-offer, re-prompt the user, re-run `--auth`, or re-`npm install`. Just proceed with the user's actual request. This is the common case for repeat users.

**If checks 1–5 fail → blocking** — Claude cannot generate a checklist. Walk the user through §1 above, automating every step except the browser-only Cloud Console + OAuth consent flows.

**If checks 6–7 fail → non-blocking** but mention it once: "I notice the Figma / Google Drive connectors aren't set up yet — if you want Claude to read your current Figma selection or browse your Drive, follow `Checklist/MCP_SETUP.md` §2 / §3." Then proceed with what Claude CAN do (e.g. ask for a Figma URL instead). If they ARE set up, never re-mention setup.

**Never silently skip a missing check, and never re-prompt a passing one.** If the user says "create a checklist for what I selected in Figma" and the Figma MCP isn't there, say so — don't just ask for a URL without explaining why. Conversely, if MCP is already wired up, don't ask the user to "verify setup" or "re-authorize" — just do the work.
