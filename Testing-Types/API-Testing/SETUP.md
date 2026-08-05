# API-Testing kit — setup & round flow (Claude-followable)

## 0. Prerequisites (auto-detect, fix what's missing)

1. **Node ≥ 18**: `node --version` — the runner uses the built-in `fetch`, no npm installs.
2. **Postman MCP connected** — the full connection flow (register → restart → authenticate →
   verify) lives in [`POSTMAN_MCP_SETUP.md`](POSTMAN_MCP_SETUP.md); run its §0 auto-detection
   first. One connection serves this kit and Load-Testing.
3. **Tokens for the staging test users** — exported as environment variables at run time,
   never pasted into files (§3). No usable staging account → ask the owner; do not test
   against production instead.

## 1. Read the API first (never guess)

Walk the collection per [`POSTMAN_MCP_SETUP.md`](POSTMAN_MCP_SETUP.md) §5 and extract: base
URL, auth scheme, per-endpoint method/path/body, response shapes, documented error statuses.
No collection → the OpenAPI spec → the code, in that order
([`API_TESTING_RULES.md`](API_TESTING_RULES.md)). If the API cannot be read at all, the round
is **blocked** — record it as blocked and say what was missing; never improvise a contract.

## 2. Scaffold the project folder (first round only)

```bash
mkdir -p <Project>/API-Testing/{tools,runs}
cp QA-SetupKit/Testing-Types/API-Testing/template/tools/api-run.mjs      <Project>/API-Testing/tools/
cp QA-SetupKit/Testing-Types/API-Testing/template/config.example.json    <Project>/API-Testing/config.json
cp QA-SetupKit/Testing-Types/API-Testing/template/suite.example.json     <Project>/API-Testing/suite.json
```

Fill `config.json`: `environment` + `baseUrl` (**staging/dev — the runner refuses
`environment: "production"`**, CRUD mutates) and the token variable *names* under `secrets`
(documentation for whoever runs it; the values stay in the environment).

Then replace the example checks in `suite.json` with checks derived from the real collection
(§1) — the example documents the format: expected status + body assertions
(`exists`/`equals`/`absent`/`matches` on a dot-path), `capture` to chain a later check on a
returned value, `{env.NAME}`/`{cap.name}`/`{runId}` placeholders, an oracle per check.
Negative and authorization checks are first-class — write them before the happy paths
(bad input → documented 4xx; no token → 401; another user's resource → 403/404, where 200 is
an IDOR filed with tag `SECURITY`). Use the project's real `TC-NNN` ids where cases exist —
those rows feed `results[]` in the run-result and regression counting.

## 3. Secrets

Export the tokens in the shell that runs the suite — never write them into `config.json`,
`suite.json`, or any doc:

```bash
export API_TOKEN=…                  # the seeded staging test user
export API_TOKEN_SECOND_USER=…      # a different user, for authorization checks
```

`api-run.mjs` scans the suite for `{env.*}` references and refuses to start (exit 2) while
any of them is unset — a suite that silently sends `Bearer undefined` produces 401s that read
like findings and waste a triage cycle.

## 4. Run the suite

```bash
cd <Project>/API-Testing
node tools/api-run.mjs --out runs/<YYYY-MM-DD>-<slug>
```

Exit codes (documented in the runner's header; same contract as the CI gate, so a stable
suite can gate G-4 directly):

| Exit | Meaning |
|------|---------|
| 0 | pass — every check executed, every assertion held |
| 1 | fail — ≥1 assertion failed; each failure is a `BUG-NNN` candidate |
| 2 | usage/config — missing config, unset env var, production target; nothing was sent |
| 3 | blocked — zero checks executed, or checks errored/skipped; never a pass |

Validate the artefact **in the same turn** (schemas rule — machine artefacts are validated
when written):

```bash
node QA-SetupKit/Rules-Guide/schemas/validate.mjs run-result runs/<YYYY-MM-DD>-<slug>/run-result.json
```

## 5. Triage failures & report

1. **Every fail → a `BUG-NNN` candidate.** The repro is in `runs/<…>/evidence.json` — method,
   URL, headers (as written in the suite, `{env.*}` placeholders unresolved, so no secret is
   in the artefact), body, expected vs actual. Front/back triage by the response; dedup +
   severity per [`BUG_REPORTS_RULES`](../../QA-Documentation/Bug-Reports/BUG_REPORTS_RULES.md).
2. **Contract drift is a finding, not a chore** — the response stopped matching the
   collection/spec: say which of the three (API, spec, assumption) is wrong. Never silently
   edit the expectation to match the new response.
3. **Errored/skipped checks are debt, not noise** — the run is `blocked`, and the blocked
   reasons are listed in `thresholds.crossed`. Fix the harness/env or name the blocker;
   re-run before claiming the round green.
4. Artefacts land in `<Project>/API-Testing/runs/<YYYY-MM-DD>-<slug>/` (`run-result.json` +
   `evidence.json`); the suite and config stay at `<Project>/API-Testing/`. End the round
   with a LINKS section (run folder, candidates doc) per the workspace convention.
