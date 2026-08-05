# Usage kit — SETUP (Claude-followable)

Give Claude Code real-time visibility into the **5-hour session limit**: % used, when the
window resets, and weekly quota — injected automatically into every prompt via a hook.
Treat the injected line as ground truth — same source as `/usage`; never second-guess or
re-derive the number. At ~80%+ used, flag before any heavy phase: suggest `/clear` or
deferring past the reset.

After setup, every user message gets a line like:

```
Claude session: 44% used, resets 21:10 (in 4h21m) | week: 23% (model: 34%)
```

Claude sees this line and can plan work around the budget (suggest `/clear` before a big
task, warn before hitting the cap, time heavy runs after the reset).

> **For Claude:** follow the steps below in order. Everything is idempotent — re-running
> a step is safe. Stop and tell the user only if a verification step fails.

---

## Prerequisites

| What | Why | Check |
|---|---|---|
| macOS | live data reads the OAuth token from the Keychain (`security` CLI) | `uname` → `Darwin` |
| Python 3 | the script is stdlib-only, no pip installs | `python3 --version` |
| Claude Code logged in via claude.ai account | the OAuth usage endpoint is the same source as the in-app `/usage` panel | `/usage` shows data |

**Linux/Windows:** the live-API path won't find a Keychain token → the script automatically
falls back to a local **estimate** from `~/.claude/projects/**/*.jsonl` logs. Reset time is
still exact; the % needs one-time calibration (see step 5).

## Step 1 — install the script

Copy [`session-limit.py`](session-limit.py) (in this folder) to the user-level scripts dir:

```bash
mkdir -p ~/.claude/scripts
cp "<this-folder>/session-limit.py" ~/.claude/scripts/session-limit.py
chmod +x ~/.claude/scripts/session-limit.py
```

## Step 2 — verify it runs

```bash
python3 ~/.claude/scripts/session-limit.py
```

Expected: one line starting with `Claude session:`. Two healthy shapes:

- **Exact (live API worked):** `Claude session: 44% used, resets 21:10 (in 4h21m) | week: 23% (model: 34%)`
- **Estimate (offline fallback):** `Claude session: started 14:03, resets 19:03 (in 2h41m) | ~12.4 cost-units | ~64% of session limit (est)`
- `no active window` is also fine — it just means no messages in the current 5h block yet.

If it prints a Python traceback → stop and report it to the user.

## Step 3 — register the hook

Add a `UserPromptSubmit` hook to the **user-level** `~/.claude/settings.json` (create the
file if missing; merge into an existing `hooks` object, don't clobber other hooks):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/scripts/session-limit.py 2>/dev/null || true",
            "timeout": 10,
            "statusMessage": "Checking session limit…"
          }
        ]
      }
    ]
  }
}
```

Notes:
- `UserPromptSubmit` stdout is injected into Claude's context on **every user message** —
  that's what makes the numbers visible to the agent, not just to the human.
- `|| true` + `2>/dev/null`: the hook must never block a prompt if the script hiccups.
- User-level (`~/.claude/settings.json`), not project-level: the limit is per-account,
  so the monitor should follow the user across all workspaces.

## Step 4 — restart & verify end-to-end

Restart Claude Code (hooks are read at session start). Send any message and ask Claude:
*"what does the session-limit hook show right now?"* — it should quote the exact line.

## Step 5 — calibration (fallback mode only)

Skip this on macOS with a working Keychain token — the live path self-calibrates the
fallback automatically on every successful fetch.

If you only ever see the `(est)` line:
1. Open `/usage` in Claude Code, note the real reset time and % used.
2. Anchor the window: `python3 ~/.claude/scripts/session-limit.py --reset-at HH:MM`
3. Calibrate the %: `python3 ~/.claude/scripts/session-limit.py --cal <pct>`

Calibration is stored in `~/.claude/usage-calibration.json` and survives across windows.

---

## Files this kit touches

| Path | What |
|---|---|
| `~/.claude/scripts/session-limit.py` | the monitor (copied from this folder) |
| `~/.claude/settings.json` | `UserPromptSubmit` hook entry |
| `~/.claude/usage-calibration.json` | auto-created: window anchor + %-calibration |
| `~/.claude/usage-live-cache.json` | auto-created: 120s cache of the usage endpoint |

## Security notes

- The OAuth token is read from the macOS Keychain at runtime and sent **only** to
  `api.anthropic.com` — the same endpoint the built-in `/usage` panel uses.
- Nothing secret is stored in this kit or in the workspace; cache/calibration files live
  in `~/.claude/` and contain no credentials. Safe to share the folder as-is —
  **except** `usage-scraper/profile/` (below), which is gitignored and must never travel.

---

## Optional: browser scraper (`usage-scraper/` — legacy fallback)

Predates the Keychain/OAuth live path above and is **not used by the hook** — keep it
only for the rare case where the API path is unavailable (no Keychain, endpoint change)
and you still want exact numbers instead of the built-in estimate.

- One-time login: `node scrape.js --login-open` → a visible Chrome opens on claude.ai,
  log in within ~4 min; cookies persist to `./profile/`.
- Scrape: `node scrape.js` (headless) → extracts "% used / resets in" from the usage
  page and writes `~/.claude/usage-snapshot.json`. `--dump` prints page text for debug.
- Setup: `npm install` inside `usage-scraper/` (Playwright + Chrome channel).
- Debug helpers (dev-only, not part of the flow): `diag.js` / `diag-headed.js` — headless / headed probes of the claude.ai usage page when the scraper's selectors drift; use them to see what the page actually renders before fixing `scrape.js`.
- ⚠️ **`profile/` holds live claude.ai session cookies** — gitignored at the kit root;
  when sharing the kit by zip/AirDrop, delete `usage-scraper/profile/` manually
  (same drill as the MCP credential files).
