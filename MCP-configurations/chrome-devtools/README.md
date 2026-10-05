# `chrome-devtools` — Chrome DevTools MCP (local, interactive browser control)

Gives Claude a live, stateful Chrome session — navigate, click, fill forms, read
console/network logs, take screenshots — without hand-writing a Playwright script for
every ad-hoc check. **Complements, not replaces** the kit's scripted Playwright tools
(E2E specs, `record-network-bug.mjs`, the PageSpeed collector): those stay the codified,
reusable path for anything re-run or feeding a report; this MCP is for interactive,
one-off work — exploratory sessions, a quick repro check, "what's actually on this page
right now".

Official server, maintained by the Chrome DevTools team (Google) — Apache-2.0, published
on npm as [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp).

Like `figma-dev-mode/` and `postman/`, **this folder has no source code, no
credentials** — the package is fetched by `npx` on demand. It exists only to document
the integration alongside the other MCPs.

## What's registered where

| Property | Value |
|----------|-------|
| Type | Local process (stdio), launched fresh via `npx` — no hosted URL |
| Command | `npx -y chrome-devtools-mcp@latest` |
| Doc folder | [`chrome-devtools/`](.) — README only, no source code |
| Auth | None — controls a local Chrome instance over CDP, no account/token |
| Registered in | `<workspace>/.mcp.json` (workspace root, project-scoped) |
| Restart after change | Yes — quit + reopen Claude Code, then `/mcp` |

Project-scoped snippet (already merged into the workspace `.mcp.json`):
```json
"chrome-devtools": {
  "command": "npx",
  "args": ["-y", "chrome-devtools-mcp@latest"]
}
```

## Enabling

1. Confirm the snippet above is in `<workspace>/.mcp.json` (it is).
2. Restart Claude Code, approve the project-scoped trust prompt.
3. `/mcp` → `chrome-devtools` → should show **connected** (first launch downloads the
   package via `npx` — a few seconds; later launches use the npm cache).
4. First tool call launches a visible Chrome window by default (see Options for
   headless).

## Options (extra `args`, none required by default)

| Flag | Effect |
|------|--------|
| `--headless=true` | No visible window — for unattended/background use |
| `--channel=<stable\|canary\|beta\|dev>` | Pick a Chrome channel instead of the bundled one |
| `--isolated=true` | Fresh profile per session, no cookies/storage persisted — recommended for QA so a round doesn't inherit stale login state from the last one |
| `--viewport=<WxH>` | Fixed viewport, e.g. to check a specific device class |

Full flag list: `npx chrome-devtools-mcp@latest --help`.

## When to use this vs. the kit's Playwright scripts

- **This MCP:** ad-hoc — Exploratory-Testing sessions, a live console/network look while
  chasing a report finding, "show me what's on this page now".
- **Playwright scripts (existing kit tools):** anything re-run, versioned, or feeding a
  checklist/E2E suite/report — [`UI-Automation/template/e2e/`](../../Testing-Types/UI-Automation/template/e2e/),
  [`record-network-bug.mjs`](../../Testing-Types/Web-Testing/template/tools/record-network-bug.mjs),
  the PageSpeed collector. Per workspace rule "Mirror reusable rules": a flow used more
  than once still gets generalized into a kit script, not left as a repeated ad-hoc MCP
  session.

## Failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `chrome-devtools` missing in `/mcp` | Snippet not in `.mcp.json`, or no restart | Add snippet, fully restart Claude Code |
| First call hangs / times out | `npx` downloading the package on first use | Retry — later launches use the npm cache |
| No visible browser window appears | Running with `--headless=true`, or on a headless machine | Expected in headless mode; drop the flag for a visible window |
| Stale login/session across rounds | Default profile persists cookies between launches | Add `--isolated=true` for a clean profile each run |

## Sharing with teammates

The JSON snippet is safe to share — no secrets, no machine-specific paths, no per-user
auth. Each teammate's `npx` fetches the package independently; nothing else to configure.
