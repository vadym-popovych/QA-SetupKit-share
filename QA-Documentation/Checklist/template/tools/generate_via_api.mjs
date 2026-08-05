// One-off: generates a MOBILE QA checklist directly via Google Sheets API by
// executing a `.gs` generator through an Apps-Script-to-Sheets-API adapter.
// 28 columns A..AB.  See ../checklist/generate_via_api.template.mjs for the
// web (25-col) equivalent.
import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';
import { assertGrid } from './lib-validate-grid.mjs';

// ── EDIT FOR EACH PROJECT (or pass via env) ─────────────────────────────
// KIT TEMPLATE — no project name/path is baked in: a generator that defaults to someone else's
// project (or their .gs file) is how a teammate's first run lands a checklist in the wrong place.
const PROJECT       = process.env.PROJECT_NAME;                       // e.g. "<Project>"
if (!PROJECT) {
  console.error('generate_via_api: PROJECT_NAME is not set — refusing to guess whose checklist this is.');
  process.exit(2);
}
const GS_PATH       = process.env.CHECKLIST_GS || new URL('./checklist.gs', import.meta.url).pathname;
const GENERATOR_FN  = process.env.GENERATOR_FN || `create${PROJECT}Checklist`;
const FOLDER_PATH   = (process.env.DRIVE_FOLDER || `${PROJECT}/QA Documentation`).split('/');
const FILE_NAME     = process.env.CHECKLIST_NAME || `${PROJECT} - checklist`;
const NCOLS         = Number(process.env.NCOLS || 28);               // mobile 28 · web 25
// ────────────────────────────────────────────────────────────────────────

function findMcpSheetsDir() {
  if (process.env.MCP_SHEETS_DIR) return process.env.MCP_SHEETS_DIR;
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    const cfgPath = dir + '/.mcp.json';
    if (existsSync(cfgPath)) {
      try {
        const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
        const server = cfg.mcpServers && cfg.mcpServers['google-sheets'];
        const arg0 = server && server.args && server.args[0];
        if (arg0) return dirname(resolve(arg0));
      } catch {}
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const MCP_DIR = findMcpSheetsDir();
if (!MCP_DIR) {
  console.error('Cannot locate google-sheets MCP server.');
  console.error('Either configure .mcp.json (mcpServers["google-sheets"].args[0] = path/to/server.mjs)');
  console.error('or set MCP_SHEETS_DIR env var to the mcp-sheets directory.');
  process.exit(1);
}
if (!existsSync(MCP_DIR + '/token.json')) {
  console.error('No token.json at ' + MCP_DIR + '.');
  console.error('Run `node server.mjs --auth` inside that dir to grant Drive access to your Google account.');
  process.exit(1);
}
console.log('Using MCP dir:', MCP_DIR);

const require = createRequire(MCP_DIR + '/');
const { google } = require('googleapis');

const creds = JSON.parse(readFileSync(MCP_DIR + '/credentials.json', 'utf8'));
const token = JSON.parse(readFileSync(MCP_DIR + '/token.json', 'utf8'));
const cfg = creds.installed || creds.web;
const auth = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, (cfg.redirect_uris || [])[0]);
auth.setCredentials(token);

const drive = google.drive({ version: 'v3', auth });
const api = google.sheets({ version: 'v4', auth });

async function getOrCreateFolder(name, parentId) {
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const res = await drive.files.list({ q, fields: 'files(id,name)' });
  if (res.data.files.length) return res.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id'
  });
  return created.data.id;
}

// Root under a single ClaudeProjects/ folder (workspace Drive-structure convention), never at
// Drive root next to the user's OWN project folders. Override the root name via DRIVE_ROOT_FOLDER.
// OPT-IN hooks (default behaviour unchanged — real projects still get their own file & a
// "Checklist" tab): TARGET_SSID builds INTO an existing spreadsheet instead of creating a file;
// CHECKLIST_TAB names the tab, so several checklists can live as separate tabs in one book.
const DRIVE_ROOT = process.env.DRIVE_ROOT_FOLDER || 'ClaudeProjects';
const TAB = process.env.CHECKLIST_TAB || 'Checklist';
const TARGET_SSID = process.env.TARGET_SSID || null;

let ssId, sheetId;
if (TARGET_SSID) {
  ssId = TARGET_SSID;                                  // opt-in: build into an existing book
} else {
  const fullPath = FOLDER_PATH[0] === DRIVE_ROOT ? FOLDER_PATH : [DRIVE_ROOT, ...FOLDER_PATH];
  let folderId = 'root';
  for (const name of fullPath) folderId = await getOrCreateFolder(name, folderId);
  const existing = await drive.files.list({
    q: `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`, fields: 'files(id)' });
  if (existing.data.files.length) {
    ssId = existing.data.files[0].id;
  } else {
    const created = await api.spreadsheets.create({
      requestBody: {
        properties: { title: FILE_NAME, locale: 'uk_UA', timeZone: 'Europe/Kyiv' },
        sheets: [{ properties: { title: TAB, gridProperties: { rowCount: 200, columnCount: NCOLS } } }] },
      fields: 'spreadsheetId' });
    ssId = created.data.spreadsheetId;
    await drive.files.update({ fileId: ssId, addParents: folderId, removeParents: 'root', fields: 'id' });
  }
}

// The checklist is handed over as `…/edit#gid=<sheetId>` and the block below WIPES that tab before
// rebuilding it. The tab is located by TITLE, and a title is not an identity — a second book with a
// "Checklist" tab is one env var away. So the carrier is recorded and a rebuild aimed at a
// different book or tab is REFUSED before the wipe. (Rules-Guide/link-ledger/)
const ledgerMod = process.env.QA_LINK_LEDGER || (() => {
  let dir = dirname(new URL(import.meta.url).pathname);
  for (let i = 0; i < 12; i++) {
    for (const rel of ['QA-SetupKit/Rules-Guide/link-ledger/link-ledger.mjs', 'Rules-Guide/link-ledger/link-ledger.mjs']) {
      if (existsSync(resolve(dir, rel))) return resolve(dir, rel);
    }
    const up = dirname(dir); if (up === dir) break; dir = up;
  }
  return null;
})();
const ledger = ledgerMod ? await import(`file://${ledgerMod}`) : null;
if (!ledger) console.warn('  ⚠ link-ledger not found — the tab\'s link stability was NOT checked (set QA_LINK_LEDGER).');
const guardTabLink = (gid) => {
  if (!ledger) return;
  try {
    ledger.assertStableLink({ kind: 'sheet-tab', key: `checklist/${TAB}`, id: ssId, gid, title: TAB });
  } catch (e) {
    if (e instanceof ledger.LinkLedgerError) { console.error(`generate_via_api: ${e.message}\n  Nothing was written.`); process.exit(1); }
    throw e;
  }
};

// Ensure + RESET the TAB tab in ssId (find or create, then wipe it clean for a fresh build).
{
  const meta = await api.spreadsheets.get({ spreadsheetId: ssId });
  const sh = meta.data.sheets.find(s => s.properties.title === TAB);
  if (!sh) {
    const r = await api.spreadsheets.batchUpdate({ spreadsheetId: ssId, requestBody: { requests: [
      { addSheet: { properties: { title: TAB, gridProperties: { rowCount: 200, columnCount: NCOLS } } } } ] } });
    sheetId = r.data.replies[0].addSheet.properties.sheetId;
    guardTabLink(sheetId);                       // first sighting of this checklist's carrier
  } else {
    sheetId = sh.properties.sheetId;
    guardTabLink(sheetId);                       // before the wipe below
    const nCf = (sh.conditionalFormats || []).length;
    const reqs = [
      { unmergeCells: { range: { sheetId } } },
      { updateCells: { range: { sheetId }, fields: 'userEnteredValue,userEnteredFormat,dataValidation' } }
    ];
    for (let i = nCf - 1; i >= 0; i--) reqs.push({ deleteConditionalFormatRule: { sheetId, index: i } });
    for (const g of (sh.columnGroups || [])) for (let d = 0; d < (g.depth || 1); d++)
      reqs.push({ deleteDimensionGroup: { range: { sheetId, dimension: 'COLUMNS', startIndex: g.range.startIndex, endIndex: g.range.endIndex } } });
    for (const g of (sh.rowGroups || [])) for (let d = 0; d < (g.depth || 1); d++)
      reqs.push({ deleteDimensionGroup: { range: { sheetId, dimension: 'ROWS', startIndex: g.range.startIndex, endIndex: g.range.endIndex } } });
    const curCols = sh.properties.gridProperties.columnCount || 0;
    if (curCols < NCOLS) reqs.push({ appendDimension: { sheetId, dimension: 'COLUMNS', length: NCOLS - curCols } });
    const none = { style: 'NONE' };
    reqs.push({ updateBorders: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: NCOLS },
      top: none, bottom: none, left: none, right: none, innerHorizontal: none, innerVertical: none } });
    await api.spreadsheets.batchUpdate({ spreadsheetId: ssId, requestBody: { requests: reqs } });
  }
}
const ssUrl = 'https://docs.google.com/spreadsheets/d/' + ssId + '/edit';

// ── Apps-Script-to-API adapter ──────────────────────────────────────────
const hex = h => {
  const m = h.replace('#', '');
  return { red: parseInt(m.slice(0, 2), 16) / 255, green: parseInt(m.slice(2, 4), 16) / 255, blue: parseInt(m.slice(4, 6), 16) / 255 };
};
const HA = { left: 'LEFT', center: 'CENTER', right: 'RIGHT' };
const VA = { top: 'TOP', middle: 'MIDDLE', bottom: 'BOTTOM' };

const fmtRequests = [];
const mergeRequests = [];
const dimRequests = [];
const dvRequests = [];
let cfRequests = [];
let gridValues = null;
const logs = [];

function gridRange(row, col, nr, nc) {
  return { sheetId, startRowIndex: row - 1, endRowIndex: row - 1 + nr, startColumnIndex: col - 1, endColumnIndex: col - 1 + nc };
}
function parseA1(a1) {
  const m = a1.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
  const colN = s => s.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);
  const c1 = colN(m[1]), r1 = +m[2];
  const c2 = m[3] ? colN(m[3]) : c1, r2 = m[4] ? +m[4] : r1;
  return [r1, c1, r2 - r1 + 1, c2 - c1 + 1];
}
function fmt(range, cell, fields) {
  fmtRequests.push({ repeatCell: { range, cell: { userEnteredFormat: cell }, fields: 'userEnteredFormat.' + fields } });
}
function mkRange(row, col, nr, nc) {
  const range = gridRange(row, col, nr, nc);
  const self = {
    _grid: range,
    merge() { mergeRequests.push({ mergeCells: { range, mergeType: 'MERGE_ALL' } }); return self; },
    breakApart() { return self; }, clear() { return self; }, clearDataValidations() { return self; },
    setValues(v) { gridValues = v; return self; },
    setBackground(c) { fmt(range, { backgroundColor: hex(c) }, 'backgroundColor'); return self; },
    setFontColor(c) { fmt(range, { textFormat: { foregroundColor: hex(c) } }, 'textFormat.foregroundColor'); return self; },
    setFontWeight(w) { fmt(range, { textFormat: { bold: w === 'bold' } }, 'textFormat.bold'); return self; },
    setFontSize(s) { fmt(range, { textFormat: { fontSize: s } }, 'textFormat.fontSize'); return self; },
    setFontFamily(f) { fmt(range, { textFormat: { fontFamily: f } }, 'textFormat.fontFamily'); return self; },
    setHorizontalAlignment(a) { fmt(range, { horizontalAlignment: HA[a] }, 'horizontalAlignment'); return self; },
    setVerticalAlignment(a) { fmt(range, { verticalAlignment: VA[a] }, 'verticalAlignment'); return self; },
    setWrap(w) { fmt(range, { wrapStrategy: w ? 'WRAP' : 'OVERFLOW_CELL' }, 'wrapStrategy'); return self; },
    setDataValidation(rule) { dvRequests.push({ setDataValidation: { range, rule } }); return self; },
    shiftColumnGroupDepth(delta) {
      const r = { sheetId, dimension: 'COLUMNS', startIndex: range.startColumnIndex, endIndex: range.endColumnIndex };
      dimRequests.push(delta > 0 ? { addDimensionGroup: { range: r } } : { deleteDimensionGroup: { range: r } });
      return self;
    },
    shiftRowGroupDepth(delta) {
      const r = { sheetId, dimension: 'ROWS', startIndex: range.startRowIndex, endIndex: range.endRowIndex };
      dimRequests.push(delta > 0 ? { addDimensionGroup: { range: r } } : { deleteDimensionGroup: { range: r } });
      return self;
    },
    setBorder(top, left, bottom, right, vertical, horizontal) {
      const border = { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } };
      const req = { updateBorders: { range } };
      if (top)        req.updateBorders.top = border;
      if (bottom)     req.updateBorders.bottom = border;
      if (left)       req.updateBorders.left = border;
      if (right)      req.updateBorders.right = border;
      if (vertical)   req.updateBorders.innerVertical = border;
      if (horizontal) req.updateBorders.innerHorizontal = border;
      fmtRequests.push(req);
      return self;
    },
  };
  return self;
}

const sheetObj = {
  getMaxRows: () => 200, getMaxColumns: () => NCOLS,
  getRange(...args) {
    if (args.length === 1 && typeof args[0] === 'string') return mkRange(...parseA1(args[0]));
    return mkRange(args[0], args[1], args[2] || 1, args[3] || 1);
  },
  setConditionalFormatRules(rules) {
    cfRequests = rules.map((rule, index) => ({ addConditionalFormatRule: { rule, index } }));
  },
  setColumnWidth(c, w) {
    dimRequests.push({ updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: c - 1, endIndex: c },
      properties: { pixelSize: w }, fields: 'pixelSize' } });
  },
  setRowHeight(r, h) {
    dimRequests.push({ updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: r - 1, endIndex: r },
      properties: { pixelSize: h }, fields: 'pixelSize' } });
  },
  setFrozenRows(n) {
    dimRequests.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: n } }, fields: 'gridProperties.frozenRowCount' } });
  },
  setFrozenColumns(n) {
    dimRequests.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { frozenColumnCount: n } }, fields: 'gridProperties.frozenColumnCount' } });
  },
  setColumnGroupControlAfter(after) {
    dimRequests.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { columnGroupControlAfter: !!after } }, fields: 'gridProperties.columnGroupControlAfter' } });
  },
  setRowGroupControlAfter(after) {
    dimRequests.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { rowGroupControlAfter: !!after } }, fields: 'gridProperties.rowGroupControlAfter' } });
  },
  autoResizeRows(start, count) {
    dimRequests.push({ autoResizeDimensions: {
      dimensions: { sheetId, dimension: 'ROWS', startIndex: start - 1, endIndex: start - 1 + count }
    } });
  },
};

const ssObj = {
  getSheetByName: n => n === TAB ? sheetObj : null,
  insertSheet: () => sheetObj,
  getSheets: () => [sheetObj],
  deleteSheet: () => {},
  getSpreadsheetTimeZone: () => 'Europe/Kyiv',
  getUrl: () => ssUrl,
  getId: () => ssId,
};
const folderObj = {
  getFoldersByName: () => ({ hasNext: () => true, next: () => folderObj }),
  getFilesByName: () => ({ hasNext: () => true, next: () => ({}) }),
};
const SpreadsheetApp = {
  open: () => ssObj, create: () => ssObj,
  newDataValidation: () => {
    const rule = { condition: { type: 'ONE_OF_LIST', values: [] }, strict: false, showCustomUi: false };
    const b = {
      requireValueInList(list, dropdown) {
        rule.condition.values = list.map(v => ({ userEnteredValue: v }));
        rule.showCustomUi = !!dropdown; return b;
      },
      setAllowInvalid(allow) { rule.strict = !allow; return b; },
      build: () => rule,
    };
    return b;
  },
  newConditionalFormatRule: () => {
    const rule = { ranges: [], booleanRule: { condition: {}, format: {} } };
    const b = {
      whenTextEqualTo(t) { rule.booleanRule.condition = { type: 'TEXT_EQ', values: [{ userEnteredValue: t }] }; return b; },
      whenTextContains(t) { rule.booleanRule.condition = { type: 'TEXT_CONTAINS', values: [{ userEnteredValue: t }] }; return b; },
      setBackground(c) { rule.booleanRule.format.backgroundColor = hex(c); return b; },
      setFontColor(c) { (rule.booleanRule.format.textFormat ||= {}).foregroundColor = hex(c); return b; },
      setBold(v) { (rule.booleanRule.format.textFormat ||= {}).bold = v; return b; },
      setRanges(ranges) { rule.ranges = ranges.map(r => r._grid); return b; },
      build: () => rule,
    };
    return b;
  },
};
const DriveApp = { getRootFolder: () => folderObj, getFileById: () => ({ moveTo: () => {} }) };
const Session = { getScriptTimeZone: () => 'Europe/Kyiv' };
const Utilities = {
  formatDate: (d, tz, f) => f === 'yyyy'
    ? String(d.getFullYear())
    : d.toLocaleString('en-US', { month: 'long' }) + ' ' + d.getFullYear(),
};
const Logger = { log: s => logs.push(String(s)) };

Object.assign(globalThis, { SpreadsheetApp, DriveApp, Session, Utilities, Logger });
const gsCode = readFileSync(GS_PATH, 'utf8');
(0, eval)(gsCode);
globalThis[GENERATOR_FN]();

// Gate: the grid is checked against checklist-row.schema.json BEFORE it reaches the Sheet
// (28/07/2026). The sheet is what a human then trusts, so a fabricated status must never get
// that far — and the kit's rule is to validate in the same turn as the write, which only holds
// if the tool does it rather than a person remembering to.
assertGrid(gridValues, { ncols: NCOLS });

await api.spreadsheets.values.update({
  spreadsheetId: ssId, range: `${TAB}!A1`, valueInputOption: 'USER_ENTERED',
  requestBody: { values: gridValues },
});
console.log('Values written:', gridValues.length, 'rows');

const allRequests = [...mergeRequests, ...fmtRequests, ...dimRequests, ...dvRequests, ...cfRequests];
for (let i = 0; i < allRequests.length; i += 500) {
  await api.spreadsheets.batchUpdate({
    spreadsheetId: ssId,
    requestBody: { requests: allRequests.slice(i, i + 500) },
  });
  console.log('Batch', 1 + i / 500, 'of', Math.ceil(allRequests.length / 500), 'applied');
}
console.log(logs.join('\n'));

// ── STEP 5 functional verification — MOBILE 28-col layout only ─────────
// Page band rows 5-6, first check row 7, block 1 result I/J, Failed counter F3.
// Skipped for the 25-col web layout (different result columns) and for opt-in
// target-tab runs — the probes are mobile-cell-specific.
if (NCOLS === 28 && !TARGET_SSID) {
  const readCells = async (ranges) => {
    const r = await api.spreadsheets.values.batchGet({ spreadsheetId: ssId, ranges });
    return r.data.valueRanges.map(v => (v.values && v.values[0] && v.values[0][0]) || '');
  };
  await api.spreadsheets.values.update({
    spreadsheetId: ssId, range: 'Checklist!C7', valueInputOption: 'USER_ENTERED', requestBody: { values: [['Failed']] } });
  const probes = ['Checklist!I7', 'Checklist!J6', 'Checklist!J3', 'Checklist!C5', 'Checklist!F3'];
  const [i7, j6, j3, c5, f3] = await readCells(probes);
  const ok = i7 === 'Failed' && j6 === '1' && j3 === '1' && c5 === 'Not all issues are resolved!' && f3 === '1';
  console.log('STEP 5 test:', ok ? 'PASSED' : 'FAILED', JSON.stringify({ i7, j6, j3, c5, f3 }));
  await api.spreadsheets.values.update({
    spreadsheetId: ssId, range: 'Checklist!C7', valueInputOption: 'USER_ENTERED', requestBody: { values: [['']] } });
  const [i7b, j6b, j3b, c5b, f3b] = await readCells(probes);
  console.log('Reverted:', JSON.stringify({ i7: i7b, j6: j6b, j3: j3b, c5: c5b, f3: f3b }));
}
console.log('URL:', ssUrl);
