# CI-Integration rules (paste into your workspace CLAUDE.md)

Rules for QA gates that run unattended. Machine-specific paths do NOT belong here.
Mirror new rules of this kind here (+ into `CLAUDE.starter.md` and the workspace
`CLAUDE.md`) so they travel with the kit.

- **The client repo is READ-ONLY — pipelines are PROPOSED, never pushed.** The agent
  writes the workflow file into `<Project>/CI-Integration/proposed/`, shows it, and gives
  install instructions. It never commits, pushes, branches, or opens a PR in the app's
  repository — no exception for "it's just a YAML file". Installing is the owner's action
  (🟡 gate: show → wait → owner installs). Topology A (pipeline in the QA repo, testing a
  deployed staging URL) is the DEFAULT precisely because it needs no write access at all —
  and it cannot block a merge, which you say out loud rather than implying protection.

- **Never fake a Pass — the CI dialect.** A gate that could not run, or whose result cannot
  be trusted, is **blocked**, not green:
  - no `continue-on-error` / `allow_failure: true` on a gate, no `|| true` on a gate command
    (that includes the diff command of a schema gate — a `git diff` that fails must go RED,
    not report "no artefacts changed");
  - **an empty run is not a passing run**: zero tests executed, an all-skipped suite, a
    report with no `stats` → blocked;
  - **no oracle → not a pass**: a missing golden, a crashed scan, an unparseable or STALE
    report (left over from a previous commit) → blocked;
  - **an unvalidatable artefact is a failed job**: if the emitter cannot find or pass
    `validate.mjs`, it exits blocked rather than shipping an unchecked run-result;
  - baselines are never re-recorded in CI (no `--update-snapshots`): a visual diff is fixed
    by fixing the app or by an owner-approved re-baseline logged in
    [`BASELINES.md`](../../Testing-Types/Visual-Regression-Testing/VISUAL_REGRESSION_RULES.md).
  Exit-code contract of `ci-run-result.mjs`: **0 pass · 1 fail · 3 blocked · 2 bad usage**.

- **Know which mechanism actually gates.** The kit tools (`a11y-scan.mjs`, `visual-diff.mjs`)
  are report PRODUCERS: they exit 0 even when they find violations (they only fail on harness
  crashes), because triage was always a human's job. A pipeline that "just runs the tool"
  therefore gates on nothing. `ci-run-result.mjs` is the gate: it reads the report, derives
  the verdict, emits a schema-valid `run-result` (`method: "ci"`) and carries the exit code.
  On GitHub, a **SKIPPED job counts as a passing required check** — so the required check is
  the aggregate `verdict` job, never an individual gate. On GitLab, a job's `script:` list is
  fail-fast — so multi-step jobs capture exit codes explicitly instead of listing commands.

- **Strict by default; every relaxation is an owner decision, written down.** The emitter
  fails on *every* confirmed WCAG violation and on *any* flake (REGRESSION_RULES: a flaky
  test is broken — fix it this round or quarantine it and file a bug ON THE TEST). Narrowing
  that (`--fail-on critical,serious`, `--allow-flaky`) is allowed, but it goes in
  `GATES.md` with a reason, and the tolerated findings still appear in the evidence and the
  candidates — "pass" must never come to mean "there were findings we agreed to ignore".

- **A gate is only a gate if it's stable.** Every new gate starts `soaking` (runs, reports,
  does not block) and is promoted to `required` only after it has been meaningful and
  non-flaky across several rounds. A flaky required gate teaches the team to click "merge
  anyway" — after which the real red goes through too.

- **CI runs only what is safe to run a hundred times.** Never in a pipeline: load stress/peak
  runs, LLM-generation series, active/destructive security scans, anything a playbook marks
  🔴, and anything aimed at production. The target host is checked against an allowlist that
  **fails closed** — an unrecognised host is refused, not gated against by accident. Gate tier
  ≤10 min and free; heavier tiers (nightly, release) are explicit and budgeted.

- **Every CI run emits a machine-readable result, and the evidence with it.** Each gate writes
  a `run-result` JSON (validated before it is uploaded) plus a `details.json` of the actual
  findings. CI output lives on the runner and in the provider's artefact store; it becomes a
  kit artefact when it is pulled into `<Project>/CI-Integration/runs/<run-id>/` (see the
  kit's `fetch-run.sh`) — the pipeline cannot write there itself, and no doc should imply it can.

- **CI proposes bugs, it does not file them.** A red gate writes bug CANDIDATES
  (`candidates.md`); the dedup → severity-branch → owner-confirmation funnel from
  [`BUG_REPORTS_RULES`](../../QA-Documentation/Bug-Reports/BUG_REPORTS_RULES.md) is unchanged.
  No pipeline ever posts to the team's tracker unattended.

- **Secrets live in the CI secret store, never in the YAML.** Reference them as
  `${{ secrets.X }}` / masked CI variables; the proposed file ships with a **required secrets**
  list for the owner to populate. An agent that needs a secret to make a gate green asks the
  owner — it never inlines one, and it never disables the gate to avoid needing it.

- **The gate register is the source of truth.** `<Project>/CI-Integration/GATES.md` lists every
  gate: discipline, the kit tool it wraps, tier, status, owner, **and what the gate really
  covers** (the tools scan the page list configured inside them — there is no "changed pages
  only" mode unless the project builds one; claiming otherwise is how "green" stops meaning
  anything). A gate that isn't in the register doesn't exist; a job with no register row is a
  finding.
