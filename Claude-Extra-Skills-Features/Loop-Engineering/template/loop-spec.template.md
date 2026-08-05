# Loop-spec — <loop name>

<!--
  Per-loop declaration. A loop is DECLARED BEFORE ITS FIRST RUN — no spec, no loop.
  Copy this file to <Project>/<Testing-Type>/loops/<loop-name>.loop-spec.md and fill
  EVERY field. Delete the comments once filled. A rubric criterion without a runnable
  check command = no oracle = invalid spec (see ../../../Testing-Planning/Test-Oracles/).
  A filled example follows at the bottom of this file.
-->

| Field | Value |
|---|---|
| **Name** | <!-- short slug, e.g. `locators-self-heal` --> |
| **Kind** | <!-- `repair` (fixer+verifier, mutates allowlist files) or `observation` (read-only, reports) --> |
| **Target** | <!-- `<Project>` + discipline folder, e.g. `<Project>/UI-Automation/` — loop artifacts land THERE, never in a Loop-Engineering folder --> |
| **Trigger** | <!-- what starts the loop, e.g. "Playwright run fails with locator-RESOLUTION errors". Assertion failures are product bugs → BUG-NNN, never a loop trigger --> |
| **Fixer allowlist** | <!-- globs the fixer MAY edit, e.g. `locators/*.json`, `page-objects/*.ts`, `LOCATORS.md`. Empty for observation loops --> |
| **Off-limits paths** | <!-- globs checksummed by R0 at loop start and re-verified every iteration: spec files, assertions, expected values, checklist tabs. Any change = immediate abort + escalate --> |
| **max_iterations** | <!-- hard cap; defaults: locators 5 · Maestro 3 per screen · API 5 per pass --> |
| **Escalation rule** | <!-- default: same item fails 2 consecutive iterations → stop + escalate to human --> |
| **Budget guards** | <!-- default: ≥25% session headroom to launch; session-limit check before each iteration; ≥80% → check every iteration; ≥90% → `--fresh` + plan the stop; pause only at iteration boundaries (Cron-Session) --> |
| **Artifacts** | <!-- `<Target>/loops/<run-id>/` (run-id = YYYY-MM-DD-slug): iteration-NN.md per iteration + summary.md; summary ALSO to a Drive date-folder; report ends with LINKS --> |
| **Verifier command** | <!-- the OUTER-LOOP script that runs the whole rubric — never the fixer subagent --> |
| **Gate + approver** | <!-- repair → 🟡 owner confirms loop-spec summary before first run (name the approver); observation, read-only → 🟢 auto --> |

## Success rubric

<!--
  Machine-checkable only: each criterion = one command, exit 0 = pass.
  R0 (allowlist guard) is MANDATORY for every repair loop.
  SUCCESS = ALL criteria pass in the same iteration.
-->

| ID | Statement | Check command |
|---|---|---|
| R0 | No off-limits path changed since loop start (checksum manifest) | <!-- e.g. `node <kit>/UI-Automation/rubric/allowlist-guard.mjs --config <cfg> --check` or `run-rubric.mjs --config <cfg> --only R0` --> |
| R1 | <!-- criterion --> | <!-- command, exit 0 = pass --> |
| R2 | <!-- criterion --> | <!-- command --> |

## Stop conditions

<!-- Restate explicitly — the verifier checks these every iteration: -->
- SUCCESS: all rubric criteria pass.
- `max_iterations` reached → stop + escalate with per-criterion state.
- Escalation rule fired (same item failed 2 consecutive iterations) → stop + escalate.
- R0 violation (out-of-allowlist change) → **abort immediately** + escalate.
- Session budget: pause at iteration boundary + Cron-Session handoff.

---

# EXAMPLE (filled) — <Project> self-healing locators pilot

| Field | Value |
|---|---|
| **Name** | `locators-self-heal` |
| **Kind** | `repair` |
| **Target** | `<Project>/UI-Automation/` (Creatio test stand; public test creds `Supervisor`/`Supervisor` in `config.example.json` — real configs stay gitignored) |
| **Trigger** | Playwright run fails with locator-RESOLUTION errors (element not found / ambiguous match). Assertion failures = product bugs → `BUG-NNN`, out of scope for the loop |
| **Fixer allowlist** | `<Project>/UI-Automation/locators/*.json` · `<Project>/UI-Automation/page-objects/*.ts` · `<Project>/UI-Automation/LOCATORS.md` |
| **Off-limits paths** | DEFAULT-DENY: R0 checksums **everything** under the target outside the allowlist (incl. new files); extra explicit pins in the config: `tests/**` (specs + assertions), `tools/**`, `dom-snapshots/**`, `screenshots/**` |
| **max_iterations** | 5 |
| **Escalation rule** | Same locator fails remap 2 consecutive iterations → stop + escalate (likely redesign/removed element, not selector drift) |
| **Budget guards** | ≥25% headroom to launch; `python3 ~/.claude/scripts/session-limit.py` before each iteration; ≥80% → every iteration; ≥90% → `--fresh` + plan stop; pause at iteration boundaries only (Cron-Session) |
| **Artifacts** | `<Project>/UI-Automation/loops/<run-id>/` (e.g. `2026-07-14-locators-self-heal/`): `iteration-NN.md` + `summary.md`; summary → Drive date-folder; LINKS section in the report |
| **Verifier command** | `node QA-SetupKit/Testing-Types/UI-Automation/rubric/run-rubric.mjs --config <Project>/UI-Automation/rubric.config.json` (config copied from `rubric/config.example.json` with `projectDir: "."`; gitignored; no hardcoded user paths) |
| **Gate + approver** | 🟡 repair — Vadym confirms this spec summary before the first run |

## Success rubric

<!-- `RUBRIC` below = `node QA-SetupKit/Testing-Types/UI-Automation/rubric`; `CFG` = `--config <Project>/UI-Automation/rubric.config.json` -->

| ID | Statement | Check command |
|---|---|---|
| R0 | No path outside the allowlist changed since loop start (default-deny checksum manifest, recorded ONCE at loop start via `allowlist-guard.mjs CFG --snapshot`) | `RUBRIC/allowlist-guard.mjs CFG --check` (= `run-rubric.mjs CFG --only R0`) |
| R1 | Every `locators/*.json` locator resolves to **exactly one** element on the live page (TS-only selectors reported as unmapped notices — see rubric README) | `RUBRIC/verify-locators.mjs CFG` (= `--only R1`) |
| R2 | No locator violates the stability order (aria/role → data-* → semantic tags → text); lint rejects auto-generated ids (`mat-input-N`, GUIDs, `_ngcontent-*`, root nth-child chains) | `RUBRIC/lint-locators.mjs CFG` (= `--only R2`) |
| R3 | Full Playwright suite green, OR every remaining failure is an assertion failure classified as a product bug (`BUG-NNN` filed). **Currently skipped:** `testCommand: null` until <Project> has a spec suite — a skipped-by-config R3 still yields `complete: true` by design | `run-rubric.mjs CFG --only R3` |
| R4 | `LOCATORS.md` Traps section has an entry (old → new + reason) for every locator changed this run (baseline recorded ONCE at loop start via `check-traps.mjs CFG --snapshot`) | `RUBRIC/check-traps.mjs CFG` (= `--only R4`) |

## Fixer instructions (subagent — no verdicts, no final verification)

Headless re-capture of the live DOM → diff captured DOM vs `locators/*.json` → remap
broken locators using the stability order → update `locators/*.json` +
`page-objects/*.ts` + `LOCATORS.md` Traps → hand back to the verifier. The fixer never
edits tests/assertions, never writes statuses, never declares success.

## Stop conditions

- SUCCESS: verifier (`run-rubric.mjs CFG`) reports `pass: true` AND `complete: true` in
  one iteration — R0/R1/R2/R4 green; R3 joins once `testCommand` is configured (while
  `null` it is reported skipped-by-config and does not block `complete`).
- 5 iterations used → stop + escalate with per-criterion state.
- Same locator failed remap 2 iterations in a row → stop + escalate.
- R0 violation → abort immediately + escalate.
- Session budget threshold → pause at iteration boundary, Cron-Session handoff.
