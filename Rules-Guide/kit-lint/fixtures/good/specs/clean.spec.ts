// TC-001 · INV-1 — behaviour asserted through a page object, no locators in the spec
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../page-objects/LoginPage';
test('valid login lands on the dashboard @high @smoke', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.signIn(process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!);
  await expect(login.dashboardShell).toBeVisible();
});
