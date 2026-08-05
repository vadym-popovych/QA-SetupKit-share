<!-- Copy to <Project>/QA-Documentation/test-cases/TEST_CASES.md. This file is a
     PROJECTION regenerated from cases/*.json — edit the JSONs, then refresh this;
     never edit tables here alone. Derivation-evidence blocks ARE authored here. -->

# <Project> — Test cases

| | |
|---|---|
| **Strategy revision** | STRATEGY.md rev <date> |
| **Cases** | <N> JSONs in `cases/` (source of truth, schema: `Rules-Guide/schemas/test-case.schema.json`) |
| **Last regenerated** | <YYYY-MM-DD> |

## Coverage claims
<!-- Technique × area — this is what "covered" means. List deliberate non-derivations
     too (checklist-only areas), same skips-are-recorded ethos as the strategy. -->

| Area (strategy unit) | Risk | Techniques applied | Cases | Not derived (why) |
|---|---:|---|---:|---|
| S1 Login | 6 | EP, BVA, state-transition | TC-001..TC-009 | pairwise (only 2 params) |

## <Area: S1 Login>

### Derivation evidence
<!-- Show the work BEFORE the cases: partitions/boundaries/tables. This block is
     the proof that coverage is derived, not invented. -->
- **EP (password):** valid ≥6 chars · invalid: empty · invalid: <6 · invalid: >max(64)
- **BVA (password length):** 5 / 6 / 7 and 63 / 64 / 65
- **State transitions:** logged-out →(valid creds)→ logged-in · →(invalid ×5)→ locked

### Cases (projected from `cases/*.json`)

| ID | Title | Technique | Priority | Oracle | Status |
|----|-------|-----------|----------|--------|--------|
| TC-001 | Login rejects password below min length | boundary-value | Medium | spec (figma:123-456) | ready |

## Revision log
| Date | Change | By |
|------|--------|-----|
| <YYYY-MM-DD> | initial derivation | <who> |
