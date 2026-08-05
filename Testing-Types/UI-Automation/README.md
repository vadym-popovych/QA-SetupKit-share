# UI-Automation — locator artefacts, page objects, and maintained E2E suites

Shareable kit for the **"analyze a web app and automate it"** skill, in two layers:

1. **Foundation** — log into the app under test, walk its pages with Playwright, snapshot the
   real DOM, and distill it into **locator JSONs**, a human-readable `LOCATORS.md`, and
   ready-to-import **Playwright page objects**. Never a guessed selector.
2. **E2E suites** (added 12/07/2026) — the **maintained Playwright suite** built on that
   foundation: tagged specs (`@high` = the CI gate slice), a regression spec for **every fixed
   bug**, deterministic self-cleaning data, zero retries, and `lint-specs.mjs` to keep the
   suite from quietly decaying into decoration.

Scope: web applications (SPA or classic). Functional API testing lives in
[`API-Testing/`](../API-Testing/), performance in [`Load-Testing/`](../Load-Testing/), mobile
emulator runs in [`App-Emulators-configurations/`](../App-Emulators-configurations/). The suite
is *run* by the [`CI-Integration`](../../Testing-Planning/CI-Integration/) kit — that is where
gates, verdicts and blocking live.

## What you get

```
<Project>/UI-Automation/          # per-project output (see Project-Configuration kit)
├── LOCATORS.md                   # main reference: strategy, routes, shared elements, traps
├── locators/                     # machine-readable locator JSONs (common + per section)
├── page-objects/                 # Playwright TS page objects, import-ready
├── dom-snapshots/                # full HTML snapshots of every captured UI state
├── screenshots/                  # PNG of the same states (visual cross-check)
├── tools/                        # the capture scripts used (re-run when UI changes)
└── e2e/                          # the maintained suite
    ├── SUITES.md                 #   register: what each spec covers, traces to, and what is NOT automated
    ├── playwright.config.ts      #   retries: 0 · forbidOnly in CI · one worker = one pooled account
    ├── tests/{smoke,regression}/ #   @high gate slice · BUG-NNN regression specs
    ├── fixtures/                 #   API auth (once) + deterministic run-scoped data + teardown
    └── tools/lint-specs.mjs      #   mechanical guard: no locators in specs, no sleeps, no silent skips
```

## Files in this kit

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | Claude-followable setup: Playwright install → capture → analyze → author artefacts |
| [`UI_AUTOMATION_RULES.md`](UI_AUTOMATION_RULES.md) | Reusable rules: locator strategy, capture workflow, artefact structure, Creatio Freedom UI cheat-sheet |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Paste into YOUR workspace `CLAUDE.md` so your Claude follows the kit |
| [`template/`](template/) | Parameterized capture & analyze scripts + config example |
| [`template/e2e/`](template/e2e/) | The E2E suite layer: `playwright.config.ts`, API auth setup, deterministic data fixtures, example `@high` spec, the `BUG-NNN` regression-spec template, `SUITES.md` register, and [`lint-specs.mjs`](template/e2e/tools/lint-specs.mjs) |
| [`rubric/`](rubric/) | Machine-checkable verifier (R0–R4) for the **self-healing locators loop**: allowlist guard, live unique-resolution check, stability lint, traps-doc check, suite classification. Loop discipline: [`../../Claude-Extra-Skills-Features/Loop-Engineering/`](../../Claude-Extra-Skills-Features/Loop-Engineering/) |

## Quick start (teammate)

1. Get `QA-SetupKit/` into your workspace (see the [root README](../../README.md)).
2. Tell Claude: *"Проаналізуй сайт `<url>` і створи артефакти по локаторах для автотестів"*
   (login/password of the test stand in the same message).
3. Claude follows [`SETUP.md`](SETUP.md): installs Playwright in a scratch dir, captures the
   pages you name, and files artefacts under `<Project>/UI-Automation/`.

## Live example

`<Project>/UI-Automation/` on the author's machine — full artefact set for the
the CRM platform (Creatio Freedom UI) manufacturing polygon: 3 sections, add-forms,
record cards with tabs, production-order steps registries.
