# Loop-Engineering — setup

Self-contained steps a teammate's Claude can follow to declare and run a QA loop.
There is nothing to install for this kit itself — the loop mechanism is the harness's
native **`/loop`** command (self-paced mode). What you set up is the **discipline**:
a loop-spec, a verifier, a gate, and an artifact trail.

## Prerequisites (auto-detect first)

1. **The target discipline's kit is set up first.** A loop repairs or observes an
   EXISTING harness — it never bootstraps one. For the locators loop:
   `<Project>/UI-Automation/` exists with `locators/*.json`, `page-objects/*.ts`,
   `LOCATORS.md` per [`../../Testing-Types/UI-Automation/SETUP.md`](../../Testing-Types/UI-Automation/SETUP.md). No
   artefacts → do that setup first, no loop.
2. **Session-limit monitoring (recommended).** The Usage kit
   ([`../Usage/`](../Usage/))
   provides `session-limit.py` — the budget guards in step 6 depend on it. Without it,
   keep loops short and watch `/usage` manually.
3. **`node` 18+** — verifier rubric scripts are plain Node, no extra deps.

## Step 1 — pick the loop kind (3 questions)

1. **Will the loop modify any file?** No → **OBSERVATION** loop (read-only recurring
   check; 🟢 green gate). Yes → continue.
2. **Are the files it would modify harness files** (locators, flow YAML, test plumbing,
   page objects) **— not assertions, expected values, or checklist statuses?**
   No → STOP. That is not a loop, that is faking a Pass. App-caused failures become
   `BUG-NNN`; expected-value changes are an owner decision.
3. **Is this load-testing run "recovery"?** Then there is nothing for a repair loop to
   heal (see [`LOOP_RULES.md`](LOOP_RULES.md) §3): books parked incomplete are the
   app's EXPECTED read-driven state — resuming them is a normal, budget-gated scenario
   operation (drive reads forward), not a loop fix, and `status:failed` items are
   reported, never re-kicked to green. If what you actually need is watching invariants
   after a run → OBSERVATION loop. Otherwise → **REPAIR** loop (fixer + verifier;
   🟡 yellow gate).

## Step 2 — author the loop-spec

Copy [`template/loop-spec.template.md`](template/loop-spec.template.md) to
`<Project>/<Testing-Type>/loops/<loop-name>.loop-spec.md` and fill every field:
name, kind, target (project + discipline folder), trigger, fixer allowlist (globs),
off-limits paths, machine-checkable rubric (one shell command per criterion),
`max_iterations`, escalation rule, budget guards, artifacts destination, verifier
command, gate + approver.

A loop-spec with a rubric criterion that has **no runnable check command** is invalid —
that criterion has no oracle (see [`../../Testing-Planning/Test-Oracles/`](../../Testing-Planning/Test-Oracles/)) and the loop
must not start.

## Step 3 — wire the verifier

The verifier is an **outer-loop script**, never the fixer subagent. For the
self-healing locators loop:

1. Rubric scripts live in [`../../Testing-Types/UI-Automation/rubric/`](../../Testing-Types/UI-Automation/rubric/)
   (shipped with that kit — R0 allowlist guard, R1 unique resolution, R2 stability-order
   lint, R3 suite classification, R4 Traps completeness).
2. Create your config from `../../Testing-Types/UI-Automation/rubric/config.example.json` →
   **`<Project>/UI-Automation/rubric.config.json`** (the canonical name/location — the
   rubric auto-finds it without `--config`, and `**/rubric.config.json` is gitignored
   because real configs carry real creds). **Set `projectDir` for YOUR location**: `"."`
   when the config sits next to the artefacts (the canonical spot); the example's value
   is a placeholder, not a working path — it must be set before the first run.
   (Test-stand creds `Supervisor`/`Supervisor` are public test creds — fine in the
   example.)
3. **No hardcoded `/Users/<name>` paths** — everything is parameterized via the config
   (multi-user rule); the rubric resolves the project folder from the config, not from
   whoever authored it.

For other loop kinds, the verifier is whatever script re-runs the spec's rubric
commands and writes the per-iteration verdict — same contract.

## Step 4 — record the baselines, then dry-run the verifier BEFORE iteration 1

First, record the two baselines — ONCE, at loop start, before the fixer's first
iteration (the dry-run only verifies AGAINST them, it does not record them):

```bash
cd <Project>/UI-Automation
node <kit>/UI-Automation/rubric/allowlist-guard.mjs --config rubric.config.json --snapshot  # R0 manifest
node <kit>/UI-Automation/rubric/check-traps.mjs     --config rubric.config.json --snapshot  # R4 locator baseline
```

Then run the verifier once against the current (possibly broken) state:

```bash
node <kit>/UI-Automation/rubric/run-rubric.mjs --config rubric.config.json
# offline variant (no stand/suite): add --skip R1,R3 — verdict is marked non-final
```

- It must **execute end-to-end** and produce a per-criterion verdict — a rubric that
  crashes cannot green-light anything, so the loop must not start.
- It should **fail on the criteria that motivated the loop** (e.g. R1 red on the broken
  locators). All-green on a broken harness = broken rubric.

## Step 5 — get the gate confirmation

- **Repair loop → 🟡 yellow gate** (per [`../../Testing-Planning/QA-Agent-Playbooks/`](../../Testing-Planning/QA-Agent-Playbooks/)):
  show the owner the loop-spec summary — kind, trigger, allowlist, rubric, budgets,
  escalation — and **WAIT for explicit confirmation**. Starting without it = failed run.
- **Observation loop → 🟢 green** (auto). It may write ONLY to its own artifacts folder
  and to the report tab(s) **declared in its loop-spec** — that is its reporting output.
  Any other write — any project/harness file, any undeclared tab — reclassifies it as a
  repair loop → 🟡 gate. (Same wording in `LOOP_RULES.md` §2/§6.)

## Step 6 — run via native `/loop`, self-paced

Start `/loop` in **self-paced** mode with a prompt that executes ONE iteration per wake.
The rubric and maker-checker separation are NOT built into `/loop` — your prompt and the
outer verifier provide them:

- **One iteration per wake:** verifier classifies failures → fixer subagent repairs
  within the allowlist → verifier re-runs the rubric → log the iteration. The fixer is
  denied verdict-writing and does not run the final verification.
- **Stop conditions** (from the spec, checked by the verifier every iteration):
  SUCCESS = all rubric criteria pass · `max_iterations` reached · same item failed
  **2 consecutive iterations** → stop + escalate to human (likely a redesign/removed
  element, not drift) · any out-of-allowlist change (R0) → **abort immediately**.
- **Budget guards** (workspace session rules, restated in the spec): ≥25% session
  headroom to launch; run `python3 ~/.claude/scripts/session-limit.py` before each
  iteration; at ≥80% usage check EVERY iteration; at ≥90% use `--fresh` and plan the
  stop. Pause only at **iteration boundaries** — finish the current atomic iteration,
  write the handoff, schedule the continuation per
  [`../Cron-Session/`](../Cron-Session/).

### How an iteration looks

```
/loop wake N
  │
  ├─ session-limit check ──────────────── ≥ threshold? → handoff + Cron-Session pause
  ├─ VERIFIER: R0 allowlist guard ─────── off-limits checksum changed? → ABORT + escalate
  ├─ VERIFIER: run rubric R1..Rn ──────── all pass? → SUCCESS → step 7
  │      └─ classify failures: harness-caused → fix list │ app-caused → BUG-NNN, out of scope
  ├─ escalation check ─────────────────── same item failed 2× in a row? → STOP + escalate
  │                                        iteration N = max_iterations? → STOP + escalate
  ├─ FIXER (subagent): repair fix-list items, allowlist files ONLY
  │      └─ writes NO statuses, NO verdicts, runs NO final verification
  ├─ VERIFIER: re-run rubric ──────────── record per-criterion verdict
  └─ LOG iteration → loops/<run-id>/iteration-NN.md  →  sleep until next wake
```

## Step 7 — wrap up

1. **Final summary** → `<Project>/<Testing-Type>/loops/<run-id>/summary.md`
   (run-id = `YYYY-MM-DD-slug`): iterations used, per-criterion final verdicts, every
   file changed and why, items escalated, `BUG-NNN`s filed.
2. **Copy the summary to a Drive date-folder** (same flow as the Load-Testing per-run
   Google Doc — see [`../../Testing-Types/Load-Testing/LOAD_TESTING_RULES.md`](../../Testing-Types/Load-Testing/LOAD_TESTING_RULES.md)).
3. **End the report with a LINKS section** — every artifact as a clickable link:
   loop-spec, per-iteration logs, final summary (local + Drive), bug rows.
