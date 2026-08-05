# UI-Automation rules — locator artefacts for web autotests

Rules Claude follows when asked to "analyze a site and create locator artefacts",
"підготуй локатори для автотестів", "зніми DOM сторінок" or similar.
Mirrored from the workspace `CLAUDE.md` of the kit author so they travel with the kit.

## Workflow: capture → analyze → author (never guess locators)
- **The capture pass is READ-ONLY.** Log in, navigate, read `page.content()`, screenshot — nothing
  else. Do not submit forms and do not create/update/delete records to "see the state": a capture that
  mutates the stand leaves debris nobody attributes to QA and can invalidate someone else's test data.
  States that only exist after a write belong to the E2E layer, which owns run-scoped, self-cleaning data.

1. **Reachability & auth first.** `curl` the base URL (SPAs can be slow — use 60s timeout;
   a first `000`/timeout is not "site down", retry). Find the login mechanism; for
   API-login endpoints verify credentials via `curl` before spending time on browser runs.
2. **Capture the real DOM with Playwright** (headless Chromium in the session scratchpad —
   `npm i playwright && npx playwright install chromium`). For every page/state the tester
   cares about: full `page.content()` → `dom-snapshots/NN-name.html` + screenshot →
   `screenshots/NN-name.png`. Number snapshots by stage: `00-` login, `10-` list pages,
   `20-` create forms, `30-` record cards, `35+` tabs, `40+` nested dialogs/inline states.
3. **Capture in phases, look at screenshots between phases.** Selectors that "should" work
   often don't (localized captions, hidden skip-links, same-looking links leading elsewhere).
   After each phase READ the screenshot and inventory the DOM (grep markers/aria-labels)
   before writing the next phase's clicks. Delete snapshots taken of the WRONG page
   (e.g. a link opened a different entity) — wrong artefacts are worse than none.
4. **Analyze programmatically.** Extract an inventory per snapshot (form fields with
   aria-label + kind, buttons with aria-label/title, tabs, grid columns, detail/registry
   markers) into `locators/_inventory_raw.json`. Author the curated artefacts from it.
5. **Author three artefact layers:**
   - `locators/*.json` — machine-readable: `common.json` (login, shell, list/form/dialog
     patterns) + one file per section with fields (`label`, `locator`, `kind`, `required`),
     tabs, detail registries, add-buttons, URL patterns;
   - `LOCATORS.md` — human reference: locator strategy table, routes, per-section
     differences, **traps** (see below), where tricky features live;
   - `page-objects/*.ts` — Playwright TS: Login + base List/Form pages + one PO per
     section, importable as-is. Waits for slow SPA rendering belong IN the page objects.
6. **File everything under `<Project>/UI-Automation/`** (per Project-Configuration kit),
   including the capture scripts (`tools/`) so the set can be re-captured when UI changes.
   Nothing stays in the scratchpad.

## Locator strategy (stability order)

1. **`aria-label` / role** — first choice when the framework mirrors field captions into
   aria-labels (Creatio, most Material-based UIs): `input[aria-label="Ціна"]`,
   `getByRole('button', { name: 'Оновити' })`.
2. **`data-*` test markers** — `data-item-marker`, `data-qa`, `data-testid` when present.
3. **Semantic component tags** — custom-element tags (`crt-grid`, …) as scoping containers.
4. **Text content** (`:has-text`) — acceptable for stable UI captions; remember the app's
   locale and keep captions in the locator JSONs, not hardcoded across tests.

**Never use:** auto-generated ids (`mat-input-N`, GUID ids), framework classes
(`_ngcontent-*`, `ng-tns-*`), absolute `nth-child` paths from document root.

## Documented traps — always check for these

- **Different create-button captions per section** (`Додати` / `Створити` / `Новий` …) — record
  each one; also record a universal fallback (e.g. `button.mat-primary` in the toolbar).
- **Multiple links per grid row** — an "author"/"owner" column link opens a DIFFERENT
  entity than the name column. Open records by the name-column link filtered by text.
- **Hidden a11y skip-links** — "first link on the page" is often an offscreen skip-link.
- **Menu caption ≠ URL entity code** — record both (e.g. nav "Виробниче замовлення" ↔
  URL `GenProductionTask`), and note near-identical sibling sections.
- **Modal vs full-page create** — the same "add" action may open a mini-page dialog in one
  section and a routed form page in another; record which and the dialog's save/cancel.

## Autotest recommendations to include in every artefact set

- Login via the app's **auth API** in fixtures/`beforeAll` (cookies into the browser
  context); cover the UI login form with exactly one dedicated test.
- After navigation wait for a concrete element (grid/field), not just `networkidle`.
- Test stands change locale → captions live in `locators/*.json`, tests import them.
- Note existing demo records usable for read-only checks; CRUD tests create their own
  data and clean up.

## Creatio Freedom UI cheat-sheet (apps on Terrasoft/Creatio 8.x, e.g. the CRM platform)

- Routes: list `/0/Shell/#Section/<Entity>_ListPage`, card
  `/0/Shell/#Card/<Entity>_FormPage/edit/<GUID>`, new `.../add`, mini-page modal
  `#Section/<...>_ListPage[modal=<Entity>_MiniPage/add]`.
- Login page `/Login/NuiLogin.aspx`: `#loginEdit-el`, `#passwordEdit-el`,
  `[data-item-marker="btnLogin"]`. API login: `POST /ServiceModel/AuthService.svc/Login`
  with `{"UserName":…,"UserPassword":…}` → `Code:0` = success, cookies set.
- Form fields carry `aria-label` = field caption; lookups are autocomplete inputs
  (`.crt-autocomplete-input`) — fill, then click `mat-option:has-text(...)`.
- Grid: `crt-grid`; name-column record links `crt-data-table-crt-link a`; column headers
  `[data-item-marker="<Caption> column"]`; sort `button[aria-label="Сортувати <Caption>"]`.
- Save on form pages: `button[aria-label="Зберегти все (Ctrl+S)"]`; in mini-page dialogs:
  `mat-dialog-container button:has-text("Зберегти")`.
- Detail registries on cards are uniquely identified by their
  `button[aria-label="Додати колонки до Реєстр <Name>"]` — scope to the enclosing
  `crt-grid` via `:has()` and click `[aria-label="Новий"]` (opens card) or
  `[aria-label="Додати новий запис"]` (inline row) inside it.
- Freedom UI renders slowly: allow 10–15s settle after `networkidle` on first loads.

## E2E suites — the maintained layer (added 12/07/2026)

Locator artefacts are the *foundation*; a **maintained Playwright suite** is what actually
catches regressions. Template: [`template/e2e/`](template/e2e/) (config, auth setup, fixtures,
example specs, `SUITES.md` register, `lint-specs.mjs`). Lives in `<Project>/UI-Automation/e2e/`.

- **Specs contain no locators.** Page objects own selectors, and page objects are generated
  from the CAPTURED DOM — so a selector typed into a spec was, by definition, guessed. This is
  the never-guess-locators rule extended to the automated layer, and `lint-specs.mjs` enforces
  it mechanically (along with hard sleeps, conditional assertions, stray `.only`, anonymous
  skips, hardcoded credentials, and specs with no traceability or no tag).

- **Every fixed bug gets an E2E regression spec** — written when the bug is marked FIXED, not
  "next sprint". The spec IS the original repro (BUG_REPORTS_RULES: re-verify with the original
  repro), asserting the invariant the bug violated — not a proxy that is easier to automate.
  Name it `BUG-NNN-<slug>.spec.ts`, tag it `@regression @bug-NNN` (+ `@high` if the bug was
  Critical/Major). If the repro genuinely can't be automated, say so in `SUITES.md` with the
  reason and name the manual case that covers it instead. This is the automated arm of the
  bug→regression-case rule in [`REGRESSION_RULES`](../Regression-Testing/REGRESSION_RULES.md).

- **Retries are zero. A flake is a defect IN THE SUITE.** Not weather, not "CI being slow".
  It gets one round to be fixed; then it is `@quarantine`d *with a bug filed on the test* and
  an owner + expiry in `SUITES.md`. Retries buy a green that means nothing — and a team that
  learns to shrug at red will shrug at the real red too.

- **An empty run is not a passing run.** A bad `--grep`, a stray `test.only`, an all-skipped
  suite, a spec that asserts nothing — each reports green while proving nothing. `forbidOnly`
  in CI, the lint's `stray-only` + `missing-priority-tag` rules, and the CI kit's emitter
  (which treats "zero tests executed" as **blocked**) exist to make that impossible.

- **Tags are the interface to CI.** `@high`/`@medium`/`@low` (priority derived from the case's risk score —
  TEST_CASES_RULES), `@smoke`, `@regression`, `@bug-NNN`, `@quarantine`. The `@high` slice is the
  PR gate (G-1 in the [`CI-Integration`](../../Testing-Planning/CI-Integration/) kit); the full
  suite is the nightly regression selection. An untagged spec runs nowhere.

- **Auth once via the API; the login FORM gets exactly one dedicated spec.** Re-walking the
  form before every test makes every failure look like a login failure. Credentials come from
  the Test-Data pool via env — one account per worker, never a literal in a spec.

- **Data is deterministic, run-scoped, and self-cleaning** ([`TEST_DATA_RULES`](../../Testing-Planning/Test-Data/TEST_DATA_RULES.md)):
  seeded (never `Math.random()`), prefixed with the run-id, seeded through the API (not the
  UI — seeding through the interface makes every test depend on screens it isn't testing), and
  torn down after. Leftovers become tomorrow's phantom failures.

- **Every spec traces** to a `TC-NNN`, `BUG-NNN`, or `INV-N` in its header comment, and appears
  in `SUITES.md` — including a row for what is deliberately NOT automated and why. The RTM
  reads this; without it, "we have E2E tests" is a claim nobody can check.

## Self-healing locators loop (rubric ships here)

When locators drift (UI redeploy breaks resolution), the repair may run as an
**engineered loop** — fixer subagent remaps within an allowlist, an outer-loop verifier
grades every iteration against the machine-checkable rubric in [`rubric/`](rubric/)
(R0 allowlist guard · R1 unique live resolution · R2 stability lint · R3 suite
classification · R4 Traps completeness). Follow the Loop-Engineering kit
([`../../Claude-Extra-Skills-Features/Loop-Engineering/`](../../Claude-Extra-Skills-Features/Loop-Engineering/))
for the loop-spec, gates, and budgets; config = `<Project>/UI-Automation/rubric.config.json`
(gitignored — real creds). Assertion failures are product bugs (`BUG-NNN`), never a
loop's target.

## Mirror rule

When a new reusable UI-automation rule emerges during project work, add it BOTH to the
workspace `CLAUDE.md` AND here (+ `CLAUDE.starter.md` if it changes agent behavior),
so it travels when `QA-SetupKit/` is shared.
