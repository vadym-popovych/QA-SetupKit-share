# Playbook — new project enters QA

**Trigger:** a project gets QA for the first time (no `<Project>/` folder or no
strategy). **Goal:** the planning stack exists and is approved, so every later round
has a charter. Order matters — each step consumes the previous one's output.

| # | Step | Kit | Gate |
|---|------|-----|------|
| 1 | Create `<Project>/` per the folder convention | Project-Configuration | 🟢 |
| 2 | Build the test strategy: inventory (Figma/Postman/bug history) → 10-question interview → risk matrix → STRATEGY.md + strategy.json | Test-Strategy-and-Planning | 🟡 owner approves scope/risks/criteria |
| 3 | Assign oracles per area: decision tree → ORACLES.md; harvest invariants (business rules; bug history if migrating a project) | Test-Oracles | 🟢 (🟡 if golden masters need capturing) |
| 4 | Provision test data: account pool, seeds/teardown, `users.example.json` committed, real creds gitignored | Test-Data | 🟡 owner supplies/confirms accounts |
| 5 | Derive cases for risk ≥ 7 areas (techniques per input type; schema-valid JSONs) | QA-Documentation/Test-Cases | 🟡 owner reviews suite summary |
| 6 | Generate the checklist from Figma (web/mobile template per detection rules) | QA-Documentation/Checklist | 🟢 (existing kit flow) |
| 7 | Initialize RTM + coverage.json (everything `not-run` — that's honest) | Traceability | 🟢 |
| 8 | Report: what exists now, first-round recommendation (which plan to run first) | — | 🟡 owner picks the first round |

**Stop conditions:** all steps done (normal) · blocked on owner input at a 🟡 gate
(park, report what's waiting) · budget (pause protocol at a step boundary).

**Output:** approved STRATEGY.md + strategy.json · ORACLES.md + invariants.md ·
test-data pool docs · cases for deep areas · checklist Sheet · RTM.md + coverage.json
· a recommended first plan. LINKS section lists all of them.
