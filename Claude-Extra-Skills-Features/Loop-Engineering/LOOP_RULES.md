# Loop-Engineering rules — iterative fix/verify loops for QA harnesses

Rules Claude follows when asked to "set up a self-healing loop", "keep fixing until the
suite is green", "run this check on repeat" or similar. Mirrored from the workspace
`CLAUDE.md` of the kit author so they travel with the kit.

## 0. What loop engineering is here

**Design the loop and its rubric — don't hand-prompt each iteration.** A loop is an
engineered artefact: a declared spec, a fixer with bounded permissions, an independent
verifier, and hard stop conditions. The agent's job is to build that structure once,
then let it run.

**What native `/loop` provides vs what this kit adds.** In this harness, `/loop` is a
recurring run of a prompt or slash-command — fixed interval or **self-paced** via
scheduled wakeups (self-paced is the mode this kit uses; the ralph-loop plugin is not
needed). That is ALL it provides: it has **no built-in success rubric and no separate
grader**. Those are the loop-engineering practice this kit defines on top:

- a **loop-spec file** declared before the first run (see §1.3);
- an **outer-loop verifier script** that grades every iteration mechanically;
- a **fixer subagent** that repairs but never grades;
- iteration + session budgets, gates, and an audit trail.

## 1. Four non-negotiable principles

### 1.1 Maker-checker separation
The fixer agent NEVER grades its own result. Verification is an independent rubric
re-run in the **outer loop** — a script, not the fixer (strongest separation: the
separation falls out of STRUCTURE, not of promises). The fixer is a subagent that:
- may edit only its allowlisted files (§5);
- must NOT write statuses, verdicts, or "success" claims anywhere;
- does NOT run the final verification — the outer-loop verifier command does.

### 1.2 "Never fake a Pass" extends to loops
A loop may repair the **HARNESS** — locators, flow YAML navigation, test plumbing. It
must NEVER touch assertions, expected values, golden baselines, or checklist statuses
to force green. This generalizes the [`../../Testing-Planning/Test-Oracles/`](../../Testing-Planning/Test-Oracles/) rule
"re-recording a baseline to green a test = fabricating a Pass": editing an expected
value inside a loop is the same fabrication, automated. An app-caused failure is a
product bug → file `BUG-NNN` (per [`../../QA-Documentation/Bug-Reports/`](../../QA-Documentation/Bug-Reports/)),
never a loop fix.

### 1.3 Explicit stop conditions BEFORE the first run — the loop-spec
No open-ended loops. Every loop is declared in a **loop-spec file** (template ships in
this kit: [`template/loop-spec.template.md`](template/loop-spec.template.md)) before
iteration 1, containing: name · kind (repair/observation, §2) · target (project +
discipline folder) · trigger · fixer allowlist · off-limits paths · machine-checkable
rubric (one runnable command per criterion) · `max_iterations` · escalation rule ·
session-budget guards · artifacts destination · verifier command · gate (§6). A loop
without a spec does not launch.

### 1.4 Audit trail per iteration
Log every iteration: what failed, what the fixer changed, why. Final summary goes to
the loop's artifacts folder AND to a Drive date-folder (§7). Every loop run report ends
with a clickable **LINKS section** (same convention as [`../../Testing-Types/Load-Testing/`](../../Testing-Types/Load-Testing/)
run reports).

## 2. Loop taxonomy — repair vs observation

| Kind | What it does | Rules that apply |
|---|---|---|
| **REPAIR** | fixer + verifier; mutates harness files within an allowlist | ALL of this doc: maker-checker (§1.1), allowlist guard (§5), 🟡 gate (§6), iteration budget (§4) |
| **OBSERVATION** | read-only recurring checks — e.g. invariant watch / cover-settle watch after load runs, long-run monitoring | no maker-checker needed (nothing is fixed); 🟢 gate if strictly read-only; still needs a loop-spec with stop condition, budget guards (§4), audit trail (§1.4) |

Naming matters: call a loop by its kind. An observation loop may write ONLY to its own
artifacts folder and to the report tab(s) **declared in its loop-spec** (that is its
reporting output). Any other write — any project/harness file, any undeclared tab —
makes it a repair loop, whatever it is called.

## 3. The load-testing boundary — nothing to "heal"; resume is a scenario op

History: the owner's 2026-07-08 rule («stalled run → leave as-is, do NOT auto-resume»)
was a TEMPORARY evidence-preservation measure during a bug investigation — lifted
2026-07-11 after verifying the app code: generation is strictly **user-driven** (the
only trigger is `POST /books/:id/unlock-next-chapter`; no background auto-advance), so
a book parked incomplete at `step:idle` that nobody reads forward is the app's
**INTENDED lazy-generation state**, not harness damage.

Consequences for loops:
- **Don't build a repair loop around load-run "recovery"** — there is nothing broken
  for a fixer to fix; the repair machinery (fixer, allowlist, R0) has no target.
- **Resuming = driving reads forward** is a normal, user-shaped **scenario operation**:
  declare it, report it in the run report, and budget it (real generation = model cost;
  sizeable resume passes agreed with the owner first). It is a scenario step, not a
  self-healing loop.
- **Never re-kick failed items to green a run** (e.g. `status:failed` books): that
  masks a genuine defect (an invariant violation → `BUG-NNN`) and breaks §1.2. Failed
  items are reported, not repaired.
- Load-testing's natural loop kind is **OBSERVATION**: invariant watch (INV-1/INV-2),
  cover-settle-watch, long-run monitoring — read, report. Prevention still beats
  repair: configure runs correctly up front (e.g. per-batch `READ_TIMEOUT` ≥
  `MAX_DURATION`). See [`../../Testing-Types/Load-Testing/LOAD_TESTING_RULES.md`](../../Testing-Types/Load-Testing/LOAD_TESTING_RULES.md).

## 4. Stop conditions & budgets

**Iteration budgets (defaults — tune after the pilot):**
- self-healing locators loop: `max_iterations = 5`
- Maestro screen-coverage loop: 3 per screen
- API suite-hardening loop: 5 per pass

**Escalation rule (all repair loops):** the same item (locator, screen, test) fails
remap/fix on **2 consecutive iterations** → stop + escalate to a human. Two identical
failures usually mean a redesign or a removed element, not drift a loop can fix.

**Session-budget guards** (reuse the workspace rules from
[`../Usage/`](../Usage/) +
[`../Cron-Session/`](../Cron-Session/)):
- launching ANY loop requires **≥ 25% session headroom**;
- check the session limit (`python3 ~/.claude/scripts/session-limit.py`) before each
  iteration; at **≥ 80%** usage check every iteration; at **≥ 90%** use `--fresh` and
  plan the stop point;
- pause ONLY at iteration boundaries: finish the current atomic iteration, write the
  handoff, schedule the continuation per the Cron-Session kit. Never abandon a
  half-applied fix.

Stop = the FIRST of: rubric fully green · `max_iterations` reached · escalation rule
fired · budget guard fired · allowlist violated (§5). The final summary names which
condition fired.

## 5. Allowlist enforcement — the R0 checksum guard (machine-checked)

The allowlist is enforced by the verifier, not by trust. **R0 "allowlist guard"** is
criterion zero of every repair-loop rubric: the rubric runner records a **checksum
manifest of all off-limits paths at loop start** and re-verifies it on every iteration.
ANY change outside the allowlist — spec files, assertions, expected values, statuses —
= **immediate abort + escalate**, regardless of how green the rest of the rubric looks.

## 6. Gates (per [`../../Testing-Planning/QA-Agent-Playbooks/`](../../Testing-Planning/QA-Agent-Playbooks/))

- **Launching a repair loop = 🟡 yellow gate:** show the owner the loop-spec summary
  (trigger, allowlist, rubric, budgets, escalation) and WAIT for confirmation before
  iteration 1.
- **Observation loops = 🟢 green (auto).** They may write ONLY to their own artifacts
  folder and to the report tab(s) declared in the loop-spec (§2). Any other write
  disqualifies — reclassify as repair, 🟡 gate.

## 7. Artifacts & run-ids

- Everything a loop produces lands in **`<Project>/<Testing-Type>/loops/<run-id>/`**
  (run-id = `YYYY-MM-DD-slug`, the [`../../Rules-Guide/schemas/`](../../Rules-Guide/schemas/) convention):
  per-iteration logs, diffs, the rubric results, the final summary.
- The **final summary ALSO goes to a Drive date-folder**, same flow as the
  load-testing per-run Google Doc reports.
- Every loop run report ends with a **LINKS section**: artifacts folder, Drive summary,
  any `BUG-NNN` filed, any escalation.

## 8. Reference loop designs (rollout order: 8.1 → 8.3 → 8.2)

### 8.1 UI-Automation self-healing locators loop — PRIMARY (piloted on a CRM platform)
- **Trigger:** Playwright run fails with locator-RESOLUTION errors only (assertion
  failures = product bugs, out of scope).
- **Fixer:** headless re-capture of the live DOM → diff vs `locators/*.json` → remap
  broken locators using the [`../../Testing-Types/UI-Automation/`](../../Testing-Types/UI-Automation/) stability order
  (aria/role → data-* → semantic tags → text; never auto-generated ids) → update
  `locators/*.json` + `page-objects/*.ts` + `LOCATORS.md` Traps (old→new + reason).
  Allowlist: those three artefact layers ONLY; spec files and assertions off-limits.
- **Rubric (verifier only):** R0 allowlist guard (§5) · R1 every `locators/*.json`
  locator resolves to exactly ONE element on the live page (selectors living ONLY in
  `page-objects/*.ts` are R2 ban-checked and reported by R1 as visible "unmapped"
  notices, not live-checked — keep page objects consuming `locators/*.json` values and
  the gap stays empty) · R2 no locator violates the stability order (regex lint rejects
  auto-generated ids) · R3 full Playwright suite green OR every remaining failure is an
  assertion failure classified as a product bug · R4 `LOCATORS.md` Traps updated for
  every changed locator.
- **Budgets:** `max_iterations = 5`; same locator fails remap 2× in a row → escalate.
- **Implementation:** rubric scripts ship in [`../../Testing-Types/UI-Automation/rubric/`](../../Testing-Types/UI-Automation/rubric/),
  parameterized via config — NO hardcoded `/Users/...` paths (multi-user rule). The
  `config.example.json` carries a placeholder `projectDir` (test-stand creds
  `Supervisor`/`Supervisor` are public, OK in the example).

### 8.2 App-Emulators Maestro screen-coverage loop (outline)
- **Goal:** every target screen reached + captured, or explicitly not-run with a
  comment — unreached ≠ Passed, EVER.
- **Fixer edits flow YAML NAVIGATION STEPS ONLY.** Out of scope: visual evaluation vs
  Figma, checklist filling (those stay in
  [`../../Testing-Types/App-Emulators-configurations/EMULATOR_RULES.md`](../../Testing-Types/App-Emulators-configurations/EMULATOR_RULES.md)).
- **Budgets:** 3 iterations per screen; screen unreachable after that → not-run +
  comment, escalate.

### 8.3 API-Testing suite-hardening loop (outline)
- **Loop:** extend/repair suite → run → fix **TEST CODE only** → repeat. Source of
  truth = the real Postman collection via the postman MCP
  ([`../../Testing-Types/API-Testing/`](../../Testing-Types/API-Testing/)) — never guessed endpoints.
- **API-caused failure → `BUG-NNN`** with a `HYPERLINK` back-link, NEVER an
  expected-value edit.
- **Budgets:** 5 iterations per pass; stop when the suite is green or every remaining
  failure is ticketed.

## 9. Mirror rule

When a new reusable loop-engineering rule emerges during project work, add it BOTH to
the workspace `CLAUDE.md` AND here (+ `CLAUDE.starter.md` if it changes agent
behavior), so it travels when `QA-SetupKit/` is shared.

- **Design source:** the loop discipline follows Cowork's «claude_code_loop_design_v1.md»
  (owner's Drive; §7 = agreed answers, 11/07/2026) — consult it for rationale behind
  the four principles before proposing changes to them.
