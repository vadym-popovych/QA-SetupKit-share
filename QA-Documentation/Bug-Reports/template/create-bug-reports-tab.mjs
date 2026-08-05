// Bug Reports tab TEMPLATE (beta) — Google Sheets destination for bugs
// (Vadym, 11/07/2026). Used when the owner picks "file bugs in Google Sheets"
// instead of an external tracker. Creates (or resets) a tab with the v2
// one-cell-per-bug layout:
//   A Summary (BUG-NNN — title, bold; severity branch as a cell note)
//   B Bug report — FULL board-format text in ONE cell (bold section labels;
//     evidence lines are labels that ARE links: "Screenshot with response from
//     Api" / "Screenshot from Application[ (platform)]" / "Screen record")
//   C Comments — free info (board ticket link, not-a-bug closures)
//   D Status — dropdown To do / In progress / To test / QA in Progress /
//     Reopen / Fixed, with per-status color chips via conditional formatting
//
//   MCP_SHEETS_DIR=<mcp-sheets dir> node create-bug-reports-tab.mjs <spreadsheetId> [tabTitle] [gid]
//   defaults: tabTitle "Bug Reports", gid 777001 (fixed gid => stable #gid links)
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const MCP_DIR = process.env.MCP_SHEETS_DIR
  || `${process.env.HOME}/Projects/QA-SetupKit/MCP-configurations/mcp-sheets`;
const require = createRequire(path.join(MCP_DIR, 'package.json'));
const { google } = require('googleapis');
const creds = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'credentials.json')));
const token = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'token.json')));
const c = creds.installed || creds.web;
const oauth = new google.auth.OAuth2(c.client_id, c.client_secret, 'http://localhost:3456');
oauth.setCredentials(token);
const sheets = google.sheets({ version: 'v4', auth: oauth });

const [SPREADSHEET_ID, TITLE = 'Bug Reports', GID_ARG] = process.argv.slice(2);
if (!SPREADSHEET_ID) { console.error('usage: create-bug-reports-tab.mjs <spreadsheetId> [tabTitle] [gid]'); process.exit(1); }
const GID = Number(GID_ARG || 777001);
const TEAL = { red: 0.118, green: 0.310, blue: 0.357 };
const STATUS = ['To do', 'In progress', 'To test', 'QA in Progress', 'Reopen', 'Fixed'];
const CHIP = {
  'To do':          { backgroundColor: { red: 0.851, green: 0.886, blue: 0.953 } },
  'In progress':    { backgroundColor: { red: 1, green: 0.949, blue: 0.8 } },
  'To test':        { backgroundColor: { red: 0.902, green: 0.835, blue: 0.961 } },
  'QA in Progress': { backgroundColor: { red: 0.816, green: 0.878, blue: 0.89 } },
  'Reopen':         { backgroundColor: { red: 0.957, green: 0.8, blue: 0.8 }, textFormat: { bold: true } },
  'Fixed':          { backgroundColor: { red: 0.851, green: 0.918, blue: 0.827 }, textFormat: { bold: true } },
};

const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets(properties(sheetId,title))' });
const existing = meta.data.sheets.find(s => s.properties.sheetId === GID || s.properties.title === TITLE);
const requests = [];
if (existing) requests.push({ deleteSheet: { sheetId: existing.properties.sheetId } });
requests.push({ addSheet: { properties: { sheetId: GID, title: TITLE, gridProperties: { frozenRowCount: 1 } } } });
requests.push({ updateCells: {
  rows: [{ values: ['Summary', 'Bug report', 'Comments', 'Status'].map(h => ({
    userEnteredValue: { stringValue: h },
    userEnteredFormat: { backgroundColor: TEAL, horizontalAlignment: 'CENTER',
      textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } },
  })) }],
  range: { sheetId: GID, startRowIndex: 0, startColumnIndex: 0 },
  fields: 'userEnteredValue,userEnteredFormat',
} });
for (const [i, px] of [[0, 300], [1, 780], [2, 280], [3, 130]]) {
  requests.push({ updateDimensionProperties: { range: { sheetId: GID, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } });
}
// wrap + vertical-MIDDLE on the WHOLE range incl. the header row (house rule: ALL Sheets text
// gets wrap + vertical-align middle). Only these two subfields are set, so the header keeps its teal/center/bold.
requests.push({ repeatCell: {
  range: { sheetId: GID, startRowIndex: 0, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 4 },
  cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE' } },
  fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
} });
requests.push({ setDataValidation: {
  range: { sheetId: GID, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 3, endColumnIndex: 4 },
  rule: { condition: { type: 'ONE_OF_LIST', values: STATUS.map(s => ({ userEnteredValue: s })) }, showCustomUi: true, strict: false },
} });
STATUS.forEach((s, i) => requests.push({ addConditionalFormatRule: { index: i, rule: {
  ranges: [{ sheetId: GID, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 3, endColumnIndex: 4 }],
  booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: s }] }, format: CHIP[s] },
} } }));

await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });
console.log(`template applied: "${TITLE}" (gid ${GID}) in ${SPREADSHEET_ID}`);
