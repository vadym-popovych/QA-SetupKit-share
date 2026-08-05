<!-- Copy to <Project>/Test-Strategy/STRATEGY.md and fill. Guidance lives in
     HTML comments like this one — delete them as you fill each section. -->

# <Project> — Test Strategy

| | |
|---|---|
| **Owner** | <name / email> |
| **Created** | <YYYY-MM-DD> |
| **Last revised** | <YYYY-MM-DD> (see Revision log, §9) |
| **Status** | DRAFT → APPROVED (by <owner>, <date>) |
| **Environments** | <staging URL, dev URL — production is NEVER tested> |
| **Machine summary** | `strategy.json` — keep in sync with this doc |

## 1. Quality goals
<!-- 2–4 sentences from the owner interview: what "quality" means for THIS product.
     E.g. "Generation must complete reliably (paid feature); no data loss; UI matches
     Figma on the 3 core flows." These goals justify every priority below. -->

## 2. Scope

### 2.1 In scope
<!-- The scope-unit inventory: screens (from Figma), endpoints (from Postman),
     user roles/tiers, integrations. Every row here appears in the risk matrix §4. -->

| # | Unit | Type | Source |
|---|------|------|--------|
| S1 | <Login screen> | screen | Figma node <id> |
| E1 | <POST /books> | endpoint | Postman <collection/folder> |
| R1 | <premium user> | role | Test-Data pool |
| I1 | <LLM generation> | integration | — |

### 2.2 Out of scope (explicit!)
<!-- What is deliberately NOT tested this cycle and WHY (owner's call from the
     interview). The agent must not silently expand into these. -->

## 3. Test levels & types selected
<!-- Which QA-SetupKit kits fire for this project, and what each is responsible for.
     Delete rows that don't apply. -->

| Level/type | Kit | Applies to | Trigger |
|---|---|---|---|
| Functional UI (checklist) | QA-Documentation/Checklist + Emulators | screens | every build |
| Functional API | API-Testing | endpoints | every build |
| Load/stress | Load-Testing | hot endpoints (risk ≥ 7) | before release |
| Security (grey-box) | Security-Testing | auth + paid endpoints | once per release |
| Test data | Test-Data | all of the above | continuous |

## 4. Risk matrix
<!-- THE core section. likelihood (1–3) × impact (1–3) = risk (1–9).
     Likelihood: bug history in this area, complexity, novelty.
     Impact: user harm / money / data loss / reputation.
     Re-score after every round (§9). Order rows by risk, descending. -->

| Unit | Failure we fear | Likelihood | Impact | Risk | Depth |
|------|-----------------|-----------:|-------:|-----:|-------|
| <E1 POST /books> | generation stalls, user pays & waits | 3 | 3 | **9** | deep |
| <S1 Login> | lockout of valid users | 2 | 3 | **6** | standard |
| <S7 Settings> | cosmetic mismatch | 1 | 1 | **1** | smoke |

**Depth mapping:** 7–9 deep (full checklist + dedicated techniques + exploratory) ·
4–6 standard (checklist + happy-path API) · 1–3 smoke (may be time-boxed out — record
the skip in the plan).

## 5. Entry criteria (per testing round)
<!-- Conditions before a round starts — each must be agent-checkable. -->
- Build deployed to <staging> and healthcheck green.
- Test accounts available and not slot/quota-exhausted (check via Test-Data pool doc).
- Blocking bugs from the previous round resolved or explicitly waived by the owner.

## 6. Exit criteria (per testing round)
<!-- "Done" conditions — each must be agent-checkable, never vibes. -->
- All High-priority (risk ≥ 7) units executed at their mapped depth.
- 0 open Critical/Major bugs (or each waived by the owner, in writing).
- Checklist: every in-scope page statused (Passed/Failed/Skipped — no empty rows on in-scope pages).
- <load: p95 < SLA ms on staging at N VUs — if load in scope>

## 7. Stop criteria & escalation
Stop when ONE fires (and NAME it in the plan): exit criteria met · time-box exhausted ·
diminishing returns (a full session yields no new findings on covered areas) · blocked.

Escalate to the owner instead of deciding: contradicting sources (spec vs Figma vs
behaviour) · scope expansion discovered mid-round · destructive action needed · exit
criteria unreachable in the time-box (extend / descope / ship-with-risk = owner's call).

## 8. Definition of Done (release-level)
<!-- The release-level bar, usually: all rounds' exit criteria + regression on
     previously-broken areas + sign-off. -->
- Exit criteria of the final round met.
- Regression pass over all areas with bugs found this cycle.
- QA summary delivered (bugs by severity, coverage vs this strategy, known risks shipped).

## 9. Revision log
<!-- Append-only. After every round: what broke → likelihood re-scores; scope changes. -->

| Date | Round/plan | Change | By |
|------|-----------|--------|-----|
| <YYYY-MM-DD> | initial | first version | <owner> + Claude |
