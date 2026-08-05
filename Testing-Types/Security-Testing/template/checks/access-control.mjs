// Security-Testing kit — access-control / IDOR (BOLA) matrix
// The #1 QA-findable, high-impact API security check.
// For each resource: attacker token vs victim's object id vs anonymous.
//   - attacker reading/modifying victim's object that succeeds  => IDOR  (High/Critical)
//   - normal user hitting an admin-only route that succeeds     => broken access control
//   - anonymous hitting an authed route that succeeds           => missing auth
// Non-destructive: only GET here. Extend to write methods ONLY on disposable objects.
// Usage: node checks/access-control.mjs ../config.json
//
// THE ORACLE (28/07/2026, after an audit found this printing a false green): a 401/404 for the
// attacker proves nothing on its own — an unconfigured id or a wrong route returns exactly the
// same thing as a properly protected object. So each resource is first exercised with a CONTROL
// request: the victim reads their OWN object with their own token and must get 2xx. Only then
// does the attacker's refusal mean "access control held". No control, no oracle → the resource
// is reported `not-run`, never as held (DOCTRINE §2/§3).
// Exit: 0 = every configured resource was exercised · 2 = cannot start (config/login) ·
//       3 = blocked (no resource could be exercised — an empty run is not a passing run).
import fs from 'fs';

const CFG = process.argv[2] || 'config.json';
if (!fs.existsSync(CFG)) {
  console.error(`${CFG} not found — copy config.example.json -> config.json, set the target and scopeConfirmed (see SETUP.md).`);
  process.exit(2);
}
const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
if (!cfg.scopeConfirmed) { console.error('scopeConfirmed=false in config — confirm authorization first.'); process.exit(1); }
const api = cfg.api.baseUrl;

async function login(acc) {
  const r = await fetch(api + cfg.api.loginPath, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: acc.email, password: acc.password }),
  });
  const body = await r.json().catch(() => ({}));
  // adapt to your API's token field:
  return body.token || body.accessToken || body.idToken;
}

const attackerTok = await login(cfg.accounts.attacker);
const victimTok   = await login(cfg.accounts.victim);
// A missing token means every later request is anonymous — which answers 401 to everything and
// would read as "access control held". Fail closed instead of measuring nothing.
for (const [who, tok] of [['attacker', attackerTok], ['victim', victimTok]]) {
  if (!tok) {
    console.error(`login failed for the ${who} account (no token in the response) — cannot establish the oracle.`);
    console.error(`Check accounts.${who} in ${CFG}, api.loginPath, and the token field name in login() above.`);
    process.exit(2);
  }
}

const PLACEHOLDER = /^(REPLACE|<|TODO|CHANGE)/i;
const findings = [];
const notRun = [];
let tested = 0;

for (const res of cfg.idorResources || []) {
  // 1. A victim-owned object id is the precondition, not a default. Adapt: list the victim's
  //    objects with their token and take one id.
  if (!res.sampleVictimId || PLACEHOLDER.test(String(res.sampleVictimId))) {
    notRun.push([res.name, 'no sampleVictimId in the config — nothing to attempt to reach']);
    continue;
  }
  const url = api + res.ownerRead.replace('{id}', res.sampleVictimId);

  // 2. CONTROL: the victim reads their own object. This is what makes the attacker's refusal
  //    mean anything — see the oracle note at the top. adminOnly routes are exempt: the victim
  //    is a normal user and is SUPPOSED to be refused there, so the control is the admin account
  //    when one is configured, and otherwise the resource is not-run.
  const control = res.adminOnly
    ? (cfg.accounts.admin ? await fetch(url, { method: res.method, headers: { authorization: `Bearer ${await login(cfg.accounts.admin)}` } }) : null)
    : await fetch(url, { method: res.method, headers: { authorization: `Bearer ${victimTok}` } });
  if (!control) {
    notRun.push([res.name, 'admin-only route and no accounts.admin configured — cannot prove the route works for anyone']);
    continue;
  }
  if (control.status >= 300) {
    notRun.push([res.name, `control request failed (${control.status} for the legitimate owner at ${url}) — a refusal to the attacker would prove nothing`]);
    continue;
  }

  // 3. attacker tries victim's object · 4. anonymous tries the route
  const asAttacker = await fetch(url, { method: res.method, headers: { authorization: `Bearer ${attackerTok}` } });
  const asAnon = await fetch(url, { method: res.method });
  tested++;

  console.log(`${res.name}: control=${control.status} attacker=${asAttacker.status} anon=${asAnon.status}`);

  if (res.adminOnly && asAttacker.status < 300)
    findings.push(['Critical', `Broken access control: ${res.name}`, `non-admin got ${asAttacker.status} on admin-only ${url}`]);
  else if (!res.adminOnly && asAttacker.status < 300)
    findings.push(['High', `IDOR: ${res.name}`, `attacker read victim's object (${asAttacker.status}) at ${url}`]);
  if (asAnon.status < 300)
    findings.push(['High', `Missing auth: ${res.name}`, `anonymous got ${asAnon.status} at ${url}`]);
}

console.log('\n--- findings ---');
for (const [sev, title, detail] of findings) console.log(`  [${sev}] ${title} — ${detail}`);
if (!findings.length && tested) console.log(`  none — access control held for the ${tested} resource(s) actually exercised`);
if (notRun.length) {
  console.log('\n--- not run (no oracle — NOT a pass) ---');
  for (const [name, why] of notRun) console.log(`  [not-run] ${name} — ${why}`);
}
console.log('\nFile confirmed items as BUG-NNN tagged SECURITY (safe repro: the two ids + status codes).\n');

if (!tested) {
  console.error(`access-control: BLOCKED — 0 of ${(cfg.idorResources || []).length} resource(s) could be exercised; this run says nothing about access control.`);
  process.exit(3);
}
