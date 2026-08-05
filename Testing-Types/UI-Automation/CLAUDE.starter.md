# UI-Automation starter rules — paste into YOUR workspace CLAUDE.md

## UI locator artefacts for autotests — UI-Automation kit
- **Home for the "analyze a web app → produce locator artefacts" skill:**
  `QA-SetupKit/Testing-Types/UI-Automation/`. When the user asks to "проаналізувати сайт і створити
  артефакти по локаторах", "підготувати локатори для автотестів", "зняти DOM сторінок"
  or similar → follow `QA-SetupKit/Testing-Types/UI-Automation/SETUP.md` and
  `UI_AUTOMATION_RULES.md` exactly.
- **Never guess locators — capture the real DOM first** (Playwright headless in the
  session scratchpad), in phases, reading screenshots between phases. Extract an
  element inventory programmatically, then author three layers: `locators/*.json`,
  `LOCATORS.md` (with a Traps section), and Playwright `page-objects/*.ts`.
- **Locator stability order:** aria-label/role → data-* test markers → semantic
  component tags → text. Never auto-generated ids (`mat-input-N`, GUIDs) or
  framework classes (`_ngcontent-*`, `ng-tns-*`).
- **Artefacts land in `<Project>/UI-Automation/`** (per the Project-Configuration
  convention), including the capture scripts under `tools/`; nothing stays in scratch.
- **Test stands only, read-only by default:** don't save records during capture unless
  the user asks; API-login (e.g. Creatio `AuthService.svc/Login`) is the preferred
  auth for capture runs and for future test fixtures.
- For Creatio/the CRM platform apps use the Freedom UI cheat-sheet in
  `UI_AUTOMATION_RULES.md` (routes, login, fields-by-aria-label, detail registries).
- **E2E suites (the maintained layer):** template in
  `QA-SetupKit/Testing-Types/UI-Automation/template/e2e/` → `<Project>/UI-Automation/e2e/`.
  **No locators in specs** (page objects own selectors — the never-guess rule extended to the
  automated layer); **every fixed bug gets a `BUG-NNN-<slug>.spec.ts`** asserting the ORIGINAL
  repro, written when the bug is marked fixed; **retries: 0** — a flake is a defect in the
  suite (one round to fix, then `@quarantine` + a bug ON THE TEST + expiry in `SUITES.md`);
  an **empty run is not a passing run** (`forbidOnly`, tags required, zero-tests → blocked).
  Tags are the CI interface: `@high` slice = the PR gate (CI-Integration G-1), full suite =
  nightly. Data: deterministic, run-id-scoped, API-seeded, self-cleaning. Every spec traces to
  TC-NNN / BUG-NNN / INV-N and appears in `SUITES.md` (including what is deliberately NOT
  automated, and why). `node tools/lint-specs.mjs tests` enforces all of this mechanically —
  run it before calling a suite done.
- **Self-healing locators loop:** when locator drift needs iterative repair, use the
  verifier rubric in `QA-SetupKit/Testing-Types/UI-Automation/rubric/` (R0–R4) and follow the
  Loop-Engineering kit (`QA-SetupKit/Claude-Extra-Skills-Features/Loop-Engineering/`)
  for the loop-spec, 🟡 gate, and budgets. Config: `<Project>/UI-Automation/rubric.config.json`
  (gitignored). The fixer never grades its own result; assertion failures = `BUG-NNN`,
  never a loop fix.
