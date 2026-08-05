# Cron-Session — starter rules (paste into YOUR workspace CLAUDE.md)

## Auto-pause & resume on session limit (requires the Usage kit hook)
- During a LONG task, when the session-limit hook shows **≥95% used**: assess, then pause
  (see adaptive threshold below). Pausing = fix a short handoff (done / next / where
  artefacts live), create a ONE-SHOT in-session cron (`CronCreate`, `recurring: false`)
  at the reset time from the hook **+2 min** with a prompt to continue the task, then
  tell the user: what was paused, when it resumes, and that Claude Code must stay open
  on an awake machine.
- **Adaptive threshold 95→97%:** at 95% make a go/no-go call. Large context (each
  response ~1–3%) or expensive steps ahead → pause at 95%. Only when the remaining steps
  are demonstrably cheap and few (~2–4 to finish) → push on, re-checking with `--fresh`
  after EVERY step, up to a **hard ceiling of 97%** — never beyond; always keep ~1%
  reserve for the evacuation itself (handoff + cron + report). Any doubt → pause.
- **Self-check with dynamic frequency during autonomous work:** the hook updates only on
  user messages, so during long tool-heavy stretches run the Usage script yourself
  (`python3 ~/.claude/scripts/session-limit.py` — <100ms, 120s cache). Cadence scales
  with usage: **<60%** → every ~20 tool calls or before each expensive phase (build,
  generation series, load run); **60–80%** → every ~10; **80–90%** → every ~5;
  **≥90%** → every 2–3 calls, ONLY with `--fresh` (bypasses the 120s cache — stale %
  is dangerous near the limit), AND plan the stop point: finish the current atomic
  step, don't start the next expensive one if it won't fit. Goal: never blow through
  the threshold unnoticed; stop at a clean boundary, not mid-operation.
- On resume: report that this is a scheduled continuation, restate the task state in one
  line, continue.
- **⚠️ IDE-extension sessions (VSCode/JetBrains): in-session crons are UNRELIABLE** —
  one-shot jobs can stay queued and never fire while the panel is inactive (observed
  3× on 11/07/2026: jobs remained in CronList past their fire time; one fired only in a
  DIFFERENT window). Treat the cron as a backup only: when pausing, ALSO tell the user
  explicitly "message me anything after the reset at HH:MM" — a user message reliably
  wakes the session; then do the handed-off work inline and clean up stale jobs via
  CronList/CronDelete. CLI sessions don't show this failure mode.
- Short conversational turns don't need this — only multi-step tasks that would be lost
  mid-flight. For machine-independent autonomy prefer a scheduled cloud agent
  (`schedule` skill) with a file/memory handoff instead.
- **Frontier-model workflow calibration (11/07/2026):** one frontier-tier (Fable-5
  class) workflow agent burns ≈ 10–15% of a 5h session; required headroom before
  launching a multi-agent workflow ≈ `agents × 12% + 20% reserve` (the generic "≥25%
  headroom" floor is calibrated for smaller models). With < 60% headroom prefer inline
  work or ≤ 2–3 agents. Background workflows cannot be throttled mid-flight — the whole
  go/no-go decision happens at launch; between-iterations checks only catch the damage
  afterwards.
- **In-session crons are PER-CHAT and in-memory (11/07/2026):** a `CronCreate` job
  lives only inside the chat/session that created it — even between tabs of the SAME
  IDE window nothing is shared, and a closed tab / IDE reload kills its crons
  silently. Two parallel chats each scheduling a resume = two independent schedulers:
  either keep BOTH chats open until their crons fire, or consolidate (handoffs live on
  disk — one chat's cron can resume several tasks by reading several handoff files).
  For must-fire resumes independent of open chats, arm the OS-level fallback
  `durable-resume.sh HH:MM <handoff.md> [label] [--unattended]` (kit script): a
  one-shot `launchd` agent runs headless `claude -p` with the handoff even if every
  chat is closed. Double-fire guard: the launchd runner claims `<handoff>.lock`
  (mkdir, atomic) before running — therefore an in-session resume cron's prompt must
  ALSO start with "claim `<handoff>.lock` via mkdir; if it already exists, someone
  resumed first — stop" (arming a new resume clears a stale lock automatically).
  Live-tested 11/07/2026; two launchd traps already fixed in the script — keep them
  when porting: (1) the runner's PATH must include `$HOME/.local/bin` (launchd's bare
  PATH has no user dirs, `claude` lives there); (2) self-removal order: `rm` the plist
  BEFORE `launchctl bootout` — bootout kills the runner's own process, lines after it
  never execute, and an orphaned plist re-registers at next login.
- **Headless resumes that must WRITE need `--unattended` (15/07/2026):** permission
  prompts can't be answered headlessly, so without it every file write is silently
  blocked — the run burns a full session's budget and delivers zero progress
  (observed live). `--unattended` is the same explicit owner-authorized override the
  recurring driver uses: `--dangerously-skip-permissions` plus a deny-fence settings
  profile (no writes into `**/*-repository/**` clones, no `git push`) — an
  accident-fence for a rule-following agent, NOT a sandbox. The runner also
  (a) appends the full headless output to `<handoff>-RESULT.md` next to the handoff
  and posts a desktop notification — the next interactive session (and the owner)
  see exactly what happened; (b) on a usage-limit bounce ("hit your limit") releases
  the lock and re-arms itself at the reset time parsed from the limit message +5 min
  (fallback +65 min, max 5 retries) — a limit hit no longer kills the task silently
  or poisons the lock. ⚠️ Arming a skip-permissions agent may itself be blocked by
  the permission layer: get the owner to name/allow it explicitly (or pre-allow the
  arm script in settings) BEFORE the evacuation moment, not at 97%. ⚠️ The headless
  tool surface is NARROWER: the `Workflow` orchestration tool may be absent (observed
  live 16/07/2026) — write handoffs so any fan-out degrades to plain `Agent` calls
  (retrieve + judge; and when testing a CANDIDATE of an auto-loaded memory file,
  require verbatim quotes from the candidate as a contamination guard) — kit README
  «Headless tool surface».

- **Auto-resume without being asked — the TWO-LAYER flow (12/07; two-layer 16/07/2026):**
  when a task IS assigned but the session budget clearly won't cover it (≥95% used or
  the estimate doesn't fit), ALWAYS arm the continuation yourself on ONE handoff file:
  (1) a one-shot in-session cron at reset+2 min continuing in the same chat — its
  prompt claims the lock first (`mkdir <handoff>.lock`; failure → stand down);
  (2) `durable-resume.sh` at reset+5 min `--unattended` — lock present → backs off,
  dead session → runs headless; the runner releases the lock at finish/stop. Tell the
  owner BOTH fire times and that the Mac must stay awake. Don't wait to be reminded.
  Plan every evacuation as if the owner is absent: the must-fire layer, not a promise
  or a ping, is the guarantee.
  **Another chat already armed a resume → STAGGER it.** List what is scheduled before
  arming; the lock is per-handoff, so two runners on different handoffs BOTH fire and
  neither stands down — what they share is the budget window. Offset yours so both can
  finish with a real result, and put a budget go/no-go INSIDE the handoff (`<30% free →
  do not run, re-arm, say why in the RESULT`). A fan-out into an eaten window returns
  empty results that look like a completed run: a fake green, not a red.
