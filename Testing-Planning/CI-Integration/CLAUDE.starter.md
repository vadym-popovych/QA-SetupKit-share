# CI-Integration starter rules — paste into YOUR workspace CLAUDE.md

## CI quality gates — CI-Integration kit
- **Home:** `QA-SetupKit/Testing-Planning/CI-Integration/`. Triggers: "put gates on PRs",
  "run the checks in CI", "block merges on failing tests" → SETUP.md + `CI_RULES.md`. Turns
  kit checks (E2E smoke, a11y, visual, contract, schema validation) into standing gates:
  **gate** tier on PRs (≤10 min, free) · **nightly** (full sweeps → bug candidates) ·
  **release** (owner-approved slice; load SMOKE only).
- **Client repo READ-ONLY:** pipelines are written to `<Project>/CI-Integration/proposed/` and
  handed to the owner to install — the agent never pushes a workflow file, never opens a PR in
  the app repo. Default topology = pipeline in the QA repo against staging (needs no write
  access; **cannot block merges** — say so explicitly).
- **The tool is not the gate.** `a11y-scan.mjs` / `visual-diff.mjs` are report producers: they
  exit 0 even with violations. `ci-run-result.mjs` derives the verdict and carries the exit
  code — **0 pass · 1 fail · 3 blocked · 2 usage**. Blocked (never green): crashed scan,
  missing golden, empty/all-skipped suite, unparseable or stale report, result that fails
  schema validation (it is deleted, not shipped).
- **Never fake a Pass, CI dialect:** no `continue-on-error` / `allow_failure: true` / `|| true`
  on a gate (including a schema gate's `git diff`), no baseline re-recorded in CI. Strict by
  default: every confirmed WCAG violation fails, every flake fails (flaky = broken). Relaxing
  (`--fail-on`, `--allow-flaky`) is an owner decision recorded in `GATES.md`, and the tolerated
  findings still ship in the evidence.
- **Required check = the aggregate `verdict` job, never an individual gate** (GitHub counts a
  SKIPPED job as passing). New gates start `soaking` (report, don't block); promotion to
  `REQUIRED_GATES` is the owner's call. GitLab's `script:` is fail-fast → capture exit codes
  explicitly or the emitters never run on a red suite.
- **Never in a pipeline:** load stress/peak, LLM-generation series, active/destructive scans,
  🔴-gated steps, production targets. The env allowlist fails closed.
- **Outputs:** every job emits a schema-valid `run-result` (`method: "ci"`) + `details.json`;
  red gates write bug CANDIDATES — the dedup → severity → owner-confirmation funnel is
  unchanged. CI cannot write into the workspace: `tools/fetch-run.sh <run-id>` pulls a run into
  `<Project>/CI-Integration/runs/<run-id>/`. Register `GATES.md` is the source of truth — no
  row, no job.

Full rules: `QA-SetupKit/Testing-Planning/CI-Integration/CI_RULES.md`.
