# Test-Oracles — SETUP (Claude-followable)

How to make pass/fail decidable for a project: assign an oracle to every check, and
calibrate the expensive ones. No tooling to install — this kit is a decision
discipline; oracles reuse the sources the other kits already connect (Figma MCP,
Postman MCP, Playwright, k6 thresholds).

## Procedure

### 1. Inventory what gets decided
Collect the project's check surfaces: checklist rows (per screen), API test cases
(per endpoint), load thresholds, security checks, content-quality checks. If a
[Test-Strategy](../Test-Strategy-and-Planning/README.md) exists, its scope table §2.1
is exactly this list.

### 2. Walk the decision tree per area
Run [`template/ORACLE_DECISION_TREE.md`](template/ORACLE_DECISION_TREE.md) over each
area (not each individual check — areas share oracles). Record the result in
`<Project>/Test-Oracles/ORACLES.md`:

```markdown
| Area | Oracle | Source of truth | Notes |
|------|--------|-----------------|-------|
| Login screen layout | spec (Figma) | node 123-456 | px-tolerance ±2 |
| POST /books response | spec (schema) | Postman collection | + invariant: bookId UUID |
| Generated book text | LLM-judge | rubrics/book-quality.md | calibrated 07/2026 |
| Chapter covers | invariant | — | every chapter has non-empty coverUrl |

## Oracle misses (audit trail — false alarms & missed bugs)
| Date | Oracle/area | What happened | Adjustment |
|------|-------------|---------------|------------|

## Revision log (same discipline as the strategy's §9)
| Date | Change | By |
|------|--------|-----|
```

### 3. Write the project invariants
Copy [`template/invariants.example.md`](template/invariants.example.md) →
`<Project>/Test-Oracles/invariants.md`. Harvest from: business rules (owner
interview), schema constraints, past bugs (every bug is a violated invariant — e.g.
<Project> BUG-003 ⇒ "every generated chapter has a cover URL"). Invariants are the
cheapest strong oracle: one line each, checkable by script on every run.

### 4. Capture golden masters (only where the strategy justifies it)
For stable, high-risk outputs: capture baseline (screenshot / response snapshot) into
`<Project>/Test-Oracles/golden/`, with a `README` line per file: what it is, when
captured, what build. Rule: a golden master is UPDATED deliberately (owner-approved
change), never silently overwritten because a test went red.

### 5. Calibrate LLM-judges (only for generative content)
1. Fill [`template/llm-judge-rubric.template.md`](template/llm-judge-rubric.template.md)
   → `<Project>/Test-Oracles/rubrics/<content-type>.md`.
2. **Calibrate before trusting:** collect 3–5 known-GOOD and 3–5 known-BAD samples
   (from past runs / owner judgment). Run the judge on all of them. It must rank every
   known-bad below every known-good and agree with the owner's verdicts. If not —
   tighten rubric wording, re-run. Record the calibration date + samples in the rubric.
3. Re-calibrate when: the generator model changes, the rubric changes, or judge
   verdicts start disagreeing with human spot-checks.

### 6. Wire oracles into execution
- Checklist generators: the check text should IMPLY its oracle ("matches Figma node X",
  "response validates against schema") — a checker with the row must know what decides it.
- Scripts (k6/API/Playwright): encode invariants as assertions/thresholds directly.
- Agent sessions: read `ORACLES.md` at session start, same as the strategy.

## Maintenance

- New bug filed → check whether it implies a new invariant; add it.
- Oracle disagreed with reality (false alarm / missed bug) → note it in `ORACLES.md`,
  adjust; oracles are versioned by the same Revision-log discipline as the strategy.
