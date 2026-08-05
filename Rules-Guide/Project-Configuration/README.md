# Project-Configuration — how a project folder is structured

Convention for organizing **per-project QA artefacts** in the workspace. `QA-SetupKit/`
holds the shareable, project-agnostic kits (templates, rules, setup docs); everything
produced **for a specific project** lives in that project's own parent folder at the
workspace root, with **one subfolder per testing type, mirroring the QA-SetupKit kits**.

## The structure

```
<workspace>/
├── QA-SetupKit/               # shareable kits — templates & rules, NO project data
└── <Name>-project/             # ONE parent folder per project (e.g. <Project>/); the `<Project>/` shorthand in rules = this folder
    ├── CLAUDE.md               # project memory: env URLs, doc/board IDs, pools, invariant baselines (see PROJECT_CLAUDE.starter.md)
    ├── <Project>-repository/   # pulled project repo clone — READ-ONLY (several repos → <Project>-<role>-repository/)
    ├── QA-Documentation/       # generated checklist/test-case scripts, doc exports, bug-summary/ (the roll-up record), test-report/ (the narrative config)
    ├── Load-Testing/           # k6 harness + run results, reports, breaking-point notes
    ├── API-Testing/            # functional API test suites + run outputs
    ├── UI-Automation/          # locator JSONs, LOCATORS.md, page objects, DOM snapshots + e2e/ (maintained Playwright suite)
    ├── Emulator-Testing/       # Maestro flows, run configs, screenshots, evaluation reports
    ├── Web-Testing/            # browser rounds: design/animations/responsive/cross-browser (Playwright)
    ├── Web-Performance/        # PageSpeed rounds: pages.json + rounds/<round-id>.json (scores + Core Web Vitals; the Sheet is the live doc)
    ├── Security-Testing/       # security checks + findings (when the project gets them)
    ├── Test-Data/              # account pools, seeds, fixtures (when the project gets them)
    ├── Test-Strategy/          # STRATEGY.md + strategy.json + plans/ (per-round test plans)
    ├── Test-Oracles/           # ORACLES.md, invariants.md, rubrics/, golden/ baselines
    └── config.json             # optional: project config (Figma file/node-ids, sheet IDs, …)
```

Subfolder names mirror the QA-SetupKit kit that produces their contents:

| QA-SetupKit kit | Project subfolder | What accumulates there |
|---|---|---|
| [`QA-Documentation/`](../../QA-Documentation/) | `<Project>/QA-Documentation/` | generator scripts (`generate_via_api.mjs` + `.gs`), doc exports; the live docs stay in Google Sheets |
| [`Load-Testing/`](../../Testing-Types/Load-Testing/) | `<Project>/Load-Testing/` | filled-in k6 harness, run summaries, threshold reports, breaking-point analysis |
| [`API-Testing/`](../../Testing-Types/API-Testing/) | `<Project>/API-Testing/` | test suites, run outputs, contract snapshots |
| [`UI-Automation/`](../../Testing-Types/UI-Automation/) | `<Project>/UI-Automation/` | locator JSONs, `LOCATORS.md`, Playwright page objects, DOM snapshots/screenshots, capture tools + **`e2e/`** (the maintained suite: `playwright.config.ts`, `tests/{smoke,regression}/`, fixtures, `SUITES.md` register, `tools/lint-specs.mjs`) |
| [`App-Emulators-configurations/`](../../Testing-Types/App-Emulators-configurations/) | `<Project>/Emulator-Testing/` | Maestro flows, build/run configs, screenshots, evaluation reports |
| [`Web-Testing/`](../../Testing-Types/Web-Testing/) | `<Project>/Web-Testing/` | `config.json` (baseUrl + saved Figma node-ids), `tools/capture.mjs`, `runs/<date>-<slug>/` (shots, capture-results.json, annotated evidence, REPORT.md) |
| [`Security-Testing/`](../../Testing-Types/Security-Testing/) | `<Project>/Security-Testing/` | ZAP scan reports, IDOR/auth/rate-limit abuse checks, headers probe, triaged findings |
| [`Test-Data/`](../../Testing-Planning/Test-Data/) | `<Project>/Test-Data/` | account pools (`users.json` gitignored), Faker generators, seed/teardown scripts, boundary fixtures, `DATA.md` |
| [`Test-Strategy-and-Planning/`](../../Testing-Planning/Test-Strategy-and-Planning/) | `<Project>/Test-Strategy/` | `STRATEGY.md` (risk matrix, entry/exit/stop criteria) + `strategy.json` (machine-readable mirror) + `plans/<date>-<build>.md` per round |
| [`Traceability/`](../../Testing-Planning/Traceability/) | `<Project>/Test-Strategy/` (co-located — planning-layer views, no separate folder) | `RTM.md` (requirement → case → run → bug matrix) + `coverage.json` (machine snapshot, gaps = escalation list) |
| [`QA-Agent-Playbooks/`](../../Testing-Planning/QA-Agent-Playbooks/) | `<Project>/Test-Strategy/plans/` (a playbook run IS a round — its record is the plan file) + optional `<Project>/Test-Strategy/playbooks/` for project-specific variants | executed playbook checklists inside plan files; adapted playbook variants |
| [`Accessibility-Testing/`](../../Testing-Types/Accessibility-Testing/) | `<Project>/Accessibility-Testing/` | axe scan JSONs (`scans/`), filled WCAG 2.2 AA checklists per round, keyboard/focus pass notes, `tools/a11y-scan.mjs` |
| [`Visual-Regression-Testing/`](../../Testing-Types/Visual-Regression-Testing/) | `<Project>/Visual-Regression/` | `golden/` baselines + `BASELINES.md` approval log, per-run `current/`+`diff/` (gitignored), `report.json`, `tools/visual-diff.mjs` |
| [`Reporting-and-Metrics/`](../../Testing-Planning/Reporting-and-Metrics/) | `<Project>/QA-Reports/` | `metrics-<round>.json`, `cycle-<release>.md` summaries, `tools/qa-metrics.mjs`; the `QA Trends` tab lives in the project's QA Sheet |
| [`Exploratory-Testing/`](../../Testing-Types/Exploratory-Testing/) | `<Project>/Exploratory/` | `sessions/<date>-<charter-slug>.md` (append-only session logs with charters + debriefs) |
| [`Regression-Testing/`](../../Testing-Types/Regression-Testing/) | `<Project>/Test-Strategy/plans/` (regression is a SELECTION recorded in plan files — no separate folder) | per-round regression selection tables (`regression` marker rows) |
| [`Localization-Testing/`](../../Testing-Types/Localization-Testing/) | `<Project>/Localization-Testing/` | locale matrix, per-locale sweep screenshots (`sweeps/<locale>/`), terminology glossary |
| [`Compatibility-Testing/`](../../Testing-Types/Compatibility-Testing/) | `<Project>/Compatibility-Testing/` | `MATRIX.md` (usage-weighted, owner-signed) + per-cell run notes |
| [`Test-Oracles/`](../../Testing-Planning/Test-Oracles/) | `<Project>/Test-Oracles/` | `ORACLES.md` (per-area oracle assignments), `invariants.md`, `rubrics/` (calibrated LLM-judge rubrics), `golden/` (baselines) |
| [`Custom-Reports/HTML-Reports/`](../../QA-Documentation/Custom-Reports/HTML-Reports/) | (no project subfolder — published HTML lives in the shared reports repo, outside any project; the per-project artefact is just `tools/publish-report.sh` as a **symlink** to the kit copy) | the returned link, recorded in the producing round's report |
| [`Custom-Reports/PageSpeed-report/`](../../QA-Documentation/Custom-Reports/PageSpeed-report/) | `<Project>/Web-Performance/` | `pages.json` (the page list: id, name, URL, platforms), `rounds/<round-id>.json` (one file per round — env, tool version, every individual run, the median that went into the cell; schema-validated), `tools/` as **symlinks** to the kit's `psi-run.mjs` + `psi-sheet.mjs` (pointer, not fork — rule 9 below); the live doc stays in Google Sheets |
| [`Custom-Reports/Bug-Summary/`](../../QA-Documentation/Custom-Reports/Bug-Summary/) | `<Project>/QA-Documentation/bug-summary/` | `bug-summary.json` (the record: sites → pages → issues, the engagement's `severityScale`, a required status per row; schema-validated), `tools/` as **symlinks** to the kit's `bs-sheet.mjs` + `bs-from-bugs.mjs` + `bs-import-sheet.mjs` (pointer, not fork — rule 9 below); the live doc stays in Google Sheets (a **Bug summary** tab + a DERIVED **Left issues** tab) |
| [`Custom-Reports/Test-Report/`](../../QA-Documentation/Custom-Reports/Test-Report/) | `<Project>/QA-Documentation/test-report/` | `report-config.json` (the NARRATIVE half only — scope, environment, performed testing types; schema-validated; the results tables are derived at build time from `../bug-summary/bug-summary.json`, never stored twice), `tools/` as a **symlink** to the kit's `tr-doc.mjs` (pointer, not fork — rule 9 below); the live doc stays in Google Docs (`<Drive root>/<Project>/QA Documentation/Test Reports/`) |
| [`CI-Integration/`](../../Testing-Planning/CI-Integration/) | `<Project>/CI-Integration/` | `GATES.md` (gate register), `proposed/` (pipeline files awaiting the OWNER's install — never pushed by the agent), `tools/ci-run-result.mjs`, `runs/<run-id>/` (run-result.json, reports, bug candidates) |
| [`Loop-Engineering/`](../../Claude-Extra-Skills-Features/Loop-Engineering/) | `<Project>/<Testing-Type>/loops/<run-id>/` (a loop lives inside the discipline it repairs — never its own top-level folder) | `loop-spec.md`, per-iteration audit trail, verifier rubric output |
| (no kit yet — folder still applies) | any new testing type follows the same pattern | |

## The rules

1. **One parent folder per project** at the workspace root, named **`<Name>-project`**
   (`<Project>/`, `<Project>-project/`, …) — the `-project` suffix visually marks
   the QA parent folder; throughout the kits the `<Project>/` shorthand means this
   folder. Never scatter `<Project>-LoadTest/`-style folders at the root — the testing
   type is a SUBFOLDER, not a suffix.
2. **One subfolder per testing type**, created lazily — only when that type of work
   actually starts for the project. Don't pre-create empty folders.
3. **EVERY artefact goes into its type folder — including future ones.** Anything created
   in the course of the project's development and ongoing testing (run results, reports,
   logs, screenshots, generated scripts, analysis notes, exported data) is filed under
   the `<Project>/<Testing-Type>/` it belongs to at the moment it's created — never at
   the project root, never at the workspace root, never in a scratch location that
   outlives the session. If an artefact spans types (e.g. a combined test report), put it
   at `<Project>/` root only as a deliberate exception.
4. **New testing type for a project** → new subfolder under `<Project>/`, scaffolded from
   the matching QA-SetupKit kit if one exists. If no kit exists yet, the artefacts still
   go under `<Project>/<Type-Name>/` (and a kit can be extracted later).
5. **Kits stay clean:** nothing project-specific (URLs, payloads, user pools, results,
   screenshots) is ever committed into `QA-SetupKit/` — kits hold templates and rules
   only. The filled-in copies live under `<Project>/`.
6. **Secrets:** per-project secrets (test users, tokens) follow the same rule as the kits
   — gitignored, never shared; ship an `*.example.*` alongside instead (see
   `users.example.json` in the Load-Testing template).
7. **Pulled project repos — `<Project>/<Name>-repository/`:** when the project's
   repository (app under test, client code) is cloned, it goes INSIDE the project folder
   under a name ending in `-repository` (several repos → `<Name>-<role>-repository/`,
   e.g. `-backend-repository`; live: `<Project>/<Project>-repository/`). The suffix marks it as a
   repo CLONE, not a QA-artefact folder — never file QA artefacts inside it. Whether you may COMMIT
   into it depends on the REPO, not on the suffix: a repo you contribute to normally follows the
   team flow (branch + merge request — DOCTRINE §4); the app under test / code you did not write is
   read-only. Until the owner names a repo as client code, treat it as a team repo. No repo clones
   at the workspace root.
8. **Project memory — `<Project>/CLAUDE.md`:** each project carries its own agent memory
   file with project-specific facts (staging URLs, doc/board IDs, Figma node-ids, account
   pools, invariant baselines, bug state, assignees). Scaffold it from
   [`PROJECT_CLAUDE.starter.md`](PROJECT_CLAUDE.starter.md). Claude Code auto-loads it
   when working with files inside the project folder, so these facts must NOT be
   duplicated into the workspace CLAUDE.md (which keeps only cross-project and
   machine-specific rules). If the project folder wraps a read-only client repo, the file
   stays in your own QA folder — never committed into the client's repository.
   The file lives in your own QA folder `<Project>/` at the workspace root — **never inside the
   `<Name>-repository/` clone**. This holds whether the clone is read-only client code or an ordinary
   team repo you commit to: the agent-memory file is workspace configuration, not project source, and
   a team repo is not a licence to move it.

9. **Kit tools in a project: pointer, not fork.** The kit copy of a tool is **canonical**.
   - A tool with **no project config** (a pure library or a generic script) → the project's copy is
     a **symlink** to the kit copy. Drift then cannot happen, because there is only one file.
     Live: `annotate.py`, `collage.py`, `lib-report-tab.mjs`, `tc.mjs` in `<Project>/`.
   - A tool the project **configures** (board id, sheet id, project name) → the kit copy takes its
     config from the **environment**, so the project still runs the kit's code. Where a filled
     legacy copy is still in daily use, it stays until its env config is recorded in
     `<Project>/CLAUDE.md` — migrating a tool that files real bugs is not something to do silently.
   - **A fix to a kit tool is upstreamed, never forked.** Two byte-identical files in two places
     are not a backup; they are a future contradiction with nobody to arbitrate it.

   ⚠️ **A tool that may be pointed at must anchor to the working directory, not to its own file.**
   `import.meta.url` / `__file__` resolves through a symlink into the KIT — so a tool that anchors
   to itself will look for the project's data inside the kit. (Found the instant the first pointer
   was made: `tc.mjs` went hunting for <Project>'s cases in `QA-SetupKit/`.)

10. **A shared link survives every update — for EVERY carrier.** The owner shares a link
    once; rebuilding the artifact must land under that same link, whatever it is:
    a Sheets tab → fixed `gid` (recreate under the same sheetId, never a fresh tab) ·
    a Google Doc → update the same-titled document IN PLACE (reference: Test-Report's
    `tr-doc.mjs`; `write-run-doc.mjs` follows) · published HTML → the same repo path, same
    URL · a Drive-hosted file (screenshot, evidence, PDF) → `files.update` with new media
    on the SAME fileId, never upload-new-and-trash-old. Trash-and-recreate looks identical
    in the UI and silently kills every link anyone saved — the worst kind of break, because
    nothing tells you it happened. If a carrier genuinely cannot keep the link, say so
    out loud in the hand-over message.
    **Since 05/08/2026 this is checkable, not just remembered:**
    [`Rules-Guide/link-ledger/`](../link-ledger/) records each carrier's id (+ tab gid) by
    purpose in `<Project>/.link-ledger.json`, and a build that would land somewhere else is
    REFUSED before it writes (`LINK_LEDGER_ADOPT=1` for a deliberate, recorded move). Wire it
    into every tool that rebuilds a carrier — a rule this invisible belongs in a script.

## Live example

`<Project>/` on the author's machine:

```
<Project>/
└── Load-Testing/       # k6 smoke/load/stress harness for the <Project> API
    ├── config.js  lib/  scenarios/  run.sh  seed-users.mjs
    └── users.json (gitignored) + users.example.json
```

## For Claude

When starting ANY testing work for a project — or producing ANY artefact during it:
0. Read `<Project>/CLAUDE.md` if it exists and isn't in context yet; if the project is
   new, scaffold it from [`PROJECT_CLAUDE.starter.md`](PROJECT_CLAUDE.starter.md). New
   project facts discovered during work are recorded THERE, not in the workspace file.
1. Check whether `<workspace>/<Project>/` exists; create if not.
2. Determine the testing type → use the matching subfolder from the mapping table above
   (create it lazily on first use, scaffolding from the kit template when one exists).
3. File every output of the session (results, reports, screenshots, scripts) into that
   subfolder as you produce it. The project folder must stay readable as "one folder per
   type of testing" at all times.
