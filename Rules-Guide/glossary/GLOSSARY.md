# QA-SetupKit glossary

One line per term · owner kit in **bold** · schema home in `code` where machine-read.
On conflict the owner's docs win; fix the entry here.

## Planning & scope
- **Scope unit** — one testable thing from the strategy inventory (screen S·, endpoint E·, role R·, integration I·). **Test-Strategy** · `strategy.schema.json scope.in[].id`
- **Risk** — likelihood(1–3) × impact(1–3) = 1–9 per unit; re-scored after every round. **Test-Strategy** · `riskMatrix[].risk`
- **Depth** — how much technique a unit gets: deep (7–9) / standard (4–6) / smoke (1–3). **Test-Strategy** · `depthMapping`
- **Round** — one testing pass with a plan file, results, and a named stop condition; every playbook run is a round. **Test-Strategy** (plan) / **QA-Agent-Playbooks** (run)
- **Cycle** — all rounds between two releases; closed by the release QA summary. **Reporting-and-Metrics**
- **Entry / exit criteria** — agent-checkable conditions to start / declare done a round. **Test-Strategy** · `entryCriteria / exitCriteria`
- **Stop condition** — why a round ended: exit-criteria-met · time-box-exhausted · diminishing-returns · blocked. **Test-Strategy** · `stopConditions`
- **DoD (Definition of Done)** — release-level bar: final exit criteria + regression over bug areas + QA summary. **Test-Strategy** · `definitionOfDone`

## Verdicts & oracles
- **Oracle** — what decides pass/fail objectively; 8 types: spec · golden-master · differential · invariant · metamorphic · consistency · llm-judge · human. **Test-Oracles** · `test-case.schema.json oracle.type`
- **needs-human** — verdict CATEGORY (not a Sheet status): in checklists = empty status + comment on what to look at. **Test-Oracles**
- **Checklist statuses** — `Passed / Failed / Skipped / ""` (empty = not-run/needs-human + comment). **QA-Documentation/Checklist** · `checklist-row.schema.json`
- **Golden master / baseline** — blessed known-good artefact; updated only on owner-confirmed change, logged. **Test-Oracles** (discipline) / **Visual-Regression** (screenshots)
- **Invariant (INV-N)** — one-line always-true property, asserted in every run; every bug implies one. **Test-Oracles**
- **Calibration** — proving an LLM-judge rubric on known-good/known-bad samples before trusting it. **Test-Oracles**
- **Charter** — one-sentence exploratory mission with time-box and tour. **Exploratory-Testing**

## Artefact IDs & records
- **TC-NNN** — one derived test case (JSON canonical, technique + oracle named). **Test-Cases** · `test-case.schema.json`
- **BUG-NNN** — one defect row in the QA Sheet; severity by decision tree; dedup by component + failure signature. **Bug-Reports** · `bug.schema.json`
- **Run-id** — `YYYY-MM-DD-<slug>` of one run. **schemas** · `run-result.schema.json runId`
- **Severity ≠ priority** — severity = objective impact (QA, via tree); priority P0–P3 = fix order (owner; agent proposes, `priorityProposed`). **Bug-Reports**
- **Priority (bug) vs priority (case)** — two scales that never share a column: a BUG is `P0–P3` (fix order, owner decides); a TEST CASE is `High/Medium/Low` (execution order, derived from the strategy depth bands — risk 7–9 → High, 4–6 → Medium, 1–3 → Low). **Bug-Reports** / **Test-Cases**
- **verified** (bug) — fixed AND re-checked with the original repro on the fixed build. **Bug-Reports** · `bug.schema.json status`
- **BS-\<date\>** — one EDITION of a bug summary: the roll-up as it stood on that date. **Bug-Summary** · `bug-summary.schema.json summaryId`
- **Bug RECORD vs bug ROLL-UP** — a record is one bug (repro/expected/actual/evidence), owned by **Bug-Reports**; a roll-up COUNTS records per page and per site, owned by **Bug-Summary**. Different reader, different lifetime. **When they disagree, the record wins.**
- **Status (roll-up)** — a row's lifecycle state in a bug summary: bug.schema's six (`open/fixed/verified/reopened/wontfix/duplicate`) **plus three a roll-up needs and a record does not** — `unknown` (the source states none; counted as still owed, NEVER assumed fixed), `not-verified` (we did not re-check it; the debt stands — the same honesty as the test-case sheet's `Blocked`), `reassigned` (accepted as an improvement, no longer a defect). It must be a COLUMN, never prose in a notes field: a counter cannot read a sentence. **Bug-Summary** · `bug-summary.schema.json status`
- **`fixed` ≠ `verified`** — `fixed` means a developer said so; `verified` means QA re-checked it against the original repro. **Only `verified` leaves the outstanding count.** **Bug-Summary** / **Bug-Reports**
- **severityScale** — the ENGAGEMENT's severity vocabulary (the client's: e.g. `Critical/Major/Minor/Trivial`), declared once and reproduced, never silently remapped onto the kit's. A flat array that DRIVES the Sheet geometry — one counter column per value, exactly as `PLATFORMS` does in the checklist. A severity outside it is counted by no column, so the builder refuses to build. **Bug-Summary** · `bug-summary.schema.json severityScale`
- **Derived view** — a list computed from its source by formula (the roll-up's "Left issues" = every row not `verified`), never copied. A hand-maintained list beside its own source drifts — silently, and always in the flattering direction. **Bug-Summary**
- **hostRisk** — whether a piece of evidence will still exist next quarter: `durable` / `expiring` (screencast.com, prnt.sc, personal Dropbox shares) / `unknown`. When the link dies, the bug becomes unprovable. **Bug-Summary** · `bug-summary.schema.json evidence[].hostRisk`
- **Regression core** — bug-derived cases + P0 cases + invariants; re-runs every round. **Regression-Testing**
- **Escape** — bug found in production; tagged with the cycle it escaped (`escapedFromCycle`); feeds the strategy Revision log. **Reporting-and-Metrics** · `bug.schema.json`
- **Reopen rate** — `reopened / (verified + reopened)` per cycle (computed by `qa-metrics.mjs`); fix-quality signal. **Reporting-and-Metrics** · `bug.schema.json status`

## Coverage & traceability
- **RTM** — requirement-traceability matrix: unit → cases → runs → bugs; a projection, never a source. **Traceability**
- **Coverage state** — covered / partial / not-run(+reason) / blocked(+reason) — mechanical definitions. **Traceability** · `coverage.schema.json units[].state`
- **Gap** — risk ≥ 7 unit not covered; `gaps[]` is the escalation list. **Traceability** · `coverage.schema.json gaps`
- **Orphan** — artefact with a broken link (case→no unit, bug→no invariant, run→no plan); fixed at source. **Traceability**

## Orchestration
- **Playbook** — trigger-selected sequence of kit steps with gates (new-project / new-build / release-candidate). **QA-Agent-Playbooks**
- **Gates 🟢🟡🔴** — auto / confirm-and-WAIT / owner-only; destructive split: scan PERMISSION = 🟡, EXECUTING irreversible ops = 🔴. **QA-Agent-Playbooks**
- **Ad-hoc check** — a quick ask outside a playbook: no plan file, explicitly labeled ad-hoc, claims no coverage. **QA-Agent-Playbooks**
- **CI gate** — an automated check fired by a trigger (PR / nightly / release) whose verdict can block a merge. NOT the same word as the human-in-the-loop **Gates 🟢🟡🔴** above: those pause an agent for a person, a CI gate pauses a merge for a machine. **CI-Integration** · `GATES.md`
- **Gate tier** — WHEN a CI gate fires: `gate` (PR, free, ≤10 min) · `nightly` (full sweeps → candidates) · `release` (owner-approved slice). Whether a gate *blocks* is a per-gate property (`soaking` → `required`), not a property of the tier. **CI-Integration**
- **Soaking → required** — a new CI gate runs non-blocking (`soaking`) until it is stable and has caught something real; only then may the owner mark it `required`. A flaky required gate destroys trust faster than no gate. **CI-Integration** · `GATES.md`
- **blocked (gate verdict)** — the gate COULD NOT run (missing secret, crashed scan, no baseline): recorded as not-run, never as a pass — same meaning as the `blocked` stop condition and coverage state. **CI-Integration** · `run-result.schema.json verdict`
- **Tier (T1/T2/T3/OUT)** — compatibility matrix priority by usage; depth per tier. **Compatibility-Testing**
- **Waiver** — owner-signed decision to ship with a named open risk/gap/bug; recorded in the release QA summary. **QA-Agent-Playbooks** (gate) / **Reporting-and-Metrics** (record)

## Loops
- **Repair loop** — iterating fixer+verifier cycle that repairs HARNESS files within a declared allowlist until a rubric passes; never assertions/expected values/statuses; 🟡 gate. **Loop-Engineering**
- **Observation loop** — read-only recurring check (invariant watch, settle-watch, monitoring); writes only its own artifacts + report tabs declared in the spec; 🟢 gate. **Loop-Engineering**
- **Loop-spec** — pre-run declaration of a loop: kind, target, trigger, allowlist, machine-checkable rubric, `max_iterations`, escalation, budgets, verifier command, gate; no spec = no loop. **Loop-Engineering** · `template/loop-spec.template.md`
- **Fixer** — the subagent that repairs allowlisted files; writes NO statuses/verdicts and never runs the final verification. **Loop-Engineering**
- **Verifier (loop)** — the outer-loop script that grades every iteration against the rubric (e.g. `UI-Automation/rubric/run-rubric.mjs`); loop SUCCESS = `pass && complete`. **Loop-Engineering**
- **R0 allowlist guard** — default-deny checksum manifest over everything outside the fixer allowlist, re-verified each iteration; any change/new file = abort + escalate. **Loop-Engineering** (impl. **UI-Automation** `rubric/allowlist-guard.mjs`)

## Execution disciplines
- **Smoke / load / stress / peak** — k6 run intensities: smoke = does it work at all (always first, always before spending) · load = expected traffic · stress = past expected, to find the knee · peak = the cap the owner approved. **Load-Testing**
- **Breaking point** — the load at which the target stops meeting its thresholds; a measured number, never an estimate. The real ceiling is always the TARGET (backend, LLM cost, account limits), never k6. **Load-Testing**
- **Threshold** — a pass/fail line declared BEFORE the run (`p95 < 800ms`, `error rate < 1%`); crossing it is a finding, not a footnote. **Load-Testing** · `run-result.schema.json thresholds`
- **Runs tab** — the append-only cross-run history in the project's load book; every run (including aborted ones, marked as such) gets a row. **Load-Testing**
- **PageSpeed score** — the Lighthouse *performance category* score (0–100) for ONE page load, as returned by the PSI API; a weighted roll-up of lab metrics, not a measurement of real users. A single load is noise: the number in the doc is the MEDIAN of ≥3 runs and every individual run is kept. Fewer runs than the round's target = **not-run**, never a green number. **PageSpeed-report** · `pagespeed-round.schema.json`
- **Lab data vs field data** — *lab* = a synthetic load in a fixed environment (Lighthouse/PSI: LCP · TBT · CLS · FCP · Speed Index); *field* = what real users actually experienced (CrUX: INP · LCP · CLS — often absent for low-traffic origins, and **absent ≠ zero**). Both are recorded when available; a lab number is never presented as user experience. **PageSpeed-report**
- **Performance budget** — an owner-APPROVED pass/fail line for a metric (recorded in the round's `budgets`, with who approved it and when). Without a budget a metric is **reported, never judged**: the 90/50 colour bands are Google's classification, not a verdict. Raising a budget — or re-baselining — to make the doc green is a fabricated Pass, exactly like a silent re-baseline in Visual-Regression. **PageSpeed-report** · `pagespeed-round.schema.json`
- **Round (performance)** — one collection pass over the page list in ONE environment, stored as one round JSON and rendered as one 4-column block in the Sheet. **Environment is part of the identity of a number**: a regression is same page + same platform + same env + same profile + same tool; a staging-vs-production delta is a category error, not a regression — and a confirmed drop is a **bug CANDIDATE** (tag `PERFORMANCE` — the value the bug schema already owns; no `PERF` synonym), filed only after a second round reproduces it. **PageSpeed-report** · `pagespeed-round.schema.json` / `bug.schema.json tags`
- **Viewport class** — one of the four width bands of a web round, named by the keys of the capture `config.json` `viewports` block: mobile 360/375/390 · tablet 768/1024 · desktop 1280/1440/1920 · large 2560. The config is the definition and every doc follows it — a width named in prose but absent from the config is coverage nobody ran; a project that needs another width adds it there. A "mobile check" at a narrow desktop viewport is not a phone (UA detection differs) — use device presets. **Web-Testing** · `template/config.template.json viewports`
- **Device range** — a mobile round is never one average phone: at least one small (SE-class) + one standard, per platform; a single-device pass is labelled a smoke. **App-Emulators** / **Compatibility-Testing**
- **Maestro flow** — the scripted UI drive of an emulator/simulator round; screens it never reached are **not-run**, never Passed. **App-Emulators**
- **Passive vs active scan** — passive = read-only observation (safe, default) · active/destructive = mutates or attacks (needs the owner's explicit green light: 🟡 for permission, 🔴 to execute). **Security-Testing**
- **IDOR** — another user's resource returned instead of 403/404; in an API suite a `200` there is a security bug, not a passing test. **Security-Testing** / **API-Testing** · `bug.schema.json tags: SECURITY`
- **Violation vs incomplete (axe)** — a violation is a CONFIRMED WCAG failure; `incomplete` = needs-review, and is never counted as either a pass or a fail. **Accessibility-Testing**
- **Impact (axe)** — critical / serious / moderate / minor. Every confirmed violation fails a CI gate by default; narrowing the floor is an owner decision recorded in `GATES.md`. **Accessibility-Testing** / **CI-Integration**
- **Perceptual diff** — pixelmatch comparison of a screenshot against its golden; noise is fixed by making the capture deterministic, NEVER by raising the threshold. **Visual-Regression**
- **NO-BASELINE** — a page with no golden: no oracle, therefore not a pass. CI records it as `blocked`; recording a baseline to make it green is a fabricated Pass. **Visual-Regression** / **CI-Integration**
- **Pseudo-localization** — replacing strings with accented/expanded stand-ins to expose truncation and hardcoded text before any translation exists. **Localization-Testing**
- **Mojibake** — text corrupted by an encoding mismatch (`Ð¿Ñ€Ð¸Ð²ÑÑ‚`); always a defect, never a font issue. **Localization-Testing**
- **Contract drift** — the response no longer matches the collection/spec. A finding in one of the three (API, spec, or your assumption) — say which; silently updating the test to match is the API dialect of a silent re-baseline. **API-Testing**

## Test data
- **Pool** — the set of dedicated test accounts; one account per concurrent actor (worker/VU). Sharing one account across workers manufactures "flaky" tests. **Test-Data**
- **Seed** — deterministic data generation (fixed seed, never `Math.random()`), so a failure can be reproduced instead of admired. **Test-Data**
- **Run-id scoping** — every entity a run creates is prefixed with the run-id, which makes it trivially greppable and trivially cleanable. **Test-Data** · `run-result.schema.json runId`
- **Teardown** — the run removes what it created; leftovers become tomorrow's phantom failures. Failed teardown is recorded in `DATA.md`, never ignored. **Test-Data**

## Automated suites
- **Spec** — one automated test file. Contains no locators (page objects own selectors) and no credentials; carries a `TC-NNN` / `BUG-NNN` / `INV-N` trace and a tag. **UI-Automation** (E2E layer)
- **Tag** — the CI interface of a suite: `@high`/`@medium`/`@low` (the case's priority, same words as `test-case.priority`), `@smoke`, `@regression`, `@bug-NNN`, `@quarantine`. An untagged spec runs nowhere. **UI-Automation** / **CI-Integration**
- **Flake** — a test that passes on retry. A **defect in the suite**, not weather: one round to fix, then quarantine + a bug ON THE TEST. Retries buy a green that means nothing. **UI-Automation** / **Regression-Testing**
- **Quarantine** — a flaky spec excluded from the gate but still run nightly, with a bug on the test, an owner and an **expiry**. A debt with a deadline, never a parking lot. **UI-Automation** · `SUITES.md`
- **Empty run** — zero tests executed (bad `--grep`, stray `.only`, all-skipped): reports green while proving nothing, so it is treated as **blocked**. **UI-Automation** / **CI-Integration**
- **Conditional assertion** — `if (await x.isVisible()) expect(...)` — an assertion that can silently decide not to run; a faked Pass with extra steps. Rejected by `lint-specs.mjs`. **UI-Automation**
- **Future-date placeholder** — `dd/mm/yyyy` for any not-yet-run / not-yet-issued date (round stubs, unissued report dates); a real completed date keeps its own per-artefact format. Cross-cutting: **all kits**
