// Compute the QA metric set from artefacts — counting only, NO estimation logic.
// Copy to <Project>/QA-Reports/tools/. Run after a round closes:
//   node qa-metrics.mjs --round <plan-slug> [--since YYYY-MM-DD]
// Output: <Project>/QA-Reports/metrics-<round>.json + console table, with numeric
// deltas vs the most recent previous metrics file (by mtime).
//
// Metrics not derivable from present sources report a REASONED n/a:
//   "n/a (source missing)" — the artefact isn't there;
//   "n/a (pass --since)"   — inflow needs the round's start date.
//
// Sheets access reuses the shared mcp-sheets OAuth. Resolution order (multi-user
// rule): MCP_SHEETS_DIR env override → walk up from cwd to the first .mcp.json and
// take mcpServers["google-sheets"].args[0]'s directory. No hardcoded paths.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// ==== FILL PER PROJECT ====
const SHEET_ID = 'TODO';                       // project QA Sheet
const BUGS_RANGE = "'Bug Reports'!A2:Z";       // header on row 1
const SEV_COL = 2, STATUS_COL = 13, DATE_COL = 1; // 0-based, per your tab mapping (Bug-Reports SETUP)
// ==========================

// Paths anchored to the script location, not cwd: tools/ → QA-Reports/ → <Project>/
const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(TOOLS_DIR, '..');
const STRATEGY_DIR = path.join(REPORTS_DIR, '..', 'Test-Strategy');

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
  openBySeverity: 'n/a (source missing)', totalBugs: 'n/a (source missing)',
  inflow: since ? 'n/a (source missing)' : 'n/a (pass --since)',
  reopenRate: 'n/a (source missing)',
  coveragePct: 'n/a (source missing)', gaps: 'n/a (source missing)' };

// --- bugs from the Sheet ---
const MCP_DIR = findMcpSheetsDir();
if (!MCP_DIR || !fs.existsSync(path.join(MCP_DIR, 'token.json'))) {
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
  const cov = JSON.parse(fs.readFileSync(path.join(STRATEGY_DIR, 'coverage.json')));
  const covered = cov.units.filter(u => u.state === 'covered').length;
  metrics.coveragePct = +(100 * covered / cov.units.length).toFixed(1);
  metrics.gaps = cov.gaps.length;
  metrics.coverageAsOf = cov.asOf;
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
