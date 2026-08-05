# Claude-Extra-Skills-Features — harness add-ons for Claude Code

Home for **extra Claude Code skills / features** that aren't QA artefacts themselves but
make the agent work better: usage monitoring, custom hooks, helper skills. One subfolder
per feature — same convention as `QA-Documentation/` (never mix features in one folder).

| Feature | What it gives you | Start here |
|---------|-------------------|------------|
| [`Usage/`](Usage/) | Claude sees its own 5-hour session token limits: % used, exact reset time, weekly quota — injected into every prompt via a `UserPromptSubmit` hook | [Usage/SETUP.md](Usage/SETUP.md) |
| [`Cron-Session/`](Cron-Session/) | Auto-pause & resume: at ~95% session usage Claude saves a handoff and schedules a one-shot cron to continue the task right after the window resets (requires `Usage/`) | [Cron-Session/README.md](Cron-Session/README.md) |
| [`Loop-Engineering/`](Loop-Engineering/) | Engineered QA loops on top of native `/loop`: repair loops (fixer + outer-loop verifier, machine-checked allowlist, loop-spec, 🟡 gate) and read-only observation loops; first implemented rubric — self-healing locators at [`../Testing-Types/UI-Automation/rubric/`](../Testing-Types/UI-Automation/rubric/) | [Loop-Engineering/SETUP.md](Loop-Engineering/SETUP.md) |
| [`Knowledge-Distillation/`](Knowledge-Distillation/) | Method for compressing a knowledge file (CLAUDE.md, RULES, runbook) without losing a rule: inventory → draft → **gap audit** → deploy → verify. Proven 12/07/2026: 104k → 40k chars, zero rules lost | when the memory file grows past the point where the agent reliably reads all of it |
| [`Memory-Eval/`](Memory-Eval/) | Measures whether a memory file still surfaces the right rule at the right moment: a fresh agent retrieves, an independent judge scores it against the scenario's oracle. The companion of `Knowledge-Distillation/` — distillation compresses the memory, this checks it survived, so a restructure is measured instead of guessed | [Memory-Eval/SETUP.md](Memory-Eval/SETUP.md) |
| [`Remote-Control/`](Remote-Control/) | Every chat started in the IDE panel publishes itself to Remote Control, so it is readable and answerable from the phone. A stdio proxy the IDE spawns instead of the Claude binary; it injects the one control request the host never sends, because the auto-enable gate is a server-side flag and the CLI-side `remoteControlAtStartup` is skipped in the IDE's stream-json mode | [Remote-Control/SETUP.md](Remote-Control/SETUP.md) |
| [`Context-Budget/`](Context-Budget/) | The always-on cost nobody budgets for: every installed skill's description is injected into **every** session, used or not. Audits which skills have ever actually fired on this machine, then reversibly prunes the idle ones. Measured on the run it came from: −901 prompt tokens, zero rules touched | [Context-Budget/SETUP.md](Context-Budget/SETUP.md) |

## Adding a new feature

1. Create a subfolder `<Feature-Name>/` with at minimum: `SETUP.md` (Claude-followable
   install steps), `README.md` (what/why/how it works), and `CLAUDE.starter.md` (rules
   block the teammate pastes into THEIR workspace `CLAUDE.md`) if the feature changes
   agent behavior.
2. Register it in the table above and in the root [`QA-SetupKit/README.md`](../README.md).
3. Secrets never live in the kit — tokens/credentials are per-user and created during setup.
