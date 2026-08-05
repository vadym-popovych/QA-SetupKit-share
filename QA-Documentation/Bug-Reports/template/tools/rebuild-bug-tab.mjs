// Rebuild the «Bug Reports» tab into the compact one-cell-per-bug layout
// (Vadym, 11/07/2026): A = Summary, B = the FULL bug report in ONE cell in the
// board (Redmine) format with BOLD section labels and clickable screenshot
// links, C = Severity, D = Status, E = Redmine link, F = Date.
// Old 16-column rows are read WITH textFormatRuns so existing Evidence links
// survive the move. Idempotent; keeps gid 777001.
//
// Link stability is machine-checked: the tab's spreadsheet id + gid are recorded in the
// project's `.link-ledger.json` (QA_LINK_LEDGER overrides the module path; deliberate
// re-point: LINK_LEDGER_ADOPT=1), and a rebuild pointed at a DIFFERENT spreadsheet
// refuses before any API call is made.
//
//   QA_SHEET_ID=<spreadsheetId> node tools/rebuild-bug-tab.mjs
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

import { fileURLToPath } from 'url';

// Find the shared mcp-sheets install by walking UP from this file — never a path on one
// person's laptop (that is exactly what made the kit unportable). Override with MCP_SHEETS_DIR.
function findMcpDir() {
  if (process.env.MCP_SHEETS_DIR) return process.env.MCP_SHEETS_DIR;
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    for (const rel of ['QA-SetupKit/MCP-configurations/mcp-sheets', 'MCP-configurations/mcp-sheets']) {
      const c = path.join(dir, rel);
      if (fs.existsSync(path.join(c, 'package.json'))) return c;
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  console.error('mcp-sheets not found — set MCP_SHEETS_DIR (see QA-SetupKit/MCP-configurations/README.md)');
  process.exit(2);
}
const MCP_DIR = findMcpDir();
const require = createRequire(path.join(MCP_DIR, 'package.json'));
const { google } = require('googleapis');
const creds = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'credentials.json')));
const token = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'token.json')));
const c = creds.installed || creds.web;
const oauth = new google.auth.OAuth2(c.client_id, c.client_secret,
  (c.redirect_uris && c.redirect_uris[0]) || 'http://localhost:3456');
oauth.setCredentials(token);
const sheets = google.sheets({ version: 'v4', auth: oauth });

// KIT TEMPLATE — the QA sheet is per project, so it comes from the environment.
const SPREADSHEET_ID = process.env.QA_SHEET_ID;
if (!SPREADSHEET_ID) {
  console.error('rebuild-bug-tab: QA_SHEET_ID is not set — refusing to rewrite an unknown spreadsheet.');
  process.exit(2);
}
const GID = 777001;

// The tab is a SHARED LINK: whoever was handed `…/edit#gid=777001` keeps opening that exact
// carrier, so a rebuild pointed at a different spreadsheet kills their link while looking,
// in the UI, exactly like an update. The carrier's identity is fully known up front (env id +
// fixed gid), so the ledger check runs BEFORE any API call — a refused run touches nothing.
const ledgerMod = process.env.QA_LINK_LEDGER || (() => {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i++) {
    for (const rel of ['QA-SetupKit/Rules-Guide/link-ledger/link-ledger.mjs', 'Rules-Guide/link-ledger/link-ledger.mjs']) {
      if (fs.existsSync(path.join(dir, rel))) return path.join(dir, rel);
    }
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  return null;
})();
if (ledgerMod) {
  const { assertStableLink, LinkLedgerError } = await import(`file://${ledgerMod}`);
  try {
    assertStableLink({ kind: 'sheet-tab', key: 'bug-reports/tab', id: SPREADSHEET_ID, gid: GID, title: 'Bug Reports' });
  } catch (e) {
    if (e instanceof LinkLedgerError) {
      console.error(`rebuild-bug-tab: ${e.message}\n  Nothing was written.`);
      process.exit(1);
    }
    throw e;
  }
} else {
  console.error('rebuild-bug-tab: WARNING — link-ledger not found, the tab\'s link stability was NOT checked (set QA_LINK_LEDGER).');
}

const TEAL = { red: 0.118, green: 0.310, blue: 0.357 }; // #1E4F5B

// ---------- read old grid with rich text ----------
const resp = await sheets.spreadsheets.get({
  spreadsheetId: SPREADSHEET_ID,
  ranges: ["'Bug Reports'!A1:P9"],
  includeGridData: true,
  fields: 'sheets(data(rowData(values(formattedValue,hyperlink,textFormatRuns))))',
});
const rows = resp.data.sheets[0].data[0].rowData || [];
const cell = (r, i) => (rows[r]?.values?.[i]) || {};
const val = (r, i) => cell(r, i).formattedValue || '';

// evidence cell -> [{text, url}] one per line
function evidenceLinks(r, i) {
  const v = cell(r, i);
  const text = v.formattedValue || '';
  if (!text) return [];
  const runs = v.textFormatRuns || [];
  const links = [];
  const lines = text.split('\n');
  let offset = 0;
  for (const line of lines) {
    const start = offset, end = offset + line.length;
    let url = null;
    for (const run of runs) {
      const rs = run.startIndex || 0;
      if (rs >= start && rs < end && run.format?.link?.uri) { url = run.format.link.uri; break; }
    }
    if (line.trim()) links.push({ text: line.trim(), url });
    offset = end + 1;
  }
  return links;
}

// ---------- compose the one-cell body per bug ----------
function buildBody(bug) {
  // returns {text, runs:[{start,end,bold,url}]}
  let text = '';
  const runs = [];
  const push = (s, fmt) => {
    if (fmt) runs.push({ start: text.length, end: text.length + s.length, ...fmt });
    text += s;
  };
  const section = (label) => { if (text) push('\n\n', null); push(label, { bold: true }); };

  if (bug.preconditions?.length) {
    section('Preconditions:');
    for (const p of bug.preconditions) push(`\n• ${p}`, null);
  }
  section('Steps to reproduce:');
  push('\n' + bug.steps, null);
  section('Actual result: ');
  push(bug.actual, null);
  section('Expected result: ');
  push(bug.expected, null);
  if (bug.screenshots?.length) {
    push('\n', null);
    for (const s of bug.screenshots) {
      push('\n', null);
      push(s.text, s.url ? { url: s.url, bold: s.text.startsWith('🖍') } : { bold: false });
    }
  }
  if (bug.notes?.length) {
    section('Notes:');
    for (const n of bug.notes) push(`\n• ${n}`, null);
  }
  return { text, runs };
}

const bugs = [];
for (let r = 1; r < rows.length; r++) {
  const id = val(r, 0);
  if (!id.startsWith('BUG-')) continue;
  const notes = [];
  if (val(r, 5)) notes.push(`Component: ${val(r, 5)}`);
  if (val(r, 11)) notes.push(`Tags: ${val(r, 11)}`);
  if (val(r, 12)) notes.push(`Invariant: ${val(r, 12)}`);
  if (val(r, 14)) notes.push(val(r, 14)); // Duplicate of / occurrence note
  bugs.push({
    id,
    date: val(r, 1),
    severity: val(r, 2),
    sevBranch: val(r, 3),
    summary: `${id} — ${val(r, 6)}`,
    steps: val(r, 7),
    expected: val(r, 8),
    actual: val(r, 9),
    screenshots: evidenceLinks(r, 10),
    status: val(r, 13),
    redmine: { label: val(r, 15), url: cell(r, 15).hyperlink || null },
    notes,
  });
}
console.log(`read ${bugs.length} bugs from the old layout`);

// ---------- build new grid ----------
const header = ['Summary', 'Bug report', 'Severity', 'Status', 'Redmine', 'Date'];
const rowData = [{
  values: header.map(h => ({
    userEnteredValue: { stringValue: h },
    userEnteredFormat: {
      backgroundColor: TEAL, horizontalAlignment: 'CENTER',
      textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
    },
  })),
}];

for (const b of bugs) {
  const body = buildBody(b);
  const bodyRuns = [];
  for (const run of body.runs) {
    const format = {};
    if (run.bold) format.bold = true;
    if (run.url) { format.link = { uri: run.url }; }
    bodyRuns.push({ startIndex: run.start, format });
    bodyRuns.push({ startIndex: run.end, format: {} });
  }
  // merge/normalize runs (Sheets wants ascending unique startIndex)
  const seen = new Map();
  for (const r of bodyRuns) seen.set(r.startIndex, r);
  const norm = [...seen.values()].sort((a, b2) => a.startIndex - b2.startIndex)
    .filter(r => r.startIndex < body.text.length);

  const base = { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' };
  rowData.push({
    values: [
      { userEnteredValue: { stringValue: b.summary },
        userEnteredFormat: { ...base, textFormat: { bold: true } },
        note: b.sevBranch || undefined },
      { userEnteredValue: { stringValue: body.text },
        userEnteredFormat: { ...base, textFormat: { fontSize: 9 } },
        textFormatRuns: norm },
      { userEnteredValue: { stringValue: b.severity }, userEnteredFormat: { ...base, horizontalAlignment: 'CENTER' } },
      { userEnteredValue: { stringValue: b.status }, userEnteredFormat: { ...base, horizontalAlignment: 'CENTER' } },
      b.redmine.url
        ? { userEnteredValue: { formulaValue: `=HYPERLINK("${b.redmine.url}";"${b.redmine.label}")` },
            userEnteredFormat: { ...base, horizontalAlignment: 'CENTER' } }
        : { userEnteredValue: { stringValue: '' }, userEnteredFormat: base },
      { userEnteredValue: { stringValue: b.date }, userEnteredFormat: { ...base, horizontalAlignment: 'CENTER' } },
    ],
  });
}

const requests = [
  // wipe the old grid (values + formats) A1:P20
  { updateCells: { range: { sheetId: GID, startRowIndex: 0, endRowIndex: 20, startColumnIndex: 0, endColumnIndex: 16 }, fields: '*' } },
  // write the new grid
  { updateCells: { rows: rowData, range: { sheetId: GID, startRowIndex: 0, startColumnIndex: 0 }, fields: 'userEnteredValue,userEnteredFormat,textFormatRuns,note' } },
  // column widths: A 300, B 780, C-F 100
  { updateDimensionProperties: { range: { sheetId: GID, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 300 }, fields: 'pixelSize' } },
  { updateDimensionProperties: { range: { sheetId: GID, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 780 }, fields: 'pixelSize' } },
  { updateDimensionProperties: { range: { sheetId: GID, dimension: 'COLUMNS', startIndex: 2, endIndex: 6 }, properties: { pixelSize: 100 }, fields: 'pixelSize' } },
  // drop the now-empty columns G:P
  { deleteDimension: { range: { sheetId: GID, dimension: 'COLUMNS', startIndex: 6, endIndex: 16 } } },
  { updateSheetProperties: { properties: { sheetId: GID, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
];

await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });
console.log(`rebuilt: ${bugs.length} bugs in one-cell layout (A=Summary, B=report, C=Severity, D=Status, E=Redmine, F=Date)`);
