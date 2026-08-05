# Loop-Engineering starter rules — paste into YOUR workspace CLAUDE.md

## Iterative fix/verify loops — Loop-Engineering kit
- **Home for engineered QA loops** (self-healing locators, "keep fixing until green",
  recurring read-only watches): `QA-SetupKit/Claude-Extra-Skills-Features/Loop-Engineering/`. When the user asks for
  a self-healing / iterating / recurring loop → follow the kit's `SETUP.md` and
  `LOOP_RULES.md` exactly. Native `/loop` (self-paced) only re-runs a prompt — the
  rubric, verifier, and budgets below are what this kit adds on top.
- **Four non-negotiable principles:** (1) maker-checker — the fixer subagent never
  grades its own result; an outer-loop verifier script runs the rubric, the fixer
  writes no verdicts; (2) never fake a Pass — loops repair the HARNESS (locators, flow
  YAML, test plumbing) and NEVER touch assertions, expected values, golden baselines, or statuses;
  app-caused failure = product bug → `BUG-NNN`; (3) explicit stop conditions BEFORE
  the first run — a loop-spec file (kit template) with rubric, allowlist,
  `max_iterations`, escalation, budgets; no open-ended loops; (4) audit trail — log
  every iteration, final summary to `loops/<run-id>/` + Drive, report ends with a
  LINKS section.
- **Two loop kinds:** REPAIR (fixer+verifier, allowlisted harness edits, all rules
  apply) vs OBSERVATION (read-only recurring checks — invariant watch, monitoring;
  may write only its own artifacts + report tabs declared in the spec).
- **Load-testing boundary:** run "recovery" is NOT a repair-loop use case — items
  parked incomplete by a lazy, user-driven flow are EXPECTED state, not harness
  damage; resuming = a declared, budget-gated scenario op; genuinely failed items are
  reported as bugs, never re-kicked to force green. Load-testing loops = OBSERVATION.
- **Gates:** launching a repair loop = 🟡 yellow gate (show the loop-spec summary,
  wait for owner confirmation, per QA-Agent-Playbooks); read-only observation loops
  are 🟢 green (auto). Allowlist is machine-checked (R0 checksum guard over
  off-limits paths); any out-of-allowlist change = abort + escalate. Same item fails
  2 consecutive iterations → stop + escalate.
- **Artifacts:** `<Project>/<Testing-Type>/loops/<run-id>/` (run-id =
  `YYYY-MM-DD-slug`), final summary also to a Drive date-folder. Launching any loop
  requires ≥25% session headroom; check the session limit before each iteration;
  pause only at iteration boundaries.
