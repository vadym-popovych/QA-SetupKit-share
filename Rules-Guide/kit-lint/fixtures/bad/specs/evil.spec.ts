// TC-999 · INV-9 — traceability present so ONLY the forbidden patterns are what fail
import { test, expect } from '@playwright/test';
test('everything forbidden @high', async ({ page }) => {
  await page.getByRole('button', { name: 'Login' }).click();
  await page.fill('#password', 'Sup3rSecret!');
  await page.click('.submit-btn');
  await new Promise(r => setTimeout(r, 5000));
  const token = "hunter2hardcoded";
  await expect(page.getByText('Welcome')).toBeVisible();
});
