// selftest.mjs — the test for the testers. Zero dependencies.
//
//   node Rules-Guide/kit-lint/selftest.mjs          # from the QA-SetupKit root
//
// The kit ships FIVE checkers that render pass/fail verdicts — kit-lint, validate.mjs,
// lint-specs.mjs, ci-run-result.mjs, coverage-check.mjs — code that decides whether something
// is good. Until 13/07/2026 not one of them had a negative test. A review proved the cost: a spec
// full of forbidden patterns linted CLEAN, and a bug with a typo'd field name validated VALID.
// Worse, if someone replaced validate.mjs with `process.exit(0)`, every self-test stayed green —
// the exact silent-green the kit exists to fight, applied to the kit itself.
//
// This fixes that. For each checker there is a GOOD fixture (must exit 0) and a BAD fixture
// (must exit NONZERO). A checker that passes its bad fixture is broken — and this fails loudly.
// "Never fake a Pass" only means something if the thing that detects a fake Pass is itself tested.
//
// Exit 0 = every checker correctly greens the good input and reds the bad one; 1 = a checker
// failed its own test (printed); 2 = harness/setup error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');            // QA-SetupKit root
const FIX = path.join(HERE, 'fixtures');
const VALIDATE = path.join(ROOT, 'Rules-Guide/schemas/validate.mjs');
const KITLINT = path.join(HERE, 'kit-lint.mjs');
const LINTSPECS = path.join(ROOT, 'Testing-Types/UI-Automation/template/e2e/tools/lint-specs.mjs');
const CIRUN = path.join(ROOT, 'Testing-Planning/CI-Integration/template/tools/ci-run-result.mjs');
const COVCHECK = path.join(ROOT, 'Testing-Planning/Traceability/template/tools/coverage-check.mjs');
const cov = (which, ...extra) => [COVCHECK,
  '--strategy', path.join(FIX, `${which}/coverage/strategy.json`),
  '--coverage', path.join(FIX, `${which}/coverage/coverage.json`),
  '--cases', path.join(FIX, `${which}/coverage/cases`),
  '--runs', path.join(FIX, `${which}/coverage/runs`), ...extra];
const TMP = fs.mkdtempSync('/tmp/kit-selftest-');
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

// A checker's self-test: run it on the good input (want exit 0) and the bad input (want ≠0).
// The BAD case is the load-bearing one — it proves the checker actually detects the defect it
// claims to. `wantBad` lets a checker use a specific nonzero code (ci-run-result: 3 = blocked).
const CHECKERS = [
  {
    name: 'validate.mjs (schemas)',
    defect: "a bug with a typo'd field (invariantViolatd) + a garbage field",
    good: () => run('node', [VALIDATE, 'bug', path.join(FIX, 'good/bug.json')]),
    bad: () => run('node', [VALIDATE, 'bug', path.join(FIX, 'bad/bug.json')]),
  },
  {
    name: 'lint-specs.mjs (E2E specs)',
    defect: 'a spec with getByRole, page.fill(selector,password), page.click(selector), a Promise-wrapped sleep, and a hardcoded token',
    good: () => run('node', [LINTSPECS, path.join(FIX, 'good/specs')]),
    bad: () => run('node', [LINTSPECS, path.join(FIX, 'bad/specs')]),
  },
  {
    name: 'ci-run-result.mjs (CI verdict)',
    defect: 'an E2E report where ZERO tests executed (an empty suite is not a passing suite)',
    good: () => run('node', [CIRUN, '--discipline', 'ui-automation', '--from', path.join(FIX, 'good/e2e'),
      '--schemas', VALIDATE, '--out', path.join(TMP, 'good-rr.json')]),
    bad: () => run('node', [CIRUN, '--discipline', 'ui-automation', '--from', path.join(FIX, 'bad/e2e'),
      '--schemas', VALIDATE, '--out', path.join(TMP, 'bad-rr.json')]),
  },
  {
    name: 'coverage-check.mjs (traceability projection)',
    defect: 'a snapshot with a "covered" unit whose run was BLOCKED, a risk-9 unit missing from gaps[], a risk number stale against the strategy, a blocked unit with no reason, and a case tracing outside the scope',
    good: () => run('node', cov('good')),
    bad: () => run('node', cov('bad')),
    // Each check is asserted by name: an exit code alone cannot tell "the gaps check fired" from
    // "something else did", and the states check is the load-bearing one.
    wantInBad: ['✗ risk', '✗ state', '✗ reason', '✗ gaps', '✗ orphans'],
  },
  {
    name: 'kit-lint.mjs (kit self-lint)',
    defect: 'a mini-kit whose README has a broken link (L1), a link into a project folder (L3), and a stale L12 generated block (one source folder unlisted, one phantom row)',
    good: () => run('node', [KITLINT, '--quiet'], { KIT_LINT_ROOT: path.join(FIX, 'good-kit') }),
    // bad runs WITHOUT --quiet: per-check lines are needed so each named check can be
    // proven to fire. 28/07/2026: exit-code-only proof let a neutered L3 hide behind L1 —
    // the anonymization pass broke L3's regex and this stayed green for two weeks.
    bad: () => run('node', [KITLINT], { KIT_LINT_ROOT: path.join(FIX, 'bad-kit') }),
    wantInBad: ['✗ L1', '✗ L3', '✗ L12'],
  },
];

// Sanity: every fixture and checker must exist, or the self-test is vacuously green — which
// would be its own silent Pass.
for (const p of [VALIDATE, KITLINT, LINTSPECS, CIRUN, path.join(FIX, 'good'), path.join(FIX, 'bad')]) {
  if (!fs.existsSync(p)) { console.error(`selftest: missing ${p} — cannot run`); process.exit(2); }
}

let failures = 0;
console.log(`kit-lint selftest · ${CHECKERS.length} checkers · each proven to green good input AND red bad input\n`);
for (const c of CHECKERS) {
  const g = c.good(), b = c.bad();
  const goodOk = g.code === 0;
  const missed = (c.wantInBad || []).filter((tag) => !b.out.includes(tag));
  const badOk = b.code !== 0 && b.code != null && missed.length === 0;   // nonzero AND every named check fired
  const ok = goodOk && badOk;
  console.log(`${ok ? '✓' : '✗'} ${c.name}`);
  console.log(`    good input → exit ${g.code} ${goodOk ? '(pass, correct)' : '← EXPECTED 0'}`);
  console.log(`    bad input  → exit ${b.code} ${badOk ? '(detected, correct)' : (b.code ? '← nonzero, but a named check stayed silent' : '← EXPECTED NONZERO')}`);
  if (!ok) {
    failures++;
    if (!badOk) console.log(`    !! this checker GREENLIT: ${c.defect}${missed.length ? ` (checks silent on bad input: ${missed.join(', ')})` : ''}\n       A checker that passes its bad fixture is broken or was neutered — the kit can no longer trust its own verdicts.`);
    if (!goodOk) console.log(`    !! this checker RED-FLAGGED a known-good input — false positive:\n${(g.out || '').split('\n').slice(0, 4).map((l) => '       ' + l).join('\n')}`);
  }
  console.log();
}

if (failures) {
  console.log(`selftest: ${failures}/${CHECKERS.length} checker(s) failed their own test.`);
  console.log('A verdict-renderer that cannot be shown to fail on bad input is not a checker — it is decoration.');
  process.exit(1);
}
console.log(`selftest: all ${CHECKERS.length} checkers green the good input and red the bad one.`);
