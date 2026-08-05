#!/usr/bin/env node
// psi-run.mjs — collect ONE ROUND of the PageSpeed report. Zero dependencies (global fetch).
// Copy to <Project>/QA-Reports/pagespeed/tools/ (or wherever the round lives) together with
// pages.json, and run it once per round.
//
//   node psi-run.mjs --round r6 --env production --label "Points from 05/06/2026 (Prod)"
//   node psi-run.mjs --round r7 --env staging --label "Points from 01/07/2026 (Stage)" \
//                    --pages ./pages.json --out-dir ./rounds --runs 3
//   node psi-run.mjs --round r8 --env local --label "Points 08/07 (local LH)" --engine lighthouse
//   node psi-run.mjs --self-check      # offline unit-check of the parse/median/status logic
//
// FLAGS  (an UNKNOWN flag is REFUSED, never ignored: "--run 5" is not "--runs 5", and a round that
//         silently ran at the inventory default while you believed you had overridden it is a lie
//         about how its numbers were made.)
//   --round <id>        REQUIRED. Slug: [a-z0-9-]. Becomes <out-dir>/<id>.json and the block key.
//   --env <e>           REQUIRED. staging | production | local | other. Part of the IDENTITY of
//                       every number in the round: a staging score and a production score are not
//                       comparable, and calling their difference a regression is a category error.
//   --label "<text>"    REQUIRED. The Sheet block header, verbatim: "Points from 05/06/2026 (Prod)".
//   --date <YYYY-MM-DD> Defaults to today.
//   --pages <path>      Page inventory. Default: $PSI_PAGES, else ./pages.json. See pages.example.json.
//   --out-dir <dir>     Default: $ROUNDS_DIR, else ./rounds.
//   --engine psi|lighthouse   Default psi (the PageSpeed Insights API). `lighthouse` shells out to
//                       the LOCAL Lighthouse CLI (npx lighthouse). One round = ONE engine: local
//                       Lighthouse numbers depend on your laptop and are NOT comparable with PSI
//                       numbers, so mixing them inside a round is refused.
//   --runs <n>          Override runsPerPage from pages.json. 3 is the floor (see below). Part of the
//                       IDENTITY of a round: re-collecting an EXISTING round with a different --runs
//                       is refused (a median of 3 loads and a median of 1 load are different
//                       measurements — use a NEW --round id), exactly like changing --engine.
//   --throttle-ms <n>   Pause between requests. Default 1500.
//   --schemas <path>    Path to QA-SetupKit/Rules-Guide/schemas/validate.mjs. Also $QA_SCHEMAS_VALIDATOR.
//                       If it cannot be found, the tool REFUSES to ship the round (exit 3).
//   --self-check        Offline: runs the parser over a recorded PSI response fixture and the
//                       median/status logic over synthetic run sets, prints PASS/FAIL per case,
//                       exits 1 on any failure. No network, no key. This is the only way to prove
//                       the maths without burning API quota.
//
// THE API KEY (PSI engine only)
//   Without a key the PSI API currently answers HTTP 429 "Quota exceeded … 'Queries per day' …
//   for consumer project_number" — the anonymous shared quota is exhausted, so a key is REQUIRED,
//   not optional. Free: Google Cloud Console → enable "PageSpeed Insights API" → create an API key.
//   Resolution order: $PSI_API_KEY → the file named by $PSI_API_KEY_FILE → the documented default
//   MCP-configurations/pagespeed/.token (searched upwards from here and from the cwd; gitignored).
//   Missing → exit 2 with that instruction. The key is NEVER printed, not even inside a failing URL.
//
// WHAT THIS TOOL WILL NOT DO (the honesty contract — see PAGESPEED_REPORT_RULES.md)
//   · A PageSpeed score is a LAB metric from a single load, and one load is noise. Every page ×
//     platform is measured runsPerPage times (default 3); the cell gets the MEDIAN and every
//     individual run is kept in `runs`. The median run's metrics are the ones recorded — pairing a
//     median score with another run's LCP would describe a load that never happened.
//   · Fewer successful runs than the target ⇒ status "not-run" (EMPTY cell), never a partial green
//     number. Zero successful runs ⇒ status "error" with the failure text. NEVER 0 — 0 is a real
//     score that a real page can really get, so it can never mean "we didn't measure".
//   · It writes no verdict. It is a REPORTER: it exits 0 when it honestly recorded what happened,
//     including errors. Pass/fail needs owner-approved `budgets`, and that is a human's call.
//   · When a comment is MANDATORY (score < 50 · run count below target · n-a · error) but only a
//     human can write it, the tool writes a `NEEDS-COMMENT: …` placeholder. That string is a DEMAND,
//     not an explanation — a round still carrying one is not publishable.
//   · Existing "n-a" results in the round file are PRESERVED and not re-measured: "n-a" is an owner
//     statement that the page does not exist there, and the tool has no standing to overrule it.
//   · RE-COLLECTING AN EXISTING ROUND IS A MERGE, NOT AN OVERWRITE. Re-running a round is the normal
//     retry path (a page 429'd), and by then a human has usually written the comments the round needs
//     to be publishable at all. So the tool merges by (page id, platform): every HUMAN-written comment
//     is carried over, and only the collector's own "NEEDS-COMMENT:" placeholders are replaced. When
//     the measurement under a carried-over comment CHANGED (different score, or a score that is now
//     gone), the tool WARNS loudly: the comment may now describe a load that no longer happens, and a
//     stale explanation attached to a fresh number is a quiet lie. It is still carried (nobody's words
//     are silently deleted) — but you are told, by cell, to re-read it before publishing.
//   · An EXISTING round file that is not valid JSON is a REFUSAL, not an absence: overwriting it would
//     destroy the owner's "n-a" results and every human comment in it, and would bypass the
//     one-round-one-engine / one-round-one-runsPerPage checks that read it. Fix or move it.
//   · The round is schema-validated before it is shipped. If it does not validate, the file is
//     DELETED and the tool exits non-zero — an unvalidated artefact must never be mistaken for data.
//     (Same rule as CI-Integration's ci-run-result.mjs.)
//   · source.lighthouseVersion + source.runsPerPage travel with every round: they are what makes two
//     rounds COMPARABLE. Lighthouse re-weights its scoring between major versions, so a score jump
//     across versions is a TOOL change, not a product change — psi-sheet.mjs refuses to call such a
//     difference a delta, and it can only do that if the version is recorded.
//
// EXIT CODES: 0 = the round was collected and validated (errors inside it are reported honestly)
//             2 = usage / config / missing key — nothing was written
//             3 = the round could not be validated or written → deleted, not shipped
//             1 = --self-check found a defect in the logic

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const die = (msg, code = 2) => { console.error(`psi-run: ${msg}`); process.exit(code); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- CLI ----------
// A flag this tool does not know is a flag the USER thinks it knows. Storing it and running anyway is
// how "--run 5" (a typo for "--runs 5") produces a round at the inventory's default run count while
// its author believes it stands on 5 loads. Unknown flag ⇒ REFUSE, and say what the known ones are.
export const BOOL_FLAGS = new Set(['self-check', 'help', 'no-lhr']);
export const VALUE_FLAGS = new Set(['round', 'env', 'label', 'date', 'pages', 'out-dir', 'engine', 'runs', 'throttle-ms', 'schemas']);
export const KNOWN_FLAGS = [...VALUE_FLAGS, ...BOOL_FLAGS];

// Throws (never exits) so the guard is unit-testable; main() turns the throw into exit 2.
export function parseArgs(argv) {
  const opts = {};
  const known = () => `known flags: ${KNOWN_FLAGS.map((f) => `--${f}`).join(' ')}`;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument "${a}" (all options are --flags) — ${known()}`);
    let name = a.slice(2);
    let inline;
    const eq = name.indexOf('=');
    if (eq !== -1) { inline = name.slice(eq + 1); name = name.slice(0, eq); }
    if (!KNOWN_FLAGS.includes(name)) {
      throw new Error(`unknown flag "--${name}" — REFUSING to run.\n`
        + '  An unrecognised flag is not a harmless typo: it would be accepted, ignored, and the round\n'
        + '  would quietly run at some other setting than the one you asked for ("--run 5" is not\n'
        + `  "--runs 5"). A number is only evidence if you know how it was made.\n  ${known()}`);
    }
    if (BOOL_FLAGS.has(name)) {
      if (inline !== undefined) throw new Error(`--${name} is a switch and takes no value (got "--${name}=${inline}")`);
      opts[name] = true;
      continue;
    }
    const v = inline !== undefined ? inline : argv[i + 1];
    if (v === undefined || (inline === undefined && v.startsWith('--'))) throw new Error(`--${name} requires a value`);
    opts[name] = v;
    if (inline === undefined) i++;
  }
  return opts;
}

const ENVS = ['staging', 'production', 'local', 'other'];
const PLATFORMS = ['desktop', 'mobile'];
const RUNS_FLOOR = 3;   // below this, a "score" is noise with a decimal point

// ---------- PSI / Lighthouse response parsing (shared by both engines) ----------
// `lhr` is the Lighthouse Result object: PSI puts it under `lighthouseResult`, the Lighthouse CLI
// prints it at the top level. Returns { ok, score, metrics, lighthouseVersion } or { ok:false, error }.
export function parseLighthouseResult(lhr) {
  if (!lhr || typeof lhr !== 'object') return { ok: false, error: 'no lighthouseResult in the response' };
  if (lhr.runtimeError && lhr.runtimeError.code) {
    // The page did not load / did not return 200 / redirected away. NOT a zero — a failure.
    return { ok: false, error: `lighthouseResult.runtimeError: ${lhr.runtimeError.code} — ${lhr.runtimeError.message || ''}`.trim() };
  }
  const raw = lhr.categories?.performance?.score;
  if (typeof raw !== 'number') return { ok: false, error: 'no categories.performance.score in the response (Lighthouse could not score this load)' };
  const audit = (id) => lhr.audits?.[id]?.numericValue;
  const ms = (v) => (typeof v === 'number' ? Math.round(v) : undefined);
  const metrics = {
    lcpMs: ms(audit('largest-contentful-paint')),
    tbtMs: ms(audit('total-blocking-time')),
    cls: typeof audit('cumulative-layout-shift') === 'number' ? Math.round(audit('cumulative-layout-shift') * 1000) / 1000 : undefined,
    fcpMs: ms(audit('first-contentful-paint')),
    speedIndexMs: ms(audit('speed-index')),
  };
  for (const k of Object.keys(metrics)) if (metrics[k] === undefined) delete metrics[k];
  return {
    ok: true,
    score: Math.round(raw * 100),            // 0..1 → 0..100. 0 stays 0: it is a real score.
    metrics,
    lighthouseVersion: typeof lhr.lighthouseVersion === 'string' ? lhr.lighthouseVersion : undefined,
  };
}

// CrUX field data. ABSENT ≠ ZERO: no sample means Google has no data, and we record nothing.
export function parseField(body) {
  const le = body?.loadingExperience;
  const m = le?.metrics;
  if (!m || typeof m !== 'object' || !Object.keys(m).length) return undefined;
  const out = { source: le.origin_fallback === true ? 'crux-origin' : 'crux-url' };
  const p = (k) => (typeof m[k]?.percentile === 'number' ? m[k].percentile : undefined);
  if (p('LARGEST_CONTENTFUL_PAINT_MS') !== undefined) out.lcpMs = p('LARGEST_CONTENTFUL_PAINT_MS');
  if (p('INTERACTION_TO_NEXT_PAINT') !== undefined) out.inpMs = p('INTERACTION_TO_NEXT_PAINT');
  // CrUX reports CLS x100 as an integer (12 = 0.12).
  if (p('CUMULATIVE_LAYOUT_SHIFT_SCORE') !== undefined) out.cls = Math.round(p('CUMULATIVE_LAYOUT_SHIFT_SCORE')) / 100;
  return Object.keys(out).length > 1 ? out : undefined;
}

// ---------- median + status: the two decisions that make a number honest ----------
// The MEDIAN run is a REAL run, never a synthetic average: the score and the metrics must describe
// the same load. With an even number of runs we take the LOWER middle run — pessimistic on purpose.
export function medianRun(okRuns) {
  const sorted = [...okRuns].sort((a, b) => a.score - b.score);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

// okRuns: [{score, metrics, field?, lighthouseVersion?, collectedAt}] in COLLECTION order.
// failures: [string]. target: runsPerPage.
export function buildResult(platform, okRuns, failures, target) {
  if (okRuns.length === 0) {
    return {
      platform,
      status: 'error',
      comment: `NEEDS-COMMENT: all ${failures.length} attempt(s) failed — the page was never measured. Not a 0 and not an empty pass: the round is incomplete until this is re-collected.`,
      error: failures[failures.length - 1] || 'unknown failure',
    };
  }
  if (okRuns.length < target) {
    // A partial number is the most tempting lie in this whole doc type: it LOOKS like data.
    return {
      platform,
      status: 'not-run',
      runs: okRuns.map((r) => r.score),
      comment: `NEEDS-COMMENT: only ${okRuns.length} of ${target} target runs succeeded, so there is NO score this round and the cell stays EMPTY — a median of ${okRuns.length} run(s) is noise, not a measurement. Re-collect.`,
      ...(failures.length ? { error: failures[failures.length - 1] } : {}),
    };
  }
  const med = medianRun(okRuns);
  const spread = Math.max(...okRuns.map((r) => r.score)) - Math.min(...okRuns.map((r) => r.score));
  const notes = [];
  if (med.score < 50) {
    notes.push(`score ${med.score} < 50 — a comment is MANDATORY: name what is slow (LCP ${med.metrics.lcpMs ?? '?'} ms · TBT ${med.metrics.tbtMs ?? '?'} ms · CLS ${med.metrics.cls ?? '?'}) and treat it as a bug CANDIDATE (tag PERFORMANCE), reproduced in a second round before filing.`);
  }
  if (spread >= 10) {
    notes.push(`runs spread ${spread} points (${okRuns.map((r) => r.score).join('/')}) — this page is UNSTABLE; the median is a summary of noise, not a stable number.`);
  }
  return {
    platform,
    status: 'measured',
    score: med.score,
    runs: okRuns.map((r) => r.score),
    metrics: med.metrics,
    ...(med.field ? { field: med.field } : {}),
    ...(notes.length ? { comment: `NEEDS-COMMENT: ${notes.join(' ')}` } : {}),
    collectedAt: med.collectedAt,
  };
}

// ---------- the URL of a page: ONE resolution rule, shared with psi-sheet.mjs ----------
// `new URL(path, base)` — not string concatenation. The two disagree exactly where it matters:
// base "https://x.dev/app/" + path "/pricing" is "https://x.dev/pricing" (absolute path, the base's
// directory is dropped), while gluing the strings gives "https://x.dev/app/pricing". If the collector
// and the publisher glue differently, the Sheet hyperlinks a page that was never measured.
export function buildPageUrl(pagePath, baseUrl) {
  return new URL(pagePath, baseUrl).href;
}

// ---------- re-collecting a round is a MERGE, not an overwrite ----------
// The workflow REQUIRES humans to write comments into the round JSON (psi-sheet refuses to publish
// while a NEEDS-COMMENT placeholder survives), and re-running a round is the NORMAL retry path after
// a 429. A wholesale rewrite therefore destroys exactly the work the round cannot ship without.
export function isPlaceholderComment(c) {
  return typeof c === 'string' && /^\s*NEEDS-COMMENT\b/.test(c);
}

// fresh: the result just measured. prev: the result for the same (page id, platform) in the existing
// round file, if any. Returns { result, carried, warning }.
//   · A human comment (anything that is not the collector's own placeholder) is CARRIED OVER.
//   · A placeholder is NOT carried: it is a demand, and a demand does not answer itself.
//   · If the measurement under a carried-over comment CHANGED, the comment may now be STALE — the
//     tool says so, by cell. It does not delete the human's words to protect them from being wrong.
export function mergeResult(fresh, prev) {
  const human = prev && typeof prev.comment === 'string' && prev.comment.trim() && !isPlaceholderComment(prev.comment)
    ? prev.comment : null;
  const changed = prev ? (prev.score !== fresh.score || prev.status !== fresh.status) : true;

  // The stored `evidence` is the rendered median-run report the Sheet links to. It still describes THIS
  // cell's number only while the number is UNCHANGED — so a re-collection that reproduced the same result
  // CARRIES it, rather than orphaning every published report and forcing a full re-render + re-upload of
  // numbers that never moved. When the measurement changed, the old report is of a different load: drop it
  // (evidence is undefined here), and psi-report re-renders the fresh median.
  const evidence = prev && prev.evidence && !changed ? prev.evidence : undefined;
  const withEvidence = (r) => (evidence ? { ...r, evidence } : r);

  if (!human) return { result: withEvidence(fresh), carried: false, warning: null };

  const result = withEvidence({ ...fresh, comment: human });
  if (!changed) return { result, carried: true, warning: null };

  const show = (r) => (r.status === 'measured' ? String(r.score) : `no score (${r.status})`);
  const displaced = isPlaceholderComment(fresh.comment)
    ? ` This round wanted to demand a NEW comment — "${fresh.comment.trim().replace(/\s+/g, ' ').slice(0, 120)}…" — and your carried-over comment silenced that demand.`
    : '';
  return {
    result,
    carried: true,
    warning: `the human comment was carried over, but the measurement CHANGED: ${show(prev)} → ${show(fresh)}.`
      + ` The comment may now be STALE — it can describe a load that no longer happens.${displaced}`
      + ' Re-read it before publishing.',
  };
}

// ---------- what makes two rounds comparable, recorded WITH the numbers ----------
// Lighthouse re-weights its scoring between major versions: a score that "improved" 8 points across a
// version bump improved nothing. psi-sheet.mjs refuses to call a cross-version difference a delta —
// which it can only do if the version is in the file. `runsPerPage` is the same kind of fact: a median
// of 3 loads and a median of 1 load are not the same measurement.
export function buildSource({ tool, versions = [], runsPerPage, strategyProfiles, collectedAt, measured = 0 }) {
  const seen = [...new Set(versions.filter((v) => typeof v === 'string' && v))];
  const warnings = [];
  if (seen.length > 1) {
    warnings.push(`the responses in this round carry MORE THAN ONE Lighthouse version (${seen.join(', ')}).`
      + ` Recording "${seen[0]}" for all of them would be a guess: the engine changed underneath the round,`
      + ' so its cells are not strictly comparable with each other. Re-collect as a NEW round.');
  }
  if (!seen.length && measured > 0) {
    warnings.push('no lighthouseVersion came back in any response, so this round cannot be PROVEN comparable'
      + ' with any other: psi-sheet.mjs will not compute a delta it cannot attribute to the product.');
  }
  return {
    source: {
      tool,
      ...(seen.length ? { lighthouseVersion: seen[0] } : {}),
      runsPerPage,
      strategyProfiles,
      collectedAt,
    },
    warnings,
  };
}

// ---------- API key: fail closed, never printed ----------
// An EMPTY key file is an ABSENT key — it gets the same full instruction, not a shrug. (The kit
// ships the .token path documented and gitignored; an empty placeholder is the normal state of a
// fresh clone, so this is the message a teammate is most likely to hit first.)
function keyInstructions() {
  console.error('');
  console.error('  Without a key the PSI API answers HTTP 429 "Quota exceeded … \'Queries per day\' …');
  console.error('  for consumer project_number" — the anonymous shared quota is exhausted. A key is free:');
  console.error('    1. Google Cloud Console → APIs & Services → Library → enable "PageSpeed Insights API"');
  console.error('    2. APIs & Services → Credentials → Create credentials → API key');
  console.error('    3. Paste it into MCP-configurations/pagespeed/.token (gitignored — never commit a key),');
  console.error('       or export PSI_API_KEY, or point PSI_API_KEY_FILE at the file.');
  console.error('');
  console.error('  (No key is needed for --engine lighthouse, which runs Lighthouse locally — but local');
  console.error('   numbers depend on your machine and are NOT comparable with PSI numbers.)');
  process.exit(2);
}
function readKeyFile(p) {
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (e) {
    // A MISSING key file and an EMPTY key file are the same fact — "there is no key here" — and they
    // get the same answer. Letting one of them out as a bare ENOENT stack would tell the one person
    // most likely to hit it (a teammate on a fresh clone) nothing about how to fix it.
    console.error(`psi-run: cannot read the API-key file ${p} (${e.code || e.message}) — REFUSING to run.`);
    keyInstructions();   // exits 2
  }
  const key = raw.trim();
  if (!key) {
    console.error(`psi-run: the API-key file ${p} is EMPTY — REFUSING to run.`);
    keyInstructions();   // exits 2
  }
  return key;
}
function findDefaultKeyFile() {
  const rels = [
    ['QA-SetupKit', 'MCP-configurations', 'pagespeed', '.token'],
    ['MCP-configurations', 'pagespeed', '.token'],
  ];
  for (const start of [HERE, process.cwd()]) {
    let dir = path.resolve(start);
    for (let i = 0; i < 10; i++) {
      for (const rel of rels) {
        const p = path.join(dir, ...rel);
        if (fs.existsSync(p)) return p;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}
function resolveApiKey() {
  if (process.env.PSI_API_KEY && process.env.PSI_API_KEY.trim()) return process.env.PSI_API_KEY.trim();
  if (process.env.PSI_API_KEY_FILE) return readKeyFile(process.env.PSI_API_KEY_FILE);
  const found = findDefaultKeyFile();
  if (found) return readKeyFile(found);
  console.error('psi-run: no PageSpeed Insights API key — REFUSING to run.');
  keyInstructions();
}

// ---------- engines ----------
const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const redact = (s, key) => (key ? String(s).split(key).join('***') : String(s));

async function runPsiOnce(url, platform, key) {
  const q = `${PSI_ENDPOINT}?url=${encodeURIComponent(url)}&strategy=${platform}&category=performance&key=${encodeURIComponent(key)}`;
  let res;
  try {
    res = await fetch(q);
  } catch (e) {
    return { ok: false, retryable: true, error: `network error: ${redact(e.message, key)}` };
  }
  if (!res.ok) {
    const raw = redact((await res.text().catch(() => '')), key);
    // Prefer Google's own message over 300 chars of truncated JSON — the evidence should be readable.
    let msg = raw.replace(/\s+/g, ' ').trim().slice(0, 300);
    try { const j = JSON.parse(raw); if (j?.error?.message) msg = j.error.message; } catch { /* keep raw */ }
    // An INVALID or UNAUTHORISED key is a CONFIG failure, not a measurement failure. Recording it as
    // an "error" cell would manufacture a round of useless cells and bury the real problem in them —
    // so it aborts the whole run before anything is written, exactly like a missing key.
    const fatalConfig = (res.status === 400 || res.status === 403)
      && /API key not valid|API_KEY_INVALID|keyInvalid|PERMISSION_DENIED|has not been used in project|is disabled/i.test(raw);
    const retryable = res.status === 429 || res.status >= 500;
    return { ok: false, retryable, fatalConfig, error: `HTTP ${res.status} — ${msg}` };
  }
  let body;
  try { body = await res.json(); } catch (e) { return { ok: false, retryable: true, error: `unparseable PSI response: ${e.message}` }; }
  const parsed = parseLighthouseResult(body.lighthouseResult);
  if (!parsed.ok) return { ok: false, retryable: false, error: parsed.error };
  // The raw Lighthouse Result travels with the run. psi-report.mjs renders the MEDIAN run's copy into
  // the report the Sheet links to — which is the only way the linked report and the cell can be
  // guaranteed to show the same number. Re-analysing the page later would produce a different run.
  return { ok: true, ...parsed, field: parseField(body), lhr: body.lighthouseResult };
}

function runLighthouseOnce(url, platform) {
  const args = ['-y', 'lighthouse', url, '--only-categories=performance', '--output=json',
    '--output-path=stdout', '--quiet', '--chrome-flags=--headless=new'];
  if (platform === 'desktop') args.push('--preset=desktop');
  const r = spawnSync('npx', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) return { ok: false, retryable: false, error: `cannot run the Lighthouse CLI: ${r.error.message} (is Node/npx on PATH?)` };
  if (r.status !== 0) return { ok: false, retryable: true, error: `lighthouse exited ${r.status}: ${(r.stderr || '').trim().split('\n').slice(-1)[0] || 'no stderr'}` };
  let lhr;
  try { lhr = JSON.parse(r.stdout); } catch (e) { return { ok: false, retryable: true, error: `unparseable Lighthouse JSON: ${e.message}` }; }
  const parsed = parseLighthouseResult(lhr);
  if (!parsed.ok) return { ok: false, retryable: false, error: parsed.error };
  return { ok: true, ...parsed, lhr };   // no CrUX field data from a local run — absent, not zero
}

async function attempt(engine, url, platform, key) {
  const MAX = 4;
  let last = null;
  for (let a = 1; a <= MAX; a++) {
    const r = engine === 'psi' ? await runPsiOnce(url, platform, key) : runLighthouseOnce(url, platform);
    if (r.ok) return r;
    last = r;
    if (r.fatalConfig) {
      console.error(`\npsi-run: the API key was REJECTED (${r.error}) — REFUSING to run.`);
      console.error('  This is a configuration failure, not a slow page: nothing was written, because a round');
      console.error('  full of "error" cells caused by a bad key is not evidence about the product.');
      keyInstructions();   // exits 2
    }
    if (!r.retryable || a === MAX) break;
    const backoff = 3000 * 2 ** (a - 1);   // 3s, 6s, 12s — 429 means "slow down", not "give up"
    console.error(`      retry ${a}/${MAX - 1} in ${backoff / 1000}s — ${r.error}`);
    await sleep(backoff);
  }
  return last;
}

// ---------- schema validation: an unvalidated artefact is never shipped ----------
function locateValidator(opts = {}) {
  const explicit = opts.schemas || process.env.QA_SCHEMAS_VALIDATOR;
  if (explicit) return fs.existsSync(explicit) ? explicit : null;
  for (const start of [HERE, process.cwd()]) {
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
  }
  return null;
}
function validateOrDelete(file, opts = {}) {
  const validator = locateValidator(opts);
  if (!validator) {
    fs.rmSync(file, { force: true });
    console.error('psi-run: cannot find Rules-Guide/schemas/validate.mjs — pass --schemas <path> or set $QA_SCHEMAS_VALIDATOR.');
    console.error('  An unvalidated round is not shipped: the file was DELETED. Nothing green, nothing quietly wrong.');
    process.exit(3);
  }
  const r = spawnSync(process.execPath, [validator, 'pagespeed-round', file], { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) {
    fs.rmSync(file, { force: true });
    console.error('psi-run: the round FAILED schema validation — deleted, not shipped. Fix the tool, never the contract.');
    process.exit(3);
  }
}

// ---------- self-check (offline; no network, no key) ----------
// A recorded PSI response, trimmed to the fields the parser reads. This is the only way to prove
// the parse/median/status maths without burning API quota — the live PSI path stays unverified
// until a key exists.
const FIXTURE = {
  lighthouseResult: {
    lighthouseVersion: '11.0.0',
    categories: { performance: { score: 0.73 } },
    audits: {
      'largest-contentful-paint': { numericValue: 3412.5 },
      'total-blocking-time': { numericValue: 287.4 },
      'cumulative-layout-shift': { numericValue: 0.0821 },
      'first-contentful-paint': { numericValue: 1180.2 },
      'speed-index': { numericValue: 2900.9 },
    },
  },
  loadingExperience: {
    origin_fallback: true,
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2600 },
      INTERACTION_TO_NEXT_PAINT: { percentile: 180 },
      CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 12 },
    },
  },
};
function selfCheck() {
  let failed = 0;
  let total = 0;
  const eq = (name, actual, expected) => {
    total++;
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) { console.log(`  PASS  ${name}`); }
    else { console.log(`  FAIL  ${name}\n        expected ${e}\n        actual   ${a}`); failed++; }
  };
  const mk = (score, lcp) => ({ score, metrics: { lcpMs: lcp }, collectedAt: '2026-07-13T10:00:00Z' });

  // A GUARD is only a guard if it is exercised. These run the tool as a SUBPROCESS against a throwaway
  // temp inventory: offline, no key, no network — every one of them refuses before the first request.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psi-run-selfcheck-'));
  const cli = (args, env = {}) => {
    const r = spawnSync(process.execPath, [SELF, ...args], {
      encoding: 'utf8',
      // No key, and a key FILE that does not exist: if a guard ever stops firing, the run dies at the
      // key instead of reaching the network. A self-check must never be able to spend the owner's quota.
      env: { ...process.env, PSI_API_KEY: '', PSI_API_KEY_FILE: path.join(tmp, 'no-such-key'), ...env },
    });
    return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  };
  const inventory = {
    baseUrl: 'https://example.com',
    platforms: ['desktop'],
    runsPerPage: 3,
    sections: [{ name: 'S', pages: [{ id: 'home', name: 'Home', path: '/' }] }],
  };
  const pagesFile = path.join(tmp, 'pages.json');
  fs.writeFileSync(pagesFile, JSON.stringify(inventory));
  const roundsDir = path.join(tmp, 'rounds');
  fs.mkdirSync(roundsDir, { recursive: true });
  const writeRound = (obj) => fs.writeFileSync(path.join(roundsDir, 'r1.json'), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
  const baseArgs = ['--round', 'r1', '--env', 'staging', '--label', 'L', '--pages', pagesFile, '--out-dir', roundsDir];
  const priorRound = (over = {}) => ({
    round: { id: 'r1', date: '2026-07-13', env: 'staging', label: 'L' },
    source: { tool: 'psi-api', runsPerPage: 3, strategyProfiles: ['desktop'], collectedAt: '2026-07-13T10:00:00Z', ...over },
    pages: [{ id: 'home', name: 'Home', url: 'https://example.com/', section: 'S', results: [{ platform: 'desktop', status: 'n-a', comment: 'no desktop build' }] }],
  });

  console.log('psi-run --self-check (offline: parser · median · status · merge · guards)\n');

  const p = parseLighthouseResult(FIXTURE.lighthouseResult);
  eq('parse · score is 0..1 x100, rounded', p.score, 73);
  eq('parse · lab metrics rounded (cls to 3dp)', p.metrics, { lcpMs: 3413, tbtMs: 287, cls: 0.082, fcpMs: 1180, speedIndexMs: 2901 });
  eq('parse · lighthouseVersion kept', p.lighthouseVersion, '11.0.0');
  eq('parse · CrUX field, origin_fallback → crux-origin, CLS/100', parseField(FIXTURE), { source: 'crux-origin', lcpMs: 2600, inpMs: 180, cls: 0.12 });
  eq('parse · no loadingExperience → field ABSENT (absent ≠ zero)', parseField({ lighthouseResult: {} }), undefined);
  eq('parse · runtimeError → failed run, not a 0', parseLighthouseResult({ runtimeError: { code: 'ERRORED_DOCUMENT_REQUEST', message: 'status 503' } }),
    { ok: false, error: 'lighthouseResult.runtimeError: ERRORED_DOCUMENT_REQUEST — status 503' });

  eq('median · odd runs → the middle REAL run (89/91/93 → 91)', medianRun([mk(91, 100), mk(89, 200), mk(93, 300)]).score, 91);
  eq('median · metrics come from THAT run, not another load', medianRun([mk(91, 100), mk(89, 200), mk(93, 300)]).metrics, { lcpMs: 100 });
  eq('median · even runs → LOWER middle (pessimistic)', medianRun([mk(80, 1), mk(90, 2)]).score, 80);

  const full = buildResult('mobile', [mk(89, 100), mk(91, 110), mk(93, 120)], [], 3);
  eq('status · 3/3 runs → measured, median score + its runs', [full.status, full.score, full.runs], ['measured', 91, [89, 91, 93]]);
  eq('status · stable run set → no NEEDS-COMMENT', full.comment, undefined);

  const partial = buildResult('desktop', [mk(84, 100)], ['HTTP 429 — quota'], 3);
  eq('status · 1/3 runs → not-run, NO score (never a partial green number)', [partial.status, partial.score, partial.runs], ['not-run', undefined, [84]]);
  eq('status · the partial run keeps its failure as evidence', partial.error, 'HTTP 429 — quota');

  const none = buildResult('mobile', [], ['HTTP 503', 'HTTP 503', 'HTTP 503', 'HTTP 503'], 3);
  eq('status · 0/3 runs → error, NO score and NO 0', [none.status, none.score, none.error], ['error', undefined, 'HTTP 503']);

  const zero = buildResult('mobile', [mk(0, 9000), mk(0, 9100), mk(0, 9200)], [], 3);
  eq('status · a real 0 IS a score (0 is measured, not missing)', [zero.status, zero.score], ['measured', 0]);

  const low = buildResult('mobile', [mk(38, 6000), mk(41, 6100), mk(49, 6200)], [], 3);
  eq('status · score < 50 → a comment is demanded, not invented',
    low.comment?.startsWith('NEEDS-COMMENT: score 41 < 50'), true);
  eq('status · spread ≥ 10 (38/41/49) → instability is stated out loud', low.comment?.includes('UNSTABLE'), true);
  const tight = buildResult('mobile', [mk(38, 6000), mk(41, 6100), mk(47, 6200)], [], 3);
  eq('status · spread 9 (38/41/47) → below the threshold, no instability claim', tight.comment?.includes('UNSTABLE'), false);

  // ── FIX 1 · re-collecting a round MERGES: a human's comment is never destroyed by a retry ────────
  const humanComment = 'Hero image is a 2.4 MB PNG — BUG-014. Re-measure after the fix lands.';
  const freshLow = buildResult('mobile', [mk(41, 6000), mk(41, 6100), mk(41, 6200)], [], 3);
  const m1 = mergeResult(freshLow, { platform: 'mobile', status: 'measured', score: 41, comment: humanComment });
  eq('merge · a HUMAN comment survives a re-collection (the workflow demands humans write it)', m1.result.comment, humanComment);
  eq('merge · unchanged score under a carried comment → no stale warning', [m1.carried, m1.warning], [true, null]);
  eq('merge · the fresh score/runs/metrics are the NEW ones (only the comment is carried)',
    [m1.result.status, m1.result.score, m1.result.runs], ['measured', 41, [41, 41, 41]]);

  const m2 = mergeResult(freshLow, { platform: 'mobile', status: 'measured', score: 84, comment: humanComment });
  eq('merge · score CHANGED under a carried comment → WARN (the comment may now be stale)',
    [m2.carried, /STALE/.test(m2.warning || ''), /84 → 41/.test(m2.warning || '')], [true, true, true]);

  const freshNotRun = buildResult('mobile', [mk(84, 100)], ['HTTP 429 — quota'], 3);
  const m3 = mergeResult(freshNotRun, { platform: 'mobile', status: 'measured', score: 84, comment: humanComment });
  eq('merge · measured → not-run under a carried comment → WARN ("no score" is a change too)',
    [m3.result.status, m3.result.score, /STALE/.test(m3.warning || ''), /no score \(not-run\)/.test(m3.warning || '')],
    ['not-run', undefined, true, true]);

  const m4 = mergeResult(freshLow, { platform: 'mobile', status: 'measured', score: 41, comment: 'NEEDS-COMMENT: score 41 < 50 — …' });
  eq('merge · a NEEDS-COMMENT placeholder is NOT carried over (a demand does not answer itself)',
    [m4.carried, m4.result.comment?.startsWith('NEEDS-COMMENT: score 41 < 50 —')], [false, true]);
  eq('merge · no previous result → the fresh result is untouched', mergeResult(freshLow, undefined).result, freshLow);
  eq('merge · isPlaceholderComment recognises the demand and only the demand',
    [isPlaceholderComment('NEEDS-COMMENT: x'), isPlaceholderComment('  NEEDS-COMMENT: x'), isPlaceholderComment(humanComment), isPlaceholderComment(undefined)],
    [true, true, false, false]);

  // ── FIX 2 · a CORRUPT existing round file is a refusal, not an absence ───────────────────────────
  writeRound('{ "round": { "id": "r1"');   // truncated — e.g. a run killed mid-write
  const corrupt = cli(baseArgs);
  eq('guard · corrupt round file → exit 2, refuses to overwrite (owner n-a + comments survive)',
    [corrupt.status, /is not valid JSON/.test(corrupt.out), /refusing to overwrite/i.test(corrupt.out)], [2, true, true]);
  eq('guard · …and the corrupt file is left EXACTLY as it was (nothing was written over it)',
    fs.readFileSync(path.join(roundsDir, 'r1.json'), 'utf8'), '{ "round": { "id": "r1"');

  // ── FIX 3 · runsPerPage is part of a round's IDENTITY, like the engine ───────────────────────────
  writeRound(priorRound());                       // collected at runsPerPage 3
  const runsGuard = cli([...baseArgs, '--runs', '1']);
  eq('guard · re-collecting r1 with a different --runs → exit 2, use a NEW round id',
    [runsGuard.status, /runsPerPage/.test(runsGuard.out), /NEW --round id/.test(runsGuard.out)], [2, true, true]);
  const engineGuard = cli([...baseArgs, '--engine', 'lighthouse']);
  eq('guard · re-collecting r1 with a different --engine → exit 2 (unchanged behaviour, re-proved)',
    [engineGuard.status, /ONE engine/.test(engineGuard.out)], [2, true]);

  // ── FIX 4 · an unknown flag is REFUSED, never silently ignored ───────────────────────────────────
  let thrown = null;
  try { parseArgs(['--run', '5']); } catch (e) { thrown = e.message; }
  eq('flags · "--run 5" (typo for --runs) is REFUSED and the known flags are listed',
    [thrown !== null, /unknown flag "--run"/.test(thrown || ''), /--runs/.test(thrown || '')], [true, true, true]);
  eq('flags · a known flag still parses, with and without "="',
    [parseArgs(['--runs', '5']).runs, parseArgs(['--runs=5']).runs, parseArgs(['--self-check'])['self-check']], ['5', '5', true]);
  const typo = cli([...baseArgs, '--run', '5']);
  eq('flags · …and the CLI exits 2 SAYING SO (not by accident, further down, for another reason)',
    [typo.status, /unknown flag "--run"/.test(typo.out)], [2, true]);

  // ── FIX 5 · a MISSING key file gets the same instruction as an EMPTY one ─────────────────────────
  fs.rmSync(path.join(roundsDir, 'r1.json'), { force: true });
  const missingKey = cli(baseArgs, { PSI_API_KEY_FILE: path.join(tmp, 'absent.token') });
  eq('key · MISSING key file → exit 2 + the full Cloud-Console instruction (not a bare ENOENT)',
    [missingKey.status, /cannot read the API-key file/.test(missingKey.out), /Google Cloud Console/.test(missingKey.out)], [2, true, true]);
  const emptyKeyFile = path.join(tmp, 'empty.token');
  fs.writeFileSync(emptyKeyFile, '   \n');
  const emptyKey = cli(baseArgs, { PSI_API_KEY_FILE: emptyKeyFile });
  eq('key · EMPTY key file → the same exit 2 + the same instruction',
    [emptyKey.status, /is EMPTY/.test(emptyKey.out), /Google Cloud Console/.test(emptyKey.out)], [2, true, true]);
  eq('key · the key is never printed back (both refusals are quiet about secrets)',
    /AIza|key=/.test(missingKey.out + emptyKey.out), false);

  // ── FIX 6 · importable: `main` does not run on import, so the maths is unit-testable ─────────────
  const importer = path.join(tmp, 'importer.mjs');
  fs.writeFileSync(importer, `import { medianRun, buildResult, parseArgs, mergeResult, buildPageUrl, buildSource } from ${JSON.stringify(pathToFileURL(SELF).href)};\n`
    + "const ok = [medianRun, buildResult, parseArgs, mergeResult, buildPageUrl, buildSource].every((f) => typeof f === 'function');\n"
    + "console.log(ok ? 'IMPORT-OK' : 'IMPORT-BROKEN');\n");
  const imported = spawnSync(process.execPath, [importer], { encoding: 'utf8' });
  eq('import · the helpers import cleanly AND main() does not run on import',
    [imported.status, /IMPORT-OK/.test(imported.stdout || ''), /psi-run ·|REFUSING/.test((imported.stdout || '') + (imported.stderr || ''))],
    [0, true, false]);

  // ── FIX 7 · ONE URL rule, the one psi-sheet.mjs mirrors ──────────────────────────────────────────
  eq('url · new URL(path, base): absolute path REPLACES the base path (string-glue would not)',
    [buildPageUrl('/pricing', 'https://x.dev/app/'), buildPageUrl('/pricing', 'https://x.dev'), buildPageUrl('pricing', 'https://x.dev/app/')],
    ['https://x.dev/pricing', 'https://x.dev/pricing', 'https://x.dev/app/pricing']);
  eq('url · a double slash is never manufactured from a trailing-slash base',
    buildPageUrl('/', 'https://x.dev/'), 'https://x.dev/');

  // ── FIX 8 · what makes a round COMPARABLE travels with it ────────────────────────────────────────
  const s1 = buildSource({ tool: 'psi-api', versions: ['13.4.0', '13.4.0'], runsPerPage: 3, strategyProfiles: ['desktop', 'mobile'], collectedAt: '2026-07-13T10:00:00Z', measured: 2 });
  eq('source · lighthouseVersion + runsPerPage are recorded (psi-sheet needs both for a delta)',
    [s1.source.lighthouseVersion, s1.source.runsPerPage, s1.warnings.length], ['13.4.0', 3, 0]);
  const s2 = buildSource({ tool: 'psi-api', versions: [], runsPerPage: 3, strategyProfiles: ['desktop'], collectedAt: '2026-07-13T10:00:00Z', measured: 2 });
  eq('source · measured cells but NO version → warn (comparability cannot be proven), never invent one',
    [s2.source.lighthouseVersion, /lighthouseVersion/.test(s2.warnings[0] || '')], [undefined, true]);
  const s3 = buildSource({ tool: 'psi-api', versions: ['13.4.0', '13.5.0'], runsPerPage: 3, strategyProfiles: ['desktop'], collectedAt: '2026-07-13T10:00:00Z', measured: 2 });
  eq('source · TWO versions inside one round → warn (the engine changed under the round)',
    /MORE THAN ONE Lighthouse version/.test(s3.warnings[0] || ''), true);
  const s4 = buildSource({ tool: 'psi-api', versions: [], runsPerPage: 3, strategyProfiles: ['desktop'], collectedAt: '2026-07-13T10:00:00Z', measured: 0 });
  eq('source · nothing measured (all n-a/error) → no version, and no false alarm about it', s4.warnings.length, 0);

  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\n${total} assertion(s) · ${failed ? `${failed} FAILURE(S)` : 'all passed'}`);
  console.log('  Offline: the parser, the median/status maths, the merge, and every refusal guard.');
  console.log('  NOT covered: the LIVE PSI request itself — no self-check can prove that without quota.');
  process.exit(failed ? 1 : 0);
}

// ---------- main ----------
async function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { die(e.message); }

  if (opts.help) {
    console.log(fs.readFileSync(SELF, 'utf8').split('\n')
      .filter((l) => l.startsWith('//')).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    process.exit(0);
  }
  if (opts['self-check']) selfCheck();   // exits

  const round = opts.round || die('--round <id> is required (it names the file AND the Sheet block)');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(round)) die(`--round "${round}" must match ^[a-z0-9][a-z0-9-]*$ (schema: round.id)`);
  const env = opts.env || die(`--env is required (${ENVS.join(' | ')}) — a number without its environment cannot be compared with anything`);
  if (!ENVS.includes(env)) die(`--env must be one of: ${ENVS.join(', ')}`);
  const label = opts.label || die('--label "<Sheet block header>" is required, e.g. --label "Points from 05/06/2026 (Prod)"');
  const date = opts.date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) die(`--date "${date}" must be YYYY-MM-DD`);
  const engine = opts.engine || 'psi';
  if (!['psi', 'lighthouse'].includes(engine)) die('--engine must be psi or lighthouse');
  const toolName = engine === 'psi' ? 'psi-api' : 'lighthouse-cli';
  const throttleMs = Number(opts['throttle-ms'] ?? 1500);
  if (!Number.isFinite(throttleMs) || throttleMs < 0) die('--throttle-ms must be a non-negative number');

  const pagesFile = path.resolve(opts.pages || process.env.PSI_PAGES || './pages.json');
  if (!fs.existsSync(pagesFile)) {
    die(`page inventory not found: ${pagesFile}\n  Copy pages.example.json → pages.json and fill it in (or pass --pages <path> / set $PSI_PAGES).\n  Without an inventory there is nothing to measure — the tool will not invent pages.`);
  }
  let inv;
  try { inv = JSON.parse(fs.readFileSync(pagesFile, 'utf8')); }
  catch (e) { die(`${pagesFile} is not valid JSON: ${e.message}`); }

  // Fail closed on a malformed inventory: a silently-empty round is the worst possible artefact.
  if (!inv || typeof inv !== 'object') die(`${pagesFile} must be an object — see pages.example.json`);
  if (!inv.baseUrl || !/^https?:\/\//.test(inv.baseUrl)) die(`${pagesFile}: "baseUrl" is required and must start with http(s):// — see pages.example.json`);
  if (!Array.isArray(inv.sections) || !inv.sections.length) die(`${pagesFile}: "sections" must be a non-empty array — see pages.example.json`);
  const platforms = Array.isArray(inv.platforms) && inv.platforms.length ? inv.platforms : ['desktop', 'mobile'];
  for (const p of platforms) if (!PLATFORMS.includes(p)) die(`${pagesFile}: "platforms" may only contain ${PLATFORMS.join(' / ')} — got "${p}"`);

  const target = Number(opts.runs ?? inv.runsPerPage ?? RUNS_FLOOR);
  if (!Number.isInteger(target) || target < 1) die('runsPerPage / --runs must be an integer >= 1');
  if (target < RUNS_FLOOR) {
    console.error(`psi-run: WARNING — runsPerPage is ${target}. A PageSpeed score is a LAB metric from a single load,`);
    console.error(`  and fewer than ${RUNS_FLOOR} runs is noise with a decimal point. The round records runsPerPage=${target}`);
    console.error('  so every reader can see how thin the evidence is. Raise it unless you have a reason.');
  }

  const pages = [];
  for (const s of inv.sections) {
    if (!s || !s.name || !Array.isArray(s.pages)) die(`${pagesFile}: every section needs { name, pages: [...] }`);
    for (const p of s.pages) {
      if (!p || !p.id || !p.name || typeof p.path !== 'string') die(`${pagesFile}: every page needs { id, name, path } — see pages.example.json`);
      if (!/^[a-z0-9][a-z0-9-]*$/.test(p.id)) die(`${pagesFile}: page id "${p.id}" must match ^[a-z0-9][a-z0-9-]*$ (it is the permanent key the Sheet carries history by)`);
      // ONE resolution rule, shared with psi-sheet.mjs — see buildPageUrl.
      pages.push({ id: p.id, name: p.name, section: s.name, url: buildPageUrl(p.path, inv.baseUrl) });
    }
  }
  if (!pages.length) die(`${pagesFile}: no pages found — nothing to measure`);

  const outDir = path.resolve(opts['out-dir'] || process.env.ROUNDS_DIR || './rounds');
  const outFile = path.join(outDir, `${round}.json`);
  // The median run's raw Lighthouse Result, one file per page+platform. psi-report.mjs renders these
  // into the reports the Sheet links to. They are bulky (~0.5–1 MB each) — gitignore them, and pass
  // --no-lhr to skip them entirely if you are not going to attach evidence to this round.
  const keepLhr = !opts['no-lhr'];
  const lhrDir = path.join(outDir, `${round}.lhr`);

  // ---- the existing round file: READ IT BEFORE YOU DESTROY IT ----
  // Re-collecting a round is the normal retry path, so an existing file is the normal case — and it
  // holds two things the tool must not throw away: the owner's "n-a" statements, and the human
  // comments without which the round cannot be published at all.
  const prevResults = new Map();   // "<pageId>|<platform>" → the previous result, whatever its status
  if (fs.existsSync(outFile)) {
    let prev;
    try {
      prev = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    } catch (e) {
      // A file we cannot parse is NOT an absent file. Treating it as absent would silently overwrite
      // owner-set "n-a" results and human comments, and would skip the identity checks below —
      // precisely because the file that was supposed to enforce them was unreadable.
      die(`${outFile} exists but is not valid JSON: ${e.message} — refusing to overwrite it.\n`
        + '  A round file that cannot be read is not an empty one: it may still hold owner-set "n-a"\n'
        + '  results and the human comments this round needs to be publishable, and the engine /\n'
        + '  runsPerPage identity checks below are made against it. Repair the file, or move it aside\n'
        + '  (and accept that its comments are gone), then re-run.');
    }
    // One round = one engine. Local Lighthouse numbers and PSI numbers are not the same measurement.
    if (prev?.source?.tool && prev.source.tool !== toolName) {
      die(`${outFile} was collected with "${prev.source.tool}" and you are running "${toolName}". One round = ONE engine:\n  local Lighthouse numbers depend on the machine and are NOT comparable with PSI numbers, so mixing them\n  inside a block would put two different measurements in the same column. Use a NEW --round id.`);
    }
    // ...and one round = one runsPerPage, for exactly the same reason. Re-collecting r6 with --runs 1
    // would leave the id, the label and the block untouched while quietly standing every score in it
    // on a single load. That is a different measurement wearing the old round's name.
    const prevTarget = prev?.source?.runsPerPage;
    if (prevTarget != null && Number(prevTarget) !== target) {
      die(`${outFile} was collected with runsPerPage=${prevTarget} and you are running with ${target}. One round = ONE run count:\n`
        + `  a median of ${prevTarget} load(s) and a median of ${target} load(s) are different measurements, and this round's\n`
        + '  block in the Sheet says how many loads its numbers stand on. Silently restating them at another\n'
        + '  run count is a change to the evidence, not a re-collection of it. Use a NEW --round id\n'
        + `  (or drop --runs to keep ${prevTarget}).`);
    }
    for (const p of prev?.pages ?? []) {
      for (const r of p.results ?? []) prevResults.set(`${p.id}|${r.platform}`, r);
    }
  }

  const key = engine === 'psi' ? resolveApiKey() : null;

  const preservedNa = [...prevResults.values()].filter((r) => r.status === 'n-a').length;
  const humanComments = [...prevResults.values()].filter((r) => r.comment && !isPlaceholderComment(r.comment) && r.status !== 'n-a').length;

  console.log(`psi-run · round ${round} · ${env} · engine ${toolName} · ${pages.length} page(s) × ${platforms.join('+')} × ${target} run(s)`);
  console.log(`  inventory: ${pagesFile}`);
  if (preservedNa) console.log(`  preserving ${preservedNa} owner-set "n-a" result(s) from the existing round file`);
  if (humanComments) console.log(`  re-collecting into an EXISTING round: ${humanComments} human comment(s) will be carried over, not overwritten`);
  console.log('');

  const outPages = [];
  const versions = [];
  const tally = { measured: 0, 'not-run': 0, 'n-a': 0, error: 0 };
  const staleWarnings = [];
  let carried = 0;
  let needsComment = 0;

  for (const page of pages) {
    const results = [];
    for (const platform of platforms) {
      const prevRes = prevResults.get(`${page.id}|${platform}`);
      if (prevRes?.status === 'n-a') {
        // "n-a" is an OWNER statement ("this page does not exist there"). The tool has no standing to
        // overrule it by measuring anyway — it is preserved verbatim, comment and all.
        results.push(prevRes);
        tally['n-a']++;
        console.log(`  ${page.name} (${platform}) · n/a (preserved) — ${prevRes.comment ? '' : 'NO COMMENT — n/a REQUIRES one'}`);
        if (!prevRes.comment) needsComment++;
        continue;
      }
      const okRuns = [];
      const failures = [];
      process.stdout.write(`  ${page.name} (${platform}) · `);
      for (let i = 0; i < target; i++) {
        const r = await attempt(engine, page.url, platform, key);
        if (r.ok) {
          okRuns.push({ score: r.score, metrics: r.metrics, field: r.field, lhr: r.lhr, collectedAt: new Date().toISOString() });
          if (r.lighthouseVersion) versions.push(r.lighthouseVersion);
          process.stdout.write(`${r.score} `);
        } else {
          failures.push(r.error);
          process.stdout.write('x ');
        }
        if (i < target - 1 && throttleMs) await sleep(throttleMs);
      }
      const fresh = buildResult(platform, okRuns, failures, target);
      // Keep the MEDIAN run's raw Lighthouse Result — the one whose score is in the cell. psi-report.mjs
      // renders exactly this file, so the report behind the Sheet's link can never show a different
      // number than the Sheet. (Only for 'measured': there is no median of a round that did not happen.)
      const lhrFile = path.join(lhrDir, `${page.id}-${platform}.json`);
      const med = fresh.status === 'measured' ? medianRun(okRuns) : null;
      if (keepLhr && med?.lhr) {
        fs.mkdirSync(lhrDir, { recursive: true });
        fs.writeFileSync(lhrFile, JSON.stringify(med.lhr));
      } else if (fs.existsSync(lhrFile)) {
        // We just RE-MEASURED this cell but are NOT writing a fresh stored run for it — either --no-lhr,
        // or the cell is no longer 'measured'. A stored run left over from a PREVIOUS collection of this
        // same round would be rendered by psi-report as evidence of THIS round's number: a report of a
        // DIFFERENT load, invisible to the runScore guard whenever the two loads happen to share a score.
        // Delete it. No stored run is fail-closed (psi-report skips the cell); a stale one is a silent lie.
        fs.rmSync(lhrFile);
      }
      // MERGE, never overwrite: the human's comment outlives the retry that re-measured the cell.
      const merged = mergeResult(fresh, prevRes);
      const res = merged.result;
      if (merged.carried) carried++;
      if (merged.warning) staleWarnings.push(`${page.id} (${platform}): ${merged.warning}`);
      results.push(res);
      tally[res.status]++;
      if (isPlaceholderComment(res.comment)) needsComment++;
      const detail = res.status === 'measured'
        ? `→ median ${res.score} (LCP ${res.metrics.lcpMs ?? '?'} ms · TBT ${res.metrics.tbtMs ?? '?'} ms · CLS ${res.metrics.cls ?? '?'})`
        : `→ ${res.status.toUpperCase()} — ${res.error || 'see comment'}`;
      console.log(`${detail}${merged.carried ? ' · comment carried over' : ''}${merged.warning ? ' · ⚠ MAY BE STALE' : ''}`);
      if (throttleMs) await sleep(throttleMs);
    }
    outPages.push({ id: page.id, name: page.name, url: page.url, section: page.section, results });
  }

  // What makes this round comparable with another one travels INSIDE it: tool, Lighthouse version,
  // runsPerPage, profiles. psi-sheet.mjs refuses to compute a delta across differing versions.
  const { source, warnings: sourceWarnings } = buildSource({
    tool: toolName,
    versions,
    runsPerPage: target,
    strategyProfiles: platforms,
    collectedAt: new Date().toISOString(),
    measured: tally.measured,
  });

  const roundJson = {
    round: { id: round, date, env, label },
    source,
    pages: outPages,
  };
  // budgets are NOT written here. A budget is an owner decision (approvedBy + approvedOn); a tool that
  // invented one would be inventing the pass/fail line it is then judged by. Add it by hand.

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(roundJson, null, 2) + '\n');
  validateOrDelete(outFile, opts);   // exits 3 (and deletes) if the contract is not met

  console.log('');
  console.log(`Round ${round} — ${env} — ${date} — ${toolName}${source.lighthouseVersion ? ` (Lighthouse ${source.lighthouseVersion})` : ''}`);
  console.log(`  measured: ${tally.measured} · not-run: ${tally['not-run']} · n/a: ${tally['n-a']} · error: ${tally.error}   (of ${pages.length * platforms.length} cells)`);
  if (carried) {
    console.log(`  ${carried} human comment(s) carried over from the previous collection of this round — a re-collection`);
    console.log('  merges, it does not overwrite: the comments this round needs in order to publish are not the tool\'s to delete.');
  }
  if (staleWarnings.length) {
    console.log('');
    console.log(`  ⚠ ${staleWarnings.length} carried-over comment(s) may now be STALE — the measurement under them CHANGED:`);
    for (const w of staleWarnings) console.log(`      · ${w}`);
    console.log('    Nobody deleted your words; you are being told they may no longer describe this cell. Re-read each');
    console.log('    one before publishing — a stale explanation attached to a fresh number is a quiet lie.');
  }
  for (const w of sourceWarnings) {
    console.log('');
    console.log(`  ⚠ ${w}`);
  }
  if (needsComment) {
    console.log('');
    console.log(`  ${needsComment} result(s) carry a NEEDS-COMMENT placeholder — a human must replace each one with a real`);
    console.log('  explanation before this round is published. The placeholder is a demand, not an answer.');
  }
  if (tally['not-run'] || tally.error) {
    console.log('  Cells that were not measured stay EMPTY in the Sheet. They are not 0, and they are not a pass.');
  }
  console.log(`  → ${outFile}`);
  console.log('  No verdict was produced: without owner-approved `budgets`, this report REPORTS numbers and never judges them.');
}

// Run main ONLY when this file is the entry point. Imported (by a test, or by another tool that wants
// parseLighthouseResult / medianRun / buildResult / mergeResult), it must define and do nothing: a
// module that collects a round as a side effect of being imported cannot be unit-tested at all, and
// logic nobody can test is logic nobody can trust.
const entry = process.argv[1] ? (() => {
  try { return pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return pathToFileURL(process.argv[1]).href; }
})() : null;
if (entry && import.meta.url === entry) await main();
