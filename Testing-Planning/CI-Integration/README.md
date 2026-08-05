# CI-Integration kit — QA gates that run without a human

Home for **continuous-integration gates**: the checks the kits already run locally (E2E
smoke, accessibility, visual regression, API contract, schema validity) executed
**automatically on every PR / merge / nightly**, with a verdict that can *block a merge* —
and reported back in kit formats (`run-result` JSON + evidence, bug-candidate funnel).

This closes the kit's biggest structural gap: until now **every** discipline ran only when a
human asked an agent to run it. A regression could land in `main` on a day nobody ran a
round. CI turns the kit's checks into **standing gates**.

It encodes the **"Stop / Escalate" judgment** from
[`../../Rules-Guide/Roadmap/AI-QA-ROADMAP.md`](../../Rules-Guide/Roadmap/AI-QA-ROADMAP.md)
(tracker #16) — a red gate *is* the stop condition, and it fires without anyone in the room.

> **⚠️ The client repo stays READ-ONLY.** Pipelines are **proposed as artefacts** for the
> owner to install. The agent never pushes a workflow file, never opens a PR, and never
> commits into the app's repository. See [`CI_RULES.md`](CI_RULES.md).

> **The prime directive still holds: never fake a Pass.** In CI that means a gate that could
> not run — or whose result cannot be trusted — is **blocked**, never green: an empty suite,
> a crashed scan, a missing golden, a stale report, an unvalidatable result. No
> `continue-on-error`, no `|| true` on a gate, no baseline quietly re-recorded to make a diff
> disappear.

## What actually gates (read this before writing any YAML)

The kit tools (`a11y-scan.mjs`, `visual-diff.mjs`) are **report producers**: they exit 0 even
when they find violations, because triage was always a human's job. A pipeline that "just runs
the tool" therefore **gates on nothing**.

[`ci-run-result.mjs`](template/tools/ci-run-result.mjs) is the gate. It reads the tool's
report, derives the verdict, writes a schema-valid `run-result` (`method: "ci"`) plus a
`details.json` of the evidence, and carries the exit code:

| Exit | Verdict | When |
|---|---|---|
| `0` | **pass** | the oracle says the app is good |
| `1` | **fail** | real findings: failed tests, WCAG violations, visual diffs |
| `3` | **blocked** | the gate could not run or cannot be trusted: crashed scan, missing golden, empty/all-skipped suite, unparseable or STALE report, result that fails schema validation |
| `2` | usage error | the pipeline invoked it wrong |

**Blocked is never green.** That is the whole point of the file.

## Two topologies — pick before you write any YAML

| | **A · QA-repo pipeline** (default) | **B · Client-repo pipeline** (owner installs) |
|---|---|---|
| Where the workflow lives | your QA repo / workspace repo | the app's repo (`.github/workflows/`) |
| What it tests | a deployed staging URL | the PR's own build |
| Can it block a merge? | **No** — it reports and files candidates | **Yes** — required check on the PR |
| Client repo touched? | never | only by the OWNER, installing the proposed file |
| Kit tools available? | they're right there | via a second checkout of the QA repo (`QA_REPO_TOKEN`) |

Start at **A** — it needs nobody's permission and proves the gates are stable. Promote
individual gates to **B** once they've been green-and-meaningful for a few rounds (a flaky
gate installed as a required check destroys trust in QA faster than no gate at all).

## Gate tiers — what runs when

| Trigger | Tier | What fires | Blocking? | Budget |
|---|---|---|---|---|
| PR opened / updated | **gate** | E2E smoke (@high slice) · a11y scan · visual regression · API contract · `validate.mjs` on QA artefacts in the diff | only the gates listed in `REQUIRED_GATES` (start with none) | free, ≤10 min |
| Merge to `main` / nightly | **nightly** | full regression selection · full a11y sweep · full visual suite | no — produces bug candidates | moderate |
| Release candidate / manual dispatch | **release** | the automatable slice of the RC playbook · load **smoke** | no — feeds the RC gate, which stays 🔴 owner | owner-approved |

**Never in CI, at any tier:** load stress/peak runs, active or destructive security scans,
LLM-generation series, anything a playbook marks 🔴, and anything pointed at production. The
target host is checked against an allowlist that **fails closed**.

**Required check = the `verdict` job, never an individual gate.** GitHub counts a SKIPPED job
as a passing required check, so requiring `a11y` directly would let a red `preflight` (→ a11y
skipped) merge green. `verdict` runs `if: always()`, re-derives every gate's result, and fails
only on `preflight` + the gates the owner promoted into `REQUIRED_GATES` — so `soaking` gates
report loudly without blocking.

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | Claude-followable: detect provider → pick topology → propose the pipeline → prove it → hand it over |
| [`CI_RULES.md`](CI_RULES.md) | The rules (READ-ONLY, blocking policy, strict-by-default, flakes, secrets, cost, reporting) |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Paste block for a teammate's workspace `CLAUDE.md` |
| [`template/GATES.md`](template/GATES.md) | Per-project gate register — what each gate really covers, tier, status, owner |
| [`template/github-actions/qa-gates.yml`](template/github-actions/qa-gates.yml) | PR-gate workflow (GitHub Actions) |
| [`template/github-actions/qa-nightly.yml`](template/github-actions/qa-nightly.yml) | Nightly / release workflow (GitHub Actions) |
| [`template/gitlab-ci/qa-gates.gitlab-ci.yml`](template/gitlab-ci/qa-gates.gitlab-ci.yml) | Equivalent for GitLab CI (fail-fast `script:` handled explicitly) |
| [`template/tools/ci-run-result.mjs`](template/tools/ci-run-result.mjs) | The verdict emitter — the thing that actually gates |
| [`template/tools/fetch-run.sh`](template/tools/fetch-run.sh) | Pull a finished run's artefacts into `<Project>/CI-Integration/runs/<run-id>/` for triage |

## Deliverables & where they live

```
<Project>/CI-Integration/
├── GATES.md                 # the gate register (source of truth for what gates exist)
├── proposed/                # pipeline files awaiting the OWNER's install — never pushed by the agent
│   └── qa-gates.yml
├── tools/                   # ci-run-result.mjs + fetch-run.sh
└── runs/<run-id>/           # pulled from CI by fetch-run.sh: run-result.json, details.json, candidates.md
```

**The pipeline cannot write into your workspace** — it runs on an ephemeral runner and uploads
to the provider's artefact store. `runs/<run-id>/` gets populated when you (or the agent) pull
a run down with [`fetch-run.sh`](template/tools/fetch-run.sh). Any doc that implies CI files
artefacts into the repo by itself is lying about how CI works.

Gate failures do **not** auto-file bugs. CI writes `candidates.md` + `details.json`; the bug
funnel (dedup → severity branch → owner confirmation) stays exactly as
[`Bug-Reports`](../../QA-Documentation/Bug-Reports/BUG_REPORTS_RULES.md) defines it.

## How it composes with the other kits

CI-Integration **runs** other kits — it never re-implements them. A gate job is a thin wrapper
around a kit's existing tool plus the three things CI adds: a **trigger**, a **blocking
verdict**, and a **machine-readable result**. If a gate needs behaviour a kit doesn't have,
extend THE KIT, then call it from the pipeline.

| Kit | What CI adds |
|---|---|
| [`QA-Agent-Playbooks`](../QA-Agent-Playbooks/) | fires the *mechanical* steps of the new-build playbook on a webhook. A CI run is **not** a playbook run and **not** a round — it has no plan file; it feeds one |
| [`Regression-Testing`](../../Testing-Types/Regression-Testing/) | the selection runs per PR instead of per round; a flake fails the gate (flaky = broken) |
| [`Accessibility`](../../Testing-Types/Accessibility-Testing/) · [`Visual-Regression`](../../Testing-Types/Visual-Regression-Testing/) | objective oracles → ideal blocking gates; no golden = blocked, never pass |
| [`Reporting-and-Metrics`](../Reporting-and-Metrics/) | the `run-result` files are the raw material for gate pass-rate / time-to-green. Those metrics are **not computed yet** — `qa-metrics.mjs` doesn't read CI results; wiring it is queued work, not a shipped feature |
| [`Rules-Guide/schemas`](../../Rules-Guide/schemas/) | every gate emits a validated `run-result` (`method: "ci"`) — and a result that fails validation is deleted, not shipped |
