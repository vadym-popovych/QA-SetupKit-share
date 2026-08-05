#!/usr/bin/env node
// run-rubric.mjs — the VERIFIER entry point for the self-healing locators loop.
//
// The OUTER LOOP calls this between iterations. The FIXER subagent NEVER runs it and
// never writes verdicts — maker-checker separation is structural, not behavioral.
//
// Runs the criteria cheap-to-expensive:
//   R0 allowlist guard  (allowlist-guard.mjs --check)  — FAIL => ABORT, nothing else runs
//   R2 stability lint   (lint-locators.mjs)
//   R4 traps updated    (check-traps.mjs)
//   R1 live resolution  (verify-locators.mjs — needs the test stand + creds)
//   R3 full test suite  (config.testCommand; null => reported skipped, NOT failed);
//                       failing output lines are classified locator-resolution vs
//                       assertion failure — R3 passes when the suite is green OR every
//                       remaining failure is an assertion failure (= product bug to
//                       file as BUG-NNN, never a loop fix).
//
// Emits ONE verdict JSON to stdout AND to <verdictsDir>/<timestamp>.json.
// Exit 0 only if every configured, non-skipped criterion passes.
// The outer loop must require BOTH `pass: true` AND `complete: true` to declare
// SUCCESS (`--skip R1,R3` produces a non-final verdict for offline dry-runs).
//
// Usage: node run-rubric.mjs --config <path> [--skip R1,R3] [--only R0,R2,R4]
//   --skip  run everything except the listed criteria
//   --only  run ONLY the listed criteria (shorthand for skipping all others);
//           useful as the per-criterion check command in a loop-spec
// Either flag produces a NON-FINAL verdict (complete: false).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseArgs, loadConfig, ensureDir, log } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function runScript(script, cfg, extraArgs = []) {
  const r = spawnSync(
    process.execPath,
    [path.join(HERE, script), '--config', cfg._configPath, '--json', ...extraArgs],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  let parsed = null;
  try {
    parsed = JSON.parse(r.stdout);
  } catch { /* script crashed before emitting JSON */ }
  return {
    pass: parsed ? parsed.pass === true : false,
    exit: r.status,
    ...(parsed || { error: `no JSON output from ${script}`, stderr: (r.stderr || '').slice(-2000) }),
  };
}

// ---- R3: full suite + failure classification -------------------------------

const ASSERT_RX = [
  /Error: expect\(/,
  /expect\(received\)/,
  /AssertionError/,
  /waiting for expect\(/i,
  /toHaveText|toBeVisible|toBeHidden|toHaveCount|toEqual|toContainText|toHaveURL|toHaveValue/,
];
const LOCATOR_RX = [
  /waiting for locator/i,
  /waiting for selector/i,
  /strict mode violation/i,
  /locator\.\w+: Timeout/i,
  /Unknown engine/i,
  /is not a valid selector/i,
  /failed to find element/i,
];

function classifyLine(line) {
  // Assertion patterns win: "waiting for expect(locator)..." is an expectation
  // timeout — a product-behaviour signal, not a harness-repair signal.
  if (ASSERT_RX.some((rx) => rx.test(line))) return 'assertion';
  if (LOCATOR_RX.some((rx) => rx.test(line))) return 'locator';
  return null;
}

function runTests(cfg) {
  if (!cfg.testCommand) {
    return { skipped: true, pass: null, detail: 'testCommand is null in config — R3 not configured, reported as skipped (not failed)' };
  }
  log(`R3: ${cfg.testCommand}`);
  const r = spawnSync(cfg.testCommand, {
    shell: true,
    cwd: cfg._projectDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${r.stdout || ''}\n${r.stderr || ''}`;
  if (r.status === 0) {
    return { pass: true, exit: 0, detail: 'suite green' };
  }
  const samples = { locator: [], assertion: [] };
  let locator = 0;
  let assertion = 0;
  for (const line of output.split('\n')) {
    const kind = classifyLine(line);
    if (!kind) continue;
    if (kind === 'locator') locator++;
    else assertion++;
    if (samples[kind].length < 5) samples[kind].push(line.trim().slice(0, 300));
  }
  const unclassified = locator === 0 && assertion === 0;
  // Cowork R3: green OR every remaining failure is an assertion failure (product bug).
  const pass = !unclassified && locator === 0;
  return {
    pass,
    exit: r.status,
    classification: { locatorResolution: locator, assertion, unclassified },
    samples,
    detail: pass
      ? `suite red, but all ${assertion} classified failure signal(s) are assertion failures — file them as product bugs (BUG-NNN), do NOT edit expected values`
      : unclassified
        ? 'suite red with no classifiable failure lines — inspect manually (conservative fail)'
        : `${locator} locator-resolution failure signal(s) — harness repair needed, keep looping`,
    outputTail: output.slice(-3000),
  };
}

// ---- verdict ---------------------------------------------------------------

function hintsFor(criteria) {
  const hints = [];
  const c = criteria;
  if (c.R0 && !c.R0.skipped && !c.R0.pass) {
    hints.push('R0 ABORT: off-limits files changed — the fixer stepped outside its allowlist; stop the loop and escalate to the owner (see criteria.R0.violations).');
  }
  if (c.R2 && !c.R2.skipped && !c.R2.pass) {
    hints.push(`R2: ${c.R2.counts?.errors ?? '?'} banned/broken locator value(s) — remap per stability order (aria/role -> data-* -> semantic tag -> text), see criteria.R2.findings.`);
  }
  if (c.R4 && !c.R4.skipped && !c.R4.pass) {
    hints.push(`R4: ${c.R4.findings?.length ?? '?'} changed/added locator key(s) missing a LOCATORS.md Traps mention (old->new + why), see criteria.R4.findings.`);
  }
  if (c.R1 && !c.R1.skipped && !c.R1.pass) {
    hints.push(`R1: ${c.R1.stats?.fail ?? '?'} locator(s) did not resolve to exactly one element on the live stand, see criteria.R1.findings.`);
  }
  if (c.R3 && !c.R3.skipped && !c.R3.pass) {
    hints.push(`R3: ${c.R3.detail ?? 'suite failed'} (assertion failures = product bugs -> BUG-NNN; only locator-resolution failures are loop-fixable).`);
  }
  return hints;
}

function main() {
  const args = parseArgs();
  if (args.help) {
    log('Usage: node run-rubric.mjs --config <path> [--skip R1,R3] [--only R0,R2,R4]');
    process.exit(0);
  }
  const cfg = loadConfig(args);
  const ALL = ['R0', 'R1', 'R2', 'R3', 'R4'];
  const parseSet = (v) => new Set((v || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
  const skip = parseSet(args.skip);
  const only = parseSet(args.only);
  for (const id of only) {
    if (!ALL.includes(id)) {
      log(`run-rubric: unknown criterion in --only: ${id} (expected ${ALL.join(',')})`);
      process.exit(2);
    }
  }
  if (only.size) for (const id of ALL) if (!only.has(id)) skip.add(id);
  const skipMark = (id) => ({ skipped: true, pass: null, detail: `skipped via --skip/--only (${id}) — verdict is NOT final` });
  const criteria = {};

  // R0 first — a violation aborts everything else.
  if (!skip.has('R0')) log('R0: allowlist guard...');
  criteria.R0 = skip.has('R0') ? skipMark('R0') : runScript('allowlist-guard.mjs', cfg, ['--check']);
  const aborted = !criteria.R0.skipped && criteria.R0.pass !== true;

  if (aborted) {
    const notRun = { skipped: true, pass: null, detail: 'not run — R0 allowlist violation aborted the rubric' };
    criteria.R2 = notRun;
    criteria.R4 = notRun;
    criteria.R1 = notRun;
    criteria.R3 = notRun;
  } else {
    if (!skip.has('R2')) log('R2: stability lint...');
    criteria.R2 = skip.has('R2') ? skipMark('R2') : runScript('lint-locators.mjs', cfg);
    if (!skip.has('R4')) log('R4: traps check...');
    criteria.R4 = skip.has('R4') ? skipMark('R4') : runScript('check-traps.mjs', cfg);
    if (!skip.has('R1')) log('R1: live resolution...');
    criteria.R1 = skip.has('R1') ? skipMark('R1') : runScript('verify-locators.mjs', cfg);
    criteria.R3 = skip.has('R3') ? skipMark('R3') : runTests(cfg);
  }

  const evaluated = Object.values(criteria).filter((c) => !c.skipped);
  const pass = !aborted && evaluated.length > 0 && evaluated.every((c) => c.pass === true);
  // complete = the verdict may declare loop SUCCESS: nothing flag-skipped, no abort.
  // (R3 skipped because testCommand is null still counts as complete — by design.)
  const flagSkipped = [...skip].filter((s) => criteria[s]?.skipped);
  const complete = !aborted && flagSkipped.length === 0;

  const verdict = {
    rubric: 'self-healing-locators v1',
    ranAt: new Date().toISOString(),
    config: cfg._configPath,
    projectDir: cfg._projectDir,
    pass,
    complete,
    aborted,
    criteria,
    hints: hintsFor(criteria),
  };

  ensureDir(cfg._verdictsDir);
  const stamp = verdict.ranAt.replace(/[:.]/g, '-');
  const verdictPath = path.join(cfg._verdictsDir, `${stamp}.json`);
  fs.writeFileSync(verdictPath, JSON.stringify(verdict, null, 2) + '\n');
  verdict.verdictFile = verdictPath;

  log(`verdict: ${pass ? 'PASS' : aborted ? 'ABORT' : 'FAIL'}${complete ? '' : ' (non-final: skipped criteria)'} -> ${verdictPath}`);
  process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
  process.exit(pass ? 0 : 1);
}

try {
  main();
} catch (e) {
  log(`run-rubric error: ${e.message}`);
  process.stdout.write(JSON.stringify({ rubric: 'self-healing-locators v1', pass: false, error: e.message }, null, 2) + '\n');
  process.exit(2);
}
