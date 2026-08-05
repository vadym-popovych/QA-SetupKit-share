// Playwright config for a MAINTAINED E2E suite (UI-Automation kit, E2E layer).
// Copy to <Project>/UI-Automation/e2e/playwright.config.ts and fill the marked lines.
//
// The two settings that carry the kit's ethos:
//
//   retries: 0        A flake is a DEFECT IN THE SUITE, not weather. Retries hide it, and a
//                     suite whose greens are "green on the third try" gates nothing. When a
//                     test flakes: fix it this round, or tag it @quarantine and file a bug ON
//                     THE TEST (REGRESSION_RULES). Never buy silence with a retry.
//
//   forbidOnly: true  in CI — a stray `test.only` would silently shrink the suite to one test
//                     and still report green. An empty/whittled run is not a passing run.

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'https://staging.example.com';  // TODO: staging only, never prod

// Fail loudly rather than run against the wrong environment. An unattended suite pointed at
// production is worse than no suite (CI_RULES: the target allowlist fails closed).
if (!/staging|stg|dev|test|qa|preview|localhost/.test(BASE_URL)) {
  throw new Error(`BASE_URL (${BASE_URL}) does not look like a test environment — refusing to run.`);
}

export default defineConfig({
  testDir: './tests',
  outputDir: './.artifacts',

  fullyParallel: true,
  // One worker = one account from the Test-Data pool (TEST_DATA_RULES: isolated actors).
  // Raising this without growing the pool makes tests fight over the same user's state —
  // which then reads as "flaky tests" and gets blamed on Playwright.
  workers: process.env.CI ? 2 : undefined,

  retries: 0,                       // see the note above — do not "just add one retry"
  forbidOnly: !!process.env.CI,
  timeout: 60_000,                  // Freedom-UI-class SPAs render slowly; per-action waits live in page objects
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [['json'], ['github']]        // stdout JSON is what ci-run-result.mjs scores (CI-Integration kit)
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',     // no retries ⇒ capture the evidence on the FIRST failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Auth once, reuse the storage state — the UI login form is covered by exactly one
    // dedicated test (UI_AUTOMATION_RULES), not re-walked before every spec.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
    },
    // Cross-browser is a COMPATIBILITY-kit decision (tiers T1–T3), not a default:
    // three browsers × every spec triples the gate's runtime for little signal.
    // { name: 'firefox', dependencies: ['setup'], use: { ...devices['Desktop Firefox'], storageState: '.auth/user.json' } },
  ],
});
