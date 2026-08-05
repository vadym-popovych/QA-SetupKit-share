#!/usr/bin/env node
// coverage-check.mjs — prove the coverage snapshot against the artefacts it claims to derive from.
// Zero dependencies.
//
//   node coverage-check.mjs --strategy <strategy.json> --coverage <coverage.json> \
//                           [--cases <dir>] [--runs <dir>] [--quiet]
//
// WHY THIS EXISTS (28/07/2026, external audit). TRACEABILITY_RULES says coverage states are
// "mechanical" and that "a full rebuild must reproduce the same table"; coverage.schema.json even
// marks `reason` as "REQUIRED in spirit" for not-run/blocked. None of it was enforced by anything —
// the chain's central honesty artefact was checked by no tool at all. A hand-maintained RTM drifts
// in exactly one direction: toward `covered`. This is the check that makes the claim real.
//
// It re-derives what can be derived and reports every disagreement:
//   · membership   — coverage and strategy describe the SAME set of scope units (both directions;
//                    a strategy unit with no coverage row is the silent gap the artefact exists to
//                    surface, and it cannot be seen by reading coverage.json alone)
//   · risk         — coverage risk == strategy risk == likelihood x impact (the schemas can only
//                    bound each number 1-9; the arithmetic between them was unchecked)
//   · depth        — coverage targetDepth == the depth the strategy assigned that risk
//   · state        — `covered` must survive the runs: a run that exists, its verdict pass, no open
//                    bugs, and at least one case tracing to the unit. A `covered` row sitting on a
//                    blocked run is a fabricated Pass with a table around it.
//   · reason       — not-run / blocked without a reason is a silent skip
//   · gaps[]       — EXACTLY the risk>=7 units not covered: missing entries hide an escalation,
//                    invented ones cry wolf until the list is ignored
//   · orphans      — a case tracing to a scope unit that does not exist
//
// EXIT CODES — a checker that cannot check must not answer 0 (the doctrine it enforces applies to
// itself first):
//   0 = every check ran and the artefacts agree
//   1 = inconsistencies found (each one printed with the artefact that disagrees)
//   2 = usage / unreadable or invalid input
//   3 = INCOMPLETE — the artefacts given are consistent, but --cases/--runs were not supplied, so
//       the state checks could not run. Not a pass: `covered` is unproven without the runs.

import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const die = (msg, code = 2) => { console.error(`coverage-check: ${msg}`); process.exit(code); };

const opts = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const key = a.slice(2);
  const next = argv[i + 1];
  if (next && !next.startsWith('--')) { opts[key] = next; i++; } else opts[key] = true;
}
const QUIET = opts.quiet === true;
const say = (m) => { if (!QUIET) console.log(m); };

const readJson = (file, label) => {
  if (!fs.existsSync(file)) die(`${label} not found: ${file}`);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { die(`${label} is not valid JSON (${file}): ${e.message}`); }
};

const strategyPath = opts.strategy || die('--strategy <strategy.json> is required');
const coveragePath = opts.coverage || die('--coverage <coverage.json> is required');
const strategy = readJson(strategyPath, 'strategy');
const coverage = readJson(coveragePath, 'coverage');

// Collect every JSON file under a directory (runs live one level down in runs/<id>/run-result.json,
// cases sit flat as TC-NNN.json — walk rather than guess the layout).
const walkJson = (dir, match) => {
  const out = [];
  const visit = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) visit(p);
      else if (e.isFile() && e.name.endsWith('.json') && match(e.name)) out.push(p);
    }
  };
  visit(dir);
  return out;
};

let cases = null;
if (opts.cases) {
  if (!fs.existsSync(opts.cases)) die(`--cases directory not found: ${opts.cases}`);
  cases = walkJson(opts.cases, (n) => /^TC-\d{3,}\.json$/.test(n)).map((f) => ({ file: f, data: readJson(f, 'case') }));
}
let runs = null;
if (opts.runs) {
  if (!fs.existsSync(opts.runs)) die(`--runs directory not found: ${opts.runs}`);
  runs = walkJson(opts.runs, (n) => n === 'run-result.json' || /run-result.*\.json$/.test(n)).map((f) => ({ file: f, data: readJson(f, 'run-result') }));
}

// ── the checks ────────────────────────────────────────────────────────────────────────────────
const issues = [];
const add = (check, msg) => issues.push({ check, msg });
const skipped = [];

const scope = strategy?.scope?.in;
if (!Array.isArray(scope)) die(`strategy has no scope.in[] — nothing to measure coverage against (${strategyPath})`);
if (!Array.isArray(coverage?.units)) die(`coverage has no units[] (${coveragePath})`);

const scopeIds = new Set(scope.map((u) => u.id));
const riskById = new Map((strategy.riskMatrix || []).map((r) => [r.id, r]));
const covById = new Map();
for (const u of coverage.units) {
  if (covById.has(u.id)) add('membership', `${u.id} appears twice in coverage.units — a unit has exactly one state`);
  covById.set(u.id, u);
}

// The snapshot must say which strategy revision it measures. A snapshot against a stale revision
// describes a scope that no longer exists — the numbers look fine and mean nothing.
if (coverage.strategyRevision && strategy.strategyRevision && coverage.strategyRevision !== strategy.strategyRevision) {
  add('membership', `coverage measures strategyRevision "${coverage.strategyRevision}" but the strategy is at "${strategy.strategyRevision}" — re-derive the snapshot before trusting it`);
}

// membership, both directions
for (const u of coverage.units) {
  if (!scopeIds.has(u.id)) add('membership', `${u.id} is in coverage but not in strategy scope.in[] — an orphan row measuring nothing`);
}
for (const s of scope) {
  if (!covById.has(s.id)) add('membership', `${s.id} ("${s.unit}") is in scope but has NO coverage row — an in-scope unit nobody can see the state of`);
}

// risk arithmetic + depth
for (const u of coverage.units) {
  const r = riskById.get(u.id);
  if (!r) {
    if (scopeIds.has(u.id)) add('risk', `${u.id} has no riskMatrix entry in the strategy — its risk ${u.risk} and depth "${u.targetDepth}" rest on nothing`);
    continue;
  }
  if (typeof r.likelihood === 'number' && typeof r.impact === 'number' && r.likelihood * r.impact !== r.risk)
    add('risk', `${u.id}: strategy risk ${r.risk} != likelihood ${r.likelihood} x impact ${r.impact} = ${r.likelihood * r.impact}`);
  if (u.risk !== r.risk)
    add('risk', `${u.id}: coverage risk ${u.risk} != strategy risk ${r.risk} — the snapshot was not re-derived after the strategy changed`);
  if (r.depth && u.targetDepth !== r.depth)
    add('depth', `${u.id}: coverage targetDepth "${u.targetDepth}" != strategy depth "${r.depth}"`);
}

// reasons — a skip is never silent
for (const u of coverage.units) {
  if ((u.state === 'not-run' || u.state === 'blocked') && !String(u.reason || '').trim())
    add('reason', `${u.id} is "${u.state}" with no reason — a skip nobody can audit`);
  if (u.state === 'not-run' && u.lastRun)
    add('reason', `${u.id} is "not-run" yet claims lastRun "${u.lastRun}" — one of the two is wrong`);
}

// open bugs never coexist with covered — this one needs no runs, so it always executes
for (const u of coverage.units) {
  if (u.state === 'covered' && Array.isArray(u.openBugs) && u.openBugs.length)
    add('state', `${u.id} is "covered" with open bugs ${u.openBugs.join(', ')} — by the state definition that is "partial"`);
}

// state vs the runs — the load-bearing check, and the one that needs --runs
if (runs) {
  const runById = new Map(runs.map((r) => [r.data.runId, r.data]));
  for (const u of coverage.units) {
    if (u.lastRun && !runById.has(u.lastRun))
      add('state', `${u.id}: lastRun "${u.lastRun}" matches no run-result under the runs directory — an unverifiable citation`);
    if (u.state !== 'covered') continue;
    if (!u.lastRun) { add('state', `${u.id} is "covered" but names no lastRun — nothing decided it`); continue; }
    const run = runById.get(u.lastRun);
    if (!run) continue;                                    // already reported above
    if (run.verdict !== 'pass')
      add('state', `${u.id} is "covered" but its lastRun "${u.lastRun}" ended "${run.verdict}" — a covered row on a non-passing run is a fabricated Pass`);
  }
} else {
  skipped.push('state-vs-runs (no --runs given): every "covered" row is unproven');
}

// cases — orphans, and the "covered by nothing" case
if (cases) {
  for (const c of cases) {
    const unit = c.data?.traceability?.strategyUnit;
    if (unit && !scopeIds.has(unit))
      add('orphans', `${path.basename(c.file)} traces to strategyUnit "${unit}" which is not in scope — fix at the source, not in the RTM`);
  }
  const unitsWithCases = new Set(cases.map((c) => c.data?.traceability?.strategyUnit).filter(Boolean));
  for (const u of coverage.units) {
    if (u.state === 'covered' && !unitsWithCases.has(u.id))
      add('state', `${u.id} is "covered" but no case traces to it — coverage at a target depth that no case implements`);
  }
} else {
  skipped.push('orphans + covered-without-cases (no --cases given)');
}

// gaps[] — exactly the risk>=7 units not covered
const expectedGaps = coverage.units.filter((u) => u.risk >= 7 && u.state !== 'covered').map((u) => u.id).sort();
const actualGaps = [...(coverage.gaps || [])].sort();
for (const id of expectedGaps)
  if (!actualGaps.includes(id)) add('gaps', `${id} is risk ${covById.get(id)?.risk} and "${covById.get(id)?.state}" but is MISSING from gaps[] — a hidden escalation`);
for (const id of actualGaps) {
  const u = covById.get(id);
  if (!u) add('gaps', `gaps[] names "${id}" which is not a coverage unit`);
  else if (!(u.risk >= 7 && u.state !== 'covered')) add('gaps', `gaps[] names ${id} (risk ${u.risk}, "${u.state}") which is not an escalation — a list that cries wolf gets ignored`);
}

// ── report ────────────────────────────────────────────────────────────────────────────────────
const CHECKS = {
  membership: 'coverage and strategy describe the same scope units',
  risk: 'risk copied correctly and equal to likelihood x impact',
  depth: 'target depth matches the strategy',
  state: 'states survive the runs that supposedly produced them',
  reason: 'not-run / blocked name a reason',
  gaps: 'gaps[] is exactly the risk>=7 units not covered',
  orphans: 'no case traces to a unit outside the scope',
};

say(`coverage-check · ${coverage.units.length} unit(s) vs ${scope.length} scope unit(s) · ${cases ? `${cases.length} case(s)` : 'no cases given'} · ${runs ? `${runs.length} run(s)` : 'no runs given'}\n`);
for (const [id, label] of Object.entries(CHECKS)) {
  const mine = issues.filter((i) => i.check === id);
  say(`${mine.length ? '✗' : '✓'} ${id} — ${label}${mine.length ? ` (${mine.length})` : ''}`);
  for (const i of mine) say(`    ${i.msg}`);
}

if (skipped.length) {
  say('');
  for (const s of skipped) say(`· NOT CHECKED — ${s}`);
}

if (issues.length) {
  console.log(`\ncoverage-check: ${issues.length} inconsistency(ies). The RTM is a projection — fix each one AT THE SOURCE (strategy, case, run, bug), then re-derive; never by editing the table.`);
  process.exit(1);
}
if (skipped.length) {
  console.log(`\ncoverage-check: the artefacts given agree, but ${skipped.length} check(s) could not run — INCOMPLETE, not a pass. Pass --cases and --runs to prove the states.`);
  process.exit(3);
}
console.log(`\ncoverage-check: consistent (${coverage.units.length} units, ${scope.length} scope units, all checks ran).`);
