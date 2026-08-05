# UI-Automation kit — setup (Claude-followable)

Follow this top-to-bottom when a user asks to *"analyze site X and create locator
artefacts for autotests"*. Read [`UI_AUTOMATION_RULES.md`](UI_AUTOMATION_RULES.md) first —
it defines the workflow and locator strategy; this file is the mechanical setup.

## 0. What you need from the user

- Base URL of the test stand + the page URLs / sections to cover
- Test credentials (test stands only — never production)
- Project name → artefacts go to `<Project>/UI-Automation/` (see
  [`Project-Configuration/README.md`](../../Rules-Guide/Project-Configuration/README.md))

## 1. Prerequisites (one-time per machine)

```bash
node -v    # need Node 18+; if missing: brew install node
```

Install Playwright **in the session scratchpad** (not in the project folder — keeps
`node_modules` out of artefacts):

```bash
cd <scratchpad> && npm init -y && npm i playwright --no-audit && npx playwright install chromium
```

~100 MB Chromium download on first run; cached under `~/Library/Caches/ms-playwright/` after.

## 2. Scaffold

```bash
mkdir -p <workspace>/<Project>/UI-Automation/{locators,dom-snapshots,screenshots,page-objects,tools}
cp QA-SetupKit/Testing-Types/UI-Automation/template/config.example.json <scratchpad>/config.json
cp QA-SetupKit/Testing-Types/UI-Automation/template/capture.mjs QA-SetupKit/Testing-Types/UI-Automation/template/analyze.py <scratchpad>/
```

Edit `config.json`: `baseUrl`, `outDir` (absolute path to `<Project>/UI-Automation`),
`auth` (mode `creatio-api` / `form` / `none` + credentials), `pages` to capture.

## 3. Verify reachability & auth (before any browser run)

```bash
curl -sk -o /dev/null -w "%{http_code}" --max-time 60 "<baseUrl>"        # expect 200/302; retry once on timeout
# Creatio stands:
curl -sk -X POST "<baseUrl>/ServiceModel/AuthService.svc/Login" \
  -H "Content-Type: application/json" -d '{"UserName":"<u>","UserPassword":"<p>"}'   # expect "Code":0
```

## 4. Capture in phases

```bash
node capture.mjs config.json
```

The template captures the pages listed in config. Then work in phases per the RULES:
**look at the screenshots**, inventory the DOM, and extend the capture (clicks into
add-forms, record cards, tabs, dialogs) with selectors you SAW in the snapshots —
not selectors you assume. Re-run; delete wrong-page snapshots.

## 5. Analyze & author

```bash
python3 analyze.py <outDir>/dom-snapshots <outDir>/locators/_inventory_raw.json
```

From the inventory author, by hand (this is the thinking part — see RULES §5):

1. `locators/common.json` + `locators/<section>.json` per section
2. `LOCATORS.md` — strategy, routes, shared elements, **traps found**
3. `page-objects/*.ts` — Login + base List/Form + per-section POs
4. `README.md` of the artefact folder — contents map + how it was captured
5. Copy the final capture scripts into `<Project>/UI-Automation/tools/`

## 6. Done-check

- [ ] Every snapshot has a matching screenshot; wrong-page captures deleted
- [ ] No auto-generated ids / `_ngcontent-*` classes anywhere in `locators/` or POs
- [ ] Traps section filled in `LOCATORS.md` (create-button captions, row-link traps, …)
- [ ] Credentials appear only in artefact docs if the user shared them for the test stand;
      never real/production secrets (gitignore rules of the workspace apply)
- [ ] Everything lives under `<Project>/UI-Automation/`, scratchpad holds nothing needed

## 7. From artefacts to a maintained E2E suite (the second layer)

Locators are the foundation; the suite is what actually catches regressions. Scaffold it from
[`template/e2e/`](template/e2e/) into `<Project>/UI-Automation/e2e/`:

1. `playwright.config.ts` (retries **0**, `forbidOnly` in CI, one worker per pooled account),
   `tests/auth.setup.ts` (log in ONCE via the auth API — the login FORM gets one dedicated spec),
   `fixtures/data.ts` (deterministic, run-id-scoped, API-seeded, self-cleaning).
2. Write specs against the **page objects** — never a locator in a spec. Tag every spec:
   `@high`/`@medium`/`@low` (priority from the case's risk score), `@smoke`, `@regression`, `@bug-NNN`.
   The `@high` slice is the PR gate (G-1 in the [`CI-Integration`](../../Testing-Planning/CI-Integration/) kit).
3. **Every fixed bug gets `tests/regression/BUG-NNN-<slug>.spec.ts`** — the original repro as
   the test, asserting the invariant the bug violated. Not a proxy, not "next sprint".
4. Fill [`SUITES.md`](template/e2e/SUITES.md): what each spec covers, what it traces to
   (TC-NNN / BUG-NNN / INV-N), quarantine debts with owners and expiry dates, and **what is
   deliberately NOT automated and why**.
5. Run `node tools/lint-specs.mjs tests` — it must be clean. It catches the things that make a
   suite lie: locators in specs, hard sleeps, conditional assertions, stray `.only`, anonymous
   skips, hardcoded credentials, specs with no traceability or no tag, and an empty suite.

### Done-check (suite)

- [ ] `lint-specs.mjs` clean, `@high` slice green locally against staging
- [ ] Every fixed bug in the project has a regression spec (or a SUITES.md row saying why not)
- [ ] Zero retries configured; any flake is fixed or quarantined WITH a bug on the test
- [ ] `SUITES.md` current — including the "deliberately NOT automated" table
