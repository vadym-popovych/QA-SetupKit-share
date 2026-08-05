// Security-Testing kit — auth & session abuse checks
// Non-destructive, bounded. Adapt endpoints/fields to your API.
// Covers: token still valid after logout, login rate-limit (brute-force), verbose errors.
// Usage: node checks/auth-session.mjs ../config.json
import fs from 'fs';

const CFG = process.argv[2] || 'config.json';
if (!fs.existsSync(CFG)) {
  console.error(`${CFG} not found — copy config.example.json -> config.json, set the target and scopeConfirmed (see SETUP.md).`);
  process.exit(2);
}
const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
if (!cfg.scopeConfirmed) { console.error('scopeConfirmed=false — confirm authorization first.'); process.exit(1); }
const api = cfg.api.baseUrl;
const acc = cfg.accounts.attacker;
const findings = [];

async function login(email, password) {
  const r = await fetch(api + cfg.api.loginPath, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

// 1. token invalidation after logout (adapt paths /me, /auth/logout)
const { body } = await login(acc.email, acc.password);
const tok = body.token || body.accessToken || body.idToken;
if (tok) {
  await fetch(api + '/auth/logout', { method: 'POST', headers: { authorization: `Bearer ${tok}` } }).catch(() => {});
  const after = await fetch(api + '/me', { headers: { authorization: `Bearer ${tok}` } });
  console.log(`token after logout → /me = ${after.status}`);
  if (after.status < 300) findings.push(['High', 'Session not invalidated on logout', `token still works (${after.status}) after logout`]);
}

// 2. login rate-limit — BOUNDED burst (10) with a wrong password; must start returning 429
//    Uses the attacker's own email so no real account gets locked meaningfully.
let sawLimit = false;
for (let i = 0; i < 10; i++) {
  const r = await login(acc.email, `wrong-${i}`);
  if (r.status === 429) { sawLimit = true; break; }
}
console.log(`login brute-force burst → rate-limited: ${sawLimit}`);
if (!sawLimit) findings.push(['Medium', 'No login rate-limiting', '10 rapid failed logins, never 429 — brute-force exposure']);

// 3. verbose error on bad login (stack trace / internal detail leak)
const bad = await login('nope@example.com', 'x');
const txt = JSON.stringify(bad.body).toLowerCase();
if (/stack|exception|sql|at .*\.js:|\/users\/|traceback/.test(txt))
  findings.push(['Low', 'Verbose error leak', 'login error response exposes internal detail']);

console.log('\n--- findings ---');
for (const [sev, title, detail] of findings) console.log(`  [${sev}] ${title} — ${detail}`);
if (!findings.length) console.log('  none — auth/session held');
console.log('\nFile confirmed items as BUG-NNN tagged SECURITY.\n');
