// ci-run-result.mjs — turn a kit tool's report into a CI VERDICT + a schema-valid
// run-result JSON. Zero dependencies. Copy to <Project>/CI-Integration/tools/.
//
// Why this exists: the kit tools (a11y-scan.mjs, visual-diff.mjs, …) are REPORT
// PRODUCERS — they exit 0 even when they find violations, because triage was always a
// human/agent job (they only crash on harness failures). CI needs a machine verdict, so
// the pipeline runs the tool and then runs THIS, which reads the tool's report, decides
// pass/fail/blocked, and carries the exit code that makes the gate red.
//
// Usage:
//   node ci-run-result.mjs --discipline accessibility     --from <Project>/Accessibility-Testing/scans --out artifacts/a11y/run-result.json
//   node ci-run-result.mjs --discipline visual-regression --from <Project>/Visual-Regression           --out artifacts/visual/run-result.json
//   node ci-run-result.mjs --discipline ui-automation     --from artifacts/e2e                         --out artifacts/e2e/run-result.json
//   node ci-run-result.mjs --candidates --from artifacts --out artifacts/candidates.md
//
// Flags:
//   --run-id <label>     a YYYY-MM-DD- prefix is added if missing (schema pattern)
//   --env <url>          defaults to $BASE_URL / $STAGING_BASE_URL
//   --plan-ref <path>    the Test-Strategy plan this run executes, if any
//   --schemas <path>     path to QA-SetupKit/Rules-Guide/schemas/validate.mjs (see FINDING SCHEMAS below)
//   --fail-on <impacts>  a11y ONLY: which axe impacts fail the gate. DEFAULT: every
//                        confirmed violation fails. Narrowing this (e.g. critical,serious)
//                        is an OWNER decision and belongs in GATES.md — a11y-scan.mjs
//                        reports only CONFIRMED WCAG 2.2 AA violations (axe 'incomplete'
//                        is excluded), so a moderate violation is still a real violation.
//   --expect-min <n>     e2e/regression ONLY: the minimum number of tests the slice should
//                        execute. A `--grep @high` gate that a broken tag shrinks to 1 test runs
//                        GREEN proving almost nothing; below <n> executed → blocked, not pass.
//   --allow-flaky        e2e ONLY: do not fail on flakes. Off by default: REGRESSION_RULES
//                        treats a flaky test as broken (fix it this round or quarantine it
//                        + file a bug ON THE TEST). With this flag the flake is still
//                        recorded in notes — it is never silently dropped.
//   --not-before <ms>    epoch ms; a report file older than this is STALE → blocked.
//                        The pipeline passes its job start time so a crashed tool cannot
//                        be scored against a report left over from a previous commit.
//
// Exit codes — the gate's verdict:
//   0 pass · 1 fail · 3 blocked (could not run / could not be trusted) · 2 bad usage.
// "Blocked" is never green: a crashed scan, a missing baseline, an absent or unparseable
// report, a stale report, a suite where nothing ran, and a result that cannot be schema-
// validated are ALL not-run — never Passed. (Test-Oracles: no oracle → not-run.
// CI_RULES: never fake a Pass; an unvalidatable result is a failed job.)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------- CLI ----------
const argv = process.argv.slice(2);
const BOOLS = new Set(['candidates', 'allow-flaky']);
const die = (msg, code = 2) => { console.error(`ci-run-result: ${msg}`); process.exit(code); };

const opts = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) die(`unexpected argument "${a}"`);
  const name = a.slice(2);
  if (BOOLS.has(name)) { opts[name] = true; continue; }
  const v = argv[i + 1];
  // A flag that takes a value MUST get one — otherwise `--out` at the end of the line
  // used to silently produce a file literally named "true".
  if (v === undefined || v.startsWith('--')) die(`--${name} requires a value`);
  opts[name] = v;
  i++;
}

const DISCIPLINES = ['load', 'api', 'emulator', 'security', 'ui-automation', 'checklist',
  'exploratory', 'accessibility', 'visual-regression', 'regression', 'localization', 'compatibility', 'web'];
const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];

// Test-Oracles doctrine, applied to this emitter itself (28/07/2026, external audit): every
// verdict names its oracle, so a pass/fail run-result without one is an INCOMPLETE artefact
// (run-result.schema.json §oracle). The emitter used to ship pass/fail artefacts with no oracle
// at all — the kit's own CI gate breaking the kit's own rule. The oracle is a property of what
// DECIDED the verdict, so an adapter that knows better returns its own; this map is the
// per-discipline default, and blocked/aborted need none (there is no verdict to justify).
const ORACLE = {
  load:                 { type: 'spec', source: 'owner-approved k6 thresholds in the scenario' },
  api:                  { type: 'spec', source: 'assertions in the API suite (status + body contract)' },
  emulator:             { type: 'spec', source: 'expected results in the checklist mapping' },
  security:             { type: 'spec', source: 'the documented auth/authorization model' },
  'ui-automation':      { type: 'spec', source: 'assertions in the executed specs' },
  checklist:            { type: 'spec', source: 'expected results in the checklist rows' },
  exploratory:          { type: 'human', source: 'charter debrief by the tester' },
  accessibility:        { type: 'spec', source: 'WCAG 2.2 AA via the axe-core rule set' },
  'visual-regression':  { type: 'golden-master', source: 'owner-approved baselines (BASELINES.md)' },
  regression:           { type: 'spec', source: 'assertions in the executed specs' },
  localization:         { type: 'spec', source: 'source-locale strings + CLDR formats' },
  compatibility:        { type: 'differential', source: 'the T1 reference cell' },
  web:                  { type: 'spec', source: 'assertions in the executed specs' },
};
// A discipline added without an oracle would silently emit incomplete artefacts — fail at load.
for (const d of DISCIPLINES) if (!ORACLE[d]) { console.error(`ci-run-result: internal — no oracle mapped for discipline "${d}"`); process.exit(2); }

// ---------- helpers ----------
// Never throws: a truncated or non-JSON report is a BLOCKED gate, not a crash that the
// shell would report as exit 1 (= "fail", i.e. a real defect in the app under test).
function readJson(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) };
  } catch (e) {
    return { ok: false, err: `${path.basename(p)} is unreadable/unparseable: ${e.message}` };
  }
}

function findReport(from, names) {
  if (!from || !fs.existsSync(from)) return { err: `--from ${from} does not exist — the tool produced no report` };
  const stat = fs.statSync(from);
  const file = stat.isFile() ? from : names.map((n) => path.join(from, n)).find((p) => fs.existsSync(p));
  if (!file) return { err: `no ${names.join(' / ')} under ${from} — the tool produced no report` };
  const notBefore = opts['not-before'] ? Number(opts['not-before']) : null;
  if (notBefore && fs.statSync(file).mtimeMs < notBefore) {
    return { err: `${path.basename(file)} is STALE (written before this job started) — the tool did not rewrite it, so it describes a previous run` };
  }
  return { file };
}

const today = () => new Date().toISOString().slice(0, 10);
const normalizeRunId = (label) => {
  const slug = String(label || 'ci').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'ci';
  return /^\d{4}-\d{2}-\d{2}-/.test(slug) ? slug : `${today()}-${slug}`;
};
const blocked = (reason, metrics = {}) => ({ verdict: 'blocked', metrics, crossed: [reason], details: [] });

// ---------- adapters: tool report → verdict ----------
// Each returns { verdict, metrics, crossed[], details[] }.
// INVARIANT upheld by all of them: crossed[] non-empty ⇒ verdict is never 'pass'.
// details[] rows are written to details.json next to the run-result and rendered into
// candidates.md — they are CANDIDATES for the bug funnel, never filed bugs.

// a11y-scan.mjs writes scans/summary.json = flat array of
// { page, rule, impact, wcag, nodes, help }; a crashed page appears as rule 'SCAN-FAILED'.
function adaptAccessibility(from, failOn) {
  const found = findReport(from, ['summary.json']);
  if (found.err) return blocked(found.err);
  const r = readJson(found.file);
  if (!r.ok) return blocked(r.err);
  const rows = r.data;
  if (!Array.isArray(rows)) return blocked('summary.json is not the array a11y-scan.mjs is documented to write');

  const scanFailed = rows.filter((x) => x.rule === 'SCAN-FAILED');
  const violations = rows.filter((x) => x.rule !== 'SCAN-FAILED');
  const count = (i) => violations.filter((v) => v.impact === i).length;
  const metrics = {
    violationRules: violations.length,
    critical: count('critical'), serious: count('serious'),
    moderate: count('moderate'), minor: count('minor'),
    pagesScanFailed: scanFailed.length,
  };

  // A page that never got scanned is not a passing page.
  if (scanFailed.length) {
    return { verdict: 'blocked', metrics, details: violations,
      crossed: scanFailed.map((x) => `scan failed on ${x.page}: ${x.help}`) };
  }
  const gating = violations.filter((v) => failOn.includes(v.impact));
  const tolerated = violations.filter((v) => !failOn.includes(v.impact));
  return {
    verdict: gating.length ? 'fail' : 'pass',
    metrics,
    crossed: gating.map((v) => `${v.impact} · ${v.rule} · WCAG ${v.wcag} · ${v.page} (${v.nodes} nodes)`),
    details: violations,
    // Violations below the owner's chosen floor are NOT hidden — they ride in the notes
    // and in details.json, so "pass" never means "no violations exist".
    note: tolerated.length
      ? `${tolerated.length} confirmed WCAG violation(s) below the --fail-on floor (${failOn.join(',')}) — reported, not gating. Narrowing the floor is an owner decision recorded in GATES.md.`
      : '',
  };
}

// visual-diff.mjs writes report.json = array of
// { page, verdict: 'pass' | 'NEEDS-HUMAN-LOOK' | 'NO-BASELINE' | 'SIZE-CHANGED' | 'CAPTURE-FAILED', changedPct? }
function adaptVisual(from) {
  const found = findReport(from, ['report.json']);
  if (found.err) return blocked(found.err);
  const r = readJson(found.file);
  if (!r.ok) return blocked(r.err);
  const rows = r.data;
  if (!Array.isArray(rows)) return blocked('report.json is not the array visual-diff.mjs is documented to write');

  const noOracle = rows.filter((x) => x.verdict === 'NO-BASELINE' || x.verdict === 'CAPTURE-FAILED');
  const diffs = rows.filter((x) => x.verdict === 'NEEDS-HUMAN-LOOK' || x.verdict === 'SIZE-CHANGED');
  const metrics = {
    pages: rows.length,
    passed: rows.filter((x) => x.verdict === 'pass').length,
    diffs: diffs.length,
    noBaseline: rows.filter((x) => x.verdict === 'NO-BASELINE').length,
    captureFailed: rows.filter((x) => x.verdict === 'CAPTURE-FAILED').length,
  };
  // No golden = no oracle. Not a pass — and CI must never record a baseline to make it green.
  if (noOracle.length) {
    return { verdict: 'blocked', metrics, details: rows,
      crossed: noOracle.map((x) => `${x.verdict} · ${x.page}${x.error ? ` · ${x.error}` : ''} — no oracle, so not a Pass; re-baselining is an owner decision logged in BASELINES.md`) };
  }
  return {
    verdict: diffs.length ? 'fail' : 'pass',
    metrics,
    crossed: diffs.map((x) => `${x.verdict} · ${x.page}${x.changedPct != null ? ` · ${x.changedPct}% changed` : ''}`),
    details: rows,
  };
}

// Playwright JSON reporter: { stats: { expected, unexpected, flaky, skipped, duration }, suites }
function adaptPlaywright(from) {
  const found = findReport(from, ['report.json', 'results.json', 'playwright-report.json']);
  if (found.err) return blocked(found.err);
  const r = readJson(found.file);
  if (!r.ok) return blocked(r.err);
  const rep = r.data;

  // No stats block at all → we cannot say anything about this run. Not a pass.
  if (!rep || typeof rep !== 'object' || !rep.stats) {
    return blocked('the Playwright report has no `stats` block — the run cannot be scored');
  }
  const s = rep.stats;
  const metrics = {
    passed: s.expected ?? 0, failed: s.unexpected ?? 0,
    flaky: s.flaky ?? 0, skipped: s.skipped ?? 0,
    durationMs: Math.round(s.duration ?? 0),
  };
  const executed = metrics.passed + metrics.failed + metrics.flaky;
  // An empty run is the classic silent green: a bad --grep, a config typo, a suite that
  // never got collected. Zero executed tests proves nothing.
  if (executed === 0) {
    return { verdict: 'blocked', metrics, details: [],
      crossed: [`no tests executed (${metrics.skipped} skipped) — an empty suite is not a passing suite; check the --grep/tag and the config`] };
  }
  // --expect-min <n>: the gate slice is `--grep @high`; if a typo shrinks the tag so only 1 test
  // matches while 400 are skipped, the run is GREEN having proven almost nothing. The project
  // declares how many tests the slice should contain; a run below that is BLOCKED (the tag is
  // probably broken), not a pass. (An automatic "skipped > executed → block" would be wrong here:
  // a tag-filtered gate legitimately skips everything not in the slice — that is normal, not a
  // defect. Only the project knows the expected size, so it must say so.)
  const expectMin = opts['expect-min'] ? Number(opts['expect-min']) : null;
  if (expectMin && executed < expectMin) {
    return { verdict: 'blocked', metrics, details: [],
      crossed: [`only ${executed} test(s) executed, expected at least ${expectMin} (--expect-min) — the tag/grep is probably broken, so this run proves less than the gate claims`] };
  }

  const crossed = [];
  if (metrics.failed) crossed.push(`${metrics.failed} test(s) failed`);
  // Flaky = broken (REGRESSION_RULES): fix it this round, or quarantine it and file a bug
  // ON THE TEST. Passing on retry is not passing.
  if (metrics.flaky && !opts['allow-flaky']) {
    crossed.push(`${metrics.flaky} flaky test(s) — a flake is a defect in the suite: fix it this round or quarantine it + file a bug on the test`);
  }
  return {
    verdict: crossed.length ? 'fail' : 'pass',
    metrics,
    crossed,
    details: collectFailedTitles(rep),
    note: metrics.flaky && opts['allow-flaky']
      ? `${metrics.flaky} flaky test(s) tolerated via --allow-flaky — still a defect in the suite; quarantine + bug on the test.`
      : '',
  };
}

function collectFailedTitles(rep) {
  const out = [];
  const walk = (suite, trail = []) => {
    for (const spec of suite.specs ?? []) {
      if (spec.ok === false) out.push({ test: [...trail, spec.title].join(' › '), file: spec.file });
    }
    for (const child of suite.suites ?? []) walk(child, [...trail, child.title]);
  };
  for (const s of rep.suites ?? []) walk(s, [s.title]);
  return out;
}

// Generic fallback: any tool that writes summary.json as { passed, failed, skipped, details? }
function adaptGeneric(from) {
  const found = findReport(from, ['summary.json', 'report.json']);
  if (found.err) return blocked(found.err);
  const r = readJson(found.file);
  if (!r.ok) return blocked(r.err);
  const d = r.data;
  if (typeof d !== 'object' || Array.isArray(d) || d.failed === undefined)
    return blocked(`cannot derive a verdict from ${path.basename(found.file)} — have the tool write { passed, failed, skipped }`);
  const metrics = { passed: d.passed ?? 0, failed: d.failed ?? 0, skipped: d.skipped ?? 0 };
  if (metrics.passed + metrics.failed === 0) return { verdict: 'blocked', metrics, details: [], crossed: ['no checks executed — an empty run is not a passing run'] };
  return {
    verdict: metrics.failed > 0 ? 'fail' : 'pass',
    metrics,
    crossed: metrics.failed > 0 ? [`${metrics.failed} check(s) failed`] : [],
    details: d.details ?? [],
  };
}

// ---------- candidates mode ----------
// Red gate → bug CANDIDATES. Never a tracker post: dedup → severity branch → owner
// confirmation stays exactly as BUG_REPORTS_RULES defines it.
function writeCandidates(from, out) {
  if (!fs.existsSync(from)) die(`--from ${from} does not exist`, 2);
  const found = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'run-result.json') {
        const r = readJson(p);
        if (r.ok) found.push({ result: r.data, dir });
        else console.warn(`ci-run-result: skipping unreadable ${p}`);
      }
    }
  };
  walk(from);

  const bad = found.filter((f) => f.result.verdict !== 'pass');
  const lines = [
    `# Bug candidates — CI run ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    '> **Candidates, not bugs.** Nothing here is filed anywhere. Triage each through the',
    '> normal funnel: dedup against the board → severity by the decision tree (quote the',
    '> branch) → owner confirmation. See `QA-Documentation/Bug-Reports/BUG_REPORTS_RULES.md`.',
    '',
  ];
  if (!bad.length) {
    lines.push('All gates green — no candidates.', '');
  } else {
    for (const { result: r, dir } of bad) {
      lines.push(`## ${r.discipline} — ${r.verdict.toUpperCase()} (\`${r.runId}\`)`, '');
      if (r.verdict === 'blocked') {
        lines.push('**Blocked = the gate could not run or could not be trusted. NOT a pass, and NOT (yet) a bug — fix the harness or the env first.**', '');
      }
      for (const c of r.thresholds?.crossed ?? []) lines.push(`- ${c}`);
      if (r.notes) lines.push('', `_${r.notes}_`);
      const det = readJson(path.join(dir, 'details.json'));
      if (det.ok && Array.isArray(det.data) && det.data.length) {
        lines.push('', '<details><summary>Evidence rows</summary>', '');
        for (const d of det.data.slice(0, 50)) lines.push(`- \`${JSON.stringify(d)}\``);
        if (det.data.length > 50) lines.push(`- … ${det.data.length - 50} more in details.json`);
        lines.push('', '</details>');
      }
      lines.push('');
    }
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, lines.join('\n'));
  console.log(`candidates → ${out} (${bad.length} non-green gate(s))`);
}

// ---------- schema validation ----------
// An unvalidatable result is a FAILED job, not a quietly-shipped blob (CI_RULES).
// FINDING SCHEMAS: --schemas → $QA_SCHEMAS_VALIDATOR → walk up from this script → walk up
// from the output path. In topology B (the pipeline lives in the APP repo) none of the
// ancestor walks can succeed, so the pipeline MUST pass --schemas explicitly — and if it
// doesn't, the gate goes BLOCKED rather than shipping an unchecked artefact.
function locateValidator(outFile) {
  const explicit = opts.schemas || process.env.QA_SCHEMAS_VALIDATOR;
  if (explicit) return fs.existsSync(explicit) ? explicit : null;
  const walk = (start) => {
    let dir = path.resolve(start);
    for (let i = 0; i < 10; i++) {
      for (const rel of [
        ['QA-SetupKit', 'Rules-Guide', 'schemas', 'validate.mjs'],
        ['Rules-Guide', 'schemas', 'validate.mjs'],
      ]) {
        const p = path.join(dir, ...rel);
        if (fs.existsSync(p)) return p;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  };
  return walk(HERE) || walk(path.dirname(path.resolve(outFile)));
}

function validate(outFile) {
  const validator = locateValidator(outFile);
  if (!validator) {
    console.error('ci-run-result: cannot find Rules-Guide/schemas/validate.mjs.');
    console.error('  Pass --schemas <path-to-validate.mjs> (or set $QA_SCHEMAS_VALIDATOR).');
    console.error('  An unvalidated result is not shipped: this gate is BLOCKED, not passed.');
    process.exit(3);
  }
  const r = spawnSync(process.execPath, [validator, 'run-result', outFile], { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) {
    // Delete it: an artefact that failed its contract must not survive to be uploaded and
    // mistaken for a result. The gate is BLOCKED, and the evidence of why is in the log.
    fs.rmSync(outFile, { force: true });
    console.error('ci-run-result: the run-result failed schema validation — deleted, not shipped. Gate BLOCKED.');
    process.exit(3);
  }
}

// ---------- main ----------
if (opts.candidates) {
  const from = opts.from || die('--candidates needs --from <dir>');
  writeCandidates(from, opts.out || path.join(from, 'candidates.md'));
  process.exit(0);   // building the list always succeeds; the GATES already carried the verdict
}

const discipline = opts.discipline || die(`--discipline is required (one of: ${DISCIPLINES.join(', ')})`);
if (!DISCIPLINES.includes(discipline)) die(`--discipline must be one of: ${DISCIPLINES.join(', ')}`);
const from = opts.from || die('--from <file|dir> is required');
const out = opts.out || `runs/${normalizeRunId(opts['run-id'])}/run-result.json`;

const failOn = (opts['fail-on'] ? opts['fail-on'].split(',').map((s) => s.trim()) : IMPACTS);
for (const i of failOn) if (!IMPACTS.includes(i)) die(`--fail-on: "${i}" is not an axe impact (${IMPACTS.join(', ')})`);

let r;
switch (discipline) {
  case 'accessibility':     r = adaptAccessibility(from, failOn); break;
  case 'visual-regression': r = adaptVisual(from); break;
  case 'ui-automation':
  case 'regression':
  case 'web':               r = adaptPlaywright(from); break;
  default:                  r = adaptGeneric(from); break;
}

// Invariant: anything in crossed[] means the thresholds did NOT pass.
const thresholdsPassed = r.crossed.length === 0;
if (r.verdict === 'pass' && !thresholdsPassed) die('internal: pass verdict with crossed thresholds — refusing to emit a contradictory artefact', 3);

const outAbs = path.resolve(out);
const outDir = path.dirname(outAbs);
fs.mkdirSync(outDir, { recursive: true });

// details[] is evidence, not decoration: it is written next to the result, linked from it,
// and rendered into candidates.md by --candidates.
const detailsFile = path.join(outDir, 'details.json');
fs.writeFileSync(detailsFile, JSON.stringify(r.details ?? [], null, 2));

const runResult = {
  runId: normalizeRunId(opts['run-id'] || `ci-${discipline}`),
  date: today(),
  discipline,
  env: opts.env || process.env.BASE_URL || process.env.STAGING_BASE_URL || 'unknown',
  method: 'ci',
  verdict: r.verdict,
  metrics: r.metrics,
  // pass/fail must name what decided it; blocked/aborted must not pretend to (see ORACLE above)
  ...(r.verdict === 'pass' || r.verdict === 'fail' ? { oracle: r.oracle ?? ORACLE[discipline] } : {}),
  thresholds: { passed: thresholdsPassed, crossed: r.crossed },
  ...(r.verdict === 'blocked' ? { stopCondition: 'blocked' } : {}),
  ...(opts['plan-ref'] ? { planRef: opts['plan-ref'] } : {}),
  links: [
    { label: 'evidence rows (details.json)', url: `./${path.basename(detailsFile)}` },
    ...(process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? [{ label: 'CI run', url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` }]
      : []),
    ...(process.env.CI_PIPELINE_URL ? [{ label: 'CI pipeline', url: process.env.CI_PIPELINE_URL }] : []),
  ],
  notes: [
    r.verdict === 'blocked'
      ? 'Gate could not run or could not be trusted — recorded as blocked, NOT as a pass.'
      : `Gate verdict derived from the ${discipline} tool report by ci-run-result.mjs.`,
    r.note || '',
  ].filter(Boolean).join(' '),
};

fs.writeFileSync(outAbs, JSON.stringify(runResult, null, 2));
validate(outAbs);   // exits 3 if it cannot validate — an unchecked artefact is never shipped

const summary = [
  `### ${discipline} — **${r.verdict.toUpperCase()}**`,
  '',
  ...Object.entries(r.metrics).map(([k, v]) => `- ${k}: ${v}`),
  ...(r.crossed.length ? ['', '**Crossed:**', ...r.crossed.map((c) => `- ${c}`)] : []),
  ...(r.note ? ['', `_${r.note}_`] : []),
  '',
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
console.log(summary);
console.log(`run-result → ${out}`);

process.exit(r.verdict === 'pass' ? 0 : r.verdict === 'blocked' ? 3 : 1);
