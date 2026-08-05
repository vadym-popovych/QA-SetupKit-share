# Checklist Generator Starter Kit

Self-contained kit for generating v5 QA checklists in Google Sheets via Claude Code. This is what you share with a new teammate.

## TL;DR — first 60 seconds in a fresh workspace

The only thing you do as the user: drop the `Checklist/` folder somewhere (e.g. `~/Projects/QA-SetupKit/QA-Documentation/Checklist/`) and open Claude Code there. Then **type whatever you want in any wording**, just make sure your message references the kit by mentioning `Checklist` or "checklist kit" or "QA checklist" etc. Examples that all work:

- "Створи чекліст відносно конфігурації що є в папці `Checklist`"
- "Set up the checklist kit"
- "Generate a QA checklist for what I selected in Figma — use the kit at `Checklist/`"
- "Onboard me — I just cloned `Checklist/`"

Claude reads this README, then:
- **Inspects the workspace.** If there's no `CLAUDE.md` yet → creates one from [`CLAUDE.starter.md`](CLAUDE.starter.md) + [`CHECKLIST_RULES.md`](CHECKLIST_RULES.md). If `CLAUDE.md` exists already → **appends** the kit ruleset to the end behind a clearly-fenced `## Checklist kit rules (appended by Checklist/…)` heading and tells you in one line so you can audit / revert. Never overwrites your existing content. If the kit ruleset is already in your `CLAUDE.md` (idempotent) → no-op.
- **Runs the MCP auto-detection** from [`MCP_SETUP.md`](MCP_SETUP.md). If MCP is already configured → **skips setup silently** (no re-prompt, no re-auth). If something is missing → walks you through whatever's missing (the only manual bits are 2 browser screens: Google Cloud Console OAuth + the sign-in popup).
- **Handles your actual request** (e.g. the checklist).

Every later session just works — Claude Code auto-loads `<workspace>/CLAUDE.md` and you can say things like "create a checklist for what I selected in Figma" without any preamble.

> **No `cp`, no manual edits, no magic phrases.** As long as your first message points Claude at `Checklist/` (by name or context), Claude bootstraps everything from there — safely.

## What's in this folder

| Path | What it is |
|------|-----------|
| `README.md` (this file)                  | Setup steps + kit map |
| `MCP_SETUP.md`                           | Full MCP setup guide (google-sheets local, Figma Dev Mode, claude.ai connectors) — Claude reads this to onboard you |
| `CLAUDE.starter.md`                      | Bootstrap `CLAUDE.md` — copy once to `<workspace>/CLAUDE.md` so Claude auto-loads kit context on session start |
| `CHECKLIST_RULES.md`                     | The canonical workspace rules — append into your `CLAUDE.md` (after the bootstrap header) |
| `.mcp.json.example`                      | Example MCP registration for Claude Code |
| `checklist-web/`                             | Web generator template (adaptive; default `['Web']` → 25 cols) |
| `checklist-web/checklist_generator.template.gs`         | Apps-Script generator |
| `checklist-web/generate_via_api.template.mjs`           | Node adapter (Apps-Script → Sheets REST API) |
| `checklist-web/README.md`                    | Per-template instructions |
| `checklist-mobile/`                      | Mobile generator template (adaptive; default `['iOS','Android']` → 28 cols) |
| `checklist-mobile/checklist_generator.template.gs`  | Apps-Script generator (mobile) |
| `checklist-mobile/generate_via_api.template.mjs`    | Node adapter (mobile) |
| `checklist-mobile/README.md`             | Per-template instructions |
| `../../MCP-configurations/mcp-sheets/`   | **Shared** local MCP server (Sheets/Drive/Docs) — single canonical copy for ALL kits in `QA-SetupKit/`; no copy inside this kit. Setup: [its README](../../MCP-configurations/mcp-sheets/README.md) |

## Prerequisites

- **Node.js 18+**
- **Claude Code** installed and logged in
- A **Google account** (whose Drive will hold your checklists)
- 10–15 min for first-time setup

## First-time setup (one-time per machine)

> **Legend:** 🤖 = Claude can do this for you automatically (just ask "set up the checklist kit"). 👤 = you must do this yourself, it requires a browser.

The full step-by-step (Cloud Console screenshots, OAuth scopes, Figma toggles, claude.ai connectors) lives in [`MCP_SETUP.md`](MCP_SETUP.md). Below is the short version.

### 1. 👤 Put the kit somewhere stable

Pick a folder for your workspace, e.g. `~/Projects/`. Copy the entire **`QA-SetupKit/`** folder there (this kit lives at `QA-SetupKit/QA-Documentation/Checklist/` and relies on the shared `QA-SetupKit/MCP-configurations/mcp-sheets/` server). That's it — **no manual `cp` for `CLAUDE.md`**. Claude builds it for you on first ask (see Step 0 below).

### 0. 🤖 Bootstrap on first ask (autonomous, no user action)

When you open Claude Code in `<workspace>/` for the first time and say anything that references the kit (`Checklist`, "checklist kit", "QA checklist"…), Claude detects that `<workspace>/CLAUDE.md` doesn't exist and CREATES IT by concatenating [`Checklist/CLAUDE.starter.md`](CLAUDE.starter.md) + [`Checklist/CHECKLIST_RULES.md`](CHECKLIST_RULES.md) (replacing the `<!-- Append … -->` marker). After it writes the file, it reminds you once: "I just created `<workspace>/CLAUDE.md` — restart Claude Code or run `/mcp` so it's auto-loaded next session." From the second session on, the rules are in context with zero further setup.

Steps 2–6 below are then driven by Claude based on the rules — you only need to handle the browser-only bits.

### 2. Set up the `google-sheets` local MCP (required)

🤖 `npm install` inside `QA-SetupKit/MCP-configurations/mcp-sheets/` — Claude can run it.

👤 The OAuth credentials part is browser-only. Follow [`mcp-sheets/README.md`](../../MCP-configurations/mcp-sheets/README.md) to:
- Create a Google Cloud project + OAuth client (Cloud Console UI)
- Save `credentials.json` next to `server.mjs`

🤖 Once `credentials.json` is in place, Claude can run `node server.mjs --auth`. 👤 You sign in in the browser that opens — that's the only manual step. The server writes `token.json`.

After this step, the server can write to YOUR Google Drive / Docs / Sheets.

### 3. 🤖 Register the MCP server in `.mcp.json`

At your workspace root (e.g. `~/Projects/.mcp.json`). Claude creates it from [`.mcp.json.example`](.mcp.json.example) with the right absolute path. 👤 You then restart Claude Code (or run `/mcp`) so it picks up the new server — Claude can't reload itself.

### 4. 🤖 Verify the full workspace rules are in `CLAUDE.md`

Step 0 already wrote the bootstrap header + the full [`CHECKLIST_RULES.md`](CHECKLIST_RULES.md) below the `<!-- Append … -->` marker. After Step 4 verifies it, every future session auto-loads the ruleset at start — no further action needed.

### 5. 👤 (Strongly recommended) Enable Figma Dev Mode MCP

So Claude can read **your current selection in Figma Desktop** when you say "create a checklist for what I selected". Figma Desktop → Preferences → **Enable Dev Mode MCP Server**. Details + troubleshooting in [`MCP_SETUP.md`](MCP_SETUP.md) §2.

### 6. 👤 (Optional) Enable claude.ai connectors

For reading any Figma file by URL + browsing Google Drive without local OAuth. claude.ai web → Connections → toggle Figma + Google Drive. Details in [`MCP_SETUP.md`](MCP_SETUP.md) §3.

### Just ask

In a fresh session inside the workspace, say: **"Set up the checklist kit"**. Claude inspects state (see auto-detection list in [`MCP_SETUP.md`](MCP_SETUP.md)), runs everything autonomously, and pauses only at the browser-only sub-steps with clear instructions. If your MCP isn't configured yet, Claude detects it on the FIRST checklist request and walks you through setup before doing anything else — never silently skip.

## Create your first checklist

1. **Decide variant** — Web or Mobile.
2. **Copy the template pair** to a new project folder:
   ```sh
   PROJECT=<ProjectName>      # e.g. MyWebsite (web) or MyApp (mobile)
   slug=<project_snake>       # e.g. my_website / my_app
   mkdir -p ~/Projects/$PROJECT
   # Web:
   cp Checklist/checklist-web/checklist_generator.template.gs \
      ~/Projects/$PROJECT/${slug}_checklist.gs
   cp Checklist/checklist-web/generate_via_api.template.mjs \
      ~/Projects/$PROJECT/generate_via_api.mjs
   # OR Mobile:
   cp Checklist/checklist-mobile/checklist_generator.template.gs \
      ~/Projects/$PROJECT/${slug}_checklist.gs
   cp Checklist/checklist-mobile/generate_via_api.template.mjs \
      ~/Projects/$PROJECT/generate_via_api.mjs
   ```
3. **Edit the `.gs`:** rename `createChecklist` to `create<Project>Checklist`, set `FOLDER_PATH`, `FILE_NAME`, `AUTHOR`, fill `addPage`/`addSection`/`item` calls based on the Figma design.
4. **Edit the `.mjs`:** set `GS_PATH`, `GENERATOR_FN`, `FOLDER_PATH`, `FILE_NAME` to match the `.gs`.
5. **Run:**
   ```sh
   cd ~/Projects/$PROJECT
   node generate_via_api.mjs
   ```
   You should see `Using MCP dir: …` (confirms whose Drive), batch progress, `STEP 5 test: PASSED`, and the spreadsheet URL.

The fastest way to create a checklist is to ask Claude Code (in this workspace): "Створи чекліст по тому що я виділив у Figma" — Claude will pick the right template, draft sections, and run the generator.

## Sharing this kit with the next teammate

Zip / clone / share **the whole `Checklist/` folder** plus a one-liner "follow `Checklist/README.md`". Each teammate needs to redo steps 2–4 (npm install + OAuth + register MCP + paste rules into CLAUDE.md) on their machine — these are per-user and not transferable.

Do NOT share your `credentials.json` or `token.json` — each user creates their own (see `mcp-sheets/README.md`).

## What changes are safe / risky

- **Safe to extend:** add new project folders alongside `Checklist/`, add new sections to your generators.
- **Risky:** editing the templates in place. If you must, also bump `CHECKLIST_RULES.md` so the change is documented and the next generator copied from the template inherits it.
