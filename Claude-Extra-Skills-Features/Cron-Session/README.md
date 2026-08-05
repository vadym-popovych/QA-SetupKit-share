# Cron-Session — auto-pause & resume around the 5-hour session limit

Behavioral feature: when Claude is working on a long task and the 5-hour session window
is nearly exhausted, it **pauses itself and schedules its own resume** for right after
the window resets — instead of dying mid-task at 100%.

## Prerequisites — the two shell schedulers are macOS-only

`durable-resume.sh` and `recurring-driver.sh` are **launchd** scripts, and launchd is macOS.
`durable-resume.sh` writes a `~/Library/LaunchAgents/<label>.plist`, loads it with `launchctl
bootstrap`, posts its notifications through `osascript` and computes its retry time with BSD
`date -v`. `recurring-driver.sh` is armed from `templates/recurring.plist.template` (also a
launchd job), runs under `zsh`, takes `JAVA_HOME` from `/usr/libexec/java_home`, and tears
itself down with `launchctl bootout`. None of that exists on Linux or Windows, so on those
platforms both scripts fail outright — there is no degraded mode, and the kit ships no port.

What is *not* macOS-specific is everything the scripts exist to serve: the budget signal, the
95→97% thresholds, the handoff contract, the lock discipline and the two-layer rule. Layer (a),
the **in-session cron** (`CronCreate`), is part of the harness and runs wherever Claude Code
runs. A teammate on Linux therefore keeps the whole discipline and replaces only layer (b) —
the must-fire job — with their own scheduler (a `systemd --user` timer, or `cron`) invoking the
same headless command the plist invokes: `claude -p "<continuation prompt pointing at the
handoff file>"` from the workspace directory, claiming `<handoff>.lock` with `mkdir` first.
That port has not been written or tested here; treat it as work, not a flag.

## How it works

1. **Signal** — the [`Usage/`](../Usage/) kit's hook injects the current session % and
   exact reset time into every prompt (`Claude session: 95% used, resets 21:10 …`).
   The hook only fires on user messages, so during long autonomous stretches Claude
   **self-checks** by running the Usage script directly (<100ms, 120s cache) with a
   **dynamic cadence** — the closer to the limit, the more often:

   | Session usage | Check frequency |
   |---|---|
   | < 60% | every ~20 tool calls / before each expensive phase (build, generation series, load run) |
   | 60–80% | every ~10 tool calls |
   | 80–90% | every ~5 tool calls |
   | ≥ 90% | every 2–3 calls, ONLY with `--fresh` (bypass the 120s cache — stale % is dangerous here) + plan the stop point: finish the current atomic step, don't start the next expensive one if it won't fit |

2. **Adaptive threshold (95% assess, 97% hard stop)** — at **95%** Claude makes a
   go/no-go call: with a large context (each response can cost 1–3%) or expensive steps
   ahead, it pauses right there; only when the remaining steps are demonstrably cheap
   and few (~2–4 to finish the task) it pushes on — re-checking with `--fresh` after
   every step — up to a **hard ceiling of 97%**, never beyond. ~1% is always reserved
   for the evacuation itself (handoff + cron + report). Any doubt → pause. Stopping
   always happens at a clean boundary, not mid-operation.
3. **Handoff** — Claude fixes the state: what's done, what's next, where artefacts live
   (a short state note in the relevant `<Project>/<Testing-Type>/` folder if needed;
   memory plugins capture context automatically).
4. **Schedule — ALWAYS two layers on the SAME handoff** (canonical since 16/07/2026):
   **(a)** a **one-shot in-session cron** (`CronCreate`, `recurring: false`) at reset
   time + ~2 min, with a prompt like *"continue task X from the handoff"* — it fires
   into the SAME conversation, so full context is preserved. The prompt must claim the
   coordination lock FIRST (`mkdir <handoff>.lock`; mkdir fails → another runner owns
   the task, stand down). Fires only while the session process is alive.
   **(b)** `durable-resume.sh <reset+5min> <handoff> [label] --unattended` — a launchd
   job that survives a dead session: an existing lock → it backs off; a dead session →
   it runs headless. Whoever runs releases the lock at finish/stop.
   **Another chat already has a resume armed → STAGGER, never collide.** Before arming,
   list what is already scheduled (`ls ~/Library/LaunchAgents/com.claude.durable-resume.*`
   on macOS, or whatever your platform's job list is). The lock does NOT protect you here:
   it is per-handoff, so two runners on two different handoffs both fire and neither stands
   down. What they share is the **budget window**. Offset yours so the earlier job gets a
   head start and BOTH can finish with a real result, and put a budget go/no-go INSIDE the
   handoff (`<30% free → do not run, re-arm for the next reset, record why in the RESULT
   file`). A large fan-out launched into an already-eaten window returns empty results that
   *look like a completed run* — the worst failure mode there is: not a red, a fake green.
   Parallel chats are the normal case, not an edge case.
5. **Resume** — the cron fires in the fresh 5h window; Claude picks up and continues,
   reporting that it resumed.

## Limitations (read before relying on it)

- **Claude Code must stay open** (and the machine awake). The cron lives inside the
  session process. `durable: true` survives a restart of Claude Code, but not a
  powered-off machine.
- **Trigger BEFORE 100%.** At 100% Claude may not be able to schedule anything anymore —
  that's why the threshold is ~95%, not 98%.
- One-shot crons auto-delete after firing; nothing lingers.
- For fully autonomous work independent of the local machine, use scheduled **cloud
  agents** (the `schedule` skill) instead — but those start without the conversation
  context and need a file/memory handoff.

## Recurring driver vs one-shot resume

There are **two different mechanisms** here — don't confuse them:

| | `durable-resume.sh` (one-shot) | `recurring-driver.sh` (recurring) |
|---|---|---|
| Purpose | resume a Claude session ONCE after the 5-hour limit resets | drive a QA task AUTONOMOUSLY over many windows until it's done |
| Fires | once, at a scheduled time, then self-removes | every `StartInterval` (e.g. 2h) until a stop condition |
| Stops when | it has fired once | `STATUS: COMPLETE` in the state file, a STOP file, or a fire cap |
| Typical use | "pick up task X after the window resets at 21:10" | "run the emulator pilot overnight until the whole checklist is filled" |

**`recurring-driver.sh`** is the pattern for *"run the QA flow autonomously overnight."* Each
fire it: checks stop conditions → checks budget (skips the fire if the session is over
`BUDGET_STOP`%, using the [`Usage/`](../Usage/) kit's `session-limit.py --fresh`) → runs
`claude --dangerously-skip-permissions -p "$(cat PROMPT_FILE)"` for a bounded slice of work
(with socket-death retries) → exits without unloading so the next window continues. It self-unloads
**and deletes its own plist** only on completion / STOP / cap.

Arm it (self-contained, no author-machine paths — everything is env-driven):

```bash
DIR=<Project>/Emulator-Testing            # holds STATE.md, recurring-prompt.txt, logs
LABEL=com.<project>.qa.recurring          # unique launchd label
cp templates/STATE.md.template            "$DIR/STATE.md"            # fill Authorization + Next
cp templates/recurring-prompt.txt.template "$DIR/recurring-prompt.txt"
# smoke it first — never invokes claude:
DRIVER_LABEL=$LABEL DRIVER_DIR=$DIR DRYRUN=1 ./recurring-driver.sh
# then fill templates/recurring.plist.template → ~/Library/LaunchAgents/$LABEL.plist and:
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/$LABEL.plist
```

Disarm early: `touch $DIR/recurring.stop` (the next fire deletes its own plist). Safety rails
ship as defaults: `BUDGET_STOP=90`, `MAX_FIRES=60`, `MAX_ATTEMPTS=3`. The per-fire prompt
template encodes the honesty contract — idempotent writes, never-fake-a-Pass, and that
unattended writing is an **explicit owner-authorized** override of the interactive confirm-gate,
valid only against the staging/dev target named in `STATE.md`.

⚠️ **Requires the [`Usage/`](../Usage/) kit** for the budget gate, and (for emulator runs) the
[App-Emulators-configurations](../../Testing-Types/App-Emulators-configurations/) kit. The Mac must
stay awake and logged in (launchd `StartInterval` does not wake a sleeping machine).

## durable-resume.sh — unattended mode & failure handling

`durable-resume.sh HH:MM <handoff.md> [label] [--unattended]`

A headless `claude -p` cannot answer permission prompts, so a resume armed **without**
`--unattended` is read-mostly: every file write is silently denied — the run can burn a
full session window and deliver zero progress (observed live 15/07/2026). The flag is the
same **explicit owner-authorized override** of the interactive confirm-gate that the
recurring driver uses: the runner launches `claude -p --dangerously-skip-permissions`
with a deny-fence settings profile on top — no writes into `**/*-repository/**` (the
read-only client-clone convention) and no `git push`. Treat the fences as accident
protection for a rule-following agent, **not** a sandbox (verified live 15/07/2026:
`deny` rules ARE enforced even under `--dangerously-skip-permissions` — a probe write
into a `*-repository/` path came back permission-denied while workspace writes
succeeded); unattended mode is a trust decision the owner makes per arm. Note that the permission layer may also gate the
*arming* command itself — have the owner name/allow the arm script before the
evacuation moment.

Built-in failure handling (runner v2):

- **Visibility** — the full headless output is appended to `<handoff>-RESULT.md` next to
  the handoff file (timestamped per attempt) in addition to the shared log (the shared
  runner log is `~/.claude/durable-resume.log`), and a desktop notification is posted on
  every terminal outcome. The next interactive session finds the result right where the
  handoff lives. Existence of `<handoff>-RESULT.md` is NOT proof of completion —
  limit-killed runs leave partial files; DONE/idempotency checks must validate content
  (parses, required fields non-empty, score present) before treating the task as finished.
- **Self-rearm** — a headless run that cannot finish applies the evacuation rule to
  itself: update the handoff and arm its own `--unattended` continuation (proven live
  pattern).
- **Usage-limit bounce** — if the run opens on "hit your limit", the runner releases
  `<handoff>.lock` (a bounced run must not poison the double-fire guard) and re-arms
  itself at the reset time parsed from the limit message +5 min (fallback: +65 min),
  up to 5 retries, each as a fresh one-shot agent (`<label>.rN`). A limit hit no longer
  kills the scheduled task silently. If the bounce is a weekly/monthly cap (not the 5h
  window), retries are futile and will eventually fire at an uncontrolled moment — after
  2–3 bounces disarm and hand the decision back to the owner.
- **Stale-lock hygiene** — arming a new resume for a handoff clears a leftover
  `<handoff>.lock` from a previous cycle (arming implies the old cycle is over).

### Headless tool surface — the `Workflow` tool may be absent (observed live 16/07/2026)

The tool surface of a headless `claude -p` run is narrower than an interactive session's:
the multi-agent `Workflow` orchestration tool was not available in a live headless run.
Write handoffs so orchestration steps degrade gracefully: any fan-out a handoff prescribes
must be replicable with the plain `Agent` tool (e.g. an eval = one retrieve agent + one
judge agent per batch instead of a scripted pipeline). One measured trap and its guard:
subagents auto-load the live project memory file, so when the artifact under test is a
CANDIDATE version of that same file, require the retrieve agent to answer with **verbatim
quotes from the candidate** — a quote matching the candidate (and not the live file)
proves the answer came from the right document. Consolidating to one retrieve + one judge
per batch also cut eval cost ~8× versus per-scenario agent pairs in the same live run.

## Teardown hygiene — never leave an orphaned launchd agent

Any **launchd**-based autonomous/resume agent (a `~/Library/LaunchAgents/*.plist` that runs
a headless `claude`) MUST **remove its plist file on teardown**, not merely
`launchctl bootout`. A bare `bootout` only unloads the agent for the current login —
the plist file stays on disk and **launchd auto-loads it again at the next login/reboot**.
The result is an orphan: a completed job's agent silently reloads, fires on its interval,
and becomes a mystery process nobody remembers configuring.

- **Correct pattern** (what [`durable-resume.sh`](durable-resume.sh) already does): on
  self-removal, `rm -f "$HOME/Library/LaunchAgents/<label>.plist"` **first**, then
  `launchctl bootout gui/$(id -u)/<label>` (booting out your own job kills the process,
  so delete the file before that line).
- **After any autonomous / unattended run, verify no orphans remain:**
  `ls ~/Library/LaunchAgents/ | grep -i <label>` (expect nothing) and
  `launchctl list | grep -i <label>` (expect nothing). A completed pilot's agent should
  leave **no** armed plist behind.
- **Recurring drivers** (fire every N hours until a checklist completes) are especially
  prone to this: gate them on an explicit state file (`STATUS: COMPLETE`) AND make the
  completion path delete the plist — unloading alone is not enough.
- If you find a stray `*.plist` for a finished job, disable it safely: back it up next to
  the project (`<name>.plist.disabled`) and `rm` it from `~/Library/LaunchAgents/`; leave
  the driver script/logs/state as the run record. Do **not** re-arm it without the owner asking.

## Dependency

Requires the [`Usage/`](../Usage/) kit (session-limit hook) — without the injected %
and reset time, Claude has no reliable signal to trigger on. Install that first
([Usage/SETUP.md](../Usage/SETUP.md)).

## Setup

No installation — this is a behavior rule. Paste [`CLAUDE.starter.md`](CLAUDE.starter.md)
into your workspace `CLAUDE.md` (after setting up the Usage kit).
