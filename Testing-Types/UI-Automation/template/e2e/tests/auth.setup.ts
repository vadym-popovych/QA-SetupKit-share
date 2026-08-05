// auth.setup.ts — log in ONCE via the app's auth API and save the storage state.
// Copy to <Project>/UI-Automation/e2e/tests/ and adapt the login call.
//
// Why the API and not the login form: the form is a FEATURE under test, covered by exactly
// one dedicated spec (tests/smoke/login.spec.ts). Re-walking it before every other spec makes
// every suite failure look like a login failure and hides the real one.
//
// Credentials come from the environment (Test-Data account pool — a dedicated CI user, never
// a human's account, never committed). No credential ever appears in a spec.

import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';

const AUTH_FILE = '.auth/user.json';

setup('authenticate', async ({ request, context }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  // A missing credential is a BLOCKED run, not a skipped one: a suite that silently doesn't
  // run is the purest form of a faked Pass.
  expect(email, 'TEST_USER_EMAIL is not set — the suite cannot run').toBeTruthy();
  expect(password, 'TEST_USER_PASSWORD is not set — the suite cannot run').toBeTruthy();

  // TODO per project. Creatio/Freedom UI example (see the cheat-sheet in UI_AUTOMATION_RULES):
  //   const res = await request.post('/ServiceModel/AuthService.svc/Login', {
  //     data: { UserName: email, UserPassword: password },
  //   });
  //   expect(res.ok()).toBeTruthy();
  //   expect((await res.json()).Code, 'auth API rejected the credentials').toBe(0);
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.ok(), `auth API returned ${res.status()}`).toBeTruthy();

  fs.mkdirSync('.auth', { recursive: true });
  await context.storageState({ path: AUTH_FILE });

  // Prove the state is actually usable — an empty storageState would let every downstream
  // spec fail with a misleading "element not found" instead of "we were never logged in".
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  expect(
    state.cookies.length + state.origins.length,
    'storage state is empty — the login call did not set cookies/tokens',
  ).toBeGreaterThan(0);
});
