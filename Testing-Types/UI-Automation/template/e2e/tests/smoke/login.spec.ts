// Example @high spec — the shape every spec in this kit follows.
// Copy to <Project>/UI-Automation/e2e/tests/smoke/ and adapt.
//
// TRACEABILITY HEADER (required — the RTM reads it; see TRACEABILITY_RULES):
//   TC-012  UI login with valid credentials
//   INV-3   a valid login always lands on the dashboard shell
//
// Tags: @high is the CI gate slice (CI-Integration kit runs `--grep @high` on every PR).
// Priority comes from the case's risk score (TEST_CASES_RULES: 9–8 → P0 … ≤3 → P3) —
// it is not a vibe.
//
// THE RULE THAT KEEPS THIS SUITE ALIVE: **no locators in specs.** Selectors live in page
// objects (which are generated from the captured DOM — never guessed). A spec that reaches
// for `page.locator('.mat-input-3')` is a defect even when it passes: the next UI redeploy
// breaks it silently and nobody knows which page it belonged to. `lint-specs.mjs` enforces
// this mechanically.

import { test, expect } from '@playwright/test';
import { LoginPage } from '../../page-objects/LoginPage';
import { DashboardPage } from '../../page-objects/DashboardPage';

test.describe('Login', () => {
  // This is the ONE spec that walks the UI login form (everything else authenticates via the
  // API in auth.setup.ts) — the form is a feature, so it gets exactly one real test.
  test.use({ storageState: { cookies: [], origins: [] } });   // start logged OUT

  test('valid credentials land on the dashboard @high @smoke', async ({ page }) => {
    const login = new LoginPage(page);
    const dashboard = new DashboardPage(page);

    await login.goto();
    await login.signIn(process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!);

    // Assert a CONCRETE post-condition, not "no exception was thrown". An assertion that
    // cannot fail is not an oracle — and a spec with no oracle is a faked Pass with extra steps.
    await expect(dashboard.shell).toBeVisible();
    await expect(page).toHaveURL(dashboard.urlPattern);
  });

  test('invalid credentials show an error and stay on the login page @medium', async ({ page }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.signIn('nobody@example.com', 'wrong-password');

    await expect(login.errorMessage).toBeVisible();
    await expect(login.errorMessage).toContainText(login.copy.invalidCredentials);
    await expect(page).toHaveURL(login.urlPattern);   // no partial navigation
  });
});
