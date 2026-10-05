// Write a ROUND's statuses into an existing checklist Sheet — from an auditable map file,
// never by hand. The map is the artefact that survives the round; the Sheet is its projection.
//
//   SSID=<spreadsheetId> node checklist-status.mjs dump
//       → prints the tab as row-numbered TSV (row \t A \t B \t C \t D \t E), so every verdict
//         can be pinned to a row number instead of being counted by eye.
//   SSID=<spreadsheetId> node checklist-status.mjs write <map.json> [--status-col C] [--comment-col E]
//       → writes one status + one comment per row. Refuses a status outside the vocabulary.
//
// map.json:  { "<row>": ["<status>", "<comment>"], ... }
//   "Passed" | "Failed" | "Skipped" | ""     ("" = not run YET this round)
//   `Partial` is NEVER written — it is a COMPUTED value of the result column (CHECKLIST_RULES).
//   A `Skipped` row without a comment is refused: the reason is mandatory, not optional.
// Rows absent from the map are left untouched, so a second platform's round cannot overwrite
// the first one's block.
//
// Env: SSID (required) · CHECKLIST_TAB (default "Checklist") · MCP_SHEETS_DIR (else resolved
// from the nearest .mcp.json, like the kit's other Sheets tools).
import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';

const SSID = process.env.SSID;
const TAB  = process.env.CHECKLIST_TAB || 'Checklist';
const STATUSES = new Set(['Passed', 'Failed', 'Skipped', '']);

if (!SSID) {
  console.error('checklist-status: SSID is not set — refusing to guess which checklist to write to.');
  process.exit(2);
}

function findMcpSheetsDir() {
  if (process.env.MCP_SHEETS_DIR) return process.env.MCP_SHEETS_DIR;
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    const cfgPath = dir + '/.mcp.json';
    if (existsSync(cfgPath)) {
      try {
        const arg0 = JSON.parse(readFileSync(cfgPath, 'utf8')).mcpServers?.['google-sheets']?.args?.[0];
        if (arg0) return dirname(resolve(arg0));
      } catch {}
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

const MCP_DIR = findMcpSheetsDir();
if (!MCP_DIR) {
  console.error('checklist-status: cannot locate the google-sheets MCP server.');
  console.error('Set MCP_SHEETS_DIR, or configure .mcp.json (mcpServers["google-sheets"].args[0]).');
  process.exit(1);
}
if (!existsSync(MCP_DIR + '/token.json')) {
  console.error(`checklist-status: no token.json at ${MCP_DIR} — run \`node server.mjs --auth\` there first.`);
  process.exit(1);
}

const require = createRequire(MCP_DIR + '/');
const { google } = require('googleapis');
const creds = JSON.parse(readFileSync(MCP_DIR + '/credentials.json', 'utf8'));
const token = JSON.parse(readFileSync(MCP_DIR + '/token.json', 'utf8'));
const cfg = creds.installed || creds.web;
const auth = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, (cfg.redirect_uris || [])[0]);
auth.setCredentials(token);
const api = google.sheets({ version: 'v4', auth });

const argv = process.argv.slice(2);
const mode = argv[0];
const flag = (name, dflt) => { const i = argv.indexOf(name); return i !== -1 && argv[i + 1] ? argv[i + 1] : dflt; };

if (mode === 'dump') {
  const res = await api.spreadsheets.values.get({ spreadsheetId: SSID, range: `${TAB}!A1:F400` });
  const clean = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ⏎ ');
  (res.data.values || []).forEach((r, i) => {
    console.log([i + 1, clean(r[0]), clean(r[1]), clean(r[2]), clean(r[3]), clean(r[4])].join('\t'));
  });
  process.exit(0);
}

if (mode === 'write') {
  const mapPath = argv[1];
  if (!mapPath) { console.error('checklist-status write: <map.json> is required'); process.exit(2); }
  const statusCol  = flag('--status-col', 'C');
  const commentCol = flag('--comment-col', 'E');
  const map = JSON.parse(readFileSync(mapPath, 'utf8'));

  const problems = [];
  for (const [row, val] of Object.entries(map)) {
    const [status, comment = ''] = Array.isArray(val) ? val : [val, ''];
    if (!STATUSES.has(status)) problems.push(`row ${row}: status "${status}" is not one of Passed / Failed / Skipped / "" (Partial is computed, never written)`);
    if (status === 'Skipped' && !comment.trim()) problems.push(`row ${row}: Skipped without a reason comment — the reason is mandatory`);
  }
  if (problems.length) { problems.forEach(p => console.error('✗ ' + p)); process.exit(2); }

  const data = [];
  for (const [row, val] of Object.entries(map)) {
    const [status, comment = ''] = Array.isArray(val) ? val : [val, ''];
    data.push({ range: `${TAB}!${statusCol}${row}`, values: [[status]] });
    if (comment) data.push({ range: `${TAB}!${commentCol}${row}`, values: [[comment]] });
  }
  const res = await api.spreadsheets.values.batchUpdate({
    spreadsheetId: SSID, requestBody: { valueInputOption: 'RAW', data },
  });
  const counts = Object.values(map).reduce((a, v) => { const s = Array.isArray(v) ? v[0] : v; a[s || 'blank'] = (a[s || 'blank'] || 0) + 1; return a; }, {});
  console.log(JSON.stringify({ tab: TAB, rows: Object.keys(map).length, cells: res.data.totalUpdatedCells, counts }, null, 2));
  process.exit(0);
}

console.error('usage: SSID=<id> node checklist-status.mjs dump | write <map.json> [--status-col C] [--comment-col E]');
process.exit(1);
