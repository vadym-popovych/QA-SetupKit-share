// Security-Testing kit — response security-headers + cookie + CORS probe
// Usage: node headers-check.mjs https://staging.example.com   (or reads config.json .target)
// Non-destructive: a single GET. Flags the fast, automatable Medium findings.
// Node 18+ (global fetch). No dependencies.
import fs from 'fs';

const arg = process.argv[2];
const target = arg?.startsWith('http')
  ? arg
  : (() => {
      const CFG = process.argv[3] || 'config.json';
      if (!fs.existsSync(CFG)) {
        console.error(`Provide a URL, or create ${CFG} with a .target (copy config.example.json).`);
        process.exit(2);
      }
      return JSON.parse(fs.readFileSync(CFG, 'utf8')).target;
    })();
if (!target) { console.error('Provide a URL or a config.json with .target'); process.exit(1); }

// header name -> why it matters (missing => finding)
const EXPECTED = {
  'strict-transport-security': 'HSTS missing — connection can be downgraded to HTTP',
  'content-security-policy':   'CSP missing — no defense-in-depth against XSS/injection',
  'x-frame-options':           'X-Frame-Options missing — clickjacking (also check CSP frame-ancestors)',
  'x-content-type-options':    'X-Content-Type-Options missing — MIME sniffing',
  'referrer-policy':           'Referrer-Policy missing — referrer may leak to third parties',
  'permissions-policy':        'Permissions-Policy missing — no restriction on powerful features',
};
// headers that SHOULD be absent (leak server internals)
const LEAKY = ['server', 'x-powered-by', 'x-aspnet-version'];

const res = await fetch(target, { redirect: 'manual' });
const h = res.headers;
const findings = [];

console.log(`\n${target} → ${res.status}\n`);

for (const [name, why] of Object.entries(EXPECTED)) {
  if (!h.has(name)) findings.push(['Medium', `Missing ${name}`, why]);
  else console.log(`  ok   ${name}: ${h.get(name)}`);
}
for (const name of LEAKY) {
  if (h.has(name)) findings.push(['Low', `${name} exposed`, `Leaks server detail: ${h.get(name)}`]);
}

// cookie flags
const setCookie = h.getSetCookie?.() ?? (h.get('set-cookie') ? [h.get('set-cookie')] : []);
for (const c of setCookie) {
  const name = c.split('=')[0];
  const low = c.toLowerCase();
  const missing = ['httponly', 'secure', 'samesite'].filter(f => !low.includes(f));
  if (missing.length) findings.push(['Medium', `Cookie ${name} weak flags`, `missing ${missing.join(', ')}`]);
}

// permissive CORS
const acao = h.get('access-control-allow-origin');
const acac = h.get('access-control-allow-credentials');
if (acao === '*' && acac === 'true') findings.push(['High', 'CORS misconfig', 'ACAO:* with credentials:true — any origin can read authed responses']);
else if (acao === '*') console.log('  note access-control-allow-origin: * (ok only if no credentialed data)');

console.log('\n--- findings ---');
if (!findings.length) console.log('  none from header probe (still run ZAP + logic checks)');
for (const [sev, title, detail] of findings) console.log(`  [${sev}] ${title} — ${detail}`);
console.log('\nFile confirmed items as BUG-NNN tagged SECURITY.\n');
