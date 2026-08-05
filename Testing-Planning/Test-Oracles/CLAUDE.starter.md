# Test-Oracles starter rules — paste into YOUR workspace CLAUDE.md

## Pass/fail oracles — Test-Oracles kit
- **Home for oracle discipline:** `QA-SetupKit/Testing-Planning/Test-Oracles/`. Every Passed/Failed
  verdict must name its oracle — "correct according to WHAT?" (Figma node, schema,
  golden baseline, invariant, metamorphic relation, calibrated rubric). No oracle =
  **not-run / needs-human**, never Passed. In checklist Sheets that's an EMPTY status
  cell + a Comment on what to look at (dropdown stays Passed/Failed/Skipped); the
  literal "needs-human" appears only in oracle artefacts.
- **Strength order** (use the strongest available): explicit spec → golden-master →
  differential → invariant → metamorphic → consistency heuristic → LLM-judge → human.
  Pick per AREA via `QA-SetupKit/Testing-Planning/Test-Oracles/template/ORACLE_DECISION_TREE.md`,
  record in `<Project>/Test-Oracles/ORACLES.md`.
- **Oracle conflict** (design vs spec vs behaviour) → record the contradiction + comment
  and escalate, even if ultimately Passed. Never pick a side silently.
- **Invariants**: harvest one-liners from business rules and past bugs (every bug is a
  violated invariant) into `<Project>/Test-Oracles/invariants.md`; assert them in every
  run (k6 checks, API assertions, Playwright).
- **Golden masters** update deliberately (owner-confirmed change, note build+date) —
  never re-record to make a red test green.
- **LLM-judge for generative content**: fixed rubric + thresholds; calibrate on
  known-good/known-bad samples before trusting; judge independent of generator;
  borderline scores → needs-human; re-calibrate on model/rubric change.
  **Ground the judge in scripted evidence**: mechanical pre-checks first (entity-mention
  counts, name spans, completeness) — every verdict claim must be re-verifiable by
  script (quoted chapter + grep-able count), else it's opinion, not an oracle.
- **Expert focus-checks (C-checks)**: recurring weak spots named by a domain expert
  become dedicated independently-scored rubric checks with an auto-flag (≤2 ⇒ finding/
  bug even if the overall average passes); outside the overall mean by design.
- **Derived-content continuity** (sequel/prequel/translation/summary): two standing
  invariants — direction/position (prequel strictly precedes the source and can't
  pre-discover late reveals; sequel starts at the source's final state; red flag =
  re-telling the inciting event) + canon-vocabulary preservation (load-bearing proper
  nouns survive or are plausibly absent; no silent renames; internal name spans stable).
- **Artefacts:** `<Project>/Test-Oracles/` (`ORACLES.md`, `invariants.md`, `rubrics/`,
  `golden/`; screenshot golden masters canonically live in
  `<Project>/Visual-Regression/golden/` — reference, don't duplicate). Kit folder =
  templates/rules only.

Full rules: `QA-SetupKit/Testing-Planning/Test-Oracles/TEST_ORACLES_RULES.md`.
