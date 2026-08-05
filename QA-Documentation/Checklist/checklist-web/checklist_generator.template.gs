/**
 * QA Checklist generator — canonical template.
 * Template: claude_code_template_instructions_v5.md, WEB variant (§4.8).
 * Hierarchy (Vadym, 16/06/2026): Page → Section → Check.
 *
 * To create a new checklist:
 *   1. Copy this file to <Project>/<project>_checklist.gs
 *   2. Rename the function `createChecklist` to `create<Project>HomeChecklist`
 *   3. Update FOLDER_PATH, FILE_NAME, AUTHOR
 *   4. Fill the design with `addPage('<Page name>')` / `addSection('<Name>')`
 *      / `item('<check>')` calls (drop the example)
 *   5. Copy Checklist/checklist-web/generate_via_api.template.mjs to
 *      <Project>/generate_via_api.mjs and update the function name + path
 *
 * ADAPTIVE to the number of status columns per block: edit PLATFORMS (default
 * ['Web'] → 1 column, 25 cols A..Y). Break it down by browser/device, e.g.
 * ['Chrome','Firefox','Safari','Edge'], and the whole layout, counters, result
 * formula (Partial-aware) and conditional formats recompute (NCOLS = 3*P + 22).
 * The mobile variant is the same engine with a 2-platform default (iOS/Android).
 *
 * Workspace rules baked in here (see /Projects/CLAUDE.md for dates/authors):
 *  - Page band (2 rows, A:B merged) per page; Section name vertically merged
 *    across its check rows in column A; per-section counter row is GONE.
 *  - Page-level counters at H{pageRow+1} / I{pageRow+1} (per block).
 *  - Row-3 global counters = SUM of all per-page counters per block.
 *  - Collapsible column groups: C:G, K:O, S:W
 *  - +/- toggle on the RIGHT of every group: setColumnGroupControlAfter(true)
 *  - B4 signature font color matches the teal background (#134f5c)
 */
function createChecklist() {
  var FOLDER_PATH = ['Projects', '<Project Name>', 'QA Documentation'];
  var FILE_NAME   = '<Project Name> - checklist';
  var SHEET_NAME  = 'Checklist';
  var AUTHOR      = 'Vadym';

  // ── Drive: find/create folder chain and spreadsheet ─────────────────
  var folder = DriveApp.getRootFolder();
  FOLDER_PATH.forEach(function (name) {
    var it = folder.getFoldersByName(name);
    folder = it.hasNext() ? it.next() : folder.createFolder(name);
  });

  var ss;
  var files = folder.getFilesByName(FILE_NAME);
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(FILE_NAME);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
  }

  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  ['Sheet1', 'Аркуш1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && ss.getSheets().length > 1 && n !== SHEET_NAME) ss.deleteSheet(sh);
  });

  // ── Cleanup ─────────────────────────────────────────────────────────
  var full = sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns());
  full.breakApart();
  full.clear();
  full.clearDataValidations();
  sheet.setConditionalFormatRules([]);

  // ── Layout — ADAPTIVE to the number of status columns per block ─────
  // Edit PLATFORMS to change the per-block status breakdown: ['Web'] (default),
  // or ['Chrome','Firefox','Safari'] / ['Web','Tablet','Mobile'], etc. ALL geometry
  // derives from P = PLATFORMS.length: each block = P status + 3 counters + 1 spacer
  // + 2 result columns (= P+6 wide); 3 blocks + 2 inter-block spacers + Module/Checklist
  // → NCOLS = 3*P + 22 (P=1 → 25 web, P=2 → 28 mobile-width).
  var PLATFORMS = ['Web'];
  var P = PLATFORMS.length;
  var NBLOCKS = 3;
  var COLORS = {
    teal:    '#134f5c', tealFg:  '#f3f3f3', blue:    '#699ebf',
    passBg:  '#d2ebda', passFg:  '#135522',
    failBg:  '#f8d5da', failFg:  '#701c22',
    gray:    '#d9d9d9', grayFg:  '#434343',
    cntPass: '#b6d7a8', cntFail: '#f4cccc',
    pageBg:  '#b7b7b7', statusBg:'#efefef', resultBg:'#f3f3f3',
    purple:  '#8E7BC3', white:   '#ffffff'
  };
  // block b (0-based) status cols [s..sEnd]; then c1,c2(=c1+1),c3 counters; spacer; rA,rB result.
  var BLOCKS = [];
  for (var _bi = 0; _bi < NBLOCKS; _bi++) {
    var _s = 3 + _bi * (P + 7);   // P+6 block width + 1 inter-block spacer
    BLOCKS.push({ s: _s, sEnd: _s + P - 1, c1: _s + P, c3: _s + P + 2,
                  spacer: _s + P + 3, rA: _s + P + 4, rB: _s + P + 5 });
  }
  var NCOLS = 3 * P + 22;
  var SPACERS = [];
  BLOCKS.forEach(function (b, i) { SPACERS.push(b.spacer); if (i < NBLOCKS - 1) SPACERS.push(b.rB + 1); });
  // per-role widths (uniform across blocks)
  var WCOL = { module: 150, checklist: 530, status: (P === 1 ? 185 : 130), counter: (P === 1 ? 110 : 90), spacer: 19, rA: 82, rB: 84, inter: 18 };
  var WIDTHS = [WCOL.module, WCOL.checklist];
  BLOCKS.forEach(function (b, i) {
    for (var k = 0; k < P; k++) WIDTHS.push(WCOL.status);
    WIDTHS.push(WCOL.counter, WCOL.counter, WCOL.counter, WCOL.spacer, WCOL.rA, WCOL.rB);
    if (i < NBLOCKS - 1) WIDTHS.push(WCOL.inter);
  });

  // Column label — handles >26 (AA, AB…) because P>1 pushes NCOLS past 26.
  function cl(n) {
    if (n <= 26) return String.fromCharCode(64 + n);
    return String.fromCharCode(64 + Math.floor((n - 1) / 26)) + String.fromCharCode(65 + ((n - 1) % 26));
  }

  // Per-check result — Partial-aware, mirrors the mobile pairResultFormula. If the "Web" status
  // is ever broken down into several columns (e.g. Chrome/Firefox/Safari, or Web/Tablet/Mobile),
  // a half-filled row resolves to "Partial", never a false "Passed"; for the default single "Web"
  // column it degrades to plain Failed/Passed/Skipped/"". Active count = COUNTA(header) (minus any
  // "(N/A)"-marked column), so one column still resolves. s1L..s2L is the block's status range.
  function resultFormula(s1L, s2L, row) {
    var rng    = s1L + row + ':' + s2L + row;
    var hdr    = s1L + '$2:' + s2L + '$2';
    var active = 'COUNTA(' + hdr + ') - COUNTIF(' + hdr + '; "*(N/A)*")';
    return '=IF(COUNTIF(' + rng + '; "Failed") > 0; "Failed"; ' +
           'IF(COUNTA(' + rng + ') = 0; ""; ' +
           'IF(COUNTA(' + rng + ') < ' + active + '; "Partial"; ' +
           'IF(COUNTIF(' + rng + '; "Passed") > 0; "Passed"; "Skipped"))))';
  }

  // ── Pages / sections / checks ───────────────────────────────────────
  var VISUAL = 'Check that the fonts, sizes, colors and spacing in this section match the Figma design';
  var PAGES = [];
  var _curPage = null, _curSection = null;
  function addPage(name) {
    _curPage = { name: name, sections: [] };
    PAGES.push(_curPage);
    _curSection = null;
  }
  function addSection(name) {
    if (!_curPage) throw new Error('Call addPage(...) before addSection(...)');
    _curSection = { name: name, checks: [VISUAL] };
    _curPage.sections.push(_curSection);
  }
  function item(text) {
    if (!_curSection) throw new Error('Call addSection(...) before item(...)');
    _curSection.checks.push(text);
  }

  // ── EXAMPLE — replace with real pages/sections from the Figma design ─
  addPage('Home page');
  addSection('Example Section');
  item('Check that <element> is displayed and behaves as expected per the design');
  // ────────────────────────────────────────────────────────────────────

  // ── Build grid ──────────────────────────────────────────────────────
  var tz = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  var monthYear = Utilities.formatDate(new Date(), tz, 'MMMM yyyy');
  var year      = Utilities.formatDate(new Date(), tz, 'yyyy');

  function er() { return new Array(NCOLS).fill(''); }
  var grid = [er(), er(), er(), er()];
  var merges = [];
  var heights = { 1: 50, 2: 59, 3: 25, 4: 36 };

  grid[0][0] = 'Module';
  grid[0][1] = 'Checklist\nUp to date according to ' + monthYear;
  grid[3][1] = 'created by ' + AUTHOR + ' =)';
  merges.push([1, 1, 4, 1]);
  merges.push([1, 2, 3, 1]);

  BLOCKS.forEach(function (b) {
    grid[0][b.s - 1]  = 'Platform';
    for (var _p = 0; _p < P; _p++) grid[1][b.s - 1 + _p] = PLATFORMS[_p];
    grid[0][b.c1 - 1] = 'Available Statuses /\nSummary counter by all platforms';
    grid[1][b.c1 - 1] = 'Passed';
    grid[1][b.c1]     = 'Failed';
    grid[1][b.c3 - 1] = 'Skipped';
    var sL = cl(b.s), sEndL = cl(b.sEnd);
    grid[2][b.c1 - 1] = '=COUNTIF(' + sL + ':' + sEndL + ';"Passed")';
    grid[2][b.c1]     = '=COUNTIF(' + sL + ':' + sEndL + ';"Failed")';
    grid[2][b.c3 - 1] = '=COUNTIF(' + sL + ':' + sEndL + ';"Skipped")';
    grid[3][b.c1 - 1] = 'Comments';
    grid[0][b.rA - 1] = 'Checked\nxx/xx/' + year;
    grid[1][b.rA - 1] = 'Total/\nCheck counter per item';
    grid[3][b.rA - 1] = 'Passed';
    grid[3][b.rB - 1] = 'Failed';
    if (P > 1) merges.push([1, b.s, 1, P]);              // "Platform" header spans the status cols
    for (var _q = 0; _q < P; _q++) merges.push([2, b.s + _q, 3, 1]); // each platform label rows 2-4
    merges.push([1, b.c1, 1, 3]);
    merges.push([4, b.c1, 1, 3]);
    merges.push([1, b.rA, 1, 2]);
    merges.push([2, b.rA, 1, 2]);
  });

  var pageLayout = []; // { pageTop, counterRow, firstCheck, lastCheck, sections: [{ start, end }] }

  PAGES.forEach(function (p) {
    var pageTop    = grid.length + 1;
    var counterRow = pageTop + 1;
    var firstCheck = pageTop + 2;
    var nTotal = p.sections.reduce(function (a, s) { return a + s.checks.length; }, 0);
    var lastCheck = firstCheck + nTotal - 1;

    // Page band: 2 rows × 25 cols
    var r1 = er(), r2 = er();
    r1[0] = p.name;
    BLOCKS.forEach(function (b) {
      var sL = cl(b.s), sEndL = cl(b.sEnd), rAL = cl(b.rA);
      r1[b.s - 1]  = '=IF(COUNTIF(' + sL + firstCheck + ':' + sEndL + lastCheck + ';"Failed")>0;"Not all issues are resolved!";"")';
      // H5:I5 / P5:Q5 / X5:Y5 mirror the page name cell A{pageTop} via formula
      // so editing the page title in A propagates everywhere (Vadym, 16/06/2026)
      r1[b.rA - 1] = '=A' + pageTop;
      r2[b.rA - 1] = '=COUNTIF(' + rAL + firstCheck + ':' + rAL + lastCheck + ';"Passed")';
      r2[b.rB - 1] = '=COUNTIF(' + rAL + firstCheck + ':' + rAL + lastCheck + ';"Failed")';
      merges.push([pageTop, b.s, 2, P]);          // page-band status cell spans P columns
      merges.push([pageTop, b.c1, 2, 3]);         // D5:F6 / L:N / T:V
      merges.push([pageTop, b.rA, 1, 2]);         // H5:I5 / P:Q / X:Y (name)
    });
    merges.push([pageTop, 1, 2, 2]); // A:B merged page band
    // pageTop is autoResized below to fit the page-name mirror cells
    heights[pageTop + 1] = 24;
    grid.push(r1, r2);

    // Sections — each one merges col A vertically across its check rows
    var sectionLayouts = [];
    p.sections.forEach(function (s) {
      var sectionStart = grid.length + 1;
      s.checks.forEach(function (text) {
        var row = grid.length + 1;
        var r = er();
        r[1] = text;
        BLOCKS.forEach(function (b) {
          var sL = cl(b.s), sEndL = cl(b.sEnd);
          r[b.rA - 1] = resultFormula(sL, sEndL, row);
          merges.push([row, b.c1, 1, 3]);
          merges.push([row, b.rA, 1, 2]);
        });
        // No explicit row height — autoResize fits each row to wrapped content
        grid.push(r);
      });
      var sectionEnd = grid.length;
      // Section name in A{sectionStart}, vertically merged
      grid[sectionStart - 1][0] = s.name;
      if (sectionEnd > sectionStart) merges.push([sectionStart, 1, sectionEnd - sectionStart + 1, 1]);
      sectionLayouts.push({ start: sectionStart, end: sectionEnd });
    });

    pageLayout.push({
      pageTop: pageTop, counterRow: counterRow,
      firstCheck: firstCheck, lastCheck: lastCheck,
      sections: sectionLayouts
    });
  });

  // Row-3 global counters = SUM of per-page counters
  BLOCKS.forEach(function (b) {
    var passCells = pageLayout.map(function (L) { return cl(b.rA) + L.counterRow; });
    var failCells = pageLayout.map(function (L) { return cl(b.rB) + L.counterRow; });
    grid[2][b.rA - 1] = '=SUM(' + passCells.join(';') + ')';
    grid[2][b.rB - 1] = '=SUM(' + failCells.join(';') + ')';
  });

  var LAST = grid.length;

  sheet.getRange(1, 1, LAST, NCOLS).setValues(grid);
  merges.forEach(function (m) { sheet.getRange(m[0], m[1], m[2], m[3]).merge(); });

  // ── Formatting ──────────────────────────────────────────────────────
  full.setFontFamily('Arial');

  var tealCells = ['A1', 'B1', 'B4'];
  BLOCKS.forEach(function (b) {
    tealCells.push(cl(b.s) + '1');
    tealCells.push(cl(b.c1) + '1');
    tealCells.push(cl(b.rA) + '1');
  });
  tealCells.forEach(function (a1) {
    sheet.getRange(a1).setBackground(COLORS.teal).setFontColor(COLORS.tealFg)
      .setFontWeight('bold').setFontSize(13)
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  });
  sheet.getRange('A4').setBackground(COLORS.teal);
  // B4 "created by" — font color matches background so the signature stays hidden (Vadym, 16/06/2026)
  sheet.getRange('B4').setFontColor(COLORS.teal);

  BLOCKS.forEach(function (b) {
    // Platform sub-label (s) — size 13 (Vadym, 17/06/2026)
    sheet.getRange(2, b.s, 1, P).setBackground(COLORS.blue).setFontWeight('bold').setFontSize(13)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.getRange(2, b.rA).setBackground(COLORS.blue).setFontWeight('bold').setFontSize(11)
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
    sheet.getRange(2, b.c1).setBackground(COLORS.passBg).setFontColor(COLORS.passFg).setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center');
    sheet.getRange(2, b.c1 + 1).setBackground(COLORS.failBg).setFontColor(COLORS.failFg).setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center');
    sheet.getRange(2, b.c3).setBackground(COLORS.gray).setFontColor(COLORS.grayFg).setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center');
    sheet.getRange(3, b.c1).setBackground(COLORS.cntPass).setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
    sheet.getRange(3, b.c1 + 1).setBackground(COLORS.cntFail).setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
    sheet.getRange(3, b.c3).setBackground(COLORS.gray).setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
    sheet.getRange(3, b.rA).setBackground(COLORS.cntPass).setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
    sheet.getRange(3, b.rB).setBackground(COLORS.cntFail).setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
    // Row 4 — "Comments" header size 14, "Passed"/"Failed" labels size 11 (Vadym, 17/06/2026)
    sheet.getRange(4, b.c1).setBackground(COLORS.gray).setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center');
    sheet.getRange(4, b.rA).setBackground(COLORS.passBg).setFontColor(COLORS.passFg).setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
    sheet.getRange(4, b.rB).setBackground(COLORS.failBg).setFontColor(COLORS.failFg).setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
  });

  SPACERS.forEach(function (col) {
    sheet.getRange(1, col, LAST, 1).setBackground(COLORS.gray);
  });

  var validation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Passed', 'Failed', 'Skipped'], true)
    .setAllowInvalid(false).build();

  pageLayout.forEach(function (L, i) {
    var p = PAGES[i];

    // Page band styling (rows pageTop..pageTop+1)
    sheet.getRange(L.pageTop, 1, 2, NCOLS).setBackground(COLORS.pageBg);
    sheet.getRange(L.pageTop, 1).setFontWeight('bold').setFontSize(13)
      .setHorizontalAlignment('left').setVerticalAlignment('middle').setWrap(true);
    BLOCKS.forEach(function (b) {
      sheet.getRange(L.pageTop, b.s).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
      // Page-band name mirror (H5:I5 / P5:Q5 / X5:Y5 etc.) — size 12 (Vadym, 17/06/2026)
      sheet.getRange(L.pageTop, b.rA).setFontWeight('bold').setFontSize(12)
        .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
      sheet.getRange(L.counterRow, b.rA).setBackground(COLORS.cntPass).setFontWeight('bold').setHorizontalAlignment('center');
      sheet.getRange(L.counterRow, b.rB).setBackground(COLORS.cntFail).setFontWeight('bold').setHorizontalAlignment('center');
    });
    // Auto-fit pageTop row so the narrow mirror cells grow to fit long page names (Vadym, 17/06/2026)
    sheet.autoResizeRows(L.pageTop, 1);

    // Check-row body (rows firstCheck..lastCheck)
    var n = L.lastCheck - L.firstCheck + 1;
    sheet.getRange(L.firstCheck, 1, n, 2).setBackground(COLORS.white);
    sheet.getRange(L.firstCheck, 2, n, 1).setWrap(true).setFontSize(10)
      .setVerticalAlignment('middle');
    BLOCKS.forEach(function (b) {
      sheet.getRange(L.firstCheck, b.s, n, P).setBackground(COLORS.statusBg).setDataValidation(validation)
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
      sheet.getRange(L.firstCheck, b.c1, n, 3).setBackground(COLORS.statusBg);
      sheet.getRange(L.firstCheck, b.rA, n, 2).setBackground(COLORS.resultBg)
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
    });
    // Auto-fit row height to wrapped content (Vadym, 17/06/2026)
    sheet.autoResizeRows(L.firstCheck, n);

    // Section name col A — bold, centered, vertically merged + per-section
    // collapsible row group (Vadym, 16/06/2026). Font size 11 (Vadym, 17/06/2026)
    // Section-aware borders on A:B (Vadym, 17/06/2026): col A = frame around the
    // merged name; col B = LEFT always + BOTTOM on last + TOP on first (skip TOP
    // on the first section of the page — page band above provides separation).
    L.sections.forEach(function (s, idx) {
      var sn = s.end - s.start + 1;
      sheet.getRange(s.start, 1, sn, 1)
        .setFontWeight('bold').setFontSize(11)
        .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
      sheet.getRange(s.start, 1, sn, NCOLS).shiftRowGroupDepth(1);

      var addTop = idx > 0;
      // Col A — outer frame around the merged section-name cell
      sheet.getRange(s.start, 1, sn, 1).setBorder(addTop || null, true, true, true, null, null);
      // Col B — left on every row, bottom on last row
      sheet.getRange(s.start, 2, sn, 1).setBorder(null, true, null, null, null, null);
      sheet.getRange(s.end, 2).setBorder(null, null, true, null, null, null);
      if (addTop) sheet.getRange(s.start, 2).setBorder(true, null, null, null, null, null);
    });
  });

  WIDTHS.forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });
  for (var r = 1; r <= LAST; r++) { if (heights[r]) sheet.setRowHeight(r, heights[r]); }
  sheet.setFrozenRows(4);
  sheet.setFrozenColumns(2);

  // collapsible column groups: status + comments of each block (Vadym, 10/06/2026)
  BLOCKS.forEach(function (b) {
    sheet.getRange(cl(b.s) + '1:' + cl(b.spacer) + '1').shiftColumnGroupDepth(1);
  });
  // +/- toggle on the right of each group (Vadym, 16/06/2026)
  sheet.setColumnGroupControlAfter(true);

  function cfRanges(a1list) {
    return a1list.map(function (a1) { return sheet.getRange(a1); });
  }
  var _sr = [], _pr = [];
  BLOCKS.forEach(function (b) {
    _sr.push(cl(b.s) + '1:' + cl(b.sEnd) + '199');   // status columns (all P)
    _sr.push(cl(b.rA) + '1:' + cl(b.rB) + '199');    // result columns
    _sr.push(cl(b.c1) + '2:' + cl(b.c3) + '2');      // counter header row 2
    _pr.push(cl(b.s) + '1:' + cl(b.sEnd) + '199');
    _pr.push(cl(b.c1) + '2:' + cl(b.c3) + '2');
  });
  var statusRanges = cfRanges(_sr);
  var purpleRanges = cfRanges(_pr);
  var rules = [
    // Partial (result columns only — no status cell can ever hold it). Amber, so a row still
    // open on some status column cannot be mistaken for a verified one when rows are collapsed.
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Partial')
      .setBackground('#FCE5A2').setFontColor('#7F6000').setBold(true).setRanges(statusRanges).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Skipped')
      .setBackground('#D9D9D9').setFontColor('#434343').setBold(true).setRanges(statusRanges).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Passed')
      .setBackground('#D2EBDA').setFontColor('#135522').setBold(true).setRanges(statusRanges).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Failed')
      .setBackground('#F8D5DA').setFontColor('#701C22').setBold(true).setRanges(statusRanges).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextContains('Not all issues are resolved!')
      .setBackground('#8E7BC3').setFontColor('#F3F3F3').setBold(true).setRanges(purpleRanges).build()
  ];
  sheet.setConditionalFormatRules(rules);

  var nSections = PAGES.reduce(function (a, p) { return a + p.sections.length; }, 0);
  var nChecks   = PAGES.reduce(function (a, p) { return a + p.sections.reduce(function (b, s) { return b + s.checks.length; }, 0); }, 0);
  Logger.log('Done: ' + PAGES.length + ' pages, ' + nSections + ' sections, ' + nChecks + ' checks, ' + LAST + ' rows.');
  Logger.log('URL: ' + ss.getUrl());
}
