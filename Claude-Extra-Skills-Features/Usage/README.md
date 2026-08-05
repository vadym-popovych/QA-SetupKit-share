# Usage — session-limit monitoring for Claude Code

Makes Claude Code **aware of its own token limits**: on every user message a hook injects
the current 5-hour session usage (% used, exact reset time, weekly quota) into Claude's
context, so the agent can budget work instead of guessing.

```
Claude session: 44% used, resets 21:10 (in 4h21m) | week: 23% (model: 34%)
```

## What's inside

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | Claude-followable install guide (script + hook + verify + calibrate) |
| [`session-limit.py`](session-limit.py) | the monitor itself — stdlib-only Python, no dependencies |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | rules block to paste into your workspace `CLAUDE.md` |

## How it works

Two data paths, best available wins:

1. **Exact (primary, macOS):** fetches `https://api.anthropic.com/api/oauth/usage` — the
   same endpoint the in-app `/usage` panel reads — using the Claude Code OAuth token from
   the macOS Keychain. Responses cached 120s (`~/.claude/usage-live-cache.json`). Every
   successful fetch silently re-calibrates the fallback.
2. **Estimate (fallback, any OS / offline):** scans local session logs
   (`~/.claude/projects/**/*.jsonl`), computes the 5h window boundaries from timestamps
   (reset time is exact) and estimates % from token counts scaled by a one-time
   calibration against the real `/usage` banner.

**Idle window:** right after a 5h window resets there is no active limit, so the endpoint
returns `resets_at: null`. The script handles this gracefully — it prints
`… % used, window idle (next message starts a fresh 5h window)` instead of crashing on the
null reset time. (Earlier versions raised `TypeError: fromisoformat: argument must be str`.)

## CLI

```bash
session-limit.py                  # one-line status (what the hook runs)
session-limit.py --json           # machine-readable
session-limit.py --est            # force the offline estimate path
session-limit.py --reset-at HH:MM # anchor the window to the real reset time from /usage
session-limit.py --cal N          # calibrate: "the /usage banner says N% right now"
```

## What Claude does with it

- Reports real numbers when asked "how much budget is left?" — no estimation theatre.
- Suggests `/clear` / `/compact` at topic boundaries when the session % runs high.
- Warns before starting a heavy task that won't fit before the cap, and can propose
  waiting for the reset time instead.
- Claude **cannot** run `/clear`/`/compact` itself — those are user-side commands; the
  monitor gives it the data to *advise* well.

## Teammate onboarding

Share the whole `QA-SetupKit/` folder (workspace convention). The teammate opens this
folder and tells their Claude: *"follow QA-SetupKit/Claude-Extra-Skills-Features/Usage/SETUP.md"*.
Then they paste [`CLAUDE.starter.md`](CLAUDE.starter.md) into their workspace `CLAUDE.md`.
No secrets travel: the OAuth token stays in each user's own Keychain.
