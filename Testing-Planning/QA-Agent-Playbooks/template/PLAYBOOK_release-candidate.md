# Playbook — release candidate

**Trigger:** the owner declares a release candidate. **Goal:** the release-level
Definition of Done — not just "this round passed" but "the cycle is closed".

| # | Step | Kit | Gate |
|---|------|-----|------|
| 1 | Entry check + freeze scope: strategy current (≤ 2 releases old), RC build on staging, full account pool available | Test-Strategy | 🟡 owner confirms RC scope |
| 2 | Full risk-ordered pass: EVERY in-scope unit at its mapped depth, all disciplines the strategy selects (checklist, API, load before release, security once per release) | execution kits | 🟢 execution; 🟡 status writes per kit rules |
| 3 | Regression sweep per the Regression-Testing kit: the regression CORE (all bug-derived cases + P0 + invariants) + all areas with bugs found THIS CYCLE re-verified on the RC build + P1 everywhere + the full visual baseline set | Regression-Testing (+ Test-Cases, Bug-Reports, Visual-Regression) | 🟢 |
| 4 | Exit criteria check, mechanically: each criterion from STRATEGY.md §6 verified and quoted (0 open Critical/Major or waivers listed; all pages statused; SLAs met) | Test-Strategy | 🟢 |
| 5 | Coverage closure: RTM + coverage refresh; `gaps[]` MUST be empty or each gap explicitly waived | Traceability | 🔴 owner decides on every gap: extend / descope / ship-with-risk |
| 5.5 | **Pre-mortem** (see below): *"it is two weeks after release and this went badly wrong — write the incident report"*. Name the failure, the blind spot that let it through, and whether this round would have caught it | this playbook | 🟡 findings go to the owner BEFORE sign-off |
| 6 | DoD + QA summary: bugs by severity over the cycle, coverage vs strategy, known risks shipped (waivers), oracle misses noted, **pre-mortem findings + what was done about each** | Test-Strategy §8 | 🔴 sign-off is the owner's |

**Stop conditions:** DoD met + sign-off (normal) · exit criteria unreachable →
🔴 owner chooses extend/descope/ship-with-risk · blocked.

**Output:** release QA summary (the §8 deliverable) · closed plan file(s) · empty-or-
waived gaps list · RTM/coverage at end-of-cycle state · LINKS to everything. The
summary is the artefact the owner ships with — it says what was verified, against
which oracles, and what risk ships knowingly.

## The pre-mortem (step 5.5)

A checklist can only find what someone already thought of. Before the sign-off gate, spend ten
minutes deliberately assuming failure — it surfaces the risks a green board hides.

**Prompt yourself (or an independent agent) with:** *"It is two weeks after this release. The
team is in an incident call. Write the post-mortem: what broke, who noticed first, and why our
QA round did not catch it."*

Write 3–5 scenarios. For each, answer three questions:

| Question | Why it earns its keep |
|---|---|
| **What failed?** | forces a concrete mechanism ("payments silently double-charge on retry"), not a worry ("payments might break") |
| **Why didn't we catch it?** | this is the finding. It names a hole in the strategy/oracles/coverage, not in the code |
| **Is it still open right now?** | if yes → it is a gap for step 5 (extend the round, or an explicit owner waiver). If no → say which test/oracle would catch it, and check that the test actually exists |

**Rules:**
- **Run it BEFORE the gate, never after.** A pre-mortem written after sign-off is a diary entry.
- **Prefer an independent agent** (or at least a fresh context): the person who ran the round is
  the worst-placed to spot what the round missed — the same maker-checker split the kit applies
  everywhere else.
- **Every scenario ends in an action:** a new case (TC-NNN), a new invariant (INV-N), an
  extension of the round, or a **named waiver** the owner signs. A pre-mortem with no outcome is
  theatre, and it teaches the team that the exercise is decorative.
- **Look where the oracles are weakest** — LLM-generated content, third-party integrations,
  money, data deletion, anything whose "correct" is a judgement call. That is where a green
  board is least trustworthy.
