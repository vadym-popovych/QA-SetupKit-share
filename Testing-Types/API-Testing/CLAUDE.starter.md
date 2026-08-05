# API-Testing starter rules — paste into YOUR workspace CLAUDE.md

## Functional API testing — API-Testing kit
- **Home:** `QA-SetupKit/Testing-Types/API-Testing/` — functional correctness (CRUD, auth,
  validation, business flows, contract), NOT performance (that is the Load-Testing kit).
  Triggers: "test the API", "перевір ендпоінти", "чи не поламався контракт" → `SETUP.md`
  (round flow; the MCP connection — `POSTMAN_MCP_SETUP.md`) + `API_TESTING_RULES.md`.
- **Read the API before testing it:** endpoints/auth/bodies come from the **Postman MCP**, the
  OpenAPI spec, or the code — never from imagination. Can't read it → **blocked**, not guessed.
- **Staging/dev only** (CRUD mutates). Data is deterministic, run-id-prefixed, torn down after.
- **`200 OK` is not an oracle.** Assert the body: schema, the values you asked for, and the
  absence of what shouldn't be there. A 200 with wrong content is a bug the status assertion
  never sees. Every assertion names its oracle (spec · invariant · differential · metamorphic).
- **Negative cases are first-class:** bad input → documented 4xx + useful error body; no/expired
  token → 401; another user's resource → 403/404 — a 200 there is an IDOR (tag `SECURITY`).
- **Chain flows through returned values**, never hardcoded ids from today's staging DB.
- **Failures → `BUG-NNN`** with the request as the repro (curl-sized), severity by the decision
  tree, front/back triage by the response. **Contract drift is a finding** — silently updating
  the test to match the new response is the API dialect of a silent re-baseline.
- Secrets come from the environment; never a literal in a request or a doc.
- Artefacts → `<Project>/API-Testing/`. A stable suite becomes CI gate **G-4** (CI-Integration).

Full rules: `QA-SetupKit/Testing-Types/API-Testing/API_TESTING_RULES.md`.
