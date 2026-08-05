# Test-Strategy-and-Planning — SETUP (Claude-followable)

How to produce a test strategy for a project. No heavy tooling — this kit is a
documentation discipline; the only prerequisites are read-access to the project's
sources of truth.

## Prerequisites (auto-detect, none are hard blockers)

- **Figma MCP** (screens inventory) — if connected, use it; if not, ask for exported
  screen list or proceed with what the user describes.
- **Postman MCP** (endpoint inventory) — same: use if available.
- **Existing QA artefacts** — the project's checklist Sheet, `Bug Reports` tab, past
  run logs (`<Project>/Load-Testing/results/`, …). Read them BEFORE the interview:
  bug history is the best risk signal.
- `<Project>/` folder per [Project-Configuration](../../Rules-Guide/Project-Configuration/README.md);
  create `<Project>/Test-Strategy/` lazily on first strategy.

## Procedure

### 1. Inventory the product (30 min, mostly automated)
Build the scope-unit list — the rows everything else ranks:
- **Screens** from Figma (file → pages/frames; reuse saved node-ids in `config.json`).
- **Endpoints** from Postman (collection → folders/requests, auth model).
- **User roles / tiers** from the user or Test-Data kit pool docs (anon / free / premium / admin).
- **Third-party integrations** (payments, LLM generation, push, analytics) — these are
  risk hot-spots by default.

### 2. Interview the owner (10 focused questions, one message)
Ask ONCE, in a single batch — don't drip-feed:
1. What does "quality" mean for this release (crash-free? conversion? data integrity?)
2. Top-3 user flows by business value?
3. What breaks most often historically?
4. Deadline / testing time budget?
5. Which platforms/browsers/devices actually matter (usage data if any)?
6. What is explicitly OUT of scope this round?
7. Any compliance/regulatory needs (GDPR, a11y, payments)?
8. Environments available (staging/dev URLs, test accounts)?
9. Who fixes bugs and how fast (affects severity thresholds)?
10. Appetite for destructive/load testing on shared environments?

### 3. Score risks
For each scope unit: **likelihood** (1–3: how often does this kind of thing break —
use bug history, complexity, novelty) × **impact** (1–3: user harm / money / data
loss / reputation) = **risk 1–9**. Rank. The matrix template is in
[`template/STRATEGY.template.md`](template/STRATEGY.template.md) §4.

### 4. Map risk → depth
| Risk | Depth |
|---|---|
| 7–9 | Deep: full checklist pass + dedicated techniques (API + load/security if applicable) + exploratory session |
| 4–6 | Standard: checklist pass + happy-path API |
| 1–3 | Smoke only; skip when time-boxed out — RECORD the skip in the plan |

### 5. Fill the templates
- Copy [`template/STRATEGY.template.md`](template/STRATEGY.template.md) →
  `<Project>/Test-Strategy/STRATEGY.md`; fill every section (guidance comments inline).
- Generate `strategy.json` from it (shape: [`template/strategy.example.json`](template/strategy.example.json)).
- First testing round → copy [`template/TEST_PLAN.template.md`](template/TEST_PLAN.template.md)
  → `<Project>/Test-Strategy/plans/<date>-<build>.md`.

### 6. Review gate (human-in-the-loop)
Present the draft strategy to the owner as a SHORT summary (scope in/out, top-5 risks,
exit criteria, what will be skipped). Get explicit approval BEFORE executing against
it — the strategy authorizes skips, so unapproved skips are silent coverage holes.

### 7. Keep it alive
Every release/build: new plan file; after the round, update the risk matrix from what
actually broke (add a row to the strategy's Revision log). Keep `strategy.json` in
step too: append the plan to its `plans[]` when the plan is created, and fill that
entry's `stopCondition` when the round closes. A strategy older than the last two
releases is stale — flag it.
