// Render a bug SPEC (the same spec redmine-bug.mjs files to the board) into a Google Sheets
// row in the v2 one-cell format — for the QA "Bug Reports" tab OR the "Bug candidates" funnel.
// ONE spec → both outputs: the Textile board ticket (redmine-bug.mjs) and this Sheet row.
//
//   MCP_SHEETS_DIR=<mcp-sheets> node bug-row.mjs <spreadsheetId> <spec.json | specDir> [flags]
//     --candidates            Verdict column (Proposed/Approved/Rejected) instead of Status
//     --tab "<title>"         tab title (default "Bug Reports", or "Bug candidates" with --candidates)
//     --gid <n>               fixed sheetId so #gid links stay stable (default 777001 / 900001)
//
// v2 one-cell layout (REDMINE_WORKFLOW):
//   A Summary   — "<id> — <subject>" bold; severityBranch (if given) as a cell NOTE
//   B Bug report— full board text in ONE cell: bold section labels; each evidence LABEL is a link
//   C Comments  — spec.comments (free info)
//   D Status/Verdict — dropdown + per-value color chips (conditional formatting)
// Rows are UPSERTED by the id/subject in column A (re-running updates in place, never duplicates).
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

function findMcpDir() {
  if (process.env.MCP_SHEETS_DIR) return process.env.MCP_SHEETS_DIR;
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    for (const rel of ['QA-SetupKit/MCP-configurations/mcp-sheets', 'MCP-configurations/mcp-sheets']) {
      if (fs.existsSync(path.join(dir, rel, 'package.json'))) return path.join(dir, rel);
    }
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  console.error('mcp-sheets not found — set MCP_SHEETS_DIR (see QA-SetupKit/MCP-configurations/README.md)');
  process.exit(2);
}
const MCP_DIR = findMcpDir();
const require = createRequire(path.join(MCP_DIR, 'package.json'));
const { google } = require('googleapis');

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i !== -1 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : undefined; };
const CANDIDATES = argv.includes('--candidates');
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && argv[i - 1] !== '--candidates'));
const [SPREADSHEET_ID, SPEC_PATH] = positional;
if (!SPREADSHEET_ID || !SPEC_PATH) {
  console.error('usage: bug-row.mjs <spreadsheetId> <spec.json | specDir> [--candidates] [--tab "<title>"] [--gid <n>]');
  process.exit(2);
}
const TAB = String(flag('--tab') || (CANDIDATES ? 'Bug candidates' : 'Bug Reports'));
const GID = Number(flag('--gid') || (CANDIDATES ? 900001 : 777001));

// ---- load spec(s) ----
const stat = fs.statSync(SPEC_PATH);
const specFiles = stat.isDirectory()
  ? fs.readdirSync(SPEC_PATH).filter(f => f.endsWith('.json')).map(f => path.join(SPEC_PATH, f))
  : [SPEC_PATH];
let loaded = specFiles.map(f => ({ f, s: JSON.parse(fs.readFileSync(f, 'utf8')) }));
if (stat.isDirectory()) {
  // a bugs/ (or template/) dir may hold non-spec .json (e.g. the QA-record bug.example.json,
  // config.example.json) — keep only the ones shaped like a spec (have a subject).
  const before = loaded.length;
  loaded = loaded.filter(({ s }) => s.subject);
  if (loaded.length < before) console.error(`bug-row: skipped ${before - loaded.length} non-spec .json in the dir`);
}
for (const { f, s } of loaded) if (!s.subject || !s.actual || !s.expected) throw new Error(`spec ${path.basename(f)} missing subject/actual/expected`);
const specs = loaded.map(x => x.s);

// ---- render one spec into { a, note, cellText, runs, comments } ----
// Mirrors redmine-bug.mjs buildDescription, but for a Sheet cell: bold labels via textFormatRuns,
// and each evidence LABEL is itself the link (the kit's v2 rule).
function renderCell(s) {
  let text = '';
  const bold = [];        // {start,len}
  const links = [];       // {start,len,url}
  const section = (label, lines, { numbered = false } = {}) => {
    const start = text.length; text += label; bold.push({ start, len: label.length }); text += '\n';
    lines.forEach((ln, i) => { text += (numbered ? `${i + 1}. ` : '') + ln + '\n'; });
    text += '\n';
  };
  section('Preconditions:', s.preconditions || []);
  section('Steps to reproduce:', s.steps || [], { numbered: true });
  // Actual/Expected: label bold, fact on the same paragraph
  for (const [label, val] of [['Actual result:', s.actual], ['Expected result:', s.expected]]) {
    const start = text.length; text += label; bold.push({ start, len: label.length });
    text += ' ' + val + '\n\n';
  }
  // Evidence: each label IS the link — but only when there's a REAL url. A placeholder
  // (`<Mega link …>`) is not a valid URI (Sheets rejects it), so render the label bold instead:
  // the evidence line is visible and awaiting a link, never a broken one.
  for (const x of s.screenshots || []) {
    const label = typeof x === 'string' ? 'Screenshot' : x.label;
    const url = typeof x === 'string' ? x : x.url;
    const start = text.length; text += label;
    if (/^https?:\/\//.test(url || '')) links.push({ start, len: label.length, url });
    else bold.push({ start, len: label.length });
    text += '\n\n';
  }
  if (s.notes?.length) section('Notes:', s.notes);
  text = text.replace(/\n+$/, '');

  const marks = [...bold.map(b => ({ ...b, bold: true })), ...links].sort((a, b) => a.start - b.start);
  const runs = []; let idx = 0;
  for (const m of marks) {
    if (m.start > idx) runs.push({ startIndex: idx, format: {} });
    runs.push({ startIndex: m.start, format: {
      ...(m.bold ? { bold: true } : {}),
      ...(m.url ? { link: { uri: m.url }, foregroundColor: { red: 0.06, green: 0.33, blue: 0.8 }, underline: true } : {}) } });
    idx = m.start + m.len;
  }
  if (idx < text.length) runs.push({ startIndex: idx, format: {} });
  const a = `${s.id ? s.id + ' — ' : ''}${s.subject}`;
  return { a, note: s.severityBranch || '', text, runs, comments: s.comments || '' };
}

// ---- Sheets client ----
const creds = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'credentials.json')));
const token = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'token.json')));
const c = creds.installed || creds.web;
const oauth = new google.auth.OAuth2(c.client_id, c.client_secret, (c.redirect_uris && c.redirect_uris[0]) || 'http://localhost:3456');
oauth.setCredentials(token);
const sheets = google.sheets({ version: 'v4', auth: oauth });

const TEAL = { red: 0.118, green: 0.310, blue: 0.357 };
const STATUS = ['To do', 'In progress', 'To test', 'QA in Progress', 'Reopen', 'Fixed'];
const VERDICT = ['Proposed', 'Approved', 'Rejected'];
const D_VALUES = CANDIDATES ? VERDICT : STATUS;
const D_HEADER = CANDIDATES ? 'Verdict' : 'Status';
const CHIP = {
  'To do': { backgroundColor: { red: 0.851, green: 0.886, blue: 0.953 } },
  'In progress': { backgroundColor: { red: 1, green: 0.949, blue: 0.8 } },
  'To test': { backgroundColor: { red: 0.902, green: 0.835, blue: 0.961 } },
  'QA in Progress': { backgroundColor: { red: 0.816, green: 0.878, blue: 0.89 } },
  'Reopen': { backgroundColor: { red: 0.957, green: 0.8, blue: 0.8 }, textFormat: { bold: true } },
  'Fixed': { backgroundColor: { red: 0.851, green: 0.918, blue: 0.827 }, textFormat: { bold: true } },
  'Proposed': { backgroundColor: { red: 1, green: 0.949, blue: 0.8 } },
  'Approved': { backgroundColor: { red: 0.851, green: 0.918, blue: 0.827 }, textFormat: { bold: true } },
  'Rejected': { backgroundColor: { red: 0.957, green: 0.8, blue: 0.8 }, textFormat: { bold: true } },
};

// ---- ensure the tab exists (build structure once); read existing rows for upsert ----
const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets(properties(sheetId,title))' });
let tab = meta.data.sheets.find(s => s.properties.title === TAB || s.properties.sheetId === GID);
const setup = [];
if (!tab) {
  setup.push({ addSheet: { properties: { sheetId: GID, title: TAB, gridProperties: { frozenRowCount: 1 } } } });
  setup.push({ updateCells: {
    rows: [{ values: ['Summary', 'Bug report', 'Comments', D_HEADER].map(h => ({
      userEnteredValue: { stringValue: h },
      userEnteredFormat: { backgroundColor: TEAL, horizontalAlignment: 'CENTER', textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } })) }],
    range: { sheetId: GID, startRowIndex: 0, startColumnIndex: 0 }, fields: 'userEnteredValue,userEnteredFormat' } });
  for (const [i, px] of [[0, 300], [1, 820], [2, 260], [3, 130]])
    setup.push({ updateDimensionProperties: { range: { sheetId: GID, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } });
  // wrap + vertical-MIDDLE on the WHOLE range incl. the header row (house rule: ALL Sheets text
  // gets wrap + vertical-align middle). Only these two subfields are set, so the header keeps its
  // teal/center/bold.
  setup.push({ repeatCell: { range: { sheetId: GID, startRowIndex: 0, endRowIndex: 400, startColumnIndex: 0, endColumnIndex: 4 },
    cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE' } }, fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)' } });
  setup.push({ setDataValidation: { range: { sheetId: GID, startRowIndex: 1, endRowIndex: 400, startColumnIndex: 3, endColumnIndex: 4 },
    rule: { condition: { type: 'ONE_OF_LIST', values: D_VALUES.map(v => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false } } });
  D_VALUES.forEach((v, i) => setup.push({ addConditionalFormatRule: { index: i, rule: {
    ranges: [{ sheetId: GID, startRowIndex: 1, endRowIndex: 400, startColumnIndex: 3, endColumnIndex: 4 }],
    booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: v }] }, format: CHIP[v] } } } }));
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: setup } });
  const m2 = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets(properties(sheetId,title))' });
  tab = m2.data.sheets.find(s => s.properties.sheetId === GID);
}
const SHEET_ID = tab.properties.sheetId;

// existing column A (for upsert by id/summary). colA[i] is data row i, i.e. 0-based sheet row i+1
// (row 0 is the frozen header). Upsert writes to sheet row (i+1); a new bug appends after the last.
const colA = (await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${TAB}!A2:A400` })).data.values || [];

const D_DEFAULT = CANDIDATES ? 'Proposed' : 'To do';
const requests = [];
let appended = 0, updated = 0;
for (const spec of specs) {
  const r = renderCell(spec);
  let i = colA.findIndex(row => (row[0] || '') === r.a);
  if (i === -1) { i = colA.length; colA.push([r.a]); appended++; } else { updated++; }
  const sheetRow0 = i + 1;                        // 0-based sheet row (header occupies row 0)
  const dVal = spec.status || spec.verdict || D_DEFAULT;
  requests.push({ updateCells: {
    rows: [{ values: [
      { userEnteredValue: { stringValue: r.a }, userEnteredFormat: { textFormat: { bold: true } }, note: r.note },
      { userEnteredValue: { stringValue: r.text }, textFormatRuns: r.runs },
      { userEnteredValue: { stringValue: r.comments } },
      { userEnteredValue: { stringValue: dVal } },
    ] }],
    range: { sheetId: SHEET_ID, startRowIndex: sheetRow0, endRowIndex: sheetRow0 + 1, startColumnIndex: 0, endColumnIndex: 4 },
    fields: 'userEnteredValue,userEnteredFormat,note,textFormatRuns' } });
}
await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });
console.log(JSON.stringify({ tab: TAB, gid: SHEET_ID, mode: CANDIDATES ? 'candidates' : 'bug-reports',
  specs: specs.length, appended, updated,
  link: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${SHEET_ID}` }, null, 2));
