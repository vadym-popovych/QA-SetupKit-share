# CI-Integration — SETUP (Claude-followable)

How to give a project **standing QA gates**. Prerequisite: at least one discipline already
runs reliably by hand (a Playwright suite, an a11y scan, a visual baseline set). CI does not
make a shaky check trustworthy — it only makes it *automatic*, a hundred times.

## 0 · Auto-detection (run this first)

| Check | How | If missing |
|---|---|---|
| CI provider | `.github/workflows/` or `.gitlab-ci.yml` in the app repo; else ask | No CI at all → topology A in the QA repo, or the scheduled fallback below |
| Write access to the app repo | **assume NO** (client repos are read-only) | this is the normal case, and it decides the topology |
| A gate-able check exists | a green local run of an a11y scan / visual suite / E2E smoke / contract test | nothing green locally yet → build that discipline first; never scaffold a pipeline around a check nobody has ever run |
| Node deps for the tools | a `package.json` with `playwright` + `axe-core` — usually in `<Project>/` | there is no lockfile → `npm ci` in CI will fail; create it before proposing the pipeline |
| Staging URL | `<Project>/CLAUDE.md`, project `config.json` | ask; never point a gate at production |
| Tools read `BASE_URL` from env | `grep BASE_URL <Project>/*/tools/*.mjs` | a tool with a hardcoded URL makes the pipeline's env guard theatre — fix the tool first (the kit templates read `process.env.BASE_URL`) |

Report what you found in one line, then pick the topology (README table) and say which one and
why — including, for topology A, the sentence *"this cannot block merges"*.

## 1 · Register the gates BEFORE writing YAML

Copy [`template/GATES.md`](template/GATES.md) → `<Project>/CI-Integration/GATES.md` and fill
one row per gate: discipline · what it wraps · tier · owner · **what it really covers**.
Be honest in that last column: the kit tools scan the page list configured *inside them* —
there is no "changed pages only" mode unless the project builds one.

Every gate starts `soaking` and `REQUIRED_GATES` starts empty. Show the register to the owner
(🟡) — this is the cheap moment to argue about what should eventually block a merge.

## 2 · Scaffold the pipeline as a PROPOSAL

1. Copy the matching template into **`<Project>/CI-Integration/proposed/`**
   ([`github-actions/qa-gates.yml`](template/github-actions/qa-gates.yml) ·
   [`github-actions/qa-nightly.yml`](template/github-actions/qa-nightly.yml) ·
   [`gitlab-ci/qa-gates.gitlab-ci.yml`](template/gitlab-ci/qa-gates.gitlab-ci.yml)).
2. Set `KIT_DIR` / `QA_DIR` / `NODE_DIR` for the chosen topology (the templates ship with
   placeholders and will not run until you do — deliberately: there is no correct default).
3. Delete every job whose gate has no row in `GATES.md` — **and delete it from `verdict.needs`
   and `REQUIRED_GATES`**, or the workflow won't load.
4. Fill the **Required secrets** block. Never inline a value.
5. Copy [`template/tools/ci-run-result.mjs`](template/tools/ci-run-result.mjs) and
   [`template/tools/fetch-run.sh`](template/tools/fetch-run.sh) → `<Project>/CI-Integration/tools/`.

**Never** write into the app repo's `.github/` yourself — not even on a branch. The file stays
in `proposed/` until the owner installs it.

## 3 · Prove it locally, then hand it over

Run each gate's command chain exactly as the pipeline would (same commands, same env, staging
target) and confirm **both directions**:

- green when the app is good, **and**
- **red when you break it on purpose** — a gate that cannot fail is not a gate. Try it: point
  the scan at a page with a known violation, delete a golden (expect `blocked`, not `pass`),
  `--grep` a tag that matches nothing (expect `blocked` — an empty suite is not a passing one).

Then give the owner:

- the file + where it goes (`.github/workflows/qa-gates.yml`),
- the secrets to add and where,
- **which check to mark required: `verdict`, and only `verdict`** (a skipped job counts as a
  passing required check on GitHub — requiring the gates directly is how a red preflight
  merges green),
- the expected runtime and cost.

That handover is the 🟡 gate. Stop there and wait.

## 4 · After it's live

- Pull a run down for triage: `./tools/fetch-run.sh <run-id>` → `runs/<run-id>/`
  (`run-result.json`, `details.json`, `candidates.md`). The pipeline cannot write into your
  workspace; this is the step that makes those paths real.
- Red gate → triage the candidates through the normal bug funnel (dedup → severity branch →
  owner OK). CI never files a bug on its own.
- **Blocked ≠ fail.** A blocked gate means the harness or the environment is broken — fix that
  first; it is not (yet) a bug in the app, and it must never be "fixed" by relaxing the gate.
- Flaky gate → one round to fix, then quarantine + a bug on the test
  ([`REGRESSION_RULES`](../../Testing-Types/Regression-Testing/REGRESSION_RULES.md)). Never
  paper over it with retries.
- Promotion: when a gate has been stable and useful, the owner adds it to `REQUIRED_GATES` and
  records the decision in `GATES.md`.

## Topology A without any CI provider

If the team has no CI (or you have no access to it), the same gates still run — on a schedule,
from the QA workspace, via the Cron-Session / launchd path in
[`Claude-Extra-Skills-Features`](../../Claude-Extra-Skills-Features/README.md). Same tiers,
same `run-result` emission, same funnel; the only thing you lose is the ability to block a
merge. Say that explicitly to the owner rather than implying merges are protected.
