#!/usr/bin/env node
// check-traps.mjs — rubric criterion R4: LOCATORS.md Traps updated for every changed locator.
//
// Two modes:
//   --snapshot          copy locators/*.json into <baselineDir>/locators/ + record
//                       SHA-256 checksums — run this ONCE at loop start (before the
//                       fixer's first iteration).
//   (default / --check) diff current locators/*.json against the baseline; every
//                       CHANGED or ADDED locator key must be mentioned in a GENUINE
//                       Traps section of LOCATORS.md (heading containing "пастк"/"trap"),
//                       by full keyPath or by the NEW selector text (documenting the
//                       old->new pair implies the new one is present). Old-value-alone
//                       mentions do NOT count — the doc naturally contains old selectors.
//                       No Traps heading while changes exist = FAIL, not a notice.
//                       Removed keys are reported as notices.
//
// Usage: node check-traps.mjs --config <path> [--snapshot] [--baseline <dir>] [--json]
// Exit:  0 pass / snapshot written, 1 findings or baseline missing, 2 usage/config error.

import fs from 'node:fs';
import path from 'node:path';
import {
  parseArgs, loadConfig, readLocatorFiles, flattenLocatorMap, listLocatorFiles,
  sha256File, ensureDir, emit, log,
} from './lib.mjs';

function snapshot(cfg, baselineDir, json) {
  const destDir = path.join(baselineDir, 'locators');
  ensureDir(destDir);
  const checksums = {};
  const files = listLocatorFiles(cfg._locatorsDir, cfg.skipFiles || []);
  for (const f of files) {
    const src = path.join(cfg._locatorsDir, f);
    fs.copyFileSync(src, path.join(destDir, f));
    checksums[f] = sha256File(src);
  }
  fs.writeFileSync(
    path.join(baselineDir, 'locators-checksums.json'),
    JSON.stringify({ createdAt: new Date().toISOString(), checksums }, null, 2) + '\n',
  );
  const result = { criterion: 'R4', mode: 'snapshot', pass: true, baselineDir, files };
  if (json) emit(result, { json: true });
  else console.log(`R4 baseline snapshot: ${files.length} file(s) -> ${destDir}`);
  return result;
}

// Locate a dedicated Traps section (heading containing "пастк"/"trap").
// Returns null when the doc has no such heading — the caller treats that as a FAIL
// when changes exist (searching the whole doc would false-pass: LOCATORS.md naturally
// contains the OLD selectors it documents).
function trapsText(mdPath) {
  const md = fs.readFileSync(mdPath, 'utf8');
  const lines = md.split('\n');
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s*(.*)/);
    if (m && /пастк|trap/i.test(m[2])) {
      start = i;
      level = m[1].length;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

// A change counts as documented ONLY via its full keyPath or its NEW selector text
// (an old->new pair mention necessarily contains the new selector). Old-value or
// bare-key-name matches are excluded — both occur naturally elsewhere in the doc
// and produced false PASSes.
function isMentioned(text, change) {
  if (change.keyPath && text.includes(change.keyPath)) return true;
  if (change.new && text.includes(change.new)) return true;
  return false;
}

function check(cfg, baselineDir, json) {
  const baselineLocDir = path.join(baselineDir, 'locators');
  if (!fs.existsSync(baselineLocDir)) {
    const result = {
      criterion: 'R4',
      pass: false,
      error: `baseline missing: ${baselineLocDir}`,
      hint: 'run `node check-traps.mjs --config <cfg> --snapshot` at loop start, BEFORE the first fixer iteration',
    };
    if (json) emit(result, { json: true });
    else log(`R4: FAIL — ${result.error}\n    ${result.hint}`);
    return result;
  }

  const flatten = (dir) => {
    const maps = new Map(); // file -> Map(keyPath -> locator)
    for (const { file, data } of readLocatorFiles(cfg, dir)) {
      const m = new Map();
      for (const [keyPath, info] of flattenLocatorMap(data)) m.set(keyPath, info.locator);
      maps.set(file, m);
    }
    return maps;
  };
  const before = flatten(baselineLocDir);
  const after = flatten(cfg._locatorsDir);

  const changed = [];
  const added = [];
  const removed = [];
  const allFiles = new Set([...before.keys(), ...after.keys()]);
  for (const file of allFiles) {
    const b = before.get(file) || new Map();
    const a = after.get(file) || new Map();
    for (const [keyPath, loc] of a) {
      if (!b.has(keyPath)) added.push({ file, keyPath, new: loc });
      else if (b.get(keyPath) !== loc) changed.push({ file, keyPath, old: b.get(keyPath), new: loc });
    }
    for (const [keyPath, loc] of b) {
      if (!a.has(keyPath)) removed.push({ file, keyPath, old: loc });
    }
  }

  const notices = [];
  const findings = [];
  let traps = null;
  if (changed.length || added.length) {
    if (!fs.existsSync(cfg._locatorsDoc)) {
      findings.push({
        kind: 'doc-missing',
        reason: `locators doc not found: ${cfg._locatorsDoc} — every changed locator must be documented`,
      });
    } else {
      traps = trapsText(cfg._locatorsDoc);
      if (traps === null) {
        findings.push({
          kind: 'traps-section-missing',
          reason:
            `no Traps heading (containing "пастк"/"trap") in ${path.basename(cfg._locatorsDoc)} while ` +
            `${changed.length + added.length} locator change(s) exist — add a "## Пастки (Traps)" section ` +
            'and document each old->new pair + WHY it moved',
        });
      }
    }
  }
  for (const change of [...changed, ...added]) {
    const mentioned = traps ? isMentioned(traps, change) : false;
    if (!mentioned) {
      findings.push({
        ...change,
        kind: change.old !== undefined ? 'changed' : 'added',
        reason: 'not mentioned in the LOCATORS.md Traps section (document the full keyPath or the old->new selector pair + WHY it moved)',
      });
    }
  }
  for (const r of removed) {
    notices.push(`removed key ${r.file}#${r.keyPath} — make sure no page-object still uses it`);
  }

  const result = {
    criterion: 'R4',
    pass: findings.length === 0,
    changes: { changed: changed.length, added: added.length, removed: removed.length },
    findings,
    notices,
  };
  if (json) {
    emit(result, { json: true });
  } else {
    for (const f of findings) {
      const head = f.file ? `${f.kind} ${f.file} :: ${f.keyPath}` : f.kind;
      const sel = f.new ? `\n    ${f.old ? `${f.old}  ->  ` : ''}${f.new}` : '';
      log(`[fail] ${head}${sel}\n    ${f.reason}`);
    }
    for (const n of notices) log(`[notice] ${n}`);
    console.log(
      `R4 traps: ${result.pass ? 'PASS' : 'FAIL'} — ${changed.length} changed / ${added.length} added / ` +
        `${removed.length} removed locator key(s), ${findings.length} missing Traps mention(s)`,
    );
  }
  return result;
}

try {
  const args = parseArgs();
  if (args.help) {
    log('Usage: node check-traps.mjs --config <path> [--snapshot] [--baseline <dir>] [--json]');
    process.exit(0);
  }
  const cfg = loadConfig(args);
  const baselineDir = args.baseline ? path.resolve(args.baseline) : cfg._baselineDir;
  const result = args.snapshot
    ? snapshot(cfg, baselineDir, !!args.json)
    : check(cfg, baselineDir, !!args.json);
  process.exit(result.pass ? 0 : 1);
} catch (e) {
  log(`check-traps error: ${e.message}`);
  process.exit(2);
}
