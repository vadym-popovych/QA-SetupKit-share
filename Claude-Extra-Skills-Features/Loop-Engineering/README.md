# Loop-Engineering kit

Home for **loop engineering** — running Claude in recurring, self-correcting loops
(via the harness's native `/loop` command) **without giving up QA discipline**. The
harness gives you the loop mechanics: a prompt or slash-command re-run on an interval
or self-paced via scheduled wakeups. It does NOT give you a success rubric, a separate
grader, stop conditions, or an audit trail — those are the **practice this kit defines**.

Two kinds of loops, and the distinction is load-bearing:

| Kind | What it does | Mutates files? | Gate |
|---|---|---|---|
| **REPAIR loop** | fixer + verifier pair that repairs test **harness** files (locators, flow YAML, test plumbing) within a declared allowlist until a rubric passes | yes — allowlist only | 🟡 owner confirms before first run |
| **OBSERVATION loop** | read-only recurring check (invariant watch, cover-settle watch, long-run monitoring) that only reports | only its own artifacts folder + report tabs declared in the spec | 🟢 auto |

Only repair loops need maker-checker separation; observation loops are just recurring
read-and-report.

## Core principles (non-negotiable)

1. **Maker-checker separation.** The fixer never grades its own result. The **verifier is
   an outer-loop script** (strongest separation — not a subagent promise, a structural
   fact); the fixer is a subagent that may NOT write statuses/verdicts and does NOT run
   the final verification.
2. **"Never fake a Pass" extends to loops.** A loop may repair the HARNESS — locators,
   flow YAML, test plumbing. It must NEVER touch assertions, expected values, golden
   baselines, or checklist statuses to force green. App-caused failure = product bug → `BUG-NNN`
   (per [`../../QA-Documentation/Bug-Reports/`](../../QA-Documentation/Bug-Reports/)), not a loop fix.
3. **Explicit stop conditions before the first run.** Every loop is declared in a
   **loop-spec** file ([`template/loop-spec.template.md`](template/loop-spec.template.md)):
   success rubric, `max_iterations`, escalation rule, fixer allowlist. No open-ended loops.
4. **Machine-checked allowlist (R0 guard).** The verifier records a checksum manifest of
   off-limits paths at loop start and re-verifies every iteration. Any out-of-allowlist
   change = immediate abort + escalate.
5. **Audit trail per iteration.** What failed, what changed, why — logged to
   `<Project>/<Testing-Type>/loops/<run-id>/`; final summary also to a Drive date-folder.

## ⚠️ The load-testing boundary — repair loops have no target there

A load run that parks items incomplete is (in the reference app) the **intended,
user-driven lazy state** — not harness damage, so there is nothing for a repair loop to
"heal". Resuming = driving the flow forward is a normal, budget-gated **scenario
operation** (declared and reported), not a loop fix; genuinely **failed** items are
reported as bugs, never re-kicked to force green. Load-testing's natural loop kind is
**observation** (e.g. INV-1/INV-2 invariant watch, cover-settle watch — see
[`../../Testing-Types/Load-Testing/`](../../Testing-Types/Load-Testing/)). Spelled out in [`LOOP_RULES.md`](LOOP_RULES.md) §3.

## What lives here (scope)

- [`SETUP.md`](SETUP.md) — Claude-followable onboarding: pick the loop kind, author the
  loop-spec, wire the verifier, dry-run, gate, run, wrap up.
- [`LOOP_RULES.md`](LOOP_RULES.md) — the rules that travel with the kit.
- [`template/loop-spec.template.md`](template/loop-spec.template.md) — the per-loop
  declaration template + a filled example (the self-healing locators pilot).
- [`CLAUDE.starter.md`](CLAUDE.starter.md) — block a teammate pastes into THEIR workspace `CLAUDE.md`.

## What does NOT live here

- **No `<Project>/Loop-Engineering/` folder — ever.** This is a **harness-practice kit**:
  loops serve another discipline, so loop artifacts land in that discipline's project
  folder — e.g. `<Project>/UI-Automation/loops/<run-id>/` — per the
  [`../../Rules-Guide/Project-Configuration/`](../../Rules-Guide/Project-Configuration/) convention.
- **No rubric implementations.** Rubrics ship with the discipline they verify: the first
  implemented one (self-healing locators) lives at [`../../Testing-Types/UI-Automation/rubric/`](../../Testing-Types/UI-Automation/rubric/).
- No project data, no credentials, no run logs — templates and rules only.

## Relationship to the other kits

- **[`../../Testing-Types/UI-Automation/`](../../Testing-Types/UI-Automation/)** — hosts the first implemented rubric
  ([`rubric/`](../../Testing-Types/UI-Automation/rubric/)) for the self-healing locators loop; its
  stability order (aria/role → data-* → semantic tags → text, never auto-generated ids)
  IS the loop's remap policy.
- **[`../../Testing-Planning/Test-Oracles/`](../../Testing-Planning/Test-Oracles/)** — rubric discipline: every criterion is a
  named, script-checkable oracle; no identifiable oracle = not-run, never Passed.
- **[`../../Testing-Planning/QA-Agent-Playbooks/`](../../Testing-Planning/QA-Agent-Playbooks/)** — gate semantics: launching a
  repair loop is a 🟡 gate (show the loop-spec summary, WAIT for owner confirmation);
  read-only observation loops are 🟢.
- **[`../Cron-Session/`](../Cron-Session/)** +
  [`Usage/`](../Usage/) — session-budget guards: ≥25%
  headroom to launch, check before each iteration, pause at iteration boundaries only.
- **[`../../Testing-Types/Load-Testing/`](../../Testing-Types/Load-Testing/)** — observation loops only (see anti-case above).

## Rollout status

| Loop | Status | Iteration budget |
|---|---|---|
| **UI-Automation self-healing locators** (piloted on a CRM platform) | ✅ implemented — rubric at [`../../Testing-Types/UI-Automation/rubric/`](../../Testing-Types/UI-Automation/rubric/) | 5 |
| **API-Testing suite-hardening** | 🔜 outlined (next) | 5 per pass |
| **App-Emulators Maestro screen-coverage** | 🔜 outlined | 3 per screen |

Rollout order: locators → API → Maestro. Budgets are defaults — tune after the pilot.
