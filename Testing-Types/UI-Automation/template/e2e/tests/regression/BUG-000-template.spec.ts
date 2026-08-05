// BUG-NNN regression spec — the automated arm of "every fixed bug gets a regression case".
// Copy to <Project>/UI-Automation/e2e/tests/regression/BUG-<NNN>-<slug>.spec.ts.
//
// WHEN THIS FILE IS WRITTEN: at the moment a bug is marked FIXED — not "later". The bug's
// own repro is the test. If the repro can't be automated, say so in SUITES.md with the reason
// (a manual regression case in the Regression kit's selection covers it instead) — but the
// default answer is a spec, and "we'll add it next sprint" is how a suite decays into
// decoration.
//
// TRACEABILITY HEADER (required):
//   BUG-014  Saving an order with an empty "Quantity" silently drops the line
//   INV-7    an order line without a quantity can never be persisted
//   TC-041   (the regression case this spec implements)
//
// TAGS: @regression @bug-014 — plus @high if the bug was Critical/Major (it re-enters the CI
// gate slice; a Critical bug that regresses must never reach main again).
//
// THE ASSERTION IS THE ORIGINAL REPRO, NOT A PROXY. Re-verify what the bug actually did
// (BUG_REPORTS_RULES: fixed → re-verify with the original repro). Asserting something
// "nearby but easier to automate" produces a green suite that would sail straight through a
// re-occurrence of the real defect.

import { test, expect } from '@playwright/test';
import { OrdersPage } from '../../page-objects/OrdersPage';
import { OrderFormPage } from '../../page-objects/OrderFormPage';
import { seedOrder, cleanup } from '../../fixtures/data';

test.describe('BUG-014 · empty quantity silently drops the order line', () => {
  const runId = `ci-${process.env.RUN_ID ?? Date.now()}`;   // isolate this run's data (TEST_DATA_RULES)

  test.afterEach(async () => {
    await cleanup(runId);            // self-cleaning: leftovers become tomorrow's phantom failures
  });

  test('an order line with no quantity is rejected, not dropped @regression @bug-014 @high', async ({ page }) => {
    const order = await seedOrder(runId);                    // deterministic, run-scoped fixture
    const orders = new OrdersPage(page);
    const form = new OrderFormPage(page);

    await orders.goto();
    await orders.openByName(order.name);

    // ── the original repro, step for step ──
    await form.addLine({ product: order.product, quantity: '' });   // the bug: empty quantity
    await form.save();

    // ── what the fix must guarantee ──
    // 1. the app refuses the save (the visible, user-facing contract)…
    await expect(form.validationError, 'saving an empty quantity must be rejected').toBeVisible();
    // 2. …and nothing was silently written behind the UI (the invariant the bug violated —
    //    the original defect was that the UI looked fine while the line vanished on reload).
    await page.reload();
    await expect(form.lines).toHaveCount(order.expectedLineCount);
  });
});
