# AI-QA Roadmap — turning QA-SetupKit into an AI QA engineer

> Proposed by Claude acting as a senior (15-yr) QA lead · 07/07/2026 · reviewed with Vadym.
> This is a **planning document**, not yet-built modules. Build order and per-module
> depth are agreed with Vadym; modules are scaffolded one at a time after approval.

## Why this document exists

Today QA-SetupKit is a set of **hands**: each module *executes* a QA action well
(run k6, capture locators, scan for IDOR, seed data, drive a checklist on an emulator).
That is exactly what you want for an AI agent to *do* things.

But when an AI agent is asked to **do QA end-to-end**, execution is not the bottleneck.
The bottleneck is the **QA-engineer judgment** the kit currently assumes a human still
supplies. That judgment is four decisions:

| Judgment | The question the agent can't answer today | What closes it |
|----------|-------------------------------------------|----------------|
| **Scope** | *What to test, in what order, and when to stop?* | planning, risk, entry/exit criteria |
| **Oracle** | *Which result is correct?* (the hardest AI-QA problem) | how to decide pass vs fail objectively |
| **Memory / Coverage** | *What's already covered, what isn't, am I duplicating?* | traceability, metrics, structured data |
| **Stop / Escalate** | *Can I close this, or must a human decide?* | orchestration, human-in-the-loop gates |

The kit already carries this ethos in scattered rules — *"never fake a Pass"*,
*"unreached screens = not-run"*, *"flag contradictions with a comment even if Passed"*,
*"file BUG-NNN, don't guess severity"*. The roadmap **formalizes that ethos into its own
layer** so the kit graduates from *AI-operated tools* to an *AI QA engineer*.

## Current inventory (what already exists)

Execution/tooling modules (mature): `QA-Documentation/Checklist`,
`App-Emulators-configurations`, `Load-Testing`, `API-Testing`, `UI-Automation`,
`Security-Testing`, `Test-Data`, plus infra: `MCP-configurations`,
`Project-Configuration`, `Claude-Extra-Skills-Features`.

Built from this roadmap since 07/07/2026 (see the Status tracker below for dates):
`Test-Strategy-and-Planning/`, `Test-Oracles/`, `Rules-Guide/schemas/`,
`QA-Documentation/Test-Cases/`, `QA-Documentation/Bug-Reports/`, `Traceability/`,
`QA-Agent-Playbooks/` — the full ⭐ core. The 🔜 markers in the module sections below
reflect the ORIGINAL plan; the Status tracker is the live source of truth.

## Proposed modules — grouped by the judgment they encode

Legend: ⭐ = highest leverage for AI integration · 🔜 already anticipated by the kit.

### 🅰 Atomic artifacts the kit already announced
- **`QA-Documentation/Test-Cases/`** 🔜 — test-design techniques (equivalence
  partitioning, boundary-value analysis, decision tables, state-transition,
  pairwise/combinatorial, use-case). *For the agent:* a **derivation procedure** to
  generate cases from a spec (Figma/Postman) instead of inventing them — defensible
  coverage. Ships a machine-readable case schema
  (`id, preconditions, steps, expected, oracle, priority, traceability`).
- **`QA-Documentation/Bug-Reports/`** 🔜 — defect standard: **severity vs priority**
  rubric (decision tree), repro discipline, expected/actual, evidence, dedup rule.
  *For the agent:* a strict schema so every `BUG-NNN` is consistent and triageable,
  and the agent neither over- nor under-rates severity.

### 🅱 "Scope" judgment — what to test and when to stop
- **`Test-Strategy-and-Planning/`** ⭐ — the master planning layer: scope in/out,
  risk-based prioritization, test levels, environments, **entry/exit criteria,
  Definition of Done**. *For the agent:* its **charter**. Without it the agent tests
  forever or at random. Most deficient area today.
- **`Regression-Testing/`** — suite curation, smoke/sanity vs full regression,
  **test-impact analysis from a diff**. *For the agent:* pick the *right subset* for a
  given change instead of running everything.

### 🅲 "Oracle" judgment — what the correct result is (biggest AI lever)
- **`Test-Oracles/`** ⭐⭐ — catalogue of oracle strategies: specification-based
  (Figma / Postman schema), consistency heuristics, **differential / A-B**,
  **metamorphic**, **golden-master**, and statistical oracles for LLM outputs
  (directly the <Project> case — scoring a generated book). *Encoding this is the single
  highest-return addition; it is the hardest part of AI-QA.*
- **`Visual-Regression-Testing/`** — Playwright + perceptual diff (pixelmatch / odiff),
  Figma as baseline. *For the agent:* an objective **golden-master oracle** for UI.
- **`Accessibility-Testing/`** — WCAG 2.2 + axe-core. *For the agent:* an ideal task —
  pass/fail against concrete success criteria, highly automatable; entirely absent today.
- **`Localization-Testing/`** — pseudo-localization, truncation/overflow, RTL,
  date/number/currency formats. Oracle = the locale rules.

### 🅳 "Memory / Coverage" judgment — machine memory and reporting
- **`Rules-Guide/schemas/`** ⭐ (cross-cutting) — JSON Schemas for test-case / bug / run-result /
  checklist-row / coverage. The **"API" between modules and the agent**: every module
  emits structured data another agent can validate and consume. This is what makes
  multi-agent QA composable.
- **`Traceability/`** (RTM) — requirement → test → bug. *For the agent:* memory and
  **gap analysis** (uncovered requirements, orphan tests).
- **`Reporting-and-Metrics/`** — QA summary, coverage %, defect density, DRE,
  escaped-defect, trends in Sheets (generalizes Load-Testing's `Runs` tab to all
  disciplines).
- **`Rules-Guide/glossary/`** — shared vocabulary/ontology (what a check / case / defect / session
  / oracle is and how they relate) so agents speak one language.

### 🅴 "Stop / Escalate" judgment — orchestration
- **`QA-Agent-Playbooks/`** ⭐ — the decision layer that chains modules into an
  **end-to-end QA pass**: given a change/build/PR → which modules fire, in what order,
  with what stop-criteria; triage and routing; **human-in-the-loop gates** (an evolution
  of *"never fake a Pass"*). The QA operating model for the agent.

### 🅴+ Smaller cross-cutting
- **`Exploratory-Testing/`** — Session-Based Test Management (charters + heuristics like
  SFDIPOT): a structured way to probe beyond scripted cases.
- **`Compatibility-Testing/`** — browser/device/OS matrix (formalizes what emulators +
  UI-automation partly cover).

## Recommended build order (for AI integration)

1. **`Test-Strategy-and-Planning/`** — the charter (scope + stop-criteria)
2. **`Test-Oracles/`** — the pass/fail brain
3. **`Rules-Guide/schemas/`** — machine contracts (unlocks multi-agent composability)
4. **`Test-Cases/` + `Bug-Reports/`** — atomic artifacts (already anticipated)
5. **`Traceability/`** — memory and coverage
6. **`QA-Agent-Playbooks/`** — orchestration that stitches everything together

Then concrete disciplines as coverage grows:
`Accessibility → Visual-Regression → Exploratory → Regression → Localization → Compatibility`.

## Conventions every new module follows

Same shape as the existing mature kits, so nothing is a special case:
- Files: `README.md` + `SETUP.md` + `<TYPE>_RULES.md` + `CLAUDE.starter.md` + `template/`.
- Register in: root [`README.md`](../README.md) "Pick your direction" table,
  [`Project-Configuration/README.md`](../Project-Configuration/README.md) kit→folder map,
  and the workspace `CLAUDE.md`.
- Per-project artifacts land in `<Project>/<Testing-Type>/` at creation time.
- Bugs → `BUG-NNN` rows in the team QA Sheet; test staging/dev only; secrets never in git.
- Reusable rules get mirrored into the module's `<TYPE>_RULES.md` + `CLAUDE.starter.md`
  so they travel when the folder is shared.
- **Language: kit docs are written in English** (README · SETUP · `<TYPE>_RULES` · templates) —
  the kit is the unit of sharing and a teammate may not read Ukrainian. Two exceptions, both
  QUOTES rather than prose: **trigger phrases** as the user actually says them
  (`"проаналізуй сайт і створи артефакти по локаторах"` — the agent matches on them, so
  translating breaks the trigger) and **literal UI strings** in selectors/examples
  (`input[aria-label="Ціна"]` — that is data). Owner-facing files (the workspace `CLAUDE.md`,
  `<Project>/CLAUDE.md`, a starter's trigger list) may be in the owner's language: they never
  travel with the kit. Enforced by `kit-lint` check **L7**.

## Status tracker

| # | Module | Judgment | Priority | Status |
|---|--------|----------|----------|--------|
| 1 | Test-Strategy-and-Planning | Scope | ⭐ | ✅ Active (07/07/2026) |
| 2 | Test-Oracles | Oracle | ⭐⭐ | ✅ Active (07/07/2026) |
| 3 | schemas | Memory | ⭐ | ✅ Active (07/07/2026) |
| 4 | QA-Documentation/Test-Cases | Atomic | high | ✅ Active (08/07/2026) |
| 5 | QA-Documentation/Bug-Reports | Atomic | high | ✅ Active (08/07/2026) |
| 6 | Traceability (RTM) | Memory | high | ✅ Active (08/07/2026) |
| 7 | QA-Agent-Playbooks | Stop/Escalate | ⭐ | ✅ Active (08/07/2026) |
| 8 | Accessibility-Testing | Oracle | med | ✅ Active (08/07/2026) |
| 9 | Visual-Regression-Testing | Oracle | med | ✅ Active (08/07/2026) |
| 10 | Reporting-and-Metrics | Memory | med | ✅ Active (08/07/2026) |
| 11 | Exploratory-Testing | Scope/Oracle | med | ✅ Active (08/07/2026) |
| 12 | Regression-Testing | Scope | med | ✅ Active (08/07/2026) |
| 13 | Localization-Testing | Oracle | low | ✅ Active (08/07/2026) |
| 14 | Compatibility-Testing | Oracle | low | ✅ Active (08/07/2026) |
| 15 | glossary | Memory | low | ✅ Active (08/07/2026) |
| 16 | CI-Integration | Stop/Escalate | high | ✅ Active (12/07/2026) |
| 17 | UI-Automation → E2E suites | Oracle | med | ✅ Active (12/07/2026) |
| 18 | Kit-Autonomy-Eval | Memory | med | ✅ Active (12/07/2026) |
| 19 | Playbooks: pre-mortem gate | Stop/Escalate | low | ✅ Active (12/07/2026) |
| 20 | Knowledge-distillation method | Memory | low | ✅ Active (12/07/2026) |
| 21 | Canonical `tools/` inside the kit | Autonomy | ⭐ high | ✅ Active (12/07/2026) |
| 22 | Maturity badges in the README table | Autonomy | med | ✅ Active (12/07/2026) |
| 23 | API-Testing: finish RULES + starter | Autonomy | high | ✅ Active (12/07/2026) |
| 24 | Language convention for kit docs | Autonomy | low | ✅ Active (12/07/2026) |
| 25 | `kit-lint.mjs` — self-test for the kit | Memory | ⭐ high | ✅ Active (12/07/2026) |
| 26 | Glossary coverage pass | Memory | med | ✅ Active (12/07/2026) |
| 27 | `QA-Documentation/Custom-Reports/` (nested group) + **PageSpeed-report** doc type | Oracle | high | ✅ Active (13/07/2026) |

Update the Status column as modules get scaffolded (🔜 Planned → 🏗 In progress → ✅ Active).

## Second wave — ideas adopted from the BMAD post-mortem (12/07/2026)

Workspace-level BMAD was removed 12/07 (dev/product pipeline — out of the QA lane), but
five ideas survived the autopsy and are queued above (#16–20):

- **#16 `CI-Integration/`** ✅ **BUILT 12/07/2026** → [`Testing-Planning/CI-Integration/`](../../Testing-Planning/CI-Integration/)
  (idea: BMAD `testarch-ci`). Shipped: README + SETUP + [`CI_RULES.md`](../../Testing-Planning/CI-Integration/CI_RULES.md)
  + starter + templates (GitHub Actions PR-gate & nightly, GitLab CI, `GATES.md` gate
  register, `ci-run-result.mjs`). Two topologies (QA-repo pipeline = default, needs no
  write access; client-repo pipeline = owner-installed, the only one that can block a
  merge) and three tiers (gate / nightly / release). Client-repo READ-ONLY holds:
  pipelines land in `<Project>/CI-Integration/proposed/`, never pushed.
  **Key design finding during the build:** the kit tools (`a11y-scan.mjs`,
  `visual-diff.mjs`) are report PRODUCERS — no CLI flags, no exit codes, always exit 0,
  because triage was always a human/agent job. So a pipeline that "just calls the tool"
  gates on nothing. `ci-run-result.mjs` is therefore the gate: it reads the tool's
  report, derives the verdict, emits a schema-valid run-result, and carries the exit
  code (0 pass / 1 fail / **3 blocked**). `SCAN-FAILED`, `NO-BASELINE`, `CAPTURE-FAILED`
  and a missing report all map to **blocked, never pass** — the CI dialect of never fake
  a Pass. Schema change it forced (schema-first per SCHEMAS_RULES): `run-result.method`
  += `ci`, `discipline` += the six kits built on 08/07 that had no way to emit a result
  (accessibility, visual-regression, regression, localization, compatibility, web).
- **#17 UI-Automation extension** ✅ **BUILT 12/07/2026** → [`Testing-Types/UI-Automation/template/e2e/`](../../Testing-Types/UI-Automation/template/e2e/)
  (idea: `testarch-automate`). The kit was deliberately scenario-agnostic (it shipped
  locators + page objects and left the tests to the tester); it now also ships the
  **maintained suite**: `playwright.config.ts` (**retries: 0**, `forbidOnly` in CI, one worker
  = one pooled account), API auth setup (the login FORM keeps exactly one dedicated spec),
  deterministic run-scoped self-cleaning fixtures, a tagged `@high` gate slice (= G-1 in the
  CI-Integration kit), the **`BUG-NNN` regression-spec template** (written when a bug is marked
  fixed, asserting the ORIGINAL repro — the automated arm of bug→regression-case), and
  `SUITES.md` (register + quarantine debts with owners/expiry + an honest "deliberately NOT
  automated" table).
  **The piece that makes it stick: [`lint-specs.mjs`](../../Testing-Types/UI-Automation/template/e2e/tools/lint-specs.mjs)** — the rules are only real if
  something checks them. It fails the suite on: a locator in a spec (a selector typed into a
  spec was, by definition, guessed), a hard sleep, a **conditional assertion** (an assertion
  that can silently skip is a faked Pass with extra steps), a stray `.only` (shrinks the suite
  to one test and still reports green), an anonymous `skip`, a hardcoded credential, a spec
  with no TC/BUG/INV traceability or no tag, and an **empty suite**. Verified against a
  deliberately poisoned spec (8/8 caught), a clean spec (0), and an empty dir (fails) — and
  the kit's own templates pass their own lint.
- **#18 `Kit-Autonomy-Eval`** (idea: `bmad-eval-runner`) — automated smoke for the
  autonomy mission: fresh kit clone + starter blocks in a clean environment must yield
  a working configuration; run after major kit changes, report gaps as findings.
- **#19 Playbooks enhancement** (idea: `bmad-advanced-elicitation`) — a **pre-mortem
  step** in the release-candidate playbook: "the release failed — write the incident
  report" before the gate; catches risks checklists miss.
- **#20 Distillation method** (idea: `bmad-distillator`) — write down the CLAUDE.md
  compression procedure used 12/07 (104k → 40k chars, zero rule loss: draft → gap
  audit → deploy → verify) as a repeatable method in Claude-Extra-Skills-Features, for
  the next time the knowledge file crosses its size trigger.

Reference material: the full BMAD install survives in `<Project>-project/.claude/skills`
+ `_bmad/` (project-level, kept deliberately) — pull concrete prompts/method text from
there when building #16–20.

## Third wave — fresh-eyes audit findings (12/07/2026)

Claude audited the kit as an outside reviewer who had never seen it (structure, README
routing, RULES/SETUP depth, schemas, git hygiene, portability). Verdict: **8/10** —
architecture and philosophy 9–10, execution uneven 7. The six findings below are queued
as #21–26; #21 and #25 are the ones that actually break a stated promise.

- **#21 Portability is broken by outward links** (⭐ the only finding that contradicts
  the autonomy mission). 69 mentions of project-folder names and `/Users/vadym/…` paths
  across kit docs — including load-bearing ones:
  [`REDMINE_WORKFLOW.md`](../../QA-Documentation/Bug-Reports/REDMINE_WORKFLOW.md) points at
  `<Project>/QA-Documentation/tools/redmine-bug.mjs`, which **does not ship with the kit**.
  Same for `annotate.py`, `collage.py`, `lib-report-tab.mjs`, `publish-report.sh` — the
  canonical tools live in project folders. A teammate with a clean clone gets rules that
  reference files they don't have. **Fix:** a canonical `tools/` home inside the kit
  (kit-wide `QA-SetupKit/tools/`, or `tools/` inside the owning kit); project copies
  become symlinks/pointers, not the source of truth.
- **#22 Uneven depth, invisible to the reader.** RULES files range from 4309 words
  (Checklist) to 211 (Visual-Regression): some kits are battle-polished, some are
  scaffolds "for later". An outsider cannot tell which to trust blindly. **Fix:** a
  maturity badge (battle-tested / stable / draft) per row in the root README table.
- **#23 API-Testing is unfinished** — no RULES, no starter ("rules TBD" in the routing
  table). One empty row in the shop window undercuts the whole showcase. **Fix:** ship
  `API_TESTING_RULES.md` + `CLAUDE.starter.md`, or honestly mark the kit draft (#22).
- **#24 Language mix with no rule.** Root README is English; some starters/RULES are
  Ukrainian, some English. Fine for the current team, but the convention is implicit —
  nowhere is it written which language a new kit is authored in. **Fix:** state the rule
  in "Conventions every new module follows" (proposal: docs EN, owner-facing deltas UA).
- **#25 Triple mirroring with no mechanical check** (⭐). Each rule lives in workspace
  CLAUDE.md + kit-RULES + starter, and sync rests on discipline ("update BOTH places").
  There is no link-checker, no CI, no script catching drift or dead internal links — and
  the 12/07 migration already produced stale paths. Ironic for a kit built on *never fake
  a Pass*: it has no automated test of itself. **Fix:** a small `kit-lint.mjs` (broken
  relative links + references to non-kit paths + starter/RULES drift), wired into the
  launchd backup run. Overlaps with #18 Kit-Autonomy-Eval — build them together.
- **#26 Glossary is thin** — 54 lines for 20 kits. The claim "every term has an owner
  kit" is right; coverage is symbolic. **Fix:** one pass extracting load-bearing terms
  from each kit's RULES into [`GLOSSARY.md`](../glossary/GLOSSARY.md).

**12/07/2026 (evening) — #25, #21 and #23 DONE.** Built in that order deliberately: the
**lint first**, because it computes the worklist the portability fix needs — you cannot fix a
promise you cannot measure.

- **#25 [`Rules-Guide/kit-lint/`](../kit-lint/)** — the kit's test for itself (L1 links · L2 every
  tool a doc tells you to run actually SHIPS · L3 no author-machine paths or links into project
  folders · L4 kit shape · L5 kits registered · L6 starters cite their RULES). Wired into the
  daily `backup-qa-setupkit.sh` (`--quiet`; it reports, it never blocks the backup — losing work
  is worse than a dirty kit). Exceptions live in `allow.json`, **each with a reason**.
  *Lesson encoded in its README:* the first pass raised 87 findings and **21 were the lint's own
  noise** (starters are workspace-relative BY DESIGN; `/users/current` is a Redmine API endpoint,
  not a filesystem path). Those were fixed in the LINT before a single doc was "corrected" —
  fixing docs to satisfy a wrong check is how a codebase learns to lie, and a lint that cries
  wolf gets ignored exactly like a flaky gate.
- **#21 portability — 66 real violations, now 0.** The canonical tools ship with the kit at last:
  `annotate.py` + `collage.py` → [`App-Emulators-configurations/template/tools/`](../../Testing-Types/App-Emulators-configurations/template/tools/),
  `redmine-bug.mjs` + `rebuild-bug-tab.mjs` → [`Bug-Reports/template/tools/`](../../QA-Documentation/Bug-Reports/template/tools/),
  `write-run-doc.mjs` → [`Load-Testing/template/tools/`](../../Testing-Types/Load-Testing/template/tools/).
  Each was **generalized on the way in** — the board id (Redmine project 745), the sheet ids, the
  Drive folder name and `/Users/vadym/...` are now env-driven, and each **fails closed**:
  `redmine-bug` without `REDMINE_PROJECT_ID` refuses to guess which board to file into, rather
  than filing a stranger's bug into someone else's project. The `mcp-sheets` path is resolved by
  walking UP from the script, never from an absolute path. MCP docs, the loop-spec template and
  the Web-Testing/Bug-Reports docs now point at kit paths. Project copies stay where they are —
  they work, and this was about what a CLONE gets.
- **#23 API-Testing** now has [`API_TESTING_RULES.md`](../../Testing-Types/API-Testing/API_TESTING_RULES.md)
  + a starter (read the API before testing it · **`200 OK` is not an oracle** — assert the body ·
  negative cases are first-class (a 200 on another user's resource is an IDOR) · chain flows
  through returned values, never today's staging ids · **contract drift is a finding, not a
  chore**: silently updating the test to match the new response is the API dialect of a silent
  re-baseline). The "rules TBD" hole in the shop window is closed.

Remaining in this wave: **#22** (maturity badges), **#24** (language convention), **#26**
(glossary coverage pass).

Suggested order: **#21 → #25 → #23 → #22 → #26 → #24** (fix the broken promise, then the
guard that keeps it fixed, then the visible gaps, then polish).

## Resume point (build log — update on every pause)

**As of 08/07/2026 ~12:00.** The full ⭐ core (tracker #1–7) is BUILT and REGISTERED
(4 registrations each: root README · Project-Configuration · workspace CLAUDE.md ·
this tracker). Quality passes done: mechanical link-checks + schema example
validation (`Rules-Guide/schemas/validate.mjs`) green for all seven; 3-lens adversarial reviews
(conventions / contradictions / completeness): modules 1–2 → 7 findings fixed;
modules 4–5 (Test-Cases + Bug-Reports) → 11 findings fixed (incl. 1 HIGH: Bug-Reports
tab canonical columns + legacy mapping, now reconciled with EMULATOR_RULES §3);
modules 6–7 (Traceability + QA-Agent-Playbooks) → 7 findings, ALL FIXED 08/07 evening
(coverage-state definitions unified schema↔kit incl. "latest fail = partial";
destructive-gate split 🟡 permission vs 🔴 execution across 3 files; hotfix→new-build
+ RC-precedence + expedited-RC path; new-project bootstrap `<date>-onboarding.md`;
RTM gaps example row; Usage-kit pointer with not-installed fallback). Core #1–7 is
now built, registered, reviewed AND fixed — cycle closed.

**08/07/2026 late evening (Max plan):** tracker **#8–15 ALL BUILT + registered** in
one session — the FULL 15-module roadmap is on disk. Reviews: batch 1 (#8–11) →
18 findings (2 high in `qa-metrics.mjs` — hardcoded owner path, `--round` parse
crash — both fixed along with all the rest: WCAG-template status vocabulary,
install-advice ESM correctness, script path anchoring + per-page try/catch, golden
canonical-location note in Test-Oracles, README Files-table links across 7 kits,
schema additions `reopened`/`escapedFromCycle`, REPORT_TAB_STYLE.md shipped into the
Reporting kit). Batch 2 (#12–15) → 16 findings, ALL FIXED same evening
(2 high: `verified`-ordering unified under the Bug-Reports owner definition across
Regression/playbooks/CLAUDE.md; consecutive-green demotion made computable via new
`run-result.results[]` + `test-case.cadence`/`traceability.bug` schema fields;
plus: playbook↔kit wiring made bidirectional, plan template got the Regression
column + view subsection, LOCALE-MATRIX template shipped, Waiver + Reopen-rate
glossary entries, quarantine slot in CYCLE_SUMMARY, web-viewport note in MATRIX,
glossary rules-pointer). Reviews for the whole roadmap: **CLOSED** — 34 findings
across 3 batches (8–11: 18, 12–15: 16), zero outstanding. Full-kit mechanical
verification green: links, schema parses, 4 examples VALID, all scripts node-check.

**12/07/2026:** second wave queued (#16–20, see the BMAD post-mortem section) —
build order suggestion: #16 CI-Integration first (biggest gap), then #17; #18–20 are
cheap and can ride along any session. Start after the weekly model quota resets
(99% used at queue time).

**12/07/2026 (evening) — #16 CI-Integration BUILT, registered, verified.** Full module
recipe done: 5 kit files + 4 templates → 4 registrations (root README · Testing-Planning
index · Project-Configuration map · workspace CLAUDE.md) + glossary entries (**"CI gate"
is a DIFFERENT word from the human-in-the-loop 🟢🟡🔴 gates** — that collision is now
explicit) + tracker row. Verification green: all 3 pipeline YAMLs parse, `ci-run-result.mjs`
node-checks, and a **functional smoke over 7 cases** proves the verdict logic (clean a11y
→ pass/0 · critical violation → fail/1 · crashed scan → **blocked/3** · visual pass →
pass/0 · missing golden → **blocked/3** · failing+flaky Playwright → fail/1 with the flake
reported, not swallowed · missing report → blocked/3); every emitted run-result validates
against the schema. Schema changed first, per SCHEMAS_RULES (`method` += `ci`, six
disciplines added — changelog row in the schemas README).
**12/07/2026 (evening, cont.) — #16 REVIEWED and FIXED. Cycle closed.** The 3-lens
adversarial review ran as a workflow (3 reviewers → **47 findings** → one independent
refuter per finding, instructed to default to "not real"): **44 confirmed, 3 refuted** — plus
1 more the reviewers missed (`details.json` sitting inside `runs/` would have been validated
as a run-result and failed the schema gate) and 1 the review got wrong (it claimed the
workspace CLAUDE.md pointer was missing; it was there — checked on disk before acting).
The review was worth its cost: the kit was violating **its own** rules.
- **HIGH — the one blocking gate faked a Pass.** G-5 (schemas) ended its diff command with
  `|| true`, which `CI_RULES.md` bans *by name*. On `workflow_dispatch` (`github.base_ref`
  empty) and on any shallow GitLab clone, `git diff` errored, the error was swallowed, and the
  gate printed "no QA artefacts" and went **green**. Now: `git merge-base` with a hard fail,
  no `|| true` anywhere in the templates (a `kit-lint` can grep for it).
- **HIGH — the emitter shipped unvalidated artefacts.** `validate()` only `console.warn`ed
  when it couldn't find `validate.mjs` (which is *always* the case in topology B, where the
  pipeline lives in the app repo). Now: not found or invalid → **exit 3 blocked**, and the
  offending artefact is deleted rather than uploaded.
- **HIGH — three silent green paths in the verdict logic:** a11y passed with real WCAG
  violations below critical/serious; a Playwright run passed with flaky tests (REGRESSION_RULES:
  flaky = broken); and an *empty* suite (bad `--grep`, all-skipped, no `stats`) passed. All three
  are now strict by default — relaxations (`--fail-on`, `--allow-flaky`) are owner decisions
  recorded in `GATES.md`, and tolerated findings still ship in the evidence.
- **HIGH — factually wrong claims about the CI engines.** The GitLab template's comment
  promised "every sweep gets a result even if an earlier one is red" while GitLab's `script:`
  is fail-fast (a red suite skipped every emitter); `CI_RULES` claimed `if: always()` masks a
  red step (it does not); and the docs told owners to mark individual gates as required —
  but GitHub counts a **SKIPPED job as a passing required check**, so a red preflight would
  have merged green. Fixed: explicit exit capture on GitLab, and the aggregate `verdict` job
  is now the only required check (it also honours `soaking` vs `REQUIRED_GATES`).
- **MED — the paths never worked in either topology** (`QA_DIR: '.'` + a hardcoded
  `QA-SetupKit/...`, `npm ci` at a root with no `package.json`, topology-B checkout in one job
  only), and the docs promised `<Project>/CI-Integration/runs/<run-id>/` that **nothing ever
  wrote to** — a pipeline cannot write into the workspace. Fixed with an explicit
  `KIT_DIR`/`QA_DIR`/`NODE_DIR` config block and a new `tools/fetch-run.sh` that pulls a
  finished run down for triage.
- **Also fixed:** the staging-URL guard was theatre (the kit tools hardcoded `BASE` and never
  read `BASE_URL` — both `a11y-scan.mjs` and `visual-diff.mjs` now read the env, a change that
  belongs to those kits anyway); stale reports from a previous commit could be scored as the
  current run (`--not-before`); `readJson` crashed on a truncated report (exit 1 = "fail" =
  a lie — now blocked); `--out` with no value silently wrote a file named `true`.
Verification after the fixes: 11/11 exit-code contracts, every emitted run-result schema-VALID,
3 YAMLs parse, 203 links resolve, zero `|| true` outside comments.
**Lesson worth keeping:** a docs-heavy kit can *read* perfectly and still gate on nothing —
the review that paid for itself was the one that traced the YAML as an engine would.

**12/07/2026 (afternoon):** third wave queued (#21–26) from a fresh-eyes audit of the
kit — see the audit section above. Nothing built yet; #21 (canonical `tools/` in the
kit) and #25 (`kit-lint.mjs` self-test, merge with #18) are the two that fix real
breakage of the autonomy mission. Order: #21 → #25 → #23 → #22 → #26 → #24.

**Next: the roadmap is COMPLETE (15/15 built + reviewed + fixed).** Next milestone
is the workspace queue below (<Project> first practical application).
Module recipe (established, for future kits): README + SETUP + RULES + CLAUDE.starter
+ template/ → 4 registrations → link-check + example validation → 3-lens review →
fix findings → flip tracker row to ✅.

**Also queued (workspace, outside this kit):** first practical application of the
core to <Project> — STRATEGY.md seeded from BUG-001..004 history, ORACLES.md +
invariants.md, LLM-judge book rubric CALIBRATED on known-good/bad samples, RTM init;
plus the parked second BUG-002 repro run (blocked on account slots).

**Budget lesson (codified in workspace CLAUDE.md 08/07):** parallel subagents burn
the session budget faster than any polling cadence catches — ≥25% headroom to launch
a workflow; at 75–90% create the evacuation cron BEFORE launching; >90% inline only.

**12/07/2026 (night) — the roadmap is CLOSED: 26/26 built.** Second wave (#16–20) and the
fresh-eyes audit wave (#21–26) are done. What the last two waves actually changed:
- the kit can now **run without a human** (#16 CI gates) and **keep a suite alive** (#17 E2E +
  spec lint);
- it can **test itself** (#25 kit-lint: links · tools that ship · portability · kit shape ·
  registration · language) and **test its own mission** (#18 autonomy-eval: a git-less clone in a
  temp dir with HOME redirected — no author machine to fall back on);
- the autonomy claim stopped being an assertion. The eval's first run found what kit-lint could
  not: 15 doc links pointed at **gitignored files** (`credentials.json`, `token.json`,
  `grafana/.token`, the workspace `.mcp.json`). Green in the author's checkout, dead in every
  clone. **A promise you only verify on the machine that made it is not verified.**

**Next:** the workspace queue below (<Project>: STRATEGY.md from BUG-001..004, ORACLES.md, RTM
init; the parked BUG-002 repro run). And the first REAL pipeline install for #16 — CI-Integration
is 🟡 by its own badge until it has run in anger.

## Correction — the 12/07 closures were premature (recorded 12/07/2026, late)

An external review (a second agent, cold) caught the kit doing to ITSELF exactly what it forbids
in the systems it tests. **#21, #25 and #18 were marked ✅ while still defective.** Leaving a ✅
over a known hole is a faked Pass in the tracker — so it is written down here rather than quietly
fixed:

- **#25 kit-lint form-checked 19 of 26 modules** (Testing-Types + Testing-Planning only) and
  still printed `clean`. A **silent cap** — the exact thing `CI_RULES` bans by name. It also had
  an escape hatch in L2 (`if (!ref.includes('/')) continue // bare filename in prose`), and
  `publish-report.sh` walked straight through it.
- **#21 was therefore closed over a live hole:** with L2 honest, **four** tools the docs order you
  to run had never shipped — including **`generate_via_api.mjs`, the core checklist generator**.
- **#18 autonomy-eval exercised 4 of 43 executables** and printed "tools checked: 4" without
  saying "of 43". Same silent cap, in the tool built to catch silent caps.

**Now genuinely closed:** modules.json declares the kit's **two module classes** (`kit` = full
contract; `feature` = README-only harness add-on) so every module is held to *its* contract and
the scope is **printed**; L2's hatch is shut; the four tools ship (generalized, failing closed —
`generate_via_api` refuses to run without `PROJECT_NAME` rather than defaulting into someone
else's Drive folder); the eval runs every `.mjs`/`.py`/`.sh`, names what it skips, and separates
"needs its documented npm/pip prereqs" from "crashes on the author's config" — the latter found
**8 tools** that greeted a teammate with `node:fs:441`, all now failing closed with an explanation.
Scope verified **independently of the lint that changed it** (`ls -d */*/` = 26 modules;
`find` = 43 executables).

**The lesson, kept:** *a self-test written by the same agent, in the same head, verified by
itself, is not a self-test.* Both fixes came from a cold reader. Two of the three defects were
the kit's own doctrine turned against it — which is precisely why the doctrine has to be
executable, not admired.

## #21 — what the "canonical tools" fix actually delivered (12/07/2026, late)

The original finding proposed *"project copies become symlinks/pointers, not the source of truth"*.
Shipping the tools closed the **portability** half; the **drift** half was left undone and unsaid
until a cold reviewer noticed that `lib-report-tab.mjs` now existed twice, byte-identical, in two
repos that will diverge. Recorded properly:

- **Pointers, done:** the four tools with no project config (`annotate.py`, `collage.py`,
  `lib-report-tab.mjs`, `tc.mjs`) are now **symlinks** from the project into the kit. One file,
  no drift.
- **Copies, deliberately kept:** the tools a project configures (`redmine-bug.mjs`,
  `generate_via_api.mjs`, `rebuild-bug-tab.mjs`, transform-bug-tab-v2, `write-run-doc.mjs`,
  `publish-report.sh`). Their kit versions are env-driven and would work — but the project's
  filled copies are in **daily use filing real bugs**, and silently swapping the code under a
  workflow that posts to a live board is not a refactor, it is a stunt. Migrating them means
  recording their env config in `<Project>/CLAUDE.md` first. **Queued, not claimed.**
- **The trap the pointers exposed immediately:** a tool that anchors paths to its own file
  (`import.meta.url`) breaks when pointed at — it resolves into the kit and looks for the
  project's data there. `tc.mjs` did exactly this within a minute of the first symlink. Tools that
  may be pointed at must anchor to the **working directory**. Now a rule in Project-Configuration.

## Open debt — 6 configured tools still forked (recorded 12/07/2026)

Convention #9 (Project-Configuration) ALLOWS a project's copy of a configured tool to stay a fork
"until its env config is recorded in `<Project>/CLAUDE.md`" — and migrating a tool that files real
bugs onto a live board is correctly not done silently. But an allowed exception **without a named
list and an exit condition** is exactly what the kit warns against in `allow.json`
("an allowlist without reasons rots"). So the list, once, explicitly:

| Tool | Kit copy (env-driven) | Project fork | Exit condition |
|---|---|---|---|
| `redmine-bug.mjs` | `QA-Documentation/Bug-Reports/template/tools/` | `<Project>/QA-Documentation/tools/` | record `REDMINE_PROJECT_ID` (=745) in `<Project>/CLAUDE.md`, then symlink |
| `rebuild-bug-tab.mjs` | ″ | ″ | record `QA_SHEET_ID` → symlink |
| transform-bug-tab-v2 | ″ | ″ | **RESOLVED 13/07: removed from kit — project-only one-off (bug→ticket data was project data)** |
| `generate_via_api.mjs` | `QA-Documentation/Checklist/template/tools/` | `<Project>/QA-Documentation/` | record `PROJECT_NAME`/`GENERATOR_FN`/`DRIVE_FOLDER` → symlink |
| `write-run-doc.mjs` | `Testing-Types/Load-Testing/template/tools/` | `<Project>/Load-Testing/tools/` | **RESOLVED 13/07: genericized to a content-driven renderer (`RUN_DOC_CONTENT` JSON) → YS pointered; old inline version archived** |
| `seed-users.mjs` | `Testing-Types/Load-Testing/template/` | `<Project>/Load-Testing/` | confirm no project-specific edits vs the kit copy → symlink |

**Single task:** *migrate the remaining configured tools to pointers* — for each, record its env
config in the project `CLAUDE.md`, verify the kit copy behaves identically on a real invocation,
then replace the fork with a symlink (the pointer-not-fork rule). Not urgent (the forks work), but
tracked so the exception cannot quietly become permanent. Done piecemeal is fine — `redmine-bug.mjs`
files live bugs, so it migrates only after a deliberate verify, never mid-round.

## Resume point — cold-review remediation (as of 13/07/2026)

A cold external review (29 findings) was worked through in two waves, each fix PROVEN to red on bad input:
- **Done (committed):** #1 lint-specs holes + #2 validate.mjs additionalProperties/keyword-guard + #3 **selftest.mjs + fixtures/** (the test for the testers — good/bad fixture per checker, wired into autonomy-eval 3c + daily backup; META-proven: neuter a checker → selftest reds). Then #5 `--expect-min` · #7 `Rules-Guide/DOCTRINE.md` + checklist doctrine · #8 visual-diff CI re-baseline refusal + BASELINES.md · #9 README "Deliberately out of scope" · #6 kit-lint **L8** (examples validate) + **L9** (dead-tool detector).
- **Skipped by Vadym (his call):** the mobile checklist COUNTIF tautology — a strict `COUNTA=COLUMNS` mis-statuses single-platform-available rounds.
- **Done — final 2 (committed `52fff78`, 13/07):**
  1. **Emulator kit scaffold.** Diagnosis was sharper than the review's "no Maestro flow": the RULES *referenced* `flows/`, `mapping.json`, `runner/platforms/`, `config.json` but shipped none of it (vaporware in the docs; the README even named `.mjs` files "created during pilot" that never existed). Made it real — `template/` with `config.example.json` + `mapping.example.json`, **5 categorized Maestro flows** (smoke, permissions-deny, lifecycle background→kill→restore, deeplink cold+warm, offline), a **runner** (`run.sh` + `platforms/{ios,android}.sh`) implementing the crash-safe verdict (§5.5), and **RULES §7** naming each resilience dimension (permissions deny-path, lifecycle, deep links, network profiles, install-over-upgrade, interruptions) *with its oracle*. iOS-offline honestly marked not-run (Maestro can't toggle iOS radios).
  2. **run-result `oracle` field.** Added optional `oracle` {`type` (the 8 Test-Oracles kinds), `source`} at the top level AND per-case in `results[]`. Optional for backward-compat + so `blocked`/`aborted` stay valid; a `pass`/`fail` run-result with no oracle is an incomplete artefact (TEST_ORACLES_RULES). Proven by red (bad enum + garbage field both fail `validate.mjs`). First `run-result.example.json` ships → L8 validates it.

**All cold-review items now closed** (bar the one Vadym deliberately skipped). Kit health: kit-lint clean (155 docs, L1–L9, 27 modules); selftest 4/4; autonomy-eval PASS (new shell tools refuse cleanly, 46/48 refusal path).

### Still open (pre-existing debt, not from this review)
- **Drive-tool convention debt — DONE (13/07):** `write-run-doc.mjs` (kit template + <Project> copy) and the <Project>-only drive-upload.mjs now root every Drive path under `ClaudeProjects/<Project>/…` instead of Drive root, where it collided with the user's OWN root project folders. The kit tool parameterizes the root name via `DRIVE_ROOT_FOLDER` (default `ClaudeProjects`); the folder search is now precise (`'root' in parents`) so it can't match a same-named folder nested elsewhere. Docs updated (LOAD_TESTING_RULES, Load starter, EMULATOR_RULES). **Left for Vadym:** the one-time MOVE of already-created files from the old root locations into `ClaudeProjects/` — data movement in his Drive, his call (not done silently).
- **6 configured-tool forks → pointers (Convention #9) — ALL 6 RESOLVED (13/07):**
  - **4 pointered** (kit canonical was env-driven; cleaned the last leaks + verified refuse-without-env): **rebuild-bug-tab** (`QA_SHEET_ID`), **seed-users** (`SEED_URL`; kit fixed to write `users.json` CWD-relative not file-relative so a pointer lands it in the project dir), **generate_via_api** (`PROJECT_NAME`; also rooted its Sheet under `ClaudeProjects/`), **redmine-bug** (`REDMINE_PROJECT_ID`+`REDMINE_URL`; real-board default → placeholder).
  - **write-run-doc — genericized then pointered** (Vadym's call): the kit tool had a whole <Project> run narrative inline. Rewrote it as a **content-driven renderer** — carries no run data, reads a project `RUN_DOC_CONTENT` JSON (shape: `run-doc.example.json`, neutral), refuses without it. YS copy is now a pointer; the old inline version (computed reproBooks for the 2026-07-06 run) archived project-side as write-run-doc.legacy-2026-07-06.mjs (project file, not shipped).
  - **transform-bug-tab-v2 — removed from kit** (Vadym's call): a one-off transform with <Project> bug→ticket data (`#<ticket>/#<ticket>/#<ticket>`, mega links, "not-a-bug" comments) inline — not a reusable template. Kit copy deleted; stays a project-only file in <Project>. Doc references scrubbed (REDMINE_WORKFLOW, roadmap).
  - Env contracts for the pointered tools recorded in `<Project>/CLAUDE.md`.
- **kit-lint gap (found 13/07):** L3 catches machine PATHS but not project CONTENT in tool BODIES (<Project> strings, real ticket #s, Sheet IDs) — which is why the two polluted templates above lint green. Add **L10: no project data in shipped tool bodies** (allowlist-driven). Would have caught all the leakage cleaned this session.
- **Emulator pilot:** the scaffold is real but the end-to-end pilot (a real report written to a sheet, flow `TODO`s filled for an actual app) remains the next milestone.

### Resume point — "demo of each doc type from the kit" walkthrough (14/07, mid-flow)
Vadym is validating that **each Google-Sheets QA doc type can be built from the kit alone**, and each
demo surfaces + closes a kit gap. Demos live as **tabs in ONE doc** (demo-only convenience —
real projects keep separate files): **"Demo"** = `<DEMO_SHEET_ID>`.
The **live tab registry** (tab ↔ gid ↔ builder ↔ input) is no longer maintained inline here — it
moved workspace-side to the Demo project's memory file (`Demo-project/CLAUDE.md` at the workspace
root, next to the rescued demo reproducers and inputs; 14/07). This file keeps only the walkthrough
narrative below; when the two disagree about the doc's current tabs, the registry wins.
- **Done — Bug reports:** shipped `bug-row.mjs` (spec → Sheet row/candidate, `--candidates` Verdict
  mode; same spec redmine-bug files) + `bug-spec.example.json` / `bug-spec-backend.example.json` +
  the "perspective by layer" wording rule (FE/App = user journey, BE = API calls). Committed.
- **Done — Checklists:** made the generator **adaptive to N status columns** (flat `PLATFORMS`,
  `NCOLS=3P+22`); docs updated; defaults unchanged. Committed.
- **Done — Test cases (13/07, 🟩 Validated).** Vadym decided all three open format questions and
  the kit followed them everywhere, not just in the Sheet:
  1. **Priority → `High/Medium/Low`** (test-case schema **v2**, BREAKING). Derivation now rides the
     bands that already existed — the strategy DEPTH bands: risk 7–9 → High (deep), 4–6 → Medium
     (standard), 1–3 → Low (smoke). `P0–P3` stays the BUG scale; the two never share a column
     (glossary entry added). Knock-on the change forced: the e2e tag vocabulary was
     `@P0`–`@P3` *"priority from the case's risk score"* — 3 levels don't map onto 4 tags, so tags
     are now `@high`/`@medium`/`@low` across UI-Automation + CI (lint-specs, gate greps, GATES.md,
     fixtures). A silent P0≡High mapping would have been exactly the kind of unwritten rule the kit
     exists to delete.
  2. **`Blocked` kept** as a 4th run status (Sheet-only): *could not* run (environment) ≠ *will not*
     run (`Skipped`), and neither becomes `Passed` at round end.
  3. **Module bands are DATA, not a list in the tool:** the case's own `area` is the product module
     (it used to duplicate the strategy unit, which lives in `traceability.strategyUnit`), and the
     band ORDER comes from `strategy.json` → `modules[]` (new optional field). An area missing from
     that list still renders — no silent "Other" bucket.
  Shipped: **`tc.mjs sheet`** (env-driven — `PROJECT_NAME`, optional `TARGET_SSID`/`TC_TAB`/`TC_GID`;
  no project data in the body), which validates first and refuses to publish an invalid suite,
  reuses the doc + fixed tab gid so shared links survive a rebuild. The <Project> fork
  tc-sheet-v2.mjs is superseded. 26 <Project> cases migrated (High 9 · Medium 17 · Low 0 —
  nothing in the suite scores risk ≤ 3), harness green: 26/26 valid, 13/13 risk-≥6 units covered,
  0 orphans/untraced.

  **The Sheet template is now a kit artefact — [`SHEET_TEMPLATE.md`](../../QA-Documentation/Test-Cases/SHEET_TEMPLATE.md)**
  (owner-approved 13/07, after several rounds of his edits on the live tab, each one generalised back
  into the generator rather than left as a one-off). It specifies the geometry (6-row frozen header ·
  case columns A..H written once · a 9-column **section per round**, repeated right, with its own
  status/comments/mirror + collapsible column group · module bands with row groups), the palette, and
  the invariants the tab enforces: `Blocked` ≠ `Skipped`; `Not run cases` computed by subtraction (never
  `COUNTA` of the status column — the band rows carry a formula there); an honest per-row mirror (the
  source template's guard `COUNTIF(rng,"<>")=COUNTA(rng)` is a tautology that fabricates a status);
  dropdowns on case rows only; and a rebuild that carries every round's verdicts over BY CASE ID —
  with the failure to read them now surfaced as a loud warning instead of a swallowed exception.
  technique/oracle/traceability stay out of the columns (they'd drown the doc) and ride as a Summary
  cell note.
- **Mechanism:** the checklist adapter's opt-in `TARGET_SSID`+`CHECKLIST_TAB` builds a tab INTO the
  Demo doc; other builders write a tab directly. House style on every tab: teal header, wrap +
  vertical-middle on the WHOLE range, status/verdict dropdown + colour chips.
### DONE (13/07): the WEB-PERFORMANCE doc type — `Custom-Reports/PageSpeed-report/` 🟩

Built from the owner's real "PageSpeed Insights Results" sheet (58 pages × Desktop/Mobile × 5 dated
rounds). Shipped: the nested group `QA-Documentation/Custom-Reports/` (HTML-Reports moved in beside it —
report FORMATS and report DELIVERY now live together), `PAGESPEED_REPORT_RULES.md` (18 rules),
`SHEET_TEMPLATE.md`, `pagespeed-round.schema.json`, a **collector** (`psi-run.mjs`, PSI API, median of
N runs) and the **Sheet builder** (`psi-sheet.mjs`). Demo tab built into the Demo doc from the kit and
byte-compared with the original.

What the round cost, and what it bought (worth remembering — the pattern repeats):
- **kit-lint had a hole the new group exposed.** Module discovery walked exactly one level under each
  group, so a nested group's kits would have gone UNCHECKED while the lint printed "clean". Fixed with a
  third class (`group`) declared in both `groups` and `overrides`. A nested group must always be
  declared twice — it is in `modules.json`'s note now.
- **Two adversarial reviewers found 21 findings in code that looked finished**, and the two worst were
  the ones a demo would have hit first: the builder **deleted the only tab of a document it did not
  create** (the owner's reference doc is exactly that shape), and the collector **destroyed
  human-written comments** on a re-run — the very comments the builder demands before publishing. Both
  were fixed and then re-proved by replaying the original failing input.
- **The colour bands were fail-open:** a blank not-run cell fell into the red 0–49 band (Sheets coerces
  a blank to 0), so "we didn't measure" rendered as "catastrophically slow". Now CUSTOM_FORMULA with
  ISBLANK/ISNUMBER, scoped to page rows.
- **Deltas were computed across Lighthouse versions** — Google upgrades LH server-side, so a tool
  upgrade manufactured a regression. Rounds are comparable only on identical env + tool + LH version +
  run count.
- **A PSI link is not evidence** (new rule 16): shared `/analysis/<id>` links expire after 30 days and
  die with the host — both already happened to the owner's document. The round JSON is the record.

### VALIDATED (14/07): the multi-site BUG SUMMARY doc type → `Custom-Reports/Bug-Summary/`

**Decision (owner, 14/07):** a new **Custom-Reports subtype**, not an extension of Bug-Reports.
Bug-Reports owns the RECORD (one bug: repro, expected, actual, evidence); Bug-Summary owns the
REPORT that COUNTS those records per page and per site. The roll-up is *derived* from the records
(`bs-from-bugs.mjs`), which is precisely why it sits on the report side of the line instead of
growing a second contract inside Bug-Reports. When the two disagree, the record wins.

**Built:** `bug-summary.schema.json` + `bs-sheet.mjs` (builder, locale-aware, adopt-guarded) +
`bs-from-bugs.mjs` (roll up kit bug records) + `bs-import-sheet.mjs` (**read-only** on someone
else's document). Demo tabs `Bug summary` (gid 940001) + derived `Left issues` (gid 940002) in the
Demo doc, built from the kit against the owner's reference: 2 sites, 38 pages, **309 issues**,
counters `5 / 71 / 116 / 117` — the reference's numbers, reproduced exactly.

**What the reverse-engineering found** (the reason the doc type exists — the reference is a real,
working, client-facing document that could not answer its own headline question):
- The disposition ("Skipped", "Not fixed", "Reassigned as improvement") lived as **prose in a Notes
  column**. No counter can read prose → the document could not say how many issues were still open.
- So a **second "Left issues" tab was kept BY HAND** — and it had already drifted from its own
  source: **23** rows carried a disposition, **8** reached the second tab. In the kit that list is a
  live `FILTER`; it cannot drift.
- **286 of 309 rows recorded no status at all.** A reader assumes they were fixed. The document never
  said that. `unknown` is now a real status, counted as still owed.
- Rows were addressed only by a `№` that **restarts on every page** → the hand-kept list carried no id
  and could not be traced back. A stable `id` column now rides along.
- Evidence on `screencast.com` (141) / Dropbox (148) / `prnt.sc` (31): hosts that expire. Flagged
  `hostRisk: expiring` on every build — when the link dies the bug is unprovable.
- A trap found while publishing: the reference is `uk_UA` (formula separator `;`), the Demo doc is
  `en_US` (`,`). The builder now reads `properties.locale` off the document — assume it and every
  counter on the tab becomes `#ERROR!`.

**🟩 VALIDATED by Vadym (14/07)** — the canonical state is frozen in
[`SHEET_TEMPLATE.md`](../../QA-Documentation/Custom-Reports/Bug-Summary/SHEET_TEMPLATE.md).

**Owner's edits on the live tab, generalised back into the generator (14/07):**
- summary rows carry **no explicit height** → Sheets auto-fits them and a bug's text is readable in full.
  Two traps: `autoResizeDimensions` does NOT fit wrapped text through the API (it pins the row back to
  21px), and a height set by an earlier build stays stuck until it is explicitly CLEARED. This is a
  deliberate departure from the reference, where every issue row is pinned to 21px and the text is clipped.
- the Total column is **merged down each site's span** (the owner's `I5:I290`), generalised per site.
- `(All modules)` in the headline cell goes **white**.
- the label row carries **severity descriptions as notes** (English, from the severity decision tree).
- **severity colours are ON by default**, in the owner's palette: `Critical #e03029` · `Major #eeb700` ·
  `Minor #2d6591` · `Trivial #52a700` · **empty `#cccccc`**. One conditional-format rule per value, on the
  Severity column and every label row; the text colour is DERIVED from the background (Rec. 709 luminance),
  so any palette stays readable. The reference paints all four severities the same green — the one column a
  reader scans for danger tells them nothing. `BS_SEVERITY_COLORS=0` restores the flat green.
  **The grey for an EMPTY severity is not decoration:** a row with no severity is counted by no column at
  all, so grey is what stands between it and a silent under-report.
- **Three dead ends, each burned a round trip — they are written into SHEET_TEMPLATE so nobody repeats them:**
  Sheets' coloured DROPDOWN CHIPS (the natural way to do this by hand) are **not exposed by the API** — they
  can be neither written nor read · a conditional format **OVERRIDES a manual fill**, so painting a cell
  under a rule shows nothing and looks like the paint failed · **a rebuild rewrites every format on the tab**,
  so reading the palette back off the Sheet resurrects the PREVIOUS build's colours and silently overrides
  the new ones. Colours are configuration (`SEVERITY_COLORS`), not data.

**NEXT — the real pipeline: bugs come from REDMINE.** Owner: bugs are pulled off the board, grouped by
module (often via the parent task, but not always), and the formulas do the statistics. **Redmine has NO
severity field** — the owner assigned it by hand and has offered to let the agent propose it
(`severitySource` + `severityRationale` are already in the schema; the builder notes and warns on every
proposed row). A 37-agent read-only audit measured the board — build the importer against THESE facts:

1. **No severity field exists** — confirmed (6 custom fields board-wide, none of them severity). `priority`
   sits at its default on almost every bug, so it is useless as a proxy.
2. **Most bug lines are not Redmine issues.** The board runs a **checklist plugin**: the dominant pattern is
   ONE container issue per module/page whose individual bugs live as **numbered checklist items** inside it.
   A tool that only walks `/issues.json` will miss most of the bugs.
3. **`parent` is real but unreliable** — for the plurality it points at a QA ACTIVITY, not a module. Using
   `parent.subject` blindly would file **55 of 125** <Project> bugs under a fake module
   `Smoke/Regression testing`.
4. **`category`, `fixed_version`, `tags` are dead** as module signals.
5. **Module resolution, measured: only 48 of 125 bugs resolve.** The other **77 must be REFUSED, not
   guessed**, and surfaced to the owner as an unresolved list.
6. **`PM Acceptance` is NOT a closed status** — the most common status on the board. Any "open per module"
   formula that assumes the late workflow states are done will over-count fixed work.

**Also open:** README / SETUP / SHEET_TEMPLATE still carry traces of the old "tracker" framing — sweep them.
Tracker row 15 in the Demo doc needs the final update.

### The original brief (13/07, kept for the record): a WEB-PERFORMANCE ANALYSIS doc type

Vadym has an existing document of this kind and will describe it in a **fresh session** (this one is
being cleared). Everything below is what that session needs — don't make him repeat himself.

**State — nothing built yet.** No folder, no schema, no tool. Test-Cases (the previous type) is
CLOSED: validated, packaged as `SHEET_TEMPLATE.md`, tracker row 🟩 Validated.

**What to ask him for, in one message (not drip-fed):**
1. **The reference document** — link (Drive/Sheet) or a screenshot of the one he already uses. This is
   the anchor; the Test-Cases round only converged fast because his reference template existed.
2. **Where the numbers come from** — Lighthouse / PageSpeed / WebPageTest / Chrome traces / k6
   browser / RUM? That decides whether the kit ships a collector or only the document.
3. **Scope of a run** — which URLs/pages, which viewport & network profiles, cold vs warm, how many
   runs per page (a single run is noise, and the doc must not pretend otherwise).
4. **Which project it lands on first** (<Project> landing `https://landing.example.com/` is the
   obvious candidate — the Web-Testing kit already drives it).
5. **Thresholds / budgets** — who owns the pass-fail line (Core Web Vitals defaults, or his own
   numbers)? Without an owner-approved budget a perf doc reports, it cannot judge.

**Decisions to settle before scaffolding:**
- **Placement.** Likely a new doc type under `QA-Documentation/` (one folder per document type is the
  standing convention), cross-referenced from Web-Testing and Load-Testing — performance is *their*
  output, but the DOCUMENT is a QA-Documentation artefact. Confirm with him, don't assume.
- **Does it need a schema?** If the doc is a Sheet that another tool/agent will read, it does
  (`Rules-Guide/schemas/`, "schema first, then docs and Sheets").
- **Honesty invariants it must encode** (the kit's whole point — draft these WITH him, as with
  Test-Cases): a run below the sample count is `not-run`, not a green number; a metric with no
  budget is reported, never judged; a regression is measured against a recorded baseline, and
  re-baselining is an owner decision (never a way to make the doc green — same rule as
  visual-regression BASELINES.md).

**The working loop that produced the Test-Cases template — repeat it:** build the tab from the kit
into the Demo doc (`<DEMO_SHEET_ID>` — the real id lives workspace-side in `Demo-project/CLAUDE.md` — `TARGET_SSID` adapter) → let him
edit the LIVE tab → read his edits back with the Sheets API and **generalise every one into the
generator** (never leave a hand-edit as a one-off; a template that only exists in one tab is not a
template) → package as `<TYPE>_TEMPLATE.md` + register in README/SETUP/RULES/starter + roadmap +
tracker row.
- **Remaining types to demo** (tracker `Doc-type validation`, all Pending): run-result · test-strategy/
  plan · test-oracles · traceability (RTM/coverage) · reporting/metrics · exploratory session ·
  compatibility matrix · localization matrix · HTML report.
- **Flag (not mine to edit):** the **v5 spec in Drive** (`claude_code_template_instructions_v5.md`,
  Cowork-owned) still describes fixed 25/28-col geometry + 2D mobile `PLATFORMS` — needs a Cowork
  sync to the adaptive form. Note it in the Session Log.
