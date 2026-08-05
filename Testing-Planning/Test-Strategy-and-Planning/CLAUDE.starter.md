# Test-Strategy starter rules — paste into YOUR workspace CLAUDE.md

## Test strategy & planning — Test-Strategy-and-Planning kit
- **Home for the QA planning layer:** `QA-SetupKit/Testing-Planning/Test-Strategy-and-Planning/`. When
  starting substantial testing for a project (first checklist run, load test, security
  pass) and `<Project>/Test-Strategy/STRATEGY.md` doesn't exist → offer to build it via
  the kit's `SETUP.md` (inventory Figma screens + Postman endpoints + bug history →
  10-question owner interview → risk matrix → fill templates → owner approval).
- **The strategy is the charter:** read it FIRST each testing session; obey scope
  in/out; risk ranking (likelihood 1–3 × impact 1–3) sets order; depth mapping
  (7–9 deep / 4–6 standard / 1–3 smoke) sets technique. Out-of-scope = not tested,
  noted, never silently expanded.
- **Criteria must be agent-checkable** ("0 open Critical/Major", "High-priority pages all
  statused"), never vibes. **Stop** on: exit criteria met · time-box out · diminishing
  returns · blocked — and SAY which one fired. **Skips are recorded** in the plan's
  "Not run" with reasons, never silent.
- **Escalate to the owner** on: contradicting sources, mid-round scope expansion,
  destructive actions, unreachable exit criteria (extend / descope / ship-with-risk is
  the owner's call). Owner approval gates the strategy and its revisions.
- **Artefacts:** `<Project>/Test-Strategy/STRATEGY.md` + `strategy.json` (keep in sync —
  the JSON is what agents/scripts consume) + `plans/<date>-<build>.md` per round
  (append-only history). Kit folder holds templates only, no project data.

Full rules: `QA-SetupKit/Testing-Planning/Test-Strategy-and-Planning/TEST_STRATEGY_RULES.md`.
