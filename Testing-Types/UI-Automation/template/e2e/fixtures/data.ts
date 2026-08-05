// data.ts — deterministic, isolated, self-cleaning test data (TEST_DATA_RULES).
// Copy to <Project>/UI-Automation/e2e/fixtures/ and implement against the app's API.
//
// Three properties, none optional:
//   deterministic  — a fixed seed, never Math.random(); the same run-id yields the same data,
//                    so a failure can be reproduced instead of admired.
//   isolated       — every entity is prefixed with the run-id, and one worker owns one account
//                    from the pool. Two runs must never fight over the same record.
//   self-cleaning  — teardown removes what the run created. Leftovers become tomorrow's
//                    phantom failures, and phantom failures are how a team learns to ignore red.
//
// Seed via the API, not the UI: seeding through the interface makes every test depend on the
// screens it isn't testing, so one broken form turns the whole suite red for the wrong reason.

import { APIRequestContext, request as pwRequest } from '@playwright/test';

const BASE_URL = process.env.BASE_URL!;

export interface SeededOrder {
  id: string;
  name: string;
  product: string;
  expectedLineCount: number;
}

// A tiny deterministic PRNG — same run-id ⇒ same values, every time, on every machine.
function seeded(runId: string) {
  let h = 2166136261;
  for (const c of runId) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h >>> 0) % 1000); };
}

async function api(): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: BASE_URL,
    storageState: '.auth/user.json',    // reuse the authenticated state; never re-login per fixture
  });
}

export async function seedOrder(runId: string): Promise<SeededOrder> {
  const next = seeded(runId);
  const ctx = await api();
  const name = `${runId}-order-${next()}`;          // run-scoped name = trivially greppable, trivially cleanable

  const res = await ctx.post('/api/orders', { data: { name, lines: [] } });
  if (!res.ok()) throw new Error(`seedOrder failed (${res.status()}): the test cannot run — this is BLOCKED, not a failed assertion`);

  const { id } = await res.json();
  await ctx.dispose();
  return { id, name, product: 'TEST-PRODUCT-1', expectedLineCount: 0 };
}

export async function cleanup(runId: string): Promise<void> {
  const ctx = await api();
  const res = await ctx.get(`/api/orders?nameStartsWith=${encodeURIComponent(runId)}`);
  if (!res.ok()) {
    // Teardown that silently fails is how a staging DB fills with a year of orphans. Say it out
    // loud; the run still reports its real verdict, but the leftovers get a name.
    console.warn(`cleanup: could not list ${runId} entities (${res.status()}) — leftovers may remain; record them in DATA.md`);
    await ctx.dispose();
    return;
  }
  for (const o of await res.json()) await ctx.delete(`/api/orders/${o.id}`);
  await ctx.dispose();
}
