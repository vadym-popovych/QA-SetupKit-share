# API-Testing kit (functional)

Home for **functional / integration testing of an API** — correctness, not
performance. Kept separate from [`../Load-Testing/`](../Load-Testing/) (which is about
throughput / p95-p99 / breaking point) on purpose: different goal, different tooling
cadence, different pass/fail criteria.

> Status: **rules stable + runnable scaffold.** The discipline is written down in
> [`API_TESTING_RULES.md`](API_TESTING_RULES.md) (read the API before testing it · `200 OK` is
> not an oracle · negative cases are first-class · contract drift is a finding, not a chore);
> the Postman MCP setup lets Claude work from the real collection; the round flow is
> [`SETUP.md`](SETUP.md), and [`template/`](template/) ships the copyable suite + runner.
> Concrete suites are built per project under `<Project>/API-Testing/`.

## What lives here (scope)
Functional API testing, built up incrementally:
1. **CRUD checks** — create → read → update → delete on each resource; status codes,
   response shapes, persistence.
2. **Auth & permissions** — token flows, 401/403, expiry, role boundaries.
3. **Validation & error cases** — bad input → correct 4xx + error body; idempotency.
4. **Business flows** — multi-step end-to-end journeys (e.g. sign up → create → publish),
   chaining values between calls.
5. **Contract** — responses match the API spec/schema; no drift from the Postman collection.
6. **Regression** — a runnable suite to re-check the above after changes.

## Approach
- **Read the API from Postman first** — connect the **Postman MCP** so Claude works from
  the real collection (endpoints, auth, bodies, environments), not guesses. Setup:
  **[`POSTMAN_MCP_SETUP.md`](POSTMAN_MCP_SETUP.md)** — start here.
- **Round flow:** [`SETUP.md`](SETUP.md) — read the API (§1) → scaffold (§2) → secrets (§3)
  → run (§4) → triage into `BUG-NNN` (§5).
- Test **staging/dev only, never production** — CRUD/flows mutate data.
- **Tooling that ships here:** a declarative suite — checks as data (method/path/expected
  status/body assertions/`capture` chaining), documented by
  [`template/suite.example.json`](template/suite.example.json) — executed by
  [`template/tools/api-run.mjs`](template/tools/api-run.mjs): zero dependencies (built-in
  `fetch`), fail-closed on missing config/env, writes a schema-valid `run-result.json`
  (discipline `api`) + `evidence.json` with the repro per check. Target/env-var names go in
  [`template/config.example.json`](template/config.example.json). Postman/Newman or k6
  functional runs remain fine where a team already lives in them — the artefact contract
  (run-result + evidence) stays the same.
- Report failures as `BUG-NNN` in the team QA Google Sheet, same convention as the
  checklist / emulator / load-testing kits.

## Roadmap (fill in as we go)
- [ ] Confirm target API + Postman collection/workspace (via the MCP)
- [ ] CRUD suite per resource
- [ ] Auth / permission suite
- [ ] Validation / negative-case suite
- [ ] End-to-end flow suite
- [ ] Contract/schema checks
- [x] Regression runner — `template/tools/api-run.mjs` + `suite.example.json` (the CI hook
      stays per project: a stable suite gates G-4 via CI-Integration, exit codes already match)
- [x] `API_TESTING_RULES.md` + `CLAUDE.starter.md` once patterns stabilize

## Relationship to the other kits
- **Postman MCP** is shared with the Load-Testing kit — one connection serves both;
  canonical config in [`../../MCP-configurations/README.md`](../../MCP-configurations/README.md) §5.
- **Load-Testing** ([`../Load-Testing/`](../Load-Testing/)) — same collection, performance goal.
