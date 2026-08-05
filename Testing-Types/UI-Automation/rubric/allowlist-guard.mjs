#!/usr/bin/env node
// allowlist-guard.mjs — rubric criterion R0: the fixer never touches off-limits files.
//
// DEFAULT-DENY: everything under projectDir is guarded EXCEPT files matching
// config.allowlist (default: locators/*.json, page-objects/*.ts, LOCATORS.md) and the
// rubric's own output dirs (baselineDir, verdictsDir). config.offLimits globs are extra
// EXPLICIT protection — a file matching both allowlist and offLimits is still guarded.
// The guard records a SHA-256 manifest of guarded files at loop start and re-verifies
// it between iterations. ANY difference — changed, deleted, or NEW file (including a
// file the fixer creates anywhere outside the allowlist) — is the mechanical abort
// trigger: the outer loop must STOP the loop and escalate.
//
//   --snapshot   record <baselineDir>/allowlist-manifest.json (run ONCE at loop start)
//   --check      re-hash and fail on any difference, printing which files moved
//
// Usage: node allowlist-guard.mjs --config <path> (--snapshot | --check) [--json]
// Exit:  0 clean / snapshot written, 1 violations or manifest missing, 2 usage error.

import fs from 'node:fs';
import path from 'node:path';
import {
  parseArgs, loadConfig, walkFiles, matchesGlobs, sha256File, ensureDir, emit, log,
} from './lib.mjs';

export const DEFAULT_ALLOWLIST = ['locators/*.json', 'page-objects/*.ts', 'LOCATORS.md'];

function collectGuarded(cfg) {
  const allow = cfg.allowlist || DEFAULT_ALLOWLIST;
  const explicit = cfg.offLimits || [];
  // Never guard the rubric's/loop's own outputs — they legitimately change every
  // iteration: baselines, verdicts, and the loop artifacts dir (iteration logs,
  // summaries — written by the OUTER loop, still not by the fixer).
  const exclude = [
    cfg._baselineDir,
    cfg._verdictsDir,
    path.resolve(cfg._projectDir, cfg.loopsDir || 'loops'),
  ];
  return walkFiles(cfg._projectDir, { exclude })
    .map((abs) => path.relative(cfg._projectDir, abs))
    .filter((rel) => matchesGlobs(rel, explicit) || !matchesGlobs(rel, allow))
    .sort();
}

function manifestPath(baselineDir) {
  return path.join(baselineDir, 'allowlist-manifest.json');
}

function snapshot(cfg, baselineDir, json) {
  const rels = collectGuarded(cfg);
  const files = {};
  for (const rel of rels) files[rel] = sha256File(path.join(cfg._projectDir, rel));
  ensureDir(baselineDir);
  fs.writeFileSync(
    manifestPath(baselineDir),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        allowlist: cfg.allowlist || DEFAULT_ALLOWLIST,
        offLimits: cfg.offLimits || [],
        files,
      },
      null,
      2,
    ) + '\n',
  );
  const result = {
    criterion: 'R0', mode: 'snapshot', pass: true,
    manifest: manifestPath(baselineDir), fileCount: rels.length,
    warning: rels.length === 0
      ? 'no guarded files found under projectDir — the guard protects NOTHING; check projectDir and config.allowlist'
      : undefined,
  };
  if (json) emit(result, { json: true });
  else console.log(`R0 manifest: ${rels.length} guarded file(s) hashed -> ${result.manifest}${result.warning ? `\nWARNING: ${result.warning}` : ''}`);
  return result;
}

function check(cfg, baselineDir, json) {
  const mp = manifestPath(baselineDir);
  if (!fs.existsSync(mp)) {
    const result = {
      criterion: 'R0', pass: false,
      error: `allowlist manifest missing: ${mp}`,
      hint: 'run `node allowlist-guard.mjs --config <cfg> --snapshot` at loop start, BEFORE the first fixer iteration',
    };
    if (json) emit(result, { json: true });
    else log(`R0: FAIL — ${result.error}\n    ${result.hint}`);
    return result;
  }
  const manifest = JSON.parse(fs.readFileSync(mp, 'utf8'));
  const currentRels = collectGuarded(cfg);
  const current = {};
  for (const rel of currentRels) current[rel] = sha256File(path.join(cfg._projectDir, rel));

  const changed = [];
  const deleted = [];
  const addedFiles = [];
  for (const [rel, hash] of Object.entries(manifest.files)) {
    if (!(rel in current)) deleted.push(rel);
    else if (current[rel] !== hash) changed.push(rel);
  }
  for (const rel of Object.keys(current)) {
    if (!(rel in manifest.files)) addedFiles.push(rel);
  }

  const violations = [...changed, ...deleted, ...addedFiles];
  const result = {
    criterion: 'R0',
    pass: violations.length === 0,
    checked: Object.keys(manifest.files).length,
    violations: { changed, deleted, added: addedFiles },
    abort: violations.length > 0
      ? 'OUT-OF-ALLOWLIST CHANGE — abort the loop immediately and escalate to the owner'
      : undefined,
  };
  if (json) {
    emit(result, { json: true });
  } else {
    for (const f of changed) log(`[CHANGED] ${f}`);
    for (const f of deleted) log(`[DELETED] ${f}`);
    for (const f of addedFiles) log(`[ADDED]   ${f}`);
    console.log(
      `R0 allowlist guard: ${result.pass ? 'PASS' : 'FAIL (ABORT LOOP)'} — ` +
        `${result.checked} guarded file(s) checked, ${violations.length} violation(s)`,
    );
  }
  return result;
}

try {
  const args = parseArgs();
  if (args.help || (!args.snapshot && !args.check)) {
    log('Usage: node allowlist-guard.mjs --config <path> (--snapshot | --check) [--json]');
    process.exit(args.help ? 0 : 2);
  }
  const cfg = loadConfig(args);
  const baselineDir = args.baseline ? path.resolve(args.baseline) : cfg._baselineDir;
  const result = args.snapshot ? snapshot(cfg, baselineDir, !!args.json) : check(cfg, baselineDir, !!args.json);
  process.exit(result.pass ? 0 : 1);
} catch (e) {
  log(`allowlist-guard error: ${e.message}`);
  process.exit(2);
}
