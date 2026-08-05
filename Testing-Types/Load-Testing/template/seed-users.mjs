#!/usr/bin/env node
// Seed a pool of test accounts via a dev "create test user" endpoint and write
// them to users.json for the k6 pool (lib/auth.js). SCAFFOLD — finalize the two
// marked spots (buildRequestBody / parseCreatedUser) once you know the contract.
//
// Usage:
//   SEED_URL=https://staging.example.com/dev/test-users \
//   SEED_SECRET=<dev-secret> \
//   node seed-users.mjs --count 20
//
//   SEED_URL (required) · SEED_SECRET · --count N | COUNT · --out PATH | OUT
//   EMAIL_DOMAIN (default example.com) · EMAIL_PREFIX (default ld) · PASSWORD · --dry-run
import { writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i !== -1 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : undefined; };
const DRY_RUN = args.includes('--dry-run');
const COUNT = Number(flag('--count') || process.env.COUNT || 20);
// CWD-relative, NOT file-relative: this tool is pointed at from a project (a symlink/pointer),
// so users.json must land where you RUN it (the project's Load-Testing dir), not next to the
// kit template. Override with --out / OUT for anything else.
const OUT = String(flag('--out') || process.env.OUT || path.resolve('users.json'));
const SEED_URL = process.env.SEED_URL;
const SEED_SECRET = process.env.SEED_SECRET || '';
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || 'example.com';
const EMAIL_PREFIX = process.env.EMAIL_PREFIX || 'ld';
const BASE_PASSWORD = process.env.PASSWORD || `Load!${Math.random().toString(36).slice(2, 10)}`;

if (!SEED_URL) { console.error('❌ SEED_URL is required.'); process.exit(1); }
if (existsSync(OUT) && !DRY_RUN && !args.includes('--force')) {
  console.error(`❌ ${OUT} exists. Re-run with --force to overwrite.`); process.exit(1);
}

function emailFor(i) {
  const stamp = process.env.EMAIL_STAMP || Date.now().toString(36);
  return `${EMAIL_PREFIX}+${stamp}-${i}@${EMAIL_DOMAIN}`;
}

// ---- TODO #1: request body your dev endpoint expects -----------------------
function buildRequestBody(email, password) {
  return JSON.stringify({ email, password /*, plan, limit, isTest ... */ });
}
// ---- TODO #2: read created creds out of the response -----------------------
function parseCreatedUser(reqEmail, reqPassword, status, body) {
  return { email: body?.email || body?.user?.email || reqEmail, password: body?.password || reqPassword };
}

async function createOne(i) {
  const email = emailFor(i), password = BASE_PASSWORD;
  if (DRY_RUN) { console.log(`  [dry-run] would create ${email}`); return { email, password }; }
  const res = await fetch(SEED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(SEED_SECRET ? { 'x-dev-secret': SEED_SECRET } : {}) },
    body: buildRequestBody(email, password),
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`create ${email} -> HTTP ${res.status}: ${text}`);
  const user = parseCreatedUser(email, password, res.status, body);
  console.log(`  ✅ ${user.email}`);
  return user;
}

(async () => {
  console.log(`Seeding ${COUNT} test users via ${SEED_URL}${DRY_RUN ? ' (dry-run)' : ''} ...`);
  const users = [], failures = [];
  for (let i = 1; i <= COUNT; i++) {
    try { users.push(await createOne(i)); } catch (e) { failures.push(String(e.message || e)); console.error(`  ❌ ${e.message || e}`); }
  }
  if (DRY_RUN) { console.log(`\nDry-run complete: ${users.length} planned. Nothing written.`); return; }
  if (users.length) { writeFileSync(OUT, JSON.stringify(users, null, 2) + '\n'); console.log(`\n📝 Wrote ${users.length} users to ${OUT} (gitignored).`); }
  if (failures.length) { console.log(`\n⚠️  ${failures.length} failed; partial users.json still usable.`); process.exitCode = 1; }
})();
