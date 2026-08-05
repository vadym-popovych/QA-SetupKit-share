# `figma-dev-mode-mcp-server`

Local MCP server hosted **by Figma Desktop itself** — exposes the current selection / file metadata / screenshots / variable defs / FigJam content of whatever you're looking at right now in the running Figma.app.

Unlike `mcp-sheets/`, **this folder has no source code, no `package.json`, no credentials** — the server is part of Figma Desktop. This folder exists only to document the integration in one place alongside the other MCPs.

## What's registered where

| Property | Value |
|----------|-------|
| Type | SSE (Server-Sent Events) — local HTTP stream |
| Endpoint | `http://127.0.0.1:3845/sse` |
| Process | `Figma.app` (PID owns port 3845 — verify with `lsof -nP -iTCP:3845 -sTCP:LISTEN`) |
| Registered in | `<workspace>/.mcp.json` (workspace root, project-scoped) |
| Auth | None — local loopback, Figma handles its own session |
| Restart after change | Yes — quit + reopen Claude Code |

Project-scoped snippet (already merged into the workspace `.mcp.json`):

```json
"figma-dev-mode-mcp-server": {
  "type": "sse",
  "url": "http://127.0.0.1:3845/sse"
}
```

## Enabling the server in Figma Desktop

1. Open Figma Desktop (Professional+ / Dev seat required).
2. Right sidebar → **Inspect** panel → **MCP** section.
3. Toggle **Server status: Enabled**.
4. Confirm port 3845 is listening:
   ```bash
   lsof -nP -iTCP:3845 -sTCP:LISTEN
   # COMMAND   PID  USER   FD  ... NAME
   # Figma    XXXX  <user>  78u ... TCP 127.0.0.1:3845 (LISTEN)
   ```
5. Smoke test the SSE stream:
   ```bash
   curl -N http://127.0.0.1:3845/sse | head -3
   # should stream events, not "Connection refused"
   ```

## Exposed tools

Once connected, Claude Code can call:

| Tool | Purpose |
|------|---------|
| `get_metadata` | Frame tree / layer hierarchy of the current selection (no `nodeId` = current selection). |
| `get_screenshot` | PNG of the selection. |
| `get_design_context` | Tokens, styles, variables, code-relevant context for the selection. |
| `get_variable_defs` | Resolved Figma variables (color, number, string, boolean). |
| `get_figjam` | Stickies / sections from a FigJam file. |

Per workspace rule **"Figma MCP first; inform on failure"** in `../../../CLAUDE.md`, Claude must try `get_metadata` (no `nodeId`) against this server BEFORE asking for a Figma URL.

## Failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Connection refused` on 3845 | Figma Desktop is closed | Open Figma Desktop. |
| Port 3845 listens but MCP returns "no selection" | Nothing selected in active file | Click a frame / component in Figma. |
| Tools missing in `/mcp` after restart | `.mcp.json` not picked up | Make sure Claude Code was launched with cwd at `<workspace>` (or a subdir of it). |
| `Server disconnected` | Figma was quit mid-session | Reopen Figma, re-run `/mcp` in Claude Code. |

## Sharing with teammates

The JSON snippet is **safe to share** — no secrets, no machine-specific paths. It already lives in the project-scoped `<workspace>/.mcp.json`, so anyone cloning the workspace gets it automatically. They still need to:

1. Have Figma Desktop with a Dev / Full seat.
2. Enable the MCP toggle in Figma (one-time, per machine).
3. Approve the project-scoped MCP on first launch of Claude Code in the cloned workspace.
