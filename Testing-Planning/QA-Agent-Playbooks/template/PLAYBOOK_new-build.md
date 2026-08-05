# Playbook — new build / PR on an active project

**Trigger:** a new build lands on staging (or a PR needs a QA pass) for a project
that already has the planning stack. **Goal:** test what the change touches plus the
risk backbone — not everything, not randomly.

| # | Step | Kit | Gate |
|---|------|-----|------|
| 1 | Entry check: build deployed + healthy, accounts free (quota/slots), previous blocking bugs resolved or waived | Test-Strategy (entry criteria) | 🟢 — fail → stop as `blocked`, report |
| 2 | Open the plan: what changed (changelog/PR/owner) → select units: ALL changed areas + ALL risk ≥ 7 + coverage `gaps[]`; the regression view (Regression-Testing kit: core + impact slice) defines the re-run subset; fit the rest to the time-box in risk order | Test-Strategy + Traceability + Regression-Testing | 🟡 owner confirms the plan (1 short message) |
| 3 | Execute per unit at mapped depth: checklist pages (emulator kit) / API cases / load thresholds / security checks — each per ITS kit's rules; oracles decide verdicts | execution kits + Test-Oracles | 🟢 execution; 🟡 before WRITING checklist statuses (existing rule: report → confirm → write) |
| 4 | File bugs: dedup first, severity via tree, invariant tie-in; Critical → escalate IMMEDIATELY | QA-Documentation/Bug-Reports | 🟢 filing (🔴 Critical = instant owner ping) |
| 5 | Regression guard: every bug FIXED in this build → re-verify with original repro (`verified` per Bug-Reports); same round — ensure + run its regression case + component siblings | Bug-Reports + Regression-Testing | 🟢 |
| 6 | Close the round: plan Results (executed / not-run+reasons / stop condition), RTM + coverage refresh, risk re-scores proposed | Test-Strategy + Traceability | 🟡 owner sees the report |

**Stop conditions:** exit criteria met · time-box exhausted · diminishing returns ·
blocked. NAME the one that fired in the plan Results.

**Output:** filled plan file · statused checklist · BUG-NNN rows · refreshed RTM +
coverage (gaps escalated if any) · standard report with LINKS.
