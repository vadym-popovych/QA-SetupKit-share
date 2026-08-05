# \<Project\> — E2E suite register

> Copy to `<Project>/UI-Automation/e2e/SUITES.md`. This is the suite's **memory**: what each
> spec covers, what it traces to, and — crucially — what is NOT automated and why. A suite
> without this file drifts into "we have tests" without anyone able to say what they prove.

**Run:** `npx playwright test` · gate slice: `npx playwright test --grep @high`
**Lint:** `node tools/lint-specs.mjs tests` (must be clean — it enforces the rules below)
**CI:** the `@high` slice is gate **G-1** in `<Project>/CI-Integration/GATES.md`; the full suite
is the nightly regression selection.

## Specs

| Spec | Covers | Traces to | Tags | Status |
|------|--------|-----------|------|--------|
| `tests/smoke/login.spec.ts` | UI login form: valid + invalid credentials | TC-012 · INV-3 | `@high` `@medium` `@smoke` | active |
| `tests/regression/BUG-014-empty-quantity.spec.ts` | an order line with no quantity is rejected, not silently dropped | BUG-014 · INV-7 · TC-041 | `@regression` `@bug-014` `@high` | active |

`Status`: `active` · `quarantined` (flaky — excluded from the gate, still runs nightly; needs
a bug ON THE TEST and an owner + expiry) · `retired` (the feature is gone; say so, don't just
delete the row).

## Quarantine

A quarantined spec is a debt with a name and a deadline — never a parking lot.

| Spec | Since | Bug on the test | Owner | Expires |
|------|-------|-----------------|-------|---------|
| — | | | | |

**Rule:** a flake gets ONE round to be fixed. Then it is quarantined *with* a bug filed on the
test itself and an expiry date; past the expiry it is fixed or retired. A suite that keeps
flaky tests running with retries teaches the team to ignore red — and then the real red gets
ignored too.

## Deliberately NOT automated

Being honest here is what keeps the coverage numbers meaningful.

| What | Why not | Covered instead by |
|------|---------|--------------------|
| \<e.g. 3-D Secure payment flow\> | third-party sandbox is non-deterministic | manual regression case TC-0NN, every release |
| \<e.g. push-notification receipt\> | no hook into the device layer from the browser | Emulator-Testing round |

## Suite health (update each round)

| Metric | Value | Why it matters |
|--------|-------|----------------|
| Specs total / `@high` | \<n\> / \<n\> | the `@high` slice is what gates every PR — if it is empty, the gate is decoration |
| Bugs with a regression spec | \<n\>/\<n\> fixed bugs | the whole point of #17: a fixed bug that can regress unnoticed was never really closed |
| Quarantined | \<n\> | more than a couple = the suite is rotting; stop adding, start fixing |
| Median runtime (`@high`) | \<n\> min | over ~10 min the PR gate stops being free and people start bypassing it |
