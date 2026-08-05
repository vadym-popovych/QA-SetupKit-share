# API-Testing rules (paste into your workspace CLAUDE.md)

Rules for **functional** API testing — correctness, not throughput (that is
[`Load-Testing`](../Load-Testing/LOAD_TESTING_RULES.md)). Machine-specific paths do NOT belong
here. Mirror new rules of this kind here (+ into `CLAUDE.starter.md` and the workspace
`CLAUDE.md`) so they travel with the kit.

- **Read the API before testing it — never guess the contract.** Endpoints, auth, bodies and
  environments come from the **Postman MCP** ([`POSTMAN_MCP_SETUP.md`](POSTMAN_MCP_SETUP.md)),
  the OpenAPI spec, or the code — in that order. A test written against an imagined payload
  proves nothing when it passes and wastes a triage cycle when it fails. If the API cannot be
  read, that is a **blocked** run, not a reason to invent.

- **Staging/dev only. CRUD mutates.** Never point a functional suite at production — these
  tests create, update and delete. Test data follows
  [`TEST_DATA_RULES`](../../Testing-Planning/Test-Data/TEST_DATA_RULES.md): deterministic
  (seeded, never `Math.random()`), run-id-prefixed, and torn down after. A suite that leaves
  debris behind produces tomorrow's phantom failures.

- **Every assertion names its oracle** ([`TEST_ORACLES_RULES`](../../Testing-Planning/Test-Oracles/TEST_ORACLES_RULES.md)).
  For an API the strong ones are close at hand, so use them:
  *spec* (the response matches the schema/collection), *invariant* (a created resource is
  readable; a deleted one 404s), *differential* (staging vs the previous build),
  *metamorphic* (the same query with `?limit=10` returns a prefix of `?limit=100`).
  **`200 OK` is not an oracle** — asserting only the status code is the most common way an API
  suite goes green while the payload is wrong.

- **Assert the body, not just the status.** Shape (schema), the field values you asked for, and
  the absence of what should not be there (a deleted field, another tenant's data, a null that
  used to be a value). A response that is *200 with the wrong content* is a bug the status-code
  assertion will never see.

- **Negative cases are first-class.** Bad input → the documented 4xx *and* a useful error body;
  missing/expired token → 401; another user's resource → 403/404 (never 200 — that is an IDOR,
  file it with the `SECURITY` tag per
  [`SECURITY_TESTING_RULES`](../Security-Testing/SECURITY_TESTING_RULES.md)). An API suite with
  only happy paths tests the demo, not the API.

- **Chain flows through returned values, never through hardcoded ids.** A business flow
  (sign up → create → publish) passes ids from one response to the next; a suite pinned to ids
  that exist only in today's staging DB is a suite that will lie the first time the DB is reset.

- **A failing check is a `BUG-NNN`, with the request as the repro.** Method, URL, headers
  (secrets redacted), body, actual vs expected response — the whole point of an API bug is that
  the repro fits in a curl line. Severity by the decision tree
  ([`BUG_REPORTS_RULES`](../../QA-Documentation/Bug-Reports/BUG_REPORTS_RULES.md)); front/back
  triage by the response (data correct in the response but wrong on screen → frontend; broken
  in the response → backend). Every bug earns an invariant.

- **Contract drift is a finding, not a chore.** When the response stops matching the collection
  or the spec, that is a defect in one of the three (API, spec, or your assumption) — say which.
  Silently updating the test to match the new response is the API dialect of a silent
  re-baseline: it converts a regression into a "pass".

- **Secrets never enter the suite.** Tokens come from the environment (or the MCP's environment
  object), never a literal in a request, never a value pasted into a doc, never committed.

Artefacts → `<Project>/API-Testing/` (suites, run outputs, contract snapshots), per
[`Project-Configuration`](../../Rules-Guide/Project-Configuration/README.md). When the suite is
stable, it becomes a **CI gate** (G-4) via [`CI-Integration`](../../Testing-Planning/CI-Integration/CI_RULES.md).
