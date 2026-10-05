// Compute the QA metric set from artefacts — counting only, NO estimation logic.
// Copy to <Project>/QA-Reports/tools/. Run after a round closes:
//   node qa-metrics.mjs --round <plan-slug> [--since YYYY-MM-DD]
// Output: <Project>/QA-Reports/metrics-<round>.json + console table, with numeric
// deltas vs the most recent previous metrics file (by mtime).
//
// Metrics not derivable from present sources report a REASONED n/a — the reason names
// the FIELD that is missing, not just the artefact, so the gap is actionable:
//   "n/a (source missing)"                    — the artefact isn't there;
//   "n/a (pass --since)"                      — inflow needs the round's start date;
//   "n/a (record carries no <field> field)"   — the source exists but cannot answer this one.
//
// TWO BUG SOURCES, and the output always names which one was used (`bugSource`):
//   BUG_SUMMARY=<path/to/bug-summary.json>  — the kit's canonical bug RECORD projection
//     (Custom-Reports/Bug-Summary). Preferred when the project has one; needs no network.
//   the QA Sheet's bug tab                  — QA_SHEET_ID + QA_BUGS_RANGE (or the constants
//     below). Used when BUG_SUMMARY is unset.
// A project whose bug tab was retired in favour of a bug-summary record is the normal case,
// not an exception — reading only the Sheet would report a live project as "source missing".
//
// Sheets access reuses the shared mcp-sheets OAuth. Resolution order (multi-user
// rule): MCP_SHEETS_DIR env override → walk up from cwd to the first .mcp.json and
// take mcpServers["google-sheets"].args[0]'s directory. No hardcoded paths.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// ==== PER PROJECT — env first, so the tool can be POINTERED instead of forked (Convention #9) ====
const BUG_SUMMARY = process.env.BUG_SUMMARY || null;          // path to a bug-summary.json record
const SHEET_ID = process.env.QA_SHEET_ID || 'TODO';           // project QA Sheet
const BUGS_RANGE = process.env.QA_BUGS_RANGE || "'Bug Reports'!A2:Z"; // header on row 1
const SEV_COL = 2, STATUS_COL = 13, DATE_COL = 1; // 0-based, per your tab mapping (Bug-Reports SETUP)
// ================================================================================================

const OPEN_STATES = ['open', 'reopened'];

// Paths anchored to the script location, not cwd: tools/ → QA-Reports/ → <Project>/.
// A POINTERED copy (a symlink into the kit) resolves import.meta.url to the KIT, not to the
// project, so a script-only anchor would write the project's metrics into the kit. Both anchors
// are therefore env-overridable, and passing them IS the pointer's contract (Convention #9).
const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = process.env.QA_REPORTS_DIR ? path.resolve(process.env.QA_REPORTS_DIR) : path.join(TOOLS_DIR, '..');
const STRATEGY_DIR = path.join(REPORTS_DIR, '..', 'Test-Strategy');
const COVERAGE = process.env.COVERAGE ? path.resolve(process.env.COVERAGE) : path.join(STRATEGY_DIR, 'coverage.json');

function argFlag(name) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1].trim() : null;
}
const round = argFlag('--round') || 'adhoc';
const since = argFlag('--since');

function findMcpSheetsDir() {
  if (process.env.MCP_SHEETS_DIR) return process.env.MCP_SHEETS_DIR;
  let dir = process.cwd();
  while (true) {
    const cfg = path.join(dir, '.mcp.json');
    if (fs.existsSync(cfg)) {
      try {
        const j = JSON.parse(fs.readFileSync(cfg, 'utf8'));
        const args = j.mcpServers?.['google-sheets']?.args;
        if (args?.[0]) return path.dirname(path.resolve(dir, args[0]));
      } catch { /* fall through to parent */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const metrics = { round, computedAt: new Date().toISOString(),
  bugSource: 'n/a (no bug source configured)',
  openBySeverity: 'n/a (source missing)', totalBugs: 'n/a (source missing)',
  inflow: since ? 'n/a (source missing)' : 'n/a (pass --since)',
  reopenRate: 'n/a (source missing)',
  coveragePct: 'n/a (source missing)', gaps: 'n/a (source missing)' };

// --- bugs from a bug-summary record (preferred when the project has one) ---
if (BUG_SUMMARY) {
  const rec = JSON.parse(fs.readFileSync(BUG_SUMMARY, 'utf8'));
  const issues = (rec.sites || []).flatMap(s => (s.pages || []).flatMap(p => p.issues || []));
  metrics.bugSource = `bug-summary record ${path.basename(BUG_SUMMARY)} · ${rec.source?.kind || 'unknown origin'} · generated ${rec.generatedAt || '?'}`;
  metrics.totalBugs = issues.length;

  // Each metric is REFUSED, with the missing field named, rather than guessed.
  const withStatus = issues.filter(b => b.status && b.status !== 'unknown');
  if (!withStatus.length) {
    metrics.openBySeverity = 'n/a (record carries no status field — Bug-Summary status is opt-in)';
    metrics.reopenRate = 'n/a (record carries no status field)';
  } else {
    const open = withStatus.filter(b => OPEN_STATES.includes(b.status));
    metrics.openBySeverity = {};
    for (const b of open) metrics.openBySeverity[b.severity || '?'] = (metrics.openBySeverity[b.severity || '?'] || 0) + 1;
    metrics.openTotal = open.length;
    const verified = withStatus.filter(b => b.status === 'verified').length;
    const reopened = withStatus.filter(b => b.status === 'reopened').length;
    metrics.reopenRate = (verified + reopened) > 0
      ? +(100 * reopened / (verified + reopened)).toFixed(1)
      : 'n/a (no verified/reopened bugs in the record — a board that never marks "verified" cannot show a reopen)';
  }

  const dated = issues.filter(b => b.reportedAt);
  metrics.inflow = !since ? 'n/a (pass --since)'
    : dated.length ? dated.filter(b => String(b.reportedAt) >= since).length
    : 'n/a (record carries no reportedAt field)';

  // Severity provenance rides WITH the numbers. A statistic computed from agent-proposed
  // severities is a statistic built out of hypotheses, and has to say so wherever it lands.
  const proposed = issues.filter(b => b.severitySource === 'agent-proposed').length;
  metrics.severityProvenance = proposed
    ? `WARNING: ${proposed}/${issues.length} severities are agent-proposed — hypotheses, not owner-validated`
    : `all ${issues.length} severities owner/tracker-sourced`;
  if (proposed) console.error(`qa-metrics: ${metrics.severityProvenance}`);
}

// --- bugs from the Sheet (only when no record was given) ---
const MCP_DIR = BUG_SUMMARY ? null : findMcpSheetsDir();
if (BUG_SUMMARY) {
  /* counted from the record above */
} else if (SHEET_ID === 'TODO') {
  console.error('qa-metrics: no bug source — set BUG_SUMMARY=<bug-summary.json> or QA_SHEET_ID=<sheet id>.');
  console.error('Continuing with bug metrics = n/a (source missing).');
} else if (!MCP_DIR || !fs.existsSync(path.join(MCP_DIR, 'token.json'))) {
  console.error('mcp-sheets not resolved: configure .mcp.json with a google-sheets server');
  console.error('(or set MCP_SHEETS_DIR), then bind YOUR account: node server.mjs --auth in that dir.');
  console.error('Continuing with bug metrics = n/a (source missing).');
} else try {
  const require = createRequire(path.join(MCP_DIR, 'package.json'));
  const { google } = require('googleapis');
  const credPath = path.join(MCP_DIR, 'credentials.json');
  if (!fs.existsSync(credPath)) {
    console.error(`qa-metrics: ${credPath} not found — set up the google-sheets MCP first (MCP-configurations/README.md).`);
    process.exit(2);
  }
  const creds = JSON.parse(fs.readFileSync(credPath));
  const token = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'token.json')));
  const c = creds.installed || creds.web;
  const oauth = new google.auth.OAuth2(c.client_id, c.client_secret,
    (c.redirect_uris && c.redirect_uris[0]) || 'http://localhost:3456');
  oauth.setCredentials(token);
  const sheets = google.sheets({ version: 'v4', auth: oauth });
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: BUGS_RANGE });
  const rows = (r.data.values || []).filter(x => x[0]);
  const status = x => String(x[STATUS_COL] || '').toLowerCase();
  metrics.totalBugs = rows.length;
  metrics.openBySeverity = {};
  for (const b of rows.filter(x => ['open', 'reopened'].includes(status(x))))
    metrics.openBySeverity[b[SEV_COL] || '?'] = (metrics.openBySeverity[b[SEV_COL] || '?'] || 0) + 1;
  if (since) metrics.inflow = rows.filter(x => String(x[DATE_COL] || '') >= since).length;
  const verified = rows.filter(x => status(x) === 'verified').length;
  const reopened = rows.filter(x => status(x) === 'reopened').length;
  metrics.reopenRate = (verified + reopened) > 0
    ? +(100 * reopened / (verified + reopened)).toFixed(1) : 'n/a (no verified bugs yet)';
} catch (e) { console.error('bugs source unavailable:', e.message); }

// --- coverage from Traceability ---
try {
  const cov = JSON.parse(fs.readFileSync(COVERAGE));
  const covered = cov.units.filter(u => u.state === 'covered').length;
  metrics.coveragePct = +(100 * covered / cov.units.length).toFixed(1);
  metrics.gaps = cov.gaps.length;
  metrics.coverageAsOf = cov.asOf;
  // "covered" is the only state that counts as covered. The rest are named so a 30% headline
  // cannot be read as "the other 70% is untested" or as "it's fine" — blocked is not not-run.
  metrics.coverageStates = cov.units.reduce((a, u) => (a[u.state] = (a[u.state] || 0) + 1, a), {});
  metrics.gapUnits = cov.gaps;
} catch (e) { console.error('coverage source unavailable:', e.message); }

// --- numeric delta vs the most recent previous metrics file (by mtime) ---
const prevFile = fs.readdirSync(REPORTS_DIR)
  .filter(f => /^metrics-.*\.json$/.test(f) && f !== `metrics-${round}.json`)
  .map(f => ({ f, t: fs.statSync(path.join(REPORTS_DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)[0];
if (prevFile) {
  try {
    const prev = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, prevFile.f)));
    metrics.previous = prevFile.f;
    metrics.delta = {};
    for (const k of ['coveragePct', 'gaps', 'totalBugs', 'inflow', 'reopenRate'])
      if (typeof metrics[k] === 'number' && typeof prev[k] === 'number')
        metrics.delta[k] = +(metrics[k] - prev[k]).toFixed(1);
  } catch { /* previous unreadable — skip delta */ }
}

fs.writeFileSync(path.join(REPORTS_DIR, `metrics-${round}.json`), JSON.stringify(metrics, null, 2));
console.table([metrics]);
console.log('Append the block to the plan Results + a row to the QA Trends tab (real numbers).');
console.log('Trends cells this script does not compute (outflow, run health, throughput) are filled from plan Results.');
