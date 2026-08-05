// One-off: generates a MOBILE QA checklist directly via Google Sheets API by
// executing a `.gs` generator through an Apps-Script-to-Sheets-API adapter.
// 28 columns A..AB.  See ../checklist/generate_via_api.template.mjs for the
// web (25-col) equivalent.
import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';

// ── EDIT FOR EACH PROJECT ───────────────────────────────────────────────
const GS_PATH       = '/absolute/path/to/<project>_checklist.gs';
const GENERATOR_FN  = 'create<Project>Checklist';
const FOLDER_PATH   = ['Projects', '<Project Name>', 'QA Documentation'];
const FILE_NAME     = '<Project Name> - checklist';
const NCOLS         = 28;
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

let folderId = 'root';
for (const name of FOLDER_PATH) {
  folderId = await getOrCreateFolder(name, folderId);
}

let ssId, sheetId;
const existing = await drive.files.list({
  q: `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`,
  fields: 'files(id)'
});
if (existing.data.files.length) {
  ssId = existing.data.files[0].id;
  const meta = await api.spreadsheets.get({ spreadsheetId: ssId });
  let sh = meta.data.sheets.find(s => s.properties.title === 'Checklist');
  if (!sh) {
    const r = await api.spreadsheets.batchUpdate({ spreadsheetId: ssId, requestBody: { requests: [
      { addSheet: { properties: { title: 'Checklist', gridProperties: { rowCount: 200, columnCount: NCOLS } } } }
    ] } });
    sheetId = r.data.replies[0].addSheet.properties.sheetId;
  } else {
    sheetId = sh.properties.sheetId;
    const nCf = (sh.conditionalFormats || []).length;
    const reqs = [
      { unmergeCells: { range: { sheetId } } },
      { updateCells: { range: { sheetId }, fields: 'userEnteredValue,userEnteredFormat,dataValidation' } }
    ];
    for (let i = nCf - 1; i >= 0; i--) reqs.push({ deleteConditionalFormatRule: { sheetId, index: i } });
    for (const g of (sh.columnGroups || [])) {
      for (let d = 0; d < (g.depth || 1); d++) {
        reqs.push({ deleteDimensionGroup: { range: { sheetId, dimension: 'COLUMNS', startIndex: g.range.startIndex, endIndex: g.range.endIndex } } });
      }
    }
    for (const g of (sh.rowGroups || [])) {
      for (let d = 0; d < (g.depth || 1); d++) {
        reqs.push({ deleteDimensionGroup: { range: { sheetId, dimension: 'ROWS', startIndex: g.range.startIndex, endIndex: g.range.endIndex } } });
      }
    }
    // Expand column count if the existing sheet is narrower than NCOLS
    const curCols = sh.properties.gridProperties.columnCount || 0;
    if (curCols < NCOLS) {
      reqs.push({ appendDimension: { sheetId, dimension: 'COLUMNS', length: NCOLS - curCols } });
    }
    // Clear borders on the whole data range — updateCells doesn't touch borders
    const none = { style: 'NONE' };
    reqs.push({ updateBorders: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: NCOLS },
      top: none, bottom: none, left: none, right: none, innerHorizontal: none, innerVertical: none
    } });
    await api.spreadsheets.batchUpdate({ spreadsheetId: ssId, requestBody: { requests: reqs } });
  }
} else {
  const created = await api.spreadsheets.create({
    requestBody: {
      properties: { title: FILE_NAME, locale: 'uk_UA', timeZone: 'Europe/Kyiv' },
      sheets: [{ properties: { title: 'Checklist', gridProperties: { rowCount: 200, columnCount: NCOLS } } }]
    },
    fields: 'spreadsheetId,sheets.properties.sheetId'
  });
  ssId = created.data.spreadsheetId;
  sheetId = created.data.sheets[0].properties.sheetId;
  await drive.files.update({ fileId: ssId, addParents: folderId, removeParents: 'root', fields: 'id' });
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
  getSheetByName: n => n === 'Checklist' ? sheetObj : null,
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

await api.spreadsheets.values.update({
  spreadsheetId: ssId, range: `Checklist!A1`, valueInputOption: 'USER_ENTERED',
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

// ── STEP 5 functional verification (mobile probes) ─────────────────────
// Page band rows 5-6. First check row 7. Block 1: s1=C, s2=D, c1=E, c2=F,
// c3=G, spacer H, result I/J. Failed counter now lives in F3 (c1+1).
async function readCells(ranges) {
  const r = await api.spreadsheets.values.batchGet({ spreadsheetId: ssId, ranges });
  return r.data.valueRanges.map(v => (v.values && v.values[0] && v.values[0][0]) || '');
}
await api.spreadsheets.values.update({
  spreadsheetId: ssId, range: 'Checklist!C7', valueInputOption: 'USER_ENTERED',
  requestBody: { values: [['Failed']] },
});
const probes = ['Checklist!I7', 'Checklist!J6', 'Checklist!J3', 'Checklist!C5', 'Checklist!F3'];
const [i7, j6, j3, c5, f3] = await readCells(probes);
const ok = i7 === 'Failed' && j6 === '1' && j3 === '1'
  && c5 === 'Not all issues are resolved!' && f3 === '1';
console.log('STEP 5 test:', ok ? 'PASSED' : 'FAILED', JSON.stringify({ i7, j6, j3, c5, f3 }));
await api.spreadsheets.values.update({
  spreadsheetId: ssId, range: 'Checklist!C7', valueInputOption: 'USER_ENTERED',
  requestBody: { values: [['']] },
});
const [i7b, j6b, j3b, c5b, f3b] = await readCells(probes);
console.log('Reverted:', JSON.stringify({ i7: i7b, j6: j6b, j3: j3b, c5: c5b, f3: f3b }));
console.log('URL:', ssUrl);
