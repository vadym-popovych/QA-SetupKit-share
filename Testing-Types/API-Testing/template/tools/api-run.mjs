#!/usr/bin/env node
// api-run.mjs — execute a declarative functional API suite (suite.json) and write a
// schema-valid run-result.json. Zero dependencies: built-in fetch (Node >= 18), no npm
// installs. Copy to <Project>/API-Testing/tools/ — SETUP.md scaffolds the layout it expects.
//
// Why the suite is DATA and not code: checks (method/path/expected status/body assertions/
// capture chaining) are derived from the Postman collection and must be reviewable and
// diffable like any artefact — a suite you can read is a suite the owner can audit. The
// runner is the only code, and it never decides what "correct" means; the suite does.
// The format is documented by suite.example.json next to this tool.
//
// Usage:
//   node tools/api-run.mjs --out runs/<YYYY-MM-DD>-<slug> [--suite <file>] [--config <file>]
//                          [--url <baseUrl override>]
// Defaults: ../suite.json and ../config.json relative to this script (the SETUP.md layout).
//
// Placeholders inside the suite (any string value):
//   {env.NAME}   an environment variable — secrets NEVER appear as literals in files
//   {cap.name}   a value captured from an earlier check's response (chaining; never
//                hardcoded ids — a suite pinned to today's staging DB lies after a reset)
//   {runId}      this run's id — test data is run-id-prefixed per TEST_DATA_RULES
//
// Writes into --out:
//   run-result.json  the round artefact (run-result.schema.json, discipline "api") —
//                    validate it in the SAME turn:
//                    node QA-SetupKit/Rules-Guide/schemas/validate.mjs run-result <out>/run-result.json
//   evidence.json    per-check repro: request with headers/body UNsubstituted (tokens never
//                    enter an artefact), expected vs actual, failure messages. The repro for
//                    a BUG-NNN fits in a curl line — this file is where it comes from.
//
// Exit codes (same contract as the CI gate — ci-run-result.mjs — so a stable suite can gate
// G-4 directly):
//   0 pass     every check executed and every assertion held
//   1 fail     >= 1 assertion failed — each one is a BUG-NNN candidate, not yet a bug
//   2 usage / config — missing or unreadable config/suite, malformed check, an unset env var
//              the suite references, a production target. Nothing was sent; no run-result.
//   3 blocked  the result cannot be trusted as a pass: zero checks executed, or >= 1 check
//              errored (transport/timeout) or was skipped (its {cap.*} source did not pass)
//              while nothing failed. Unreached = not-run, never a pass.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const die = (msg) => { console.error(`api-run: ${msg}`); process.exit(2); };

// ---------- CLI ----------
const argv = process.argv.slice(2);
const opts = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) die(`unexpected argument "${a}"`);
  const name = a.slice(2);
  const v = argv[i + 1];
  // A flag that takes a value must get one — a trailing `--out` must not silently
  // produce a directory literally named "true".
  if (v === undefined || v.startsWith('--')) die(`--${name} requires a value`);
  opts[name] = v;
  i++;
}
if (!opts.out) die('--out runs/<YYYY-MM-DD>-<slug> is required');

// ---------- config (fail closed: a missing/unsafe target is a refusal, not a crash) ------
const configPath = path.resolve(opts.config || path.join(HERE, '..', 'config.json'));
if (!fs.existsSync(configPath)) {
  die(`${configPath} not found — copy config.example.json to config.json and set baseUrl + environment (SETUP.md §2)`);
}
let cfg;
try { cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')); }
catch (e) { die(`config is not valid JSON (${configPath}): ${e.message}`); }

const BASE_URL = (opts.url || cfg.baseUrl || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(BASE_URL)) die('config.baseUrl (or --url) must be an http(s) URL');
if (!String(cfg.environment || '').trim()) {
  die('config.environment is required (e.g. "staging") — the artefact must say where it ran');
}
// Functional suites create, update and delete. There is no flag to override this.
if (/^(production|prod)$/i.test(cfg.environment.trim())) {
  die('config.environment is production — CRUD mutates; staging/dev only (API_TESTING_RULES)');
}
const TIMEOUT_MS = Number(cfg.timeoutMs) > 0 ? Number(cfg.timeoutMs) : 15000;

// ---------- suite: load + validate the format before sending anything --------------------
const suitePath = path.resolve(opts.suite || path.join(HERE, '..', 'suite.json'));
if (!fs.existsSync(suitePath)) {
  die(`${suitePath} not found — copy suite.example.json to suite.json and derive the checks from the real collection (SETUP.md §1-§2)`);
}
let suite;
try { suite = JSON.parse(fs.readFileSync(suitePath, 'utf8')); }
catch (e) { die(`suite is not valid JSON (${suitePath}): ${e.message}`); }
// `$comment` is the reserved annotation key (validate.mjs allows it everywhere): documentation,
// never data. Strip it before anything scans the suite — a placeholder mentioned in prose must
// not trip the env guard or invent a {cap.*} chain dependency.
const stripComments = (v) => Array.isArray(v) ? v.map(stripComments)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== '$comment').map(([k, x]) => [k, stripComments(x)]))
    : v;
suite = stripComments(suite);
if (!Array.isArray(suite.checks)) die('suite.checks[] is missing or not an array');

const ORACLE_TYPES = ['spec', 'golden-master', 'differential', 'invariant', 'metamorphic', 'consistency', 'llm-judge', 'human'];
const OPS = ['exists', 'equals', 'absent', 'matches'];
// A malformed oracle would surface only later, as an artefact that fails schema validation —
// catch it here, before a single request is sent.
const checkOracle = (o, where) => {
  if (o === undefined) return;
  if (typeof o !== 'object' || !ORACLE_TYPES.includes(o.type)) die(`${where}: oracle.type must be one of ${ORACLE_TYPES.join('/')}`);
  for (const k of Object.keys(o)) if (k !== 'type' && k !== 'source') die(`${where}: oracle has unknown key "${k}"`);
};
checkOracle(suite.oracle, 'suite');

const seen = new Set();
for (const c of suite.checks) {
  const where = `check "${c.id || c.name || '?'}"`;
  if (!c.id || typeof c.id !== 'string') die(`${where}: every check needs an "id"`);
  if (seen.has(c.id)) die(`${where}: duplicate id`);
  seen.add(c.id);
  if (!c.name) die(`${where}: every check needs a "name" (what it proves)`);
  if (!c.request?.method || !c.request?.path) die(`${where}: request.method + request.path are required`);
  if (typeof c.expect?.status !== 'number') die(`${where}: expect.status (number) is required — a check with no expected status asserts nothing`);
  for (const a of c.expect.body || []) {
    if (!a.path) die(`${where}: a body assertion needs a "path"`);
    if (OPS.filter((o) => o in a).length !== 1) die(`${where}: body assertion on "${a.path}" needs exactly one of ${OPS.join('/')}`);
  }
  checkOracle(c.oracle, where);
}

// Every {env.*} the suite references must be set BEFORE anything is sent — a suite that
// silently sends "Bearer undefined" produces 401s that read like findings.
const suiteText = JSON.stringify(suite);
const envRefs = [...new Set([...suiteText.matchAll(/\{env\.([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]))];
const unsetEnv = envRefs.filter((n) => !process.env[n]);
if (unsetEnv.length) {
  die(`unset environment variable(s) the suite references: ${unsetEnv.join(', ')} — export them in the shell (values never go into files, SETUP.md §3)`);
}
// Every {cap.*} must be declared by an EARLIER check's capture block — a typo here would
// otherwise surface mid-run as a confusing skip.
const capRefsOf = (c) => [...new Set([...JSON.stringify(c).matchAll(/\{cap\.([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]))];
{
  const declared = new Set();
  for (const c of suite.checks) {
    for (const r of capRefsOf(c)) {
      if (!declared.has(r)) die(`check "${c.id}" references {cap.${r}} which no earlier check captures`);
    }
    for (const name of Object.keys(c.capture || {})) declared.add(name);
  }
}

// ---------- run id ----------
const today = new Date().toISOString().slice(0, 10);
let runId = path.basename(opts.out).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'api';
if (!/^\d{4}-\d{2}-\d{2}-/.test(runId)) runId = `${today}-${runId}`;

// ---------- helpers ----------
const getPath = (obj, dotted) => {
  let v = obj;
  for (const key of String(dotted).split('.')) {
    if (v !== null && typeof v === 'object' && key in v) v = v[key];
    else return { found: false };
  }
  return { found: true, value: v };
};
const deepEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
};
const show = (v) => { const s = JSON.stringify(v); return s === undefined ? 'undefined' : s.length > 120 ? s.slice(0, 120) + '…' : s; };

const captures = {};
const resolveToken = (token) => {
  if (token === 'runId') return runId;
  const [kind, name] = token.split('.');
  return kind === 'env' ? process.env[name] : captures[name];
};
// A string that IS a single placeholder substitutes to the raw captured value (numbers stay
// numbers — an equals-assertion on a numeric id must not fail on "7" vs 7); otherwise
// placeholders interpolate into the string.
const subst = (v) => {
  if (typeof v === 'string') {
    const whole = /^\{((?:env|cap)\.[A-Za-z_][A-Za-z0-9_]*|runId)\}$/.exec(v);
    if (whole) return resolveToken(whole[1]);
    return v.replace(/\{((?:env|cap)\.[A-Za-z_][A-Za-z0-9_]*|runId)\}/g, (_, t) => String(resolveToken(t)));
  }
  if (Array.isArray(v)) return v.map(subst);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, subst(x)]));
  return v;
};

// ---------- execute ----------
const t0 = Date.now();
const outcomes = []; // { check, outcome: pass|fail|error|skipped, failures[], reason?, actualStatus?, actualBody?, url? }

console.log(`api-run · ${suite.suite || path.basename(suitePath)} · ${cfg.environment} ${BASE_URL} · ${suite.checks.length} check(s)`);

for (const c of suite.checks) {
  // A check whose chained value never materialised did not run — and must say so.
  const missingCaps = capRefsOf(c).filter((r) => !(r in captures));
  if (missingCaps.length) {
    const reason = `needs {cap.${missingCaps[0]}} from a check that did not pass`;
    outcomes.push({ check: c, outcome: 'skipped', failures: [], reason });
    console.log(`- ${c.id} skipped — ${reason}`);
    continue;
  }

  const url = BASE_URL + subst(c.request.path);
  const headers = subst(c.request.headers || {});
  let body;
  if (c.request.body !== undefined) {
    const b = subst(c.request.body);
    body = typeof b === 'string' ? b : JSON.stringify(b);
    if (typeof b !== 'string' && !Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json';
    }
  }

  let resp, text;
  try {
    resp = await fetch(url, { method: c.request.method, headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    text = await resp.text();
  } catch (e) {
    const reason = e.name === 'TimeoutError' ? `timeout after ${TIMEOUT_MS}ms`
      : `${e.message}${e.cause ? ` (${e.cause.code || e.cause.message})` : ''}`;
    outcomes.push({ check: c, outcome: 'error', failures: [], reason, url });
    console.log(`! ${c.id} errored — ${reason}`);
    continue;
  }

  let json = null;
  try { json = text === '' ? null : JSON.parse(text); } catch { /* not JSON — asserted below if the check needs it */ }

  const failures = [];
  if (resp.status !== c.expect.status) failures.push(`status: expected ${c.expect.status}, got ${resp.status}`);
  const bodyAsserts = c.expect.body || [];
  if ((bodyAsserts.length || c.capture) && json === null && text !== '') {
    failures.push(`body: the check asserts on the body but the response is not JSON (starts "${text.slice(0, 60)}")`);
  } else {
    for (const a of bodyAsserts) {
      const g = getPath(json, a.path);
      if ('exists' in a) { if (!g.found) failures.push(`body.${a.path}: expected present, absent`); }
      else if ('absent' in a) { if (g.found) failures.push(`body.${a.path}: expected absent, present (${show(g.value)})`); }
      else if ('equals' in a) {
        const want = subst(a.equals);
        if (!g.found) failures.push(`body.${a.path}: expected ${show(want)}, absent`);
        else if (!deepEqual(g.value, want)) failures.push(`body.${a.path}: expected ${show(want)}, got ${show(g.value)}`);
      } else if ('matches' in a) {
        if (!g.found) failures.push(`body.${a.path}: expected to match /${a.matches}/, absent`);
        else if (typeof g.value !== 'string' || !new RegExp(a.matches).test(g.value)) failures.push(`body.${a.path}: ${show(g.value)} does not match /${a.matches}/`);
      }
    }
    // A capture is an implicit exists-assertion: the check declared the response would carry
    // this value, so its absence is a failed check, not a shrug.
    if (!failures.length) {
      for (const [name, p] of Object.entries(c.capture || {})) {
        const g = getPath(json, p);
        if (!g.found) failures.push(`capture "${name}": path "${p}" is absent from the response body`);
        else captures[name] = g.value;
      }
    }
  }

  const outcome = failures.length ? 'fail' : 'pass';
  outcomes.push({ check: c, outcome, failures, actualStatus: resp.status, actualBody: text.slice(0, 4000), url });
  console.log(`${outcome === 'pass' ? '✓' : '✗'} ${c.id} ${c.name}`);
  for (const f of failures) console.log(`    ${f}`);
}

// ---------- verdict ----------
const count = (o) => outcomes.filter((x) => x.outcome === o).length;
const metrics = {
  checks: suite.checks.length,
  passed: count('pass'),
  failed: count('fail'),
  errored: count('error'),
  skipped: count('skipped'),
  durationMs: Date.now() - t0,
};
const executed = metrics.passed + metrics.failed;
// failed > 0 → fail; anything unexecuted (zero checks, errors, skips) with nothing failed →
// blocked. There is no path from "not everything ran" to "pass" — unreached = not-run.
const verdict = metrics.failed > 0 ? 'fail'
  : executed === 0 || metrics.errored + metrics.skipped > 0 ? 'blocked'
  : 'pass';

const crossed = outcomes.filter((o) => o.outcome !== 'pass').map((o) =>
  o.outcome === 'fail' ? `${o.check.id} · ${o.failures.join('; ')}`
  : `${o.check.id} · ${o.outcome}: ${o.reason}`);
if (verdict === 'pass' && crossed.length) die('internal: pass verdict with crossed thresholds — refusing to emit a contradictory artefact');

// ---------- artefacts ----------
const outDir = path.resolve(opts.out);
fs.mkdirSync(outDir, { recursive: true });

// Evidence keeps the UNsubstituted request (headers/body as written in the suite, tokens as
// {env.NAME} placeholders) — secrets never enter an artefact. The resolved URL is kept: it
// carries chained ids, which the repro needs, and never a secret.
fs.writeFileSync(path.join(outDir, 'evidence.json'), JSON.stringify(outcomes.map((o) => ({
  id: o.check.id,
  name: o.check.name,
  outcome: o.outcome,
  request: { method: o.check.request.method, url: o.url || null, headers: o.check.request.headers || {}, body: o.check.request.body ?? null },
  expect: o.check.expect,
  ...(o.actualStatus !== undefined ? { actual: { status: o.actualStatus, body: o.actualBody } } : {}),
  ...(o.failures.length ? { failures: o.failures } : {}),
  ...(o.reason ? { reason: o.reason } : {}),
})), null, 2));

// Per-case rows only for checks named with real TC ids (schema pattern ^TC-\d{3,}$) — these
// feed regression counting. Free-form ids stay in evidence.json only.
const results = outcomes.filter((o) => /^TC-\d{3,}$/.test(o.check.id)).map((o) => ({
  caseId: o.check.id,
  verdict: o.outcome === 'pass' ? 'pass' : o.outcome === 'fail' ? 'fail' : 'skipped',
  ...((o.outcome === 'pass' || o.outcome === 'fail') && o.check.oracle ? { oracle: o.check.oracle } : {}),
}));

const runResult = {
  runId,
  date: today,
  discipline: 'api',
  ...(suite.suite ? { scenario: suite.suite } : {}),
  env: `${cfg.environment} ${BASE_URL}`,
  method: 'local',
  verdict,
  // pass/fail names what decided it; blocked has no verdict to justify (Test-Oracles).
  ...(verdict === 'pass' || verdict === 'fail'
    ? { oracle: suite.oracle ?? { type: 'spec', source: 'status + body assertions in the suite, derived from the API contract' } }
    : {}),
  metrics,
  thresholds: { passed: crossed.length === 0, crossed },
  ...(verdict === 'blocked' ? { stopCondition: 'blocked' } : {}),
  ...(results.length ? { results } : {}),
  links: [{ label: 'per-check evidence & repro (evidence.json)', url: './evidence.json' }],
  notes: verdict === 'blocked'
    ? `${metrics.errored} errored / ${metrics.skipped} skipped / ${executed} executed of ${metrics.checks} — recorded as blocked, NOT a pass (unreached = not-run).`
    : verdict === 'fail'
      ? 'Each failed check is a BUG-NNN candidate with its repro in evidence.json — dedup + severity per BUG_REPORTS_RULES before filing.'
      : `All ${executed} check(s) executed and passed.`,
};
const runResultPath = path.join(outDir, 'run-result.json');
fs.writeFileSync(runResultPath, JSON.stringify(runResult, null, 2));

console.log(`\nVERDICT: ${verdict.toUpperCase()} · passed ${metrics.passed} · failed ${metrics.failed} · errored ${metrics.errored} · skipped ${metrics.skipped}`);
console.log(`run-result → ${runResultPath}`);
console.log(`evidence   → ${path.join(outDir, 'evidence.json')}`);
console.log(`validate (same turn): node QA-SetupKit/Rules-Guide/schemas/validate.mjs run-result ${runResultPath}`);

process.exit(verdict === 'pass' ? 0 : verdict === 'fail' ? 1 : 3);
