# Usage kit — starter rules (paste into YOUR workspace CLAUDE.md)

## Session-limit awareness — Usage kit
- A `UserPromptSubmit` hook (`~/.claude/scripts/session-limit.py`) injects the current
  Claude Code session usage into every prompt:
  `Claude session: NN% used, resets HH:MM (in XhYYm) | week: NN% (model: NN%)`.
  Treat these numbers as ground truth (same source as the `/usage` panel) — do NOT
  re-estimate token usage from scratch when asked about limits; quote the hook line.
- When asked "how much budget is left / when does the session reset" → answer directly
  from the latest hook line (session %, reset time, weekly %).
- Budget-aware behavior: if session usage is high (~80%+) and a heavy task is requested,
  say so up front and propose either a `/clear` at the current topic boundary or waiting
  for the reset time. You cannot run `/clear`/`/compact` yourself — only recommend.
- If the hook line is missing or shows the `(est)` fallback on a machine where exact data
  is expected, suggest re-running the setup:
  `QA-SetupKit/Claude-Extra-Skills-Features/Usage/SETUP.md` (verify + calibration steps).
