// Reusable Google-Sheets "report tab" builder — encodes Vadym's preferred house
// style (derived from the 2026-07-08 "Cover gaps 21-40" tab he hand-tuned, taken
// as the standard going forward):
//
//   • Summary/stats block at the TOP:
//       - title row      : bold, fontSize 11, BLUE bg #3D85C6 (61,133,198), white text
//       - sub-header row : bold, light-blue bg #D8E5EA (216,229,234)
//       - stat rows      : plain (numbers as real numbers via USER_ENTERED)
//   • one blank spacer row
//   • data table:
//       - header row     : bold, TEAL bg #1E4F5B (30,79,91), white text
//       - data rows      : plain
//   • wrapStrategy OVERFLOW_CELL everywhere (content on ONE line, no wrapping)
//   • EXPLICIT per-column widths (px) — not blind autoResize
//   • frozen: none by default (summary sits above the table)
//
// Usage (from a script that already has an authed `sheets` client):
//   import { buildReportTab } from './lib-report-tab.mjs';
//   await buildReportTab(sheets, {
//     spreadsheetId, tab: 'My tab',
//     title: 'SUMMARY — ...',
//     statHeaders: ['Type','Failed','Generated','Fail %'],
//     statRows: [['Book covers',1,80,'1.3%'], ['Chapter covers',49,1573,'3.1%']],
//     dataHeaders: ['Account','User UID','Book title','Book ID','...'],
//     dataRows: [[...], ...],
//     colWidths: [332,231,224,255,88,115,63,233],   // optional; per-column px
//     fixedGid: 820004,                             // keeps the shared #gid= link alive
//     ledgerKey: 'load-testing/run-12',             // optional; defaults to `report-tab/<tab>`
//   });
//
// With `fixedGid`, the carrier is checked against `<Project>/.link-ledger.json` before the tab is
// deleted and re-added: a rebuild aimed at a different document or gid THROWS instead of destroying
// a tab somebody holds a link to (Rules-Guide/link-ledger/).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Link stability is machine-checked when the caller passes `fixedGid` (see the ledger call below).
const LEDGER_MOD = process.env.QA_LINK_LEDGER || (() => {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i++) {
    for (const rel of ['QA-SetupKit/Rules-Guide/link-ledger/link-ledger.mjs', 'Rules-Guide/link-ledger/link-ledger.mjs']) {
      if (fs.existsSync(path.join(dir, rel))) return path.join(dir, rel);
    }
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  return null;
})();

const BLUE = { red: 61/255, green: 133/255, blue: 198/255 };   // #3D85C6 summary title
const LIGHT = { red: 216/255, green: 229/255, blue: 234/255 }; // #D8E5EA sub-header
const TEAL = { red: 30/255, green: 79/255, blue: 91/255 };     // #1E4F5B data header
const WHITE = { red: 1, green: 1, blue: 1 };

export async function buildReportTab(sheets, opts) {
  const { spreadsheetId, tab, title, statHeaders, statRows, dataHeaders, dataRows, colWidths, fixedGid } = opts;

  // assemble values
  const values = [];
  values.push([title]);
  values.push(statHeaders);
  for (const r of statRows) values.push(r);
  values.push([]);                         // spacer
  const dataHeaderRow = values.length;     // 0-indexed row of the data header
  values.push(dataHeaders);
  for (const r of dataRows) values.push(r);
  const nRows = values.length;
  const nCols = Math.max(dataHeaders.length, statHeaders.length);

  // Recreate tab (idempotent). With `fixedGid` the rebuilt tab keeps the SAME gid, so a `#gid=` link
  // the owner already shared survives — the link-stability invariant every re-creatable carrier owes.
  // Without it, delete+add hands you a FRESH gid and every saved share silently points at nothing;
  // the caller is warned once so the omission cannot pass as a working link.
  // This builder DELETES the tab and re-adds it, so a wrong spreadsheetId/gid here does not just
  // write in the wrong place — it destroys a tab under a link somebody holds. With `fixedGid` the
  // carrier is knowable, so it is checked against the project's ledger and a move THROWS before the
  // delete. (Without `fixedGid` there is no stable link to protect — the warning below is the whole
  // answer.) `ledgerKey` names the purpose when one project builds several report tabs.
  if (fixedGid != null && LEDGER_MOD) {
    const { assertStableLink } = await import(`file://${LEDGER_MOD}`);
    assertStableLink({ kind: 'sheet-tab', key: opts.ledgerKey || `report-tab/${tab}`, id: spreadsheetId, gid: fixedGid, title: tab });
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const ex = meta.data.sheets.find(
    (s) => s.properties.title === tab || (fixedGid != null && s.properties.sheetId === fixedGid),
  );
  if (ex) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ deleteSheet: { sheetId: ex.properties.sheetId } }] } });
  const addProps = { title: tab, gridProperties: { rowCount: nRows + 5, columnCount: nCols } };
  if (fixedGid != null) addProps.sheetId = fixedGid;
  else console.warn(`[lib-report-tab] no fixedGid for "${tab}" — the rebuilt tab gets a NEW gid, so any #gid= link already shared will break. Pass fixedGid to keep it stable.`);
  const add = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: addProps } }] } });
  const gid = add.data.replies[0].addSheet.properties.sheetId;

  await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A1`, valueInputOption: 'USER_ENTERED', requestBody: { values } });

  const requests = [
    // summary title — blue, white bold, size 11
    { repeatCell: { range: { sheetId: gid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: nCols }, cell: { userEnteredFormat: { backgroundColor: BLUE, textFormat: { bold: true, fontSize: 11, foregroundColor: WHITE } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } },
    // stats sub-header — light blue, bold
    { repeatCell: { range: { sheetId: gid, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: nCols }, cell: { userEnteredFormat: { backgroundColor: LIGHT, textFormat: { bold: true } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } },
    // data header — teal, white bold
    { repeatCell: { range: { sheetId: gid, startRowIndex: dataHeaderRow, endRowIndex: dataHeaderRow + 1, startColumnIndex: 0, endColumnIndex: nCols }, cell: { userEnteredFormat: { backgroundColor: TEAL, textFormat: { bold: true, foregroundColor: WHITE } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } },
    // one-line everywhere
    { repeatCell: { range: { sheetId: gid, startRowIndex: 0, endRowIndex: nRows, startColumnIndex: 0, endColumnIndex: nCols }, cell: { userEnteredFormat: { wrapStrategy: 'OVERFLOW_CELL' } }, fields: 'userEnteredFormat.wrapStrategy' } },
  ];
  // explicit column widths (px) if provided
  if (Array.isArray(colWidths)) {
    colWidths.forEach((px, i) => {
      if (px) requests.push({ updateDimensionProperties: { range: { sheetId: gid, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } });
    });
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  return { sheetId: gid, link: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${gid}` };
}
