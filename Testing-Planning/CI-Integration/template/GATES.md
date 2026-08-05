# <Project> — QA gate register

> Copy to `<Project>/CI-Integration/GATES.md` and fill. **This file is the source of
> truth**: a gate with no row here does not exist, and a pipeline job with no row is a
> finding. Flipping `Status` to `required` is an OWNER decision — record it in the
> Decision log below and add the job to `REQUIRED_GATES` in the workflow.

**Topology:** A (pipeline in the QA repo → staging URL; cannot block merges) ·
B (pipeline in the app repo → PR build; can block merges) — *pick one, delete the other,
say why.*
**Target env:** `<staging URL>` — never production. Set as `STAGING_BASE_URL`; the project's
tool copies read it from `BASE_URL`.
**Provider:** GitHub Actions / GitLab CI / none (scheduled from the QA workspace).
**Required check:** `verdict` only — never the individual gate jobs (GitHub counts a SKIPPED
job as a passing required check, so requiring a gate directly lets a red preflight through).

## Gates

| ID | Discipline | Wraps (kit tool / command) | Tier | Runtime | Owner | Status |
|----|------------|----------------------------|------|---------|-------|--------|
| G-1 | ui-automation | `npx playwright test --grep @high` (UI-Automation kit) | gate | ~4 min | \<name\> | soaking |
| G-2 | accessibility | `a11y-scan.mjs` → verdict by `ci-run-result.mjs --discipline accessibility` | gate | ~2 min | \<name\> | soaking |
| G-3 | visual-regression | `visual-diff.mjs` → verdict by `ci-run-result.mjs --discipline visual-regression` | gate | ~3 min | \<name\> | soaking |
| G-4 | api | contract/CRUD suite (API-Testing kit) | gate | ~2 min | \<name\> | soaking |
| G-5 | — | `validate.mjs` on the QA artefacts in the diff (Rules-Guide/schemas) | gate | <10 s | \<name\> | soaking |
| G-6 | regression | full regression selection (Regression-Testing kit) | nightly | ~15 min | \<name\> | active |
| G-7 | load | k6 **smoke only** (never stress/peak in CI) | release | ~5 min | \<name\> | active |

`Status`: **`soaking`** (runs and reports, does NOT block — the default for every new gate) ·
`required` (a red gate blocks the merge; the job is listed in `REQUIRED_GATES`) ·
`quarantined` (flaky — bug filed on the test, excluded from the verdict) · `retired`.
Nightly/release gates are `active` (they run and report; they never block a merge by design).

**Promotion rule — every gate starts `soaking`, without exception.** A gate becomes
`required` only after it has been non-flaky AND has caught something real (or demonstrably
would have) across several rounds. A flaky required gate does more damage than no gate: the
team learns to click "merge anyway", and then the real red goes through too.

## Scope of each gate — what it actually covers

Be precise here; a register that overstates coverage is how "green" starts meaning nothing.
The kit tools scan the page list configured **inside them** — neither `a11y-scan.mjs` nor
`visual-diff.mjs` takes CLI flags, so there is **no "changed pages/components only" mode**
unless the project builds one. Say what is really covered:

| Gate | Really covers | Explicitly NOT covered |
|------|---------------|------------------------|
| G-1 | the `@high` tagged specs | everything untagged |
| G-2 | the pages in `a11y-scan.mjs` PAGES (`<n>` pages), WCAG 2.2 AA, axe-detectable rules only | manual keyboard/SR passes; pages not in the list |
| G-3 | the pages in `visual-diff.mjs` PAGES that HAVE a golden | pages with no baseline → the gate reports **blocked**, not pass |

**Gate verdict floors** (owner decisions — the emitter's defaults are the strict ones):
- a11y `--fail-on`: default = **every confirmed violation** fails. If this project narrows it
  (e.g. `critical,serious`), write that here with the reason; tolerated violations are still
  reported in `details.json` and `candidates.md` — "pass" never means "no violations exist".
- e2e flakes: default = **a flake fails the gate** (REGRESSION_RULES: flaky = broken). If the
  project runs with `--allow-flaky`, record it here — it is a debt, not a setting.

## Required secrets

| Secret | Used by | Where it comes from |
|--------|---------|---------------------|
| `STAGING_BASE_URL` | all gates (exported to the tools as `BASE_URL`) | project config — staging only |
| `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` | G-1, G-4 | Test-Data account pool (dedicated CI account, not a human's) |
| `QA_REPO_TOKEN` | topology B only | read access to the QA repo holding the kit tools |

Secrets live in the CI secret store. Never inline a value in the YAML, never commit one.

## Excluded from CI (deliberately)

Load stress/peak runs · LLM-generation series · active/destructive security scans ·
anything a playbook marks 🔴 · any production target. These stay owner-triggered.

## Decision log

| Date | Change | Owner |
|------|--------|-------|
| \<dd/mm/yyyy\> | register created; every gate starts `soaking`, `REQUIRED_GATES` is empty | \<name\> |
