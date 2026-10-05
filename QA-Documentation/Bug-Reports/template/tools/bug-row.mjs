// Render a bug SPEC (the same spec redmine-bug.mjs files to the board) into a Google Sheets
// row in the v2 one-cell format — for the QA "Bug Reports" tab OR the "Bug candidates" funnel.
// ONE spec → both outputs: the Textile board ticket (redmine-bug.mjs) and this Sheet row.
//
//   MCP_SHEETS_DIR=<mcp-sheets> node bug-row.mjs <spreadsheetId> <spec.json | specDir> [flags]
//     --candidates            Verdict column (Proposed/Approved/Rejected) instead of Status
//     --tab "<title>"         tab title (default "Bug Reports", or "Bug candidates" with --candidates)
//     --gid <n>               fixed sheetId so #gid links stay stable (default 777001 / 900001)
//     --rejected-tab "<t>"    (--candidates) where Rejected rows are moved (default "Rejected Bugs")
//     --rejected-gid <n>      its fixed sheetId (default 900002)
//     --list-tab "<t>"        (--candidates) the paste-ready board list (default "Board checklist")
//     --list-gid <n>          its fixed sheetId (default 900003)
//
// v2 one-cell layout (REDMINE_WORKFLOW):
//   A Summary   — "<id> — <subject>" bold; severityBranch (if given) as a cell NOTE
//   B Bug report— full board text in ONE cell: bold section labels; each evidence LABEL is a link
//   C Comments  — spec.comments (free info; headed "AI Comments" in --candidates mode)
//   D Status/Verdict — dropdown + per-value color chips (conditional formatting)
//   E Owner's Comments (--candidates) — the owner's column; the tool writes only its header
// Rows are UPSERTED by the id/subject in column A (re-running updates in place, never duplicates).
// OWNERSHIP: A–C are the spec's projection and are rewritten on every run. D is the OWNER's
// decision (a verdict, or the board status) — written ONLY when a row is appended or its D cell is
// empty, NEVER over a value someone chose (a rerun once reset every owner verdict to "Proposed").
// One exception: a not-reproduced RE-CHECK (spec.recheck, or the legacy spec.verdict
// "Not reproduced/Fixed") replaces the default "Proposed" — and only that default. When a re-check
// disagrees with a verdict the owner chose, C turns amber with a ⚠ line and the row is reported in
// `needsOwner`; his verdict is still left alone.
// Columns from E on are never written at all, so the owner may add their own columns there.
// REJECTED (--candidates): every run first MOVES rows whose Verdict is "Rejected" — whole row, all
// columns, formatting and links, the owner's comments included — to the "Rejected Bugs" tab of the
// same file, then deletes them from the funnel. A spec whose row sits there is never re-appended.
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
// "Not reproduced/Fixed" is the one verdict the AGENT may set: a re-check on a newer build no longer
// shows the defect (spec.verdict). It is written only over the default "Proposed" — never over a
// value the owner chose (owner instruction, 29/09/2026).
const VERDICT = ['Proposed', 'Approved', 'Rejected', 'Not reproduced/Fixed'];
const AGENT_VERDICTS = new Set(['Not reproduced/Fixed']);
const D_VALUES = CANDIDATES ? VERDICT : STATUS;
const D_HEADER = CANDIDATES ? 'Verdict' : 'Status';
const HEADERS = CANDIDATES
  ? ['Summary', 'Bug report', 'AI Comments', D_HEADER, "Owner's Comments"]
  : ['Summary', 'Bug report', 'Comments', D_HEADER];
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
  'Not reproduced/Fixed': { backgroundColor: { red: 0.851, green: 0.851, blue: 0.851 }, textFormat: { italic: true } },
};

// ---- ensure the tab exists (build structure once); read existing rows for upsert ----
const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets(properties(sheetId,title))' });
let tab = meta.data.sheets.find(s => s.properties.title === TAB || s.properties.sheetId === GID);
const setup = [];
if (!tab) {
  setup.push({ addSheet: { properties: { sheetId: GID, title: TAB, gridProperties: { frozenRowCount: 1 } } } });
  setup.push({ updateCells: {
    rows: [{ values: HEADERS.map(h => ({
      userEnteredValue: { stringValue: h },
      userEnteredFormat: { backgroundColor: TEAL, horizontalAlignment: 'CENTER', textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } })) }],
    range: { sheetId: GID, startRowIndex: 0, startColumnIndex: 0 }, fields: 'userEnteredValue,userEnteredFormat' } });
  for (const [i, px] of [[0, 300], [1, 820], [2, 260], [3, 130], [4, 300]].slice(0, HEADERS.length))
    setup.push({ updateDimensionProperties: { range: { sheetId: GID, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } });
  // wrap + vertical-MIDDLE on the WHOLE range incl. the header row (house rule: ALL Sheets text
  // gets wrap + vertical-align middle). Only these two subfields are set, so the header keeps its
  // teal/center/bold.
  setup.push({ repeatCell: { range: { sheetId: GID, startRowIndex: 0, endRowIndex: 400, startColumnIndex: 0, endColumnIndex: HEADERS.length },
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

// ---- keep the D dropdown + chips in step with D_VALUES on an EXISTING tab (a value added to the
// dictionary later must reach tabs built before it). The owner's own extra list values are kept:
// the new list is the union, and a chip is only added for a value that has none yet.
{
  const v = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, ranges: [`'${tab.properties.title}'!D2`],
    fields: 'sheets(properties(sheetId),conditionalFormats,data(rowData(values(dataValidation))))' });
  const sh = v.data.sheets.find(x => x.properties.sheetId === tab.properties.sheetId);
  const dv = sh.data?.[0]?.rowData?.[0]?.values?.[0]?.dataValidation;
  const have = (dv?.condition?.values || []).map(x => x.userEnteredValue);
  const union = [...have, ...D_VALUES.filter(x => !have.includes(x))];
  const chipped = new Set((sh.conditionalFormats || []).flatMap(cf => (cf.booleanRule?.condition?.values || []).map(x => x.userEnteredValue)));
  const fix = [];
  if (union.length !== have.length) fix.push({ setDataValidation: { range: { sheetId: tab.properties.sheetId, startRowIndex: 1, endRowIndex: 400, startColumnIndex: 3, endColumnIndex: 4 },
    rule: { condition: { type: 'ONE_OF_LIST', values: union.map(x => ({ userEnteredValue: x })) }, showCustomUi: true, strict: false } } });
  for (const x of D_VALUES) if (!chipped.has(x) && CHIP[x]) fix.push({ addConditionalFormatRule: { index: 0, rule: {
    ranges: [{ sheetId: tab.properties.sheetId, startRowIndex: 1, endRowIndex: 400, startColumnIndex: 3, endColumnIndex: 4 }],
    booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: x }] }, format: CHIP[x] } } } });
  if (fix.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: fix } });
}

// ---- (--candidates) VERDICT + OWNER'S COMMENTS SYNC with the Board checklist tab ----
// The owner may decide in either tab. Before anything else runs, a value he set in one tab reaches
// the other where that one is still empty / the default "Proposed" (so a Rejected set on the list
// is archived in this same run). Two DIFFERENT non-default verdicts are never resolved by the tool:
// the list row keeps its own and is flagged amber, and the conflict is reported in needsOwner.
const LIST_TAB = String(flag('--list-tab') || 'Board checklist');
const LIST_GID = Number(flag('--list-gid') || 900003);
const idOf = a => String(a || '').split(' — ')[0].trim();
const listOwner = new Map();                      // id → { d, e } as found on the list tab
const verdictConflict = new Map();                // id → list verdict that differs from the main one
if (CANDIDATES) {
  const all = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets(properties(sheetId,title))' });
  const lt0 = all.data.sheets.find(x => x.properties.sheetId === LIST_GID || x.properties.title === LIST_TAB);
  if (lt0) {
    const lv = (await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${lt0.properties.title}'!A1:E400` })).data.values || [];
    const hdr = lv[0] || [];
    if (hdr[0] === 'ID' && hdr[3] === 'Verdict')    // only the current layout carries owner columns
      for (const r of lv.slice(1)) if (r[0]) listOwner.set(r[0], { d: String(r[3] || '').trim(), e: String(r[4] || '').trim() });
  }
  if (listOwner.size) {
    const mv = (await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${TAB}'!A2:E400` })).data.values || [];
    const upd = [];
    mv.forEach((r, i) => {
      const lo = listOwner.get(idOf(r[0])); if (!lo) return;
      const md = String(r[3] || '').trim(), me = String(r[4] || '').trim();
      const isDef = v => !v || v === 'Proposed';
      if (!isDef(lo.d) && isDef(md)) upd.push({ range: `'${TAB}'!D${i + 2}`, values: [[lo.d]] });
      else if (!isDef(lo.d) && !isDef(md) && lo.d !== md) verdictConflict.set(idOf(r[0]), lo.d);
      if (lo.e && !me) upd.push({ range: `'${TAB}'!E${i + 2}`, values: [[lo.e]] });
    });
    if (upd.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: upd } });
  }
}

// ---- (--candidates) move owner-Rejected rows to the archive tab ----
const REJ_TAB = String(flag('--rejected-tab') || 'Rejected Bugs');
const REJ_GID = Number(flag('--rejected-gid') || 900002);
let moved = 0;
let archived = new Set();
if (CANDIDATES) {
  const full = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, ranges: [`'${TAB}'!A1:Z1`],
    fields: 'sheets(properties(sheetId,title,gridProperties(columnCount)),data(columnMetadata(pixelSize)))' });
  const src = full.data.sheets.find(x => x.properties.sheetId === SHEET_ID);
  const nCols = src.properties.gridProperties.columnCount;
  const all = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets(properties(sheetId,title))' });
  let rej = all.data.sheets.find(x => x.properties.title === REJ_TAB || x.properties.sheetId === REJ_GID);
  if (!rej) {
    // a copy of the funnel's header row, widths, wrap, dropdown and colour chips — the owner's
    // current layout, whatever columns he added, not the tool's defaults
    const mk = [{ addSheet: { properties: { sheetId: REJ_GID, title: REJ_TAB, gridProperties: { frozenRowCount: 1, columnCount: nCols } } } },
      { copyPaste: { source: { sheetId: SHEET_ID, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: nCols },
        destination: { sheetId: REJ_GID, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: nCols }, pasteType: 'PASTE_NORMAL' } },
      { copyPaste: { source: { sheetId: SHEET_ID, startRowIndex: 1, endRowIndex: 400, startColumnIndex: 0, endColumnIndex: nCols },
        destination: { sheetId: REJ_GID, startRowIndex: 1, endRowIndex: 400, startColumnIndex: 0, endColumnIndex: nCols }, pasteType: 'PASTE_FORMAT' } },
      { copyPaste: { source: { sheetId: SHEET_ID, startRowIndex: 1, endRowIndex: 400, startColumnIndex: 0, endColumnIndex: nCols },
        destination: { sheetId: REJ_GID, startRowIndex: 1, endRowIndex: 400, startColumnIndex: 0, endColumnIndex: nCols }, pasteType: 'PASTE_DATA_VALIDATION' } },
      { copyPaste: { source: { sheetId: SHEET_ID, startRowIndex: 1, endRowIndex: 400, startColumnIndex: 0, endColumnIndex: nCols },
        destination: { sheetId: REJ_GID, startRowIndex: 1, endRowIndex: 400, startColumnIndex: 0, endColumnIndex: nCols }, pasteType: 'PASTE_CONDITIONAL_FORMATTING' } }];
    (src.data?.[0]?.columnMetadata || []).forEach((cm, i) => cm.pixelSize && mk.push({ updateDimensionProperties: {
      range: { sheetId: REJ_GID, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: cm.pixelSize }, fields: 'pixelSize' } }));
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: mk } });
    rej = { properties: { sheetId: REJ_GID, title: REJ_TAB } };
  }
  const RID = rej.properties.sheetId, RTITLE = rej.properties.title;
  const rejA = (await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${RTITLE}'!A2:A400` })).data.values || [];
  const cur = (await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${TAB}'!A2:D400` })).data.values || [];
  const toMove = cur.map((row, i) => ({ i, a: row[0] || '', d: String(row[3] || '').trim() })).filter(x => x.d === 'Rejected');
  if (toMove.length) {
    const reqs = [];
    let dest = rejA.length + 1;                    // 0-based row after the archive's last
    for (const x of toMove) {
      reqs.push({ copyPaste: { source: { sheetId: SHEET_ID, startRowIndex: x.i + 1, endRowIndex: x.i + 2, startColumnIndex: 0, endColumnIndex: nCols },
        destination: { sheetId: RID, startRowIndex: dest, endRowIndex: dest + 1, startColumnIndex: 0, endColumnIndex: nCols }, pasteType: 'PASTE_NORMAL' } });
      dest++;
    }
    for (const x of [...toMove].reverse())         // bottom-up so earlier indices stay valid
      reqs.push({ deleteDimension: { range: { sheetId: SHEET_ID, dimension: 'ROWS', startIndex: x.i + 1, endIndex: x.i + 2 } } });
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: reqs } });
    moved = toMove.length;
  }
  archived = new Set([...rejA.map(r => r[0] || ''), ...toMove.map(x => x.a)]);
}

// existing columns A–D (A for upsert by id/summary, D to see whether the owner already decided).
// colA[i] is data row i, i.e. 0-based sheet row i+1 (row 0 is the frozen header). Upsert writes to
// sheet row (i+1); a new bug appends after the last.
const colA = (await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${TAB}'!A2:D400` })).data.values || [];

const D_DEFAULT = CANDIDATES ? 'Proposed' : 'To do';
const requests = [];
let appended = 0, updated = 0, kept = 0, skippedRejected = 0;
const finalD = new Map();                         // spec id → the verdict the row ends up with
const needsOwner = [];
const AMBER = { red: 1, green: 0.851, blue: 0.4 }, WHITE = { red: 1, green: 1, blue: 1 };
const ROSE = { red: 0.957, green: 0.78, blue: 0.765 };   // re-checked on the owner's request: reproduced
for (const spec of specs) {
  const r = renderCell(spec);
  if (archived.has(r.a) || (spec.id && [...archived].some(x => String(x).startsWith(`${spec.id} — `)))) { skippedRejected++; continue; } // the owner rejected it — stays in the archive
  // match by ID when the spec has one, so a subject edit updates the row instead of duplicating it
  const byId = spec.id ? `${spec.id} — ` : null;
  let i = colA.findIndex(row => byId ? String(row[0] || '').startsWith(byId) || (row[0] || '') === spec.id : (row[0] || '') === r.a);
  if (i === -1) { i = colA.length; colA.push([r.a]); appended++; } else { updated++; }
  const sheetRow0 = i + 1;                        // 0-based sheet row (header occupies row 0)
  const ownerD = String(colA[i][3] || '').trim();
  // RE-CHECK vs the owner's verdict (owner, 29/09/2026). spec.recheck = { result:
  // "not-reproduced" | "reproduced", build, date }; the legacy spec.verdict "Not reproduced/Fixed"
  // counts as a not-reproduced re-check. The agent's finding never overwrites a verdict the owner
  // chose — when the two disagree, C turns AMBER and opens with a ⚠ line naming his verdict, and the
  // row is listed in `needsOwner` so the hand-over message asks him about it.
  const rc = spec.recheck || (AGENT_VERDICTS.has(spec.verdict) ? { result: 'not-reproduced' } : null);
  const rcWhere = rc ? [rc.build && `on ${rc.build}`, rc.date].filter(Boolean).join(', ') : '';
  let dWrite = null, flag = null;
  if (CANDIDATES && rc?.result === 'not-reproduced') {
    if (!ownerD || ownerD === D_DEFAULT) dWrite = 'Not reproduced/Fixed';
    else if (ownerD !== 'Not reproduced/Fixed' && ownerD !== 'Rejected')
      flag = `⚠ NOT REPRODUCED${rcWhere ? ' ' + rcWhere : ''} — your verdict: ${ownerD}, needs your decision`;
  } else if (CANDIDATES && rc?.result === 'reproduced' && ownerD === 'Not reproduced/Fixed') {
    flag = `⚠ REPRODUCED AGAIN${rcWhere ? ' ' + rcWhere : ''} — your verdict: ${ownerD}, needs your decision`;
  }
  if (flag) needsOwner.push(`${spec.id || r.a}: ${flag.slice(2)}`);
  // RE-CHECK THE OWNER ASKED FOR (owner, 30/09/2026): he could not reproduce it and asked the agent
  // to try again. A reproduced answer gets its own colour and a first line saying how; a
  // not-reproduced answer follows the ordinary not-reproduced path above.
  let asked = null;
  if (CANDIDATES && rc?.ownerAsked && !flag)
    asked = `RE-CHECKED ON YOUR REQUEST — ${rc.result === 'reproduced' ? 'REPRODUCED' : 'NOT REPRODUCED'}${rcWhere ? ' ' + rcWhere : ''}${rc.note ? ': ' + rc.note : ''}`;
  const BASE = { wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE' };
  // where the candidate stands against the board (REDMINE_WORKFLOW, checklist format) — shown on
  // every row that the board-matching pass has looked at, so the owner sees what he already filed
  const board = !CANDIDATES ? '' : spec.onBoard ? `ON BOARD — ${spec.onBoard} (already filed)`
    : spec.boardOverlap ? `PARTLY ON BOARD — ${spec.boardOverlap}` : spec.boardLine ? 'NOT ON BOARD YET' : '';
  const body = board ? `${board}\n\n${r.comments}` : r.comments;
  const lead = flag || asked;
  const cText = lead ? `${lead}\n\n${body}` : body;
  const values = [
    { userEnteredValue: { stringValue: r.a }, userEnteredFormat: { ...BASE, textFormat: { bold: true } }, note: r.note },
    { userEnteredValue: { stringValue: r.text }, userEnteredFormat: BASE, textFormatRuns: r.runs },
    { userEnteredValue: { stringValue: cText },
      userEnteredFormat: { ...BASE, backgroundColor: flag ? AMBER : asked ? (rc.result === 'reproduced' ? ROSE : WHITE) : WHITE },
      ...(lead ? { textFormatRuns: [{ startIndex: 0, format: { bold: true } }, { startIndex: lead.length, format: {} }] } : {}) },
  ];
  finalD.set(spec.id, dWrite || ownerD || spec.status || spec.verdict || D_DEFAULT);
  if (dWrite) values.push({ userEnteredValue: { stringValue: dWrite } });
  else if (ownerD) kept++;                        // the owner's D stands — never overwritten
  else values.push({ userEnteredValue: { stringValue: spec.status || spec.verdict || D_DEFAULT } });
  requests.push({ updateCells: {
    rows: [{ values }],
    range: { sheetId: SHEET_ID, startRowIndex: sheetRow0, endRowIndex: sheetRow0 + 1, startColumnIndex: 0, endColumnIndex: values.length },
    fields: 'userEnteredValue,userEnteredFormat,note,textFormatRuns' } });
}
if (requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });

// ---- (--candidates) the BOARD LIST: one paste-ready line per open candidate, in the format the
// team's tracker checklist uses (owner, 30/09/2026):
//   N. *[<App | BE | App/BE> - <Story x.y or the broken area>]* <What? Where? When?> *Screenshot:* <url>
// ("Screen record:" when the primary evidence is a video; the url is a live link). Columns as on the
// funnel: ID · Checklist item · AI Comments · Verdict · Owner's Comments — the last two are the
// owner's and stay in sync with the funnel (see the SYNC block above). Only specs with a
// `boardLine` {platform, area, summary}; left out: rejected, Not reproduced/Fixed and anything
// already on the board (`onBoard`). Rebuilt on every run under the same gid; owner values survive
// because they are carried over by ID.
let listed = 0;
if (CANDIDATES) {
  const HDR = ['ID', 'Checklist item (paste into the board)', 'AI Comments', 'Verdict', "Owner's Comments"];
  const m = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets(properties(sheetId,title))' });
  let lt = m.data.sheets.find(x => x.properties.title === LIST_TAB || x.properties.sheetId === LIST_GID);
  const L_ID = lt ? lt.properties.sheetId : LIST_GID;
  const setup2 = [];
  if (!lt) setup2.push({ addSheet: { properties: { sheetId: L_ID, title: LIST_TAB, gridProperties: { frozenRowCount: 1 } } } });
  // (re)apply the layout every run — cheap, idempotent, and it upgrades a tab built by an older version
  setup2.push({ updateCells: { rows: [{ values: HDR.map(h => ({ userEnteredValue: { stringValue: h },
      userEnteredFormat: { backgroundColor: TEAL, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', wrapStrategy: 'WRAP',
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } })) }],
    range: { sheetId: L_ID, startRowIndex: 0, startColumnIndex: 0 }, fields: 'userEnteredValue,userEnteredFormat' } });
  for (const [i, px] of [[0, 70], [1, 760], [2, 260], [3, 150], [4, 300]])
    setup2.push({ updateDimensionProperties: { range: { sheetId: L_ID, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } });
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: setup2 } });
  // dropdown + chips on the list's Verdict column (same dictionary; the owner's extra values kept)
  {
    const v = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, ranges: [`'${LIST_TAB}'!D2`],
      fields: 'sheets(properties(sheetId),conditionalFormats,data(rowData(values(dataValidation))))' });
    const sh = v.data.sheets.find(x => x.properties.sheetId === L_ID);
    const have = (sh.data?.[0]?.rowData?.[0]?.values?.[0]?.dataValidation?.condition?.values || []).map(x => x.userEnteredValue);
    const union = [...have, ...D_VALUES.filter(x => !have.includes(x))];
    const chipped = new Set((sh.conditionalFormats || []).flatMap(cf => (cf.booleanRule?.condition?.values || []).map(x => x.userEnteredValue)));
    const fix = [{ setDataValidation: { range: { sheetId: L_ID, startRowIndex: 1, endRowIndex: 400, startColumnIndex: 3, endColumnIndex: 4 },
      rule: { condition: { type: 'ONE_OF_LIST', values: union.map(x => ({ userEnteredValue: x })) }, showCustomUi: true, strict: false } } }];
    for (const x of D_VALUES) if (!chipped.has(x) && CHIP[x]) fix.push({ addConditionalFormatRule: { index: 0, rule: {
      ranges: [{ sheetId: L_ID, startRowIndex: 1, endRowIndex: 400, startColumnIndex: 3, endColumnIndex: 4 }],
      booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: x }] }, format: CHIP[x] } } } });
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: fix } });
  }
  // the funnel's owner columns AFTER this run (verdicts may have been synced or set above)
  const mainNow = new Map(((await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${TAB}'!A2:E400` })).data.values || [])
    .map(r => [idOf(r[0]), { c: r[2] || '', d: String(r[3] || '').trim(), e: String(r[4] || '').trim() }]));
  const idNum = id => String(id).match(/\d+|[a-z]+$/gi).map(x => isNaN(x) ? x : x.padStart(4, '0')).join('');
  const isArchived = sp => archived.has(renderCell(sp).a) || [...archived].some(x => String(x).startsWith(`${sp.id} — `));
  const open = specs.filter(sp => sp.boardLine && !sp.onBoard && !isArchived(sp)
    && !['Rejected', 'Not reproduced/Fixed'].includes(mainNow.get(sp.id)?.d ?? finalD.get(sp.id)))
    .sort((a, b) => idNum(a.id).localeCompare(idNum(b.id)));
  const BASE = { wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE' };
  const rowsOut = open.map((sp, n) => {
    const b = sp.boardLine, ev = (sp.screenshots || []).find(x => /^https?:\/\//.test(x?.url || ''));
    const kind = ev && /^VIDEO/i.test(ev.label) ? 'Screen record' : 'Screenshot';
    const head = `${n + 1}. *[${b.platform} - ${b.area}]* ${b.summary}${ev ? ` *${kind}:* ` : ''}`;
    const text = head + (ev ? ev.url : '');
    const main = mainNow.get(sp.id) || { c: '', d: '', e: '' };
    const lo = listOwner.get(sp.id) || {};
    const conflict = verdictConflict.get(sp.id);
    const d = conflict ? lo.d : (main.d || lo.d || D_DEFAULT);
    const e = main.e || lo.e || '';
    let c = main.c, flagged = /^⚠/.test(c); const askedRepro = /^RE-CHECKED ON YOUR REQUEST — REPRODUCED/.test(c);
    if (conflict) { const fl = `⚠ VERDICTS DIFFER BETWEEN TABS — here: ${conflict}, «${TAB}»: ${main.d} — needs your decision`;
      c = `${fl}\n\n${c}`; flagged = true; needsOwner.push(`${sp.id}: ${fl.slice(2)}`); }
    const flagLen = (flagged || askedRepro || /^RE-CHECKED ON YOUR REQUEST/.test(c)) ? c.indexOf('\n') : 0;
    return { values: [
      { userEnteredValue: { stringValue: sp.id }, userEnteredFormat: { ...BASE, textFormat: { bold: true } } },
      { userEnteredValue: { stringValue: text }, userEnteredFormat: BASE,
        ...(ev ? { textFormatRuns: [{ startIndex: 0, format: {} },
          { startIndex: head.length, format: { link: { uri: ev.url }, foregroundColor: { red: 0.06, green: 0.33, blue: 0.8 }, underline: true } }] } : {}) },
      { userEnteredValue: { stringValue: c }, userEnteredFormat: { ...BASE, backgroundColor: flagged ? AMBER : askedRepro ? ROSE : WHITE },
        ...(flagLen > 0 ? { textFormatRuns: [{ startIndex: 0, format: { bold: true } }, { startIndex: flagLen, format: {} }] } : {}) },
      { userEnteredValue: { stringValue: d }, userEnteredFormat: BASE },
      { userEnteredValue: { stringValue: e }, userEnteredFormat: BASE },
    ] };
  });
  const reqs = [{ updateCells: { range: { sheetId: L_ID, startRowIndex: 1, endRowIndex: 400, startColumnIndex: 0, endColumnIndex: 5 },
    fields: 'userEnteredValue,textFormatRuns,userEnteredFormat(backgroundColor)' } }];
  if (rowsOut.length) reqs.push({ updateCells: { rows: rowsOut,
    range: { sheetId: L_ID, startRowIndex: 1, endRowIndex: 1 + rowsOut.length, startColumnIndex: 0, endColumnIndex: 5 },
    fields: 'userEnteredValue,userEnteredFormat,textFormatRuns' } });
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: reqs } });
  listed = rowsOut.length;
}
console.log(JSON.stringify({ tab: TAB, gid: SHEET_ID, mode: CANDIDATES ? 'candidates' : 'bug-reports',
  specs: specs.length, appended, updated, ownerDKept: kept,
  ...(CANDIDATES ? { rejectedMoved: moved, rejectedSkipped: skippedRejected, rejectedTab: REJ_TAB, needsOwner, boardListed: listed } : {}),
  link: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${SHEET_ID}` }, null, 2));
