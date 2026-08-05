# QA-SetupKit — shared QA toolkit

This folder is the **unit of sharing**: a teammate gets the whole `QA-SetupKit/`,
adds it to their IDE, and their Claude sets up the module they need. Every module is
self-documented — start from the doc listed for your direction.

## Quick start — one command in the terminal

The repo is **private** — ask the owner to add you as a collaborator first
(GitHub → Settings → Collaborators), then run from your workspace root:

```bash
git clone https://github.com/vadym-popovych/QA-SetupKit.git
```

Or, if you use the GitHub CLI (`brew install gh`, then `gh auth login`):

```bash
gh repo clone vadym-popovych/QA-SetupKit
```

> ⚠️ **What a collaborator receives:** a clone brings the FULL git history, and this repo's
> pre-cleanup history (before the anonymity rule of 14/07/2026) still holds client-identifying
> data — kit-lint L10 guards `HEAD`, not the past. Becoming a collaborator means being trusted
> with that history, like any team member. Anyone who only needs to READ the kit gets the
> link-share mirror instead (`QA-SetupKit-share` — a fresh-history snapshot of `HEAD` only);
> never hand this repo out as a read link.

Then open the workspace in your IDE with Claude Code and tell it:
*"Set me up for &lt;checklists / emulator runs / load testing / API testing&gt;
using QA-SetupKit"* — it will follow the right SETUP doc from the table below.
To update later, just `git pull` inside `QA-SetupKit/`.

## The kit ships — so it names nobody

**Nothing in this kit may identify a real client, person, tracker, document or host.** Not the docs, not the
tools, and above all **not the examples** — an example is the easiest place to leave somebody's data behind,
because it looks like data *about the format* rather than *somebody's data*.

It happened: a shipped example file held **309 of a client's real bugs**, his staging URLs and 325 evidence
links. It was committed and pushed. The kit had nine checks and not one of them asked whether it was giving
away a client's data — so the only thing between that and a teammate's clone was the owner happening to open
the file.

**Now [`kit-lint`](Rules-Guide/kit-lint/) L10 enforces it**, on every new document, forever:

- a **data** file that ships (an example, a template config) may not point at a real host — use
  `example.com` / `*.invalid`;
- **nothing** anywhere may name a client, a person, a real tracker or a real document id. "A real name"
  cannot be detected generically, so the owner lists his own clients **once**, in
  [`Rules-Guide/kit-lint/no-client-data.json`](Rules-Guide/kit-lint/no-client-data.json). **Add a client the
  day you start working with them — not the day you leak them.**

**And no functionality is lost by this — that is the point.** Teaching material keeps its whole value without
the names: **the SHAPE of an example is what calibrates a judgement, never the product's nouns.** *"A paid
item is not unlocked after the payment goes through → Critical, because money"* teaches exactly as much as the
version with the client's feature names, and costs nobody their data. Tools take their real values from
**env vars**, so a clone with placeholders in the docs still runs — on the teammate's board, against the
teammate's project.


## Pick your direction

> **Paste this first, whatever else you take:** [`Rules-Guide/DOCTRINE.md`](Rules-Guide/DOCTRINE.md)
> — the five always-on rules (never fake a Pass · name the oracle · blocked ≠ green · client repos
> read-only · escalate don't decide). Every kit below is a *dialect* of these; a teammate who
> adopts one kit still needs the core. It is ~2k chars — small enough to always keep on.

| Direction | Module | Start here | Paste into your `CLAUDE.md` |
|-----------|--------|------------|------------------------------|
| 🟢 **QA documentation** (checklists from Figma · technique-derived test cases · bug-report standard — one subfolder per document type) | [`QA-Documentation/`](QA-Documentation/) | [README](QA-Documentation/README.md) → [Checklist/README](QA-Documentation/Checklist/README.md) → [MCP_SETUP.md](QA-Documentation/Checklist/MCP_SETUP.md) | [`CLAUDE.starter.md`](QA-Documentation/Checklist/CLAUDE.starter.md) (+ [CHECKLIST_RULES.md](QA-Documentation/Checklist/CHECKLIST_RULES.md)) |
| 🟢 **HTML report publishing** (discipline-agnostic: any self-contained QA HTML — load report, visual gallery, a11y summary — → shareable browser link; project name never in the URL) | [`Custom-Reports/HTML-Reports/`](QA-Documentation/Custom-Reports/HTML-Reports/) | [README](QA-Documentation/Custom-Reports/HTML-Reports/README.md) → [SETUP.md](QA-Documentation/Custom-Reports/HTML-Reports/SETUP.md) | [`CLAUDE.starter.md`](QA-Documentation/Custom-Reports/HTML-Reports/CLAUDE.starter.md) (+ [HTML_REPORTS_RULES.md](QA-Documentation/Custom-Reports/HTML-Reports/HTML_REPORTS_RULES.md)) |
| 🟡 **PageSpeed / web-performance report** (Lighthouse-via-PSI page-load scores + Core Web Vitals, collected by the kit itself and tracked round over round in one Google Sheet; median of ≥3 runs, empty ≠ 0, env is part of the number) | [`Custom-Reports/PageSpeed-report/`](QA-Documentation/Custom-Reports/PageSpeed-report/) | [README](QA-Documentation/Custom-Reports/PageSpeed-report/README.md) → [SETUP.md](QA-Documentation/Custom-Reports/PageSpeed-report/SETUP.md) | [`CLAUDE.starter.md`](QA-Documentation/Custom-Reports/PageSpeed-report/CLAUDE.starter.md) (+ [PAGESPEED_REPORT_RULES.md](QA-Documentation/Custom-Reports/PageSpeed-report/PAGESPEED_REPORT_RULES.md)) |
| 🟡 **Bug summary** (a retrospective roll-up of the bugs FOUND: how many, at what severity, per module — a report, not a tracker; every count is a formula, and a severity outside the scale is refused because no counter would count it) | [`Custom-Reports/Bug-Summary/`](QA-Documentation/Custom-Reports/Bug-Summary/) | [README](QA-Documentation/Custom-Reports/Bug-Summary/README.md) → [SETUP.md](QA-Documentation/Custom-Reports/Bug-Summary/SETUP.md) | [`CLAUDE.starter.md`](QA-Documentation/Custom-Reports/Bug-Summary/CLAUDE.starter.md) (+ [BUG_SUMMARY_RULES.md](QA-Documentation/Custom-Reports/Bug-Summary/BUG_SUMMARY_RULES.md)) |
| 🟡 **Test report** (the end-of-engagement narrative Google Doc a client receives: scope · environment · test design · severity-count tables per module — the tables are DERIVED from the Bug-Summary record at build time; narrative is testimony, numbers are computed, never typed) | [`Custom-Reports/Test-Report/`](QA-Documentation/Custom-Reports/Test-Report/) | [README](QA-Documentation/Custom-Reports/Test-Report/README.md) → [SETUP.md](QA-Documentation/Custom-Reports/Test-Report/SETUP.md) | [`CLAUDE.starter.md`](QA-Documentation/Custom-Reports/Test-Report/CLAUDE.starter.md) (+ [TEST_REPORT_RULES.md](QA-Documentation/Custom-Reports/Test-Report/TEST_REPORT_RULES.md)) |
| 🟢 **Emulator / simulator test runs** (build → Maestro-drive UI → auto-fill checklist) | [`App-Emulators-configurations/`](Testing-Types/App-Emulators-configurations/) | [SETUP.md](Testing-Types/App-Emulators-configurations/SETUP.md) | [`CLAUDE.starter.md`](Testing-Types/App-Emulators-configurations/CLAUDE.starter.md) (+ [EMULATOR_RULES.md](Testing-Types/App-Emulators-configurations/EMULATOR_RULES.md)) |
| 🟢 **Web / landing rounds** (Playwright browser sweep: design vs Figma + animations + responsiveness + cross-browser in one pass) | [`Web-Testing/`](Testing-Types/Web-Testing/) | [README](Testing-Types/Web-Testing/README.md) → [SETUP.md](Testing-Types/Web-Testing/SETUP.md) | [`CLAUDE.starter.md`](Testing-Types/Web-Testing/CLAUDE.starter.md) (+ [WEB_TESTING_RULES.md](Testing-Types/Web-Testing/WEB_TESTING_RULES.md)) |
| 🟢 **Load / stress testing** (k6, smoke → load → stress, Grafana dashboards) | [`Load-Testing/`](Testing-Types/Load-Testing/) | [SETUP.md](Testing-Types/Load-Testing/SETUP.md) | [`CLAUDE.starter.md`](Testing-Types/Load-Testing/CLAUDE.starter.md) (+ [LOAD_TESTING_RULES.md](Testing-Types/Load-Testing/LOAD_TESTING_RULES.md)) |
| 🟡 **Functional API testing** (CRUD, auth, validation, flows, contract — correctness, not throughput) | [`API-Testing/`](Testing-Types/API-Testing/) | [README](Testing-Types/API-Testing/README.md) → [POSTMAN_MCP_SETUP.md](Testing-Types/API-Testing/POSTMAN_MCP_SETUP.md) | [`CLAUDE.starter.md`](Testing-Types/API-Testing/CLAUDE.starter.md) (+ [API_TESTING_RULES.md](Testing-Types/API-Testing/API_TESTING_RULES.md)) |
| 🟢 **UI automation** (Playwright DOM capture → locator JSONs + `LOCATORS.md` + page objects → **maintained E2E suites**: `@high` gate slice, a regression spec per fixed bug, zero retries, spec lint) | [`UI-Automation/`](Testing-Types/UI-Automation/) | [README](Testing-Types/UI-Automation/README.md) → [SETUP.md](Testing-Types/UI-Automation/SETUP.md) | [`CLAUDE.starter.md`](Testing-Types/UI-Automation/CLAUDE.starter.md) (+ [UI_AUTOMATION_RULES.md](Testing-Types/UI-Automation/UI_AUTOMATION_RULES.md)) |
| 🟡 **Security testing** (grey-box QA: IDOR/auth/headers via Postman MCP · OWASP ZAP · Playwright) | [`Security-Testing/`](Testing-Types/Security-Testing/) | [README](Testing-Types/Security-Testing/README.md) → [SETUP.md](Testing-Types/Security-Testing/SETUP.md) | [`CLAUDE.starter.md`](Testing-Types/Security-Testing/CLAUDE.starter.md) (+ [SECURITY_TESTING_RULES.md](Testing-Types/Security-Testing/SECURITY_TESTING_RULES.md)) |
| 🟡 **Test data** (account pools, Faker-seeded data, seed/teardown, boundary fixtures) | [`Test-Data/`](Testing-Planning/Test-Data/) | [README](Testing-Planning/Test-Data/README.md) → [SETUP.md](Testing-Planning/Test-Data/SETUP.md) | [`CLAUDE.starter.md`](Testing-Planning/Test-Data/CLAUDE.starter.md) (+ [TEST_DATA_RULES.md](Testing-Planning/Test-Data/TEST_DATA_RULES.md)) |
| 🟡 **Test strategy & planning** (what to test, risk-based priorities, entry/exit & stop criteria — the agent's charter) | [`Test-Strategy-and-Planning/`](Testing-Planning/Test-Strategy-and-Planning/) | [README](Testing-Planning/Test-Strategy-and-Planning/README.md) → [SETUP.md](Testing-Planning/Test-Strategy-and-Planning/SETUP.md) | [`CLAUDE.starter.md`](Testing-Planning/Test-Strategy-and-Planning/CLAUDE.starter.md) (+ [TEST_STRATEGY_RULES.md](Testing-Planning/Test-Strategy-and-Planning/TEST_STRATEGY_RULES.md)) |
| 🟢 **Test oracles** (deciding pass/fail objectively: spec, golden-master, invariants, metamorphic, LLM-judge rubrics) | [`Test-Oracles/`](Testing-Planning/Test-Oracles/) | [README](Testing-Planning/Test-Oracles/README.md) → [SETUP.md](Testing-Planning/Test-Oracles/SETUP.md) | [`CLAUDE.starter.md`](Testing-Planning/Test-Oracles/CLAUDE.starter.md) (+ [TEST_ORACLES_RULES.md](Testing-Planning/Test-Oracles/TEST_ORACLES_RULES.md)) |
| 🟡 **Machine contracts** (JSON Schemas for test-case / bug / bug-spec / run-result / checklist-row / coverage / strategy / pagespeed-round / bug-summary / test-report / link-ledger + zero-dep validator — the full, current list lives in the [schemas README](Rules-Guide/schemas/README.md)) | [`Rules-Guide/schemas/`](Rules-Guide/schemas/) | [README](Rules-Guide/schemas/README.md) | [`CLAUDE.starter.md`](Rules-Guide/schemas/CLAUDE.starter.md) (+ [SCHEMAS_RULES.md](Rules-Guide/schemas/SCHEMAS_RULES.md)) |
| 🟡 **Traceability** (RTM: requirement → case → run → bug; coverage snapshots + gap escalation) | [`Traceability/`](Testing-Planning/Traceability/) | [README](Testing-Planning/Traceability/README.md) → [SETUP.md](Testing-Planning/Traceability/SETUP.md) | [`CLAUDE.starter.md`](Testing-Planning/Traceability/CLAUDE.starter.md) (+ [TRACEABILITY_RULES.md](Testing-Planning/Traceability/TRACEABILITY_RULES.md)) |
| 🟡 **QA orchestration playbooks** (trigger → which kits fire, in what order, with human gates: new-project / new-build / release-candidate) | [`QA-Agent-Playbooks/`](Testing-Planning/QA-Agent-Playbooks/) | [README](Testing-Planning/QA-Agent-Playbooks/README.md) → [SETUP.md](Testing-Planning/QA-Agent-Playbooks/SETUP.md) | [`CLAUDE.starter.md`](Testing-Planning/QA-Agent-Playbooks/CLAUDE.starter.md) (+ [PLAYBOOKS_RULES.md](Testing-Planning/QA-Agent-Playbooks/PLAYBOOKS_RULES.md)) |
| 🟡 **CI quality gates** (kit checks as PR/nightly gates: pipeline templates + verdict emitter; pipelines PROPOSED, never pushed into a client repo) | [`CI-Integration/`](Testing-Planning/CI-Integration/) | [README](Testing-Planning/CI-Integration/README.md) → [SETUP.md](Testing-Planning/CI-Integration/SETUP.md) | [`CLAUDE.starter.md`](Testing-Planning/CI-Integration/CLAUDE.starter.md) (+ [CI_RULES.md](Testing-Planning/CI-Integration/CI_RULES.md)) |
| 🟡 **Accessibility testing** (axe-core scans + keyboard/focus/semantics passes; WCAG 2.2 AA as the oracle) | [`Accessibility-Testing/`](Testing-Types/Accessibility-Testing/) | [README](Testing-Types/Accessibility-Testing/README.md) → [SETUP.md](Testing-Types/Accessibility-Testing/SETUP.md) | [`CLAUDE.starter.md`](Testing-Types/Accessibility-Testing/CLAUDE.starter.md) (+ [ACCESSIBILITY_TESTING_RULES.md](Testing-Types/Accessibility-Testing/ACCESSIBILITY_TESTING_RULES.md)) |
| 🟡 **Visual regression** (golden-master screenshots + pixelmatch diffs; baseline lifecycle discipline) | [`Visual-Regression-Testing/`](Testing-Types/Visual-Regression-Testing/) | [README](Testing-Types/Visual-Regression-Testing/README.md) → [SETUP.md](Testing-Types/Visual-Regression-Testing/SETUP.md) | [`CLAUDE.starter.md`](Testing-Types/Visual-Regression-Testing/CLAUDE.starter.md) (+ [VISUAL_REGRESSION_RULES.md](Testing-Types/Visual-Regression-Testing/VISUAL_REGRESSION_RULES.md)) |
| 🟡 **QA reporting & metrics** (computed-not-estimated metric set; round metrics block, Trends tab, release cycle summary) | [`Reporting-and-Metrics/`](Testing-Planning/Reporting-and-Metrics/) | [README](Testing-Planning/Reporting-and-Metrics/README.md) → [SETUP.md](Testing-Planning/Reporting-and-Metrics/SETUP.md) | [`CLAUDE.starter.md`](Testing-Planning/Reporting-and-Metrics/CLAUDE.starter.md) (+ [REPORTING_RULES.md](Testing-Planning/Reporting-and-Metrics/REPORTING_RULES.md)) |
| 🟡 **Exploratory testing** (SBTM: chartered time-boxed sessions, tour patterns, HICCUPPS oracles, feed-forward into cases/invariants) | [`Exploratory-Testing/`](Testing-Types/Exploratory-Testing/) | [README](Testing-Types/Exploratory-Testing/README.md) → [SETUP.md](Testing-Types/Exploratory-Testing/SETUP.md) | [`CLAUDE.starter.md`](Testing-Types/Exploratory-Testing/CLAUDE.starter.md) (+ [EXPLORATORY_RULES.md](Testing-Types/Exploratory-Testing/EXPLORATORY_RULES.md)) |
| 🟡 **Regression testing** (selection over existing artefacts: bug-derived core + impact slice; fix verification; suite hygiene) | [`Regression-Testing/`](Testing-Types/Regression-Testing/) | [README](Testing-Types/Regression-Testing/README.md) → [SETUP.md](Testing-Types/Regression-Testing/SETUP.md) | [`CLAUDE.starter.md`](Testing-Types/Regression-Testing/CLAUDE.starter.md) (+ [REGRESSION_RULES.md](Testing-Types/Regression-Testing/REGRESSION_RULES.md)) |
| 🟡 **Localization testing** (i18n sweeps: keys/truncation/CLDR formats/RTL + LLM-judged translation quality) | [`Localization-Testing/`](Testing-Types/Localization-Testing/) | [README](Testing-Types/Localization-Testing/README.md) → [SETUP.md](Testing-Types/Localization-Testing/SETUP.md) | [`CLAUDE.starter.md`](Testing-Types/Localization-Testing/CLAUDE.starter.md) (+ [LOCALIZATION_RULES.md](Testing-Types/Localization-Testing/LOCALIZATION_RULES.md)) |
| 🟡 **Compatibility testing** (usage-driven browser/OS/device matrix, tiers T1-T3/OUT, differential oracle across cells) | [`Compatibility-Testing/`](Testing-Types/Compatibility-Testing/) | [README](Testing-Types/Compatibility-Testing/README.md) → [SETUP.md](Testing-Types/Compatibility-Testing/SETUP.md) | [`CLAUDE.starter.md`](Testing-Types/Compatibility-Testing/CLAUDE.starter.md) (+ [COMPATIBILITY_RULES.md](Testing-Types/Compatibility-Testing/COMPATIBILITY_RULES.md)) |
| 🟡 **QA glossary** (controlled vocabulary: every load-bearing term, its owner kit, schema home) | [`Rules-Guide/glossary/`](Rules-Guide/glossary/) | [README](Rules-Guide/glossary/README.md) → [GLOSSARY.md](Rules-Guide/glossary/GLOSSARY.md) | [`CLAUDE.starter.md`](Rules-Guide/glossary/CLAUDE.starter.md) |
| 🟡 **Integrations** (infrastructure used by all modules) | [`MCP-configurations/`](MCP-configurations/) | [README](MCP-configurations/README.md) — MCP servers: google-sheets · figma · postman · grafana; plus the non-MCP API integrations sharing the folder: mega · cloudflare · redmine · pagespeed | — |
| 🟡 **Claude extra skills & features** (harness add-ons: session token-limit monitoring hook · Cron-Session auto-pause/resume · **loop engineering** — repair/observation loops with maker-checker verifier · **context budget** — audit and reversibly prune the always-on cost of installed skills · **remote control** — every IDE chat reachable from the phone · **memory-eval** — a hop-scenario retrieval net that gates automated CLAUDE.md rewrites · **knowledge distillation** — compressing an oversized memory file without triage) | [`Claude-Extra-Skills-Features/`](Claude-Extra-Skills-Features/) | [README](Claude-Extra-Skills-Features/README.md) → [Usage/SETUP.md](Claude-Extra-Skills-Features/Usage/SETUP.md) · [Loop-Engineering/SETUP.md](Claude-Extra-Skills-Features/Loop-Engineering/SETUP.md) · [Context-Budget/SETUP.md](Claude-Extra-Skills-Features/Context-Budget/SETUP.md) · [Remote-Control/SETUP.md](Claude-Extra-Skills-Features/Remote-Control/SETUP.md) | [`Usage/CLAUDE.starter.md`](Claude-Extra-Skills-Features/Usage/CLAUDE.starter.md) · [`Loop-Engineering/CLAUDE.starter.md`](Claude-Extra-Skills-Features/Loop-Engineering/CLAUDE.starter.md) (+ [LOOP_RULES.md](Claude-Extra-Skills-Features/Loop-Engineering/LOOP_RULES.md)) |
| 🟢 **Kit self-test** (`kit-lint.mjs`: broken links · docs pointing at tools that don't ship · author-machine paths · missing RULES/starters · unregistered kits) | [`Rules-Guide/kit-lint/`](Rules-Guide/kit-lint/) | [README](Rules-Guide/kit-lint/README.md) | — (run `node Rules-Guide/kit-lint/kit-lint.mjs`) |
| 🟡 **Project folder structure** (how per-project artefacts are organized: `<Project>/<Testing-Type>/`) | [`Project-Configuration/`](Rules-Guide/Project-Configuration/) | [README](Rules-Guide/Project-Configuration/README.md) | [`CLAUDE.starter.md`](Rules-Guide/Project-Configuration/CLAUDE.starter.md) |

**Maturity is stated, not implied.** A reader cannot otherwise tell a kit that has survived
real projects from one written last week — and a kit you over-trust is worse than one you
don't trust at all.

| Badge | Means | How a kit earns it |
|---|---|---|
| 🟢 **battle-tested** | driven end-to-end on a real project; its rules were *revised from field failures* | evidence named below — a project folder with real artefacts, not an intention |
| 🟡 **stable** | complete and reviewed (rules + templates + registrations), but **not yet field-run** — expect small gaps on first use, and fix them in the kit | passed its build + review cycle |
| 🔴 **draft** | scaffold; do not trust it blindly | — |

**Battle-tested evidence — what each 🟢 was actually driven through.** The badge and this evidence
are single-sourced in [`modules.json`](Rules-Guide/kit-lint/modules.json) (`maturity`), which is what
`kit-lint` L11 checks every badge in every index against; battle-tested with no evidence is refused.

- **Checklist** — two client engagements, 2026: mobile and web checklists, several rounds each,
  generated from Figma into Sheets.
- **App-Emulators** — two mobile apps driven on iOS + Android simulators against real builds; its
  rules were rewritten from field failures (a Maestro crash that read as a false PASS).
- **Web-Testing** — a landing round across the kit's 9 viewport widths that produced BUG-008.
- **Load-Testing** — a k6 harness across many runs, smoke through stress, against a live LLM-backed
  API; the account-pool and cost rules come out of those runs.
- **UI-Automation** — a CRM locator set captured from a real test stand (the E2E-suite layer on top
  is itself 🟡).
- **HTML-Reports** — the publisher behind real load-run reports handed to a team, host and
  private-by-default links set up end to end.
- **Test-Oracles** — project invariants plus calibrated LLM-judge rubrics, used to decide real
  verdicts.
- **kit-lint** — 66 real violations on its first run against this kit; five checkers now proven to
  red on bad input, and L3 was caught neutered by exactly that proof.

*(No client is named here on purpose — the kit ships. What makes this evidence rather than a claim
is the scale and the kind of engagement, never the customer's nouns.)*

Everything else is 🟡: written, reviewed, and honest about never having been fired in anger.
**CI-Integration in particular has never run inside a live pipeline** — it was verified against
the tools' real report shapes and its own exit-code contracts, which is not the same thing.
**PageSpeed-report is 🟡 for a concrete reason** — a narrower one than before: with an API key in
place, the **collector is now proven live** (a 3-run round against a real URL came back through the
PSI v5 payload and wrote a schema-valid round file, Lighthouse 13.4.0). What is still unverified is
the other half: **`psi-sheet.mjs` has never written to a real Google document** (fixtures and
`--dry-run` only), and the `--engine lighthouse` local fallback is untested. 🟢 needs a real project
round end-to-end; this is not one. Reported, not assumed.

**Folder layout (since 12/07/2026):** kits are grouped by role — the 12 testing
disciplines under [`Testing-Types/`](Testing-Types/) ([index](Testing-Types/README.md)),
the 7 planning/process kits under [`Testing-Planning/`](Testing-Planning/)
([index](Testing-Planning/README.md)), and the reference/convention layer under
[`Rules-Guide/`](Rules-Guide/) ([index](Rules-Guide/README.md): `schemas`, `glossary`,
`Roadmap`, `Project-Configuration`, `kit-lint`, `link-ledger` — no `_`-prefixes anymore). At the kit root stay:
`QA-Documentation/` (itself a group of document types), `MCP-configurations/`
(runtime paths in `.mcp.json` — never move/rename), and
`Claude-Extra-Skills-Features/` (renamed from the `_`-prefixed name).
**Grouping rule:** new artefacts land in the matching group folder; something new that
fits no group and is likely to grow subtypes gets its own new group folder (with a
README index) — never loose folders scattered at the root.
**Nested group (13/07/2026):** the report-shaped document types now live together under
[`QA-Documentation/Custom-Reports/`](QA-Documentation/Custom-Reports/) ([index](QA-Documentation/Custom-Reports/README.md))
— `HTML-Reports` (moved there) and `PageSpeed-report`. A nested group must be declared in
[`Rules-Guide/kit-lint/modules.json`](Rules-Guide/kit-lint/modules.json) (as a `group` **and** as
a discovery root), or its kits go unchecked while the lint still prints "clean".

Common conventions across all modules: bugs are filed as **`BUG-NNN`** rows in the
team's QA Google Sheet; test only staging/dev; secrets never in git.

**Where this is heading:** [`Rules-Guide/Roadmap/AI-QA-ROADMAP.md`](Rules-Guide/Roadmap/AI-QA-ROADMAP.md) —
the plan for turning the kit from *AI-operated tools* into an *AI QA engineer*
(planning, oracles, traceability, orchestration modules), with the agreed build order.

## Deliberately out of scope

Silence is not coverage. These are QA concerns the kit **does not** address today — named so a
teammate never mistakes "the kit has no folder for X" for "X is covered". Each is a real gap, not
an oversight; several are candidates for future kits.

| Not covered | Note |
|---|---|
| **API contract testing** (schema/breaking-change detection against the spec) | the most visible gap: the Postman MCP is already connected, so the API-Testing kit *could* diff responses against the collection/OpenAPI and catch drift — it currently checks correctness and IDOR, not contract conformance. Queued. |
| **Penetration testing** | Security-Testing is grey-box QA (IDOR / auth / headers / passive & owner-approved ZAP). It is not a pentest and does not replace one. |
| **Performance profiling / APM** | Two kinds of performance ARE covered, so read this narrowly: Load-Testing finds the breaking point and thresholds under traffic, and PageSpeed-report measures **page-load (lab) performance** — Lighthouse score + Core Web Vitals per page, tracked round over round. What stays out is **profiling the app's internals**: flame graphs, DB query plans, memory leaks, span-level APM traces. A slow LCP tells you the page is slow; nothing in the kit tells you which function made it slow. |
| **Chaos / resilience / failover** | no fault injection, network-partition, or dependency-outage testing. |
| **Data-migration / upgrade testing** | schema migrations, install-over-upgrade, backfill correctness are not covered (the Emulator kit's lifecycle coverage is also thin — see the roadmap). |
| **Usability / user research** | the kit tests against oracles (spec, design, invariants), not against real-user comprehension or task success. |
| **Production monitoring** | staging/dev only, by rule. Synthetic monitoring and real-user monitoring are out — the CI-Integration nightly is the closest, and it targets staging. |

If your project needs one of these, say so explicitly in its `Test-Strategy/STRATEGY.md` scope-out
list with the reason — the same "record the skip" discipline the kit applies everywhere.

## ⚠️ For the person SHARING this folder

Git-based sharing is safe — all secrets are gitignored. If you zip / AirDrop / copy
manually, **strip these first**:

- every `MCP-configurations/*/` credential — `mcp-sheets/credentials.json` + `token.json`
  (Google OAuth), and the per-service token files: `grafana/.token`, `redmine/.token`,
  `pagespeed/.token`, `cloudflare/.token` + `basic-auth.txt`, `mega/` credentials
- `Claude-Extra-Skills-Features/Usage/usage-scraper/profile/` — a **LIVE browser session**
  (cookies), not a rotatable token: the worst thing in this folder to hand over
- any `node_modules/` (heavy, regenerated by `npm install`)

**The list to trust is the one your backup script enumerates**, not this paragraph: add a new
integration's secret there in the same commit that adds the integration, and this list stays a
convenience copy rather than the source of truth.

Each teammate creates their own credentials by following the module setup docs —
tokens are always per-user and never travel.

## For the teammate RECEIVING this folder

1. Put `QA-SetupKit/` somewhere stable in your workspace (e.g. `~/Projects/QA-SetupKit/`) —
   easiest via the **Quick start** clone command above.
2. Open the workspace in your IDE with Claude Code.
3. Paste the relevant `CLAUDE.starter.md` block(s) into your workspace `CLAUDE.md`.
4. Ask Claude for what you need ("create a checklist from my Figma selection", "load
   test my API", …) — it will auto-detect missing prerequisites and walk you through
   the module's SETUP doc.
