#!/usr/bin/env node
// verify-locators.mjs — rubric criterion R1: every locator resolves to EXACTLY ONE
// element on the live page.
//
// Launches headless Chromium (Playwright), authenticates per config.auth (mode "api":
// POST the login endpoint through context.request so the cookies land in the browser
// context — the Creatio-style CRM pattern), then walks every top-level group of
// every locators/*.json, navigates to that group's page and counts each locator:
//   count === 1                      -> pass
//   count >= 1 && multiAllowed match -> pass
//   count === 0 / ambiguous / throws -> fail
// Template locators containing <placeholders> are substituted from config.samples or
// skipped-with-notice; "annotated" values (human prose mixed into the selector) are
// skipped-with-notice — they are documentation, not runnable selectors.
//
// SCOPE (documented gap): R1 live-checks the locators/*.json entries. Selectors that
// exist ONLY inside page-objects/*.ts are NOT live-checked (no reliable TS->page URL
// mapping); they are ban-checked by R2 and reported here as "unmapped" notices so the
// gap is visible in every verdict. Keep page-objects consuming values from
// locators/*.json (per UI_AUTOMATION_RULES.md) and the gap stays empty.
// A navigation failure on one group's page no longer kills the run — it is recorded
// as that group's fail finding and the remaining groups are still checked.
//
// Needs: the test stand reachable + valid creds + playwright installed (resolved from
// the project dir, the config dir, or the cwd). This script HITS THE LIVE STAND —
// authorized test/staging environments only.
//
// Usage: node verify-locators.mjs --config <path> [--only <sectionFile>] [--json] [--headed]
// Exit:  0 all resolvable locators pass, 1 failures (or nothing checked), 2 setup error.

import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import {
  parseArgs, loadConfig, readLocatorFiles, flattenLocatorMap, extractTsSelectors,
  emit, log, idMatches,
} from './lib.mjs';

const DEFAULT_READY = { _ListPage: 'crt-grid', NuiLogin: '#loginEdit-el' };

// CJS/ESM interop: a file-URL import of playwright's CJS entry may expose the API
// under `default` instead of as named exports — normalize both shapes.
const pwApi = (m) => (m && m.chromium ? m : m?.default);

async function loadPlaywright(cfg) {
  const bases = [cfg._projectDir, cfg._configDir, process.cwd()];
  for (const base of bases) {
    try {
      const req = createRequire(path.join(base, 'noop.js'));
      const resolved = req.resolve('playwright');
      const api = pwApi(await import(pathToFileURL(resolved).href));
      if (api) return api;
    } catch { /* try next base */ }
  }
  try {
    const api = pwApi(await import('playwright'));
    if (api) return api;
    throw new Error('playwright import resolved but exposes no chromium API');
  } catch {
    throw new Error(
      'playwright not found. Install it near the project or config: ' +
        '`npm i playwright && npx playwright install chromium` ' +
        `(searched: ${bases.join(', ')})`,
    );
  }
}

function joinUrl(base, u) {
  if (/^https?:/i.test(u)) return u;
  return String(base).replace(/\/+$/, '') + u;
}

function resolveGroupUrl(cfg, id, groupNode) {
  const overrides = cfg.urlOverrides || {};
  if (Object.prototype.hasOwnProperty.call(overrides, id)) {
    const v = overrides[id];
    return v == null
      ? { skip: `urlOverrides["${id}"] is null — group intentionally skipped` }
      : { url: v };
  }
  if (groupNode && typeof groupNode.url === 'string' && !groupNode.url.includes('<')) {
    return { url: groupNode.url };
  }
  return { skip: `no navigable URL — add urlOverrides["${id}"] to the config` };
}

function substitutePlaceholders(locator, samples = {}) {
  let out = locator;
  for (const [k, v] of Object.entries(samples)) {
    if (k.startsWith('$comment')) continue;
    out = out.split(k).join(v);
  }
  return { out, remaining: out.match(/<[^<>]+>/g) || [] };
}

function readySelectorFor(url, cfg) {
  const map = { ...DEFAULT_READY, ...(cfg.readySelectors || {}) };
  for (const [substr, sel] of Object.entries(map)) {
    if (substr.startsWith('$comment')) continue;
    if (url.includes(substr)) return sel;
  }
  return null;
}

async function settle(page, url, cfg, notices) {
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  const ready = readySelectorFor(url, cfg);
  if (ready) {
    await page
      .locator(ready).first()
      .waitFor({ state: 'visible', timeout: cfg.readyTimeoutMs ?? 60_000 })
      .catch(() => notices.push(`ready selector "${ready}" not visible on ${url}`));
  }
  await page.waitForTimeout(cfg.settleMs ?? 12_000); // Freedom UI paints late
}

async function apiLogin(ctx, cfg) {
  const a = cfg.auth || {};
  const resp = await ctx.request.post(joinUrl(cfg.baseUrl, a.url), {
    data: {
      [a.userField || 'UserName']: a.user,
      [a.passwordField || 'UserPassword']: a.password,
    },
  });
  const body = await resp.json().catch(() => ({}));
  const ok =
    resp.ok() && (a.successField ? body[a.successField] === a.successValue : true);
  if (!ok) {
    throw new Error(
      `auth failed: HTTP ${resp.status()} ${JSON.stringify(body).slice(0, 200)}`,
    );
  }
}

async function checkGroup(page, group, cfg, findings, notices) {
  const resolved = resolveGroupUrl(cfg, group.id, group.node);
  if (resolved.skip) {
    for (const e of group.entries) {
      findings.push({ ...entryRef(group, e), status: 'skipped', reason: resolved.skip });
    }
    return;
  }
  const url = joinUrl(cfg.baseUrl, resolved.url);
  log(`  ${group.id} -> ${url}`);
  try {
    // Freedom UI does NOT re-render a section on a hash-only URL change (Playwright
    // goto #Section/A -> #Section/B keeps the stale section; counts then measure the
    // WRONG page). Force a real render: after a same-path hash goto, reload.
    const prevUrl = page.url();
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: cfg.navTimeoutMs ?? 90_000,
    });
    if (prevUrl && prevUrl.split('#')[0] === url.split('#')[0] && prevUrl !== url) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: cfg.navTimeoutMs ?? 90_000 });
    }
    await settle(page, url, cfg, notices);
  } catch (err) {
    // One unreachable page must not kill the whole R1 run — fail THIS group, move on.
    findings.push({
      file: group.file,
      keyPath: `${group.group} (navigation)`,
      locator: url,
      status: 'fail',
      reason: `navigation failed: ${String(err.message).split('\n')[0]} — ${group.entries.length} entr(ies) of this group not checked`,
    });
    return;
  }

  for (const e of group.entries) {
    const ref = entryRef(group, e);
    if (e.classification === 'unclassified') {
      findings.push({ ...ref, status: 'skipped', reason: 'value did not classify as a runnable selector — ban-checked by R2 only' });
      continue;
    }
    if (e.classification === 'annotated') {
      findings.push({ ...ref, status: 'skipped', reason: 'annotated value (human note mixed into locator) — not a runnable selector' });
      continue;
    }
    if (e.classification === 'empty') {
      findings.push({ ...ref, status: 'fail', reason: 'empty locator value' });
      continue;
    }
    let selector = e.locator;
    if (e.classification === 'template') {
      const sub = substitutePlaceholders(e.locator, cfg.samples);
      if (sub.remaining.length) {
        findings.push({ ...ref, status: 'skipped', reason: `unresolved placeholders ${sub.remaining.join(', ')} — add them to config.samples` });
        continue;
      }
      selector = sub.out;
    }
    let count;
    try {
      count = await page.locator(selector).count();
    } catch (err) {
      findings.push({ ...ref, resolved: selector, status: 'fail', reason: `invalid selector: ${String(err.message).split('\n')[0]}` });
      continue;
    }
    const id = `${group.file}#${e.keyPath}`;
    const multiOk = (cfg.multiAllowed || []).some((p) => idMatches(p, id));
    if (count === 1 || (count >= 1 && multiOk)) {
      findings.push({ ...ref, resolved: selector, status: 'pass', count });
    } else if (count === 0) {
      findings.push({ ...ref, resolved: selector, status: 'fail', count, reason: 'no element matched' });
    } else {
      findings.push({ ...ref, resolved: selector, status: 'fail', count, reason: `ambiguous — ${count} elements matched (add to config.multiAllowed only if genuinely multi-element)` });
    }
  }
}

const entryRef = (group, e) => ({
  file: group.file,
  keyPath: e.keyPath,
  locator: e.locator,
});

async function main() {
  const args = parseArgs();
  if (args.help) {
    log('Usage: node verify-locators.mjs --config <path> [--only <sectionFile>] [--json] [--headed]');
    process.exit(0);
  }
  const cfg = loadConfig(args);
  const json = !!args.json;
  const notices = [];
  const findings = [];

  // Build groups: one navigable page per top-level key of each locators/*.json.
  const files = readLocatorFiles(cfg).filter((f) => !args.only || f.file === args.only);
  if (args.only && files.length === 0) {
    throw new Error(`--only ${args.only}: no such locator file in ${cfg._locatorsDir}`);
  }
  const groups = [];
  for (const { file, data } of files) {
    const byGroup = new Map();
    for (const [keyPath, info] of flattenLocatorMap(data)) {
      const g = keyPath.split('.')[0];
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push({ keyPath, ...info });
    }
    for (const [g, entries] of byGroup) {
      groups.push({ id: `${file}#${g}`, file, group: g, node: data[g], entries });
    }
  }

  const preIds = cfg.preAuthGroups || [];
  const pre = groups.filter((g) => preIds.includes(g.id));
  const post = groups.filter((g) => !preIds.includes(g.id));

  const pw = await loadPlaywright(cfg);
  const browser = await pw.chromium.launch({ headless: !args.headed });
  try {
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: cfg.ignoreHTTPSErrors !== false,
      viewport: cfg.viewport || { width: 1680, height: 950 },
    });
    const page = await ctx.newPage();
    page.on('pageerror', () => {});

    for (const g of pre) await checkGroup(page, g, cfg, findings, notices);

    const mode = cfg.auth?.mode || 'none';
    if (mode === 'api') {
      log('  auth: api login...');
      await apiLogin(ctx, cfg);
    } else if (mode !== 'none') {
      throw new Error(`auth.mode "${mode}" not supported by verify-locators (use "api" or "none")`);
    }

    for (const g of post) await checkGroup(page, g, cfg, findings, notices);
  } finally {
    await browser.close();
  }

  // TS-only selectors: visible-gap report (see SCOPE note in the header).
  const jsonValues = new Set(groups.flatMap((g) => g.entries.map((e) => e.locator)));
  const tsAll = extractTsSelectors(cfg);
  const tsUnmapped = tsAll.filter((t) => !jsonValues.has(t.selector));
  for (const t of tsUnmapped.slice(0, 50)) {
    notices.push(`TS-only selector NOT live-checked (unmapped): page-objects/${t.file}:${t.line} ${t.selector}`);
  }
  if (tsUnmapped.length > 50) notices.push(`...and ${tsUnmapped.length - 50} more unmapped TS selectors`);

  const stats = { pass: 0, fail: 0, skipped: 0 };
  for (const f of findings) stats[f.status === 'pass' ? 'pass' : f.status === 'fail' ? 'fail' : 'skipped']++;
  const checked = stats.pass + stats.fail;
  const result = {
    criterion: 'R1',
    pass: stats.fail === 0 && checked > 0,
    stats: { ...stats, checked, total: findings.length },
    tsSelectors: { total: tsAll.length, mappedToJson: tsAll.length - tsUnmapped.length, unmapped: tsUnmapped.length },
    notices,
    findings: findings.filter((f) => f.status !== 'pass'),
  };

  if (json) {
    emit(result, { json: true });
  } else {
    for (const f of result.findings) {
      log(`[${f.status}] ${f.file} :: ${f.keyPath}\n    ${f.locator}\n    ${f.reason || ''}`);
    }
    console.log(
      `R1 verify: ${result.pass ? 'PASS' : 'FAIL'} — ${stats.pass}/${checked} resolved to exactly one element, ` +
        `${stats.fail} failed, ${stats.skipped} skipped-with-notice`,
    );
  }
  process.exit(result.pass ? 0 : 1);
}

main().catch((e) => {
  log(`verify-locators error: ${e.message}`);
  const args = parseArgs();
  if (args.json) emit({ criterion: 'R1', pass: false, error: e.message }, { json: true });
  process.exit(2);
});
