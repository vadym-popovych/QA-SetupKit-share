#!/usr/bin/env node
// lint-locators.mjs — rubric criterion R2: no locator violates the stability order.
//
// Walks every locator value in locators/*.json (plus quoted selectors extracted from
// page-objects/*.ts) and rejects the banned patterns from UI_AUTOMATION_RULES.md:
//   - auto-generated Angular Material ids   (mat-input-N)
//   - GUID ids                              (#xxxxxxxx-xxxx-...)
//   - Angular framework classes             (_ngcontent-*, ng-tns-*)
//   - absolute nth-child chains from the document root
// Also flags empty locator values (error) and duplicate locator values within one
// file (warning by default; escalate with --strict-dup).
//
// Usage: node lint-locators.mjs --config <path> [--json] [--strict-dup]
// Exit:  0 clean, 1 findings, 2 usage/config error.
// --json prints {pass, findings:[{file, key, locator, rule, severity}], counts, scanned}.

import {
  parseArgs, loadConfig, extractLocatorEntries, extractTsSelectors, emit, log,
} from './lib.mjs';

const BANNED = [
  {
    rule: 'auto-generated-material-id',
    why: 'Angular Material auto-ids (mat-input-N) change on every render/deploy',
    test: (s) => /mat-input-\d+/.test(s),
  },
  {
    rule: 'guid-id',
    why: 'GUID ids are per-record / per-deploy artefacts',
    test: (s) => /^#?[0-9a-f]{8}-[0-9a-f]{4}/i.test(s) || /#[0-9a-f]{8}-[0-9a-f]{4}/i.test(s),
  },
  {
    rule: 'ngcontent-class',
    why: '_ngcontent-* attributes are Angular view-encapsulation internals',
    test: (s) => /_ngcontent-/.test(s),
  },
  {
    rule: 'ng-tns-class',
    why: 'ng-tns-* classes are Angular-generated and unstable',
    test: (s) => /ng-tns-/.test(s),
  },
  {
    rule: 'absolute-nth-child-chain',
    why: 'absolute structural paths from the document root break on any layout change',
    test: (s) =>
      /^\s*html\s*>?\s*body/i.test(s) || (s.match(/:nth-child\(/g) || []).length >= 3,
  },
  {
    rule: 'guid-in-selector',
    severity: 'warn',
    why: 'a full GUID anywhere in a selector (e.g. data-* attribute value) is a per-record artefact',
    test: (s) =>
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(s) &&
      !/^#?[0-9a-f]{8}-[0-9a-f]{4}/i.test(s) && !/#[0-9a-f]{8}-[0-9a-f]{4}/i.test(s),
  },
];

function main() {
  const args = parseArgs();
  if (args.help) {
    log('Usage: node lint-locators.mjs --config <path> [--json] [--strict-dup]');
    process.exit(0);
  }
  const cfg = loadConfig(args);
  const json = !!args.json;
  const findings = [];

  // --- locators/*.json entries ---
  const entries = extractLocatorEntries(cfg);
  for (const e of entries) {
    if (e.classification === 'empty') {
      findings.push({
        file: `locators/${e.file}`, key: e.keyPath, locator: e.locator,
        rule: 'empty-locator', severity: 'error',
      });
      continue;
    }
    for (const b of BANNED) {
      if (b.test(e.locator)) {
        findings.push({
          file: `locators/${e.file}`, key: e.keyPath, locator: e.locator,
          rule: b.rule, severity: b.severity || 'error', why: b.why,
        });
      }
    }
  }

  // Duplicates within one top-level GROUP (identical plain-selector values under
  // different keys). Cross-group duplicates are legitimate — groups are scoped by
  // navigation (e.g. addMiniPage vs formPage sharing an aria-label selector).
  const dupSeverity = args['strict-dup'] ? 'error' : 'warn';
  const byGroup = new Map();
  for (const e of entries) {
    if (e.classification !== 'selector') continue;
    const groupId = `${e.file}::${e.group}`;
    const bucket = byGroup.get(groupId) || new Map();
    byGroup.set(groupId, bucket);
    const keys = bucket.get(e.locator) || [];
    keys.push(e.keyPath);
    bucket.set(e.locator, keys);
  }
  for (const [groupId, bucket] of byGroup) {
    const file = groupId.split('::')[0];
    for (const [locator, keys] of bucket) {
      if (keys.length > 1) {
        findings.push({
          file: `locators/${file}`, key: keys.join(' + '), locator,
          rule: 'duplicate-locator', severity: dupSeverity,
        });
      }
    }
  }

  // --- page-objects/*.ts quoted selectors (ban-check only) ---
  const tsSelectors = extractTsSelectors(cfg);
  for (const s of tsSelectors) {
    for (const b of BANNED) {
      if (b.test(s.selector)) {
        findings.push({
          file: `page-objects/${s.file}`, key: `line ${s.line}`, locator: s.selector,
          rule: b.rule, severity: 'error', why: b.why,
        });
      }
    }
  }

  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.length - errors;
  const result = {
    criterion: 'R2',
    pass: errors === 0,
    findings,
    counts: { errors, warnings },
    scanned: { jsonEntries: entries.length, tsSelectors: tsSelectors.length },
  };

  if (json) {
    emit(result, { json: true });
  } else {
    for (const f of findings) {
      log(`[${f.severity}] ${f.rule}  ${f.file} :: ${f.key}\n    ${f.locator}`);
    }
    console.log(
      `R2 lint: ${result.pass ? 'PASS' : 'FAIL'} — ${entries.length} JSON entries + ` +
        `${tsSelectors.length} TS selectors scanned, ${errors} error(s), ${warnings} warning(s)`,
    );
  }
  process.exit(result.pass ? 0 : 1);
}

try {
  main();
} catch (e) {
  log(`lint-locators error: ${e.message}`);
  process.exit(2);
}
