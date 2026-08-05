// bs-sheet.mjs — build the Bug summary tab from a summary JSON.
//
// THE DOCUMENT: a retrospective roll-up of the bugs FOUND during an engagement — how many, at what
// severity, broken down by module. It is a REPORT, not a tracker. The headline number is "bugs found",
// and every statistic on the tab is computed by a formula over the rows below it.
//
// FIDELITY FIRST. The default output reproduces the owner's document exactly: same columns, same
// palette, same fonts, same borders, same per-page numbering, same formulas. "Reproduce, don't
// redesign" (Custom-Reports convention #3) — a report nobody recognises is a report nobody opens.
// Every improvement the kit has to offer is OPT-IN and listed under IMPROVEMENTS below, so the owner
// turns on what he wants and the default stays his.
//
//   node tools/bs-sheet.mjs --help
//   node tools/bs-sheet.mjs --dry-run                 # validate + build + print the plan. No Google, no writes.
//   PROJECT_NAME=Acme node tools/bs-sheet.mjs         # publish
//
// Env contract (no project data lives in this file):
//   PROJECT_NAME=<Project>       required to publish — names the doc and its Drive folder
//   SUMMARY=./bug-summary.json   the record: sites → modules → issues (bug-summary.schema.json)
//   BS_TAB="Statistic"           tab title (the owner's name for it) · BS_GID=940001  fixed sheetId
//   TARGET_SSID=<spreadsheetId>  write the tab INTO an existing doc (the demo/validation path)
//   SHEET_NAME="Issues on <Project>"   doc title when the tool creates the file
//   DRIVE_ROOT_FOLDER=ClaudeProjects · DRIVE_CATEGORY="QA Documentation"
//   MCP_SHEETS_DIR / QA_SCHEMAS_VALIDATOR   auto-resolved by walking up to the nearest .mcp.json
//   QA_LINK_LEDGER               path to Rules-Guide/link-ledger/link-ledger.mjs (auto-resolved);
//                                the tab's id+gid must match `<Project>/.link-ledger.json` or the
//                                build REFUSES — a rebuilt tab under a new gid kills shared links.
//                                Deliberate move: LINK_LEDGER_ADOPT=1
//   BS_ALLOW_ADOPT=1             permit REPLACING a tab this tool did not write (one with no `bs:` note)
//
// IMPROVEMENTS — all OFF by default; each one is additive and none changes the default look:
//   BS_STATUS_COLUMN=1   a Status column (+ an "Unresolved" counter and a derived "Left issues" tab).
//                        Only for a summary that is being WORKED, not one that reports a closed engagement.
//   BS_ID_COLUMN=1       a stable ID column. The owner's № restarts at 1 on every module, so it cannot
//                        address a row; anything that has to point AT a row needs this.
//   BS_PAGE_TOTALS=1     a per-module total in the Total column (the owner's document totals only globally).
//   BS_RECONCILE=1       a visible guard: the grand total vs the sum of the module counters. They disagree
//                        exactly when a row sits outside every module band, where no counter can see it.
//                        (Even with this OFF, the tool performs the same check at BUILD time and refuses.)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const PLAN_JSON = process.argv.includes('--plan-json');

if (process.argv.includes('--help')) {
  console.log('bs-sheet — build the Bug summary tab from a summary JSON. Default output reproduces the owner document exactly.\n'
    + 'Flags: --dry-run · --plan-json · --help\n'
    + 'Env: PROJECT_NAME SUMMARY BS_TAB BS_GID TARGET_SSID SHEET_NAME DRIVE_ROOT_FOLDER DRIVE_CATEGORY MCP_SHEETS_DIR QA_SCHEMAS_VALIDATOR QA_LINK_LEDGER BS_ALLOW_ADOPT LINK_LEDGER_ADOPT\n'
    + 'Improvements (all OFF by default): BS_STATUS_COLUMN BS_ID_COLUMN BS_PAGE_TOTALS BS_RECONCILE');
  process.exit(0);
}

const die = (msg, code = 1) => { console.error(`bs-sheet: ${msg}`); process.exit(code); };
const warnings = [];
const warn = (m) => warnings.push(m);
const readJson = (p, msg) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return die(`${msg}: ${e.message}`, 2); } };
const findUp = (rels) => {
  let dir = HERE;
  for (let i = 0; i < 12; i++) {
    for (const rel of rels) if (fs.existsSync(path.join(dir, rel))) return path.join(dir, rel);
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  return null;
};

// ── the record ────────────────────────────────────────────────────────────────────────────
const SUMMARY_PATH = process.env.SUMMARY || path.join(process.cwd(), 'bug-summary.json');
if (!fs.existsSync(SUMMARY_PATH)) die(`no summary at ${SUMMARY_PATH} — set SUMMARY=<path> (see README).`, 2);
const S = readJson(SUMMARY_PATH, 'cannot read the summary');

const validator = process.env.QA_SCHEMAS_VALIDATOR
  || findUp(['QA-SetupKit/Rules-Guide/schemas/validate.mjs', 'Rules-Guide/schemas/validate.mjs']);
if (validator) {
  const r = spawnSync(process.execPath, [validator, 'bug-summary', SUMMARY_PATH], { encoding: 'utf8' });
  if (r.status !== 0) die(`the summary is not valid against bug-summary.schema.json:\n${(r.stderr || r.stdout || '').trim()}`, 1);
} else {
  warn('validate.mjs not found — the summary was NOT schema-checked (set QA_SCHEMAS_VALIDATOR).');
}

const SCALE = S.severityScale;            // the client's scale — drives the geometry
const NSEV = SCALE.length;
// A row leaves the outstanding count when it is PROVEN FIXED (`verified`), when it turned out not to be a
// defect (`reassigned`), or when it is the same bug already counted under another id (`duplicate` — counting
// it again is a double-count). `wontfix` does NOT leave: nobody is going to act on it, but it is still
// broken, and a summary that quietly buries wontfixes is how a product accumulates known defects nobody
// remembers agreeing to. (An audit caught the first version of this counting all three as still owed.)
const RESOLVED = 'verified';
const NOT_OWED = ['verified', 'reassigned', 'duplicate'];
const notOwed = (col) => NOT_OWED.map((v) => `COUNTIF(${col}${SEP}"${v}")`).join('+');
const notOwedIn = (col, a, b) => NOT_OWED.map((v) => `COUNTIF(${col}${a}:${col}${b}${SEP}"${v}")`).join('+');
const STATUSES = ['unknown', 'open', 'not-verified', 'fixed', 'verified', 'reopened', 'wontfix', 'reassigned', 'duplicate'];

const WITH_ID = !!process.env.BS_ID_COLUMN;
const WITH_STATUS = !!process.env.BS_STATUS_COLUMN;
const WITH_PAGE_TOTALS = !!process.env.BS_PAGE_TOTALS;
const WITH_RECONCILE = !!process.env.BS_RECONCILE;
// The reference carries ZERO cell notes. Every note Google renders as a black corner triangle, so 309 of
// them visibly change the texture of a document we promised to reproduce. Row-level notes (evidence, ids)
// are therefore OPT-IN. The notes that carry an HONESTY obligation — what this document is, and which
// severities a machine guessed — are always written: they are the ones a reader must not miss.
const WITH_CELL_NOTES = !!process.env.BS_CELL_NOTES;
// Severity colours: ON by default (owner's call, 14/07). The reference paints every severity the same
// green, which means the one column the reader scans for danger tells them nothing. The colours are the
// workspace house style (the same red/amber/green used in the analytical tabs), applied as CONDITIONAL
// FORMAT RULES keyed on the value — so they follow the data when a row is edited, re-sorted or inserted,
// which a painted cell does not. BS_SEVERITY_COLORS=0 restores the reference's flat green.
const WITH_SEV_COLORS = process.env.BS_SEVERITY_COLORS !== '0';

// ── the checks the schema cannot make ─────────────────────────────────────────────────────
const issues = [];
const seen = new Map();
for (const site of S.sites) for (const page of site.pages) for (const it of page.issues) {
  issues.push({ ...it, site, page });
  if (seen.has(it.id)) die(`duplicate issue id "${it.id}" (${seen.get(it.id)} and ${site.id}/${page.id}).`, 1);
  seen.set(it.id, `${site.id}/${page.id}`);
  if (!SCALE.includes(it.severity)) die(`issue "${it.id}" has severity "${it.severity}", which is not in severityScale [${SCALE.join(', ')}].\n`
    + '  Refusing to build: no counter column would count it, so it would vanish from every total on the\n'
    + '  tab while still sitting there in plain sight — a bug the report silently loses.', 1);
}
if (!issues.length) die('the summary contains no issues at all — nothing to roll up.', 1);

// SEVERITY PROVENANCE. The tracker this data comes from has no severity field: a human assigns it, or an
// agent proposes it. A machine's guess must never be mistaken for a triage decision — so a proposed
// severity is recorded as such, noted on its own cell, and counted out loud on every build.
const proposed = issues.filter((i) => i.severitySource === 'agent-proposed');
if (proposed.length) warn(`${proposed.length} of ${issues.length} severities are AGENT-PROPOSED, not triaged by a human. Each is flagged in its cell note with the decision-tree branch that produced it. Review them before this report goes to anyone — a proposed severity is a hypothesis, and every count on this tab is built out of them.`);
const noEvidence = issues.filter((i) => !(i.evidence || []).length);
const expiring = issues.filter((i) => (i.evidence || []).some((e) => e.hostRisk === 'expiring'));
if (noEvidence.length) warn(`${noEvidence.length} row(s) carry no evidence link.`);
if (expiring.length) warn(`${expiring.length} row(s) rest on evidence hosts where links expire (screencast.com / prnt.sc / Dropbox shares). When those die, the bug is unprovable and the row becomes a number nobody can check.`);

// ── geometry — the owner's, exactly ───────────────────────────────────────────────────────
// A №(50) · B Summary(507) · C Severity(104) · D Notes(207) · E…H counters · I Total
// Columns = 4 + NSEV + 1. severityScale drives it: one counter column per value, and every merge,
// width, formula and colour recomputes from its length.  Optional columns slot in where marked.
const cols = [];
const C = {};
const addCol = (key, width) => { C[key] = cols.length; cols.push({ key, width }); };
addCol('n', 50);
if (WITH_ID) addCol('id', 150);
addCol('summary', 507);
addCol('severity', 104);
if (WITH_STATUS) addCol('status', 112);
addCol('notes', 207);
C.cnt = cols.length;
for (let i = 0; i < NSEV; i++) addCol(`cnt${i}`, i < 2 ? 140 : 100);
addCol('total', 170);
if (WITH_STATUS) addCol('unresolved', 120);
const NCOLS = cols.length;
const LASTLEFT = C.notes;                 // the last of the row-description columns
const A1C = (i) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
const HEADER_ROWS = 4;

const rgb = (h) => ({ red: parseInt(h.slice(1, 3), 16) / 255, green: parseInt(h.slice(3, 5), 16) / 255, blue: parseInt(h.slice(5, 7), 16) / 255 });
// Read straight off the owner's document — do not "improve" these.
const HEAD_BG = rgb('#134f5c'), HEAD_FG = rgb('#f3f3f3');
const CNTHEAD_BG = rgb('#41859a');
const SEVLBL_BG = rgb('#b6d7a8'), SEVLBL_E = rgb('#b7e1cd');   // the E cell is a shade off in the original
const COUNT_BG = rgb('#6c8194');
const STRIP_BG = rgb('#d9d9d9');
const PAGE_BG = rgb('#04688c'), PAGE_MIRROR = rgb('#119ed2');
const ROW_BG = rgb('#f3f3f3');
const SEV_BG = rgb('#b6d7a8');                                  // UNIFORM — the original does not colour by severity
const WHITE = rgb('#ffffff'), BLACK = rgb('#000000');
const SPACER_BG = rgb('#073763');
const SITE_PALETTE = ['#3d85c6', '#0b5394', '#0b8043', '#7a43a4', '#a64d79'].map(rgb);
const BORDER = { style: 'SOLID', color: BLACK };
// updateBorders draws the OUTLINE of a range. The reference rules EVERY cell, so the inner lines are
// not optional — without innerHorizontal/innerVertical the grid comes back as one big box and the whole
// document reads as "the colours drifted", which is exactly how this was caught.
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, innerHorizontal: BORDER, innerVertical: BORDER };
const OPEN_BOTTOM = { top: BORDER, left: BORDER, right: BORDER, innerVertical: BORDER };   // the counter rows: no bottom rule
const STATUS_COLOR = {                                          // only ever drawn when BS_STATUS_COLUMN=1
  verified: rgb('#b6d7a8'), fixed: rgb('#d9ead3'), open: rgb('#f4c7c3'), reopened: rgb('#e06666'),
  'not-verified': rgb('#fce8b2'), unknown: rgb('#d9d9d9'),
  wontfix: rgb('#d0e2f3'), reassigned: rgb('#d0e2f3'), duplicate: rgb('#d0e2f3'),
};


// ── how tall a row must be so its text is READABLE IN FULL ─────────────────────────────────
// Sheets will not do this for us. `autoResizeDimensions` ignores wrapped text through the API (it pins
// the row back to 21px), and a row left with NO height collapses to a sliver. So the height is COMPUTED:
// Arial advance widths + the same greedy word-wrap Sheets does, including breaking a token that is wider
// than the column (which is exactly what a 120-character evidence URL is).
// Calibrated against the one row the owner auto-fitted by hand: 261 chars → 4 lines → 70px. Exact.
const ARIAL_W = { ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  0: 556, 1: 556, 2: 556, 3: 556, 4: 556, 5: 556, 6: 556, 7: 556, 8: 556, 9: 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584 };
const LINE_PX = 16, PAD_PX = 6, MIN_ROW = 21, MAX_ROW = 400;
const chW = (c, px) => ((ARIAL_W[c] ?? 556) / 1000) * px;
const strPx = (t, px) => [...t].reduce((a, c) => a + chW(c, px), 0);
function wrapLines(text, colPx, fontPt = 10) {
  if (!text) return 1;
  const px = fontPt * (96 / 72);
  const max = colPx - 8;
  let lines = 1, cur = 0;
  for (const word of String(text).split(/\s+/)) {
    const w = strPx(word, px);
    const sp = cur ? chW(' ', px) : 0;
    if (cur + sp + w <= max) { cur += sp + w; continue; }
    if (w <= max) { lines++; cur = w; continue; }
    if (cur) { lines++; cur = 0; }
    let rest = word;
    while (strPx(rest, px) > max) {
      let i = 0, acc = 0;
      while (i < rest.length && acc + chW(rest[i], px) <= max) { acc += chW(rest[i], px); i++; }
      rest = rest.slice(Math.max(i, 1));
      lines++;
    }
    cur = strPx(rest, px);
  }
  return lines;
}
const rowHeight = (row) => {
  const n = Math.max(wrapLines(row[C.summary], COL_WIDTH_OF('summary')), wrapLines(row[C.notes], COL_WIDTH_OF('notes')));
  return Math.min(MAX_ROW, Math.max(MIN_ROW, PAD_PX + n * LINE_PX));
};

const COL_WIDTH_OF = (key) => (cols.find((c) => c.key === key) || { width: 200 }).width;

const TAB = process.env.BS_TAB || 'Statistic';
const LEFT_TAB = process.env.BS_LEFT_TAB || 'Left issues';
const GID = Number(process.env.BS_GID || 940001);
const LEFT_GID = Number(process.env.BS_LEFT_GID || 940002);
const qt = (t) => t.replace(/'/g, "''");

// Google parses an API-sent formula in the SPREADSHEET's locale: uk_UA wants ";", en_US wants ",".
// Send the wrong one and every counter on the tab becomes #ERROR!. Read it; never assume it.
const COMMA_DECIMAL = /^(uk|ru|de|fr|es|it|pl|pt|nl|tr|cs|sk|hu|ro|bg|hr|sl|lt|lv|et|fi|sv|nb|da|el|vi|id|be|ka|sr|uz|kk)([_-]|$)/i;
let SEP = process.env.BS_FORMULA_SEP || ',';
const sepForLocale = (loc) => (COMMA_DECIMAL.test(String(loc || '')) ? ';' : ',');

// ── build ─────────────────────────────────────────────────────────────────────────────────
const blank = () => Array.from({ length: NCOLS }, () => '');
let grid, notes, merges, rowGroups, siteRows, pageRows, spacerRows, issueRanges, pageTotalRows, siteTotalMerges, footerRow;

// What the previous tab says, read back before a rebuild overwrites it. Declared HERE, above build(),
// because --dry-run calls build() long before the Google read happens — a declaration further down
// would be in its temporal dead zone and the dry run would die with a ReferenceError.
const carried = new Map();          // global issue index → what the tab says
const carriedByText = new Map();    // normalised summary → same, for UNIQUE summaries only
const drifted = [];                 // the tab and the JSON disagree; the tab wins and the JSON is stale
const unmatched = [];               // a row on the tab we could not tie to a row in the JSON
const normTxt = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const sameSummary = (a, b) => normTxt(a).slice(0, 120) === normTxt(b).slice(0, 120);

function build(carried) {
  grid = []; notes = []; merges = []; rowGroups = []; siteRows = []; pageRows = []; spacerRows = [];
  issueRanges = []; pageTotalRows = []; siteTotalMerges = []; footerRow = -1;
  drifted.length = 0; unmatched.length = 0;
  let gidx = 0;                                   // the issue's position across the WHOLE tab, top to bottom
  const SEVC = A1C(C.severity);

  // header rows 1–4
  const h1 = blank();
  h1[C.n] = '№'; h1[C.summary] = 'Summary '; h1[C.severity] = 'Severity'; h1[C.notes] = 'Notes';
  if (WITH_ID) h1[C.id] = 'ID';
  if (WITH_STATUS) h1[C.status] = 'Status';
  h1[C.cnt] = 'Total count per Severity';
  h1[C.total] = 'Total count of issues:\n(All modules)';
  if (WITH_STATUS) h1[C.unresolved] = 'Still unresolved:\n(not proven fixed)';
  grid.push(h1);

  const h2 = blank();
  SCALE.forEach((s, i) => { h2[C.cnt + i] = s; });
  grid.push(h2);

  const h3 = blank();
  SCALE.forEach((s, i) => { h3[C.cnt + i] = `=COUNTIF(${SEVC}:${SEVC}${SEP}"${s}")`; });
  h3[C.total] = `=${SCALE.map((_, i) => `${A1C(C.cnt + i)}3`).join('+')}`;      // the owner's =E3+F3+G3+H3
  if (WITH_STATUS) h3[C.unresolved] = `=${A1C(C.total)}3-(${notOwed(`${A1C(C.status)}:${A1C(C.status)}`)})`;
  grid.push(h3);

  const h4 = blank();
  h4[C.cnt] = 'Count per Severity (Per Page)';
  grid.push(h4);

  merges.push({ r0: 0, r1: 3, c0: C.n, c1: C.n + 1 }, { r0: 0, r1: 3, c0: C.summary, c1: C.summary + 1 },
    { r0: 0, r1: 3, c0: C.severity, c1: C.severity + 1 }, { r0: 0, r1: 3, c0: C.notes, c1: C.notes + 1 },
    { r0: 0, r1: 1, c0: C.cnt, c1: C.total }, { r0: 3, r1: 4, c0: C.cnt, c1: C.total },
    { r0: 3, r1: 4, c0: 0, c1: C.cnt },                                          // A4:D4 grey strip
    { r0: 0, r1: 2, c0: C.total, c1: C.total + 1 }, { r0: 2, r1: 4, c0: C.total, c1: C.total + 1 });
  if (WITH_ID) merges.push({ r0: 0, r1: 3, c0: C.id, c1: C.id + 1 });
  if (WITH_STATUS) merges.push({ r0: 0, r1: 3, c0: C.status, c1: C.status + 1 }, { r0: 0, r1: 2, c0: C.unresolved, c1: C.unresolved + 1 });

  // A1 carries ONE thing: the statement a reader must not miss — and only while it is still true.
  // Everything the TOOL needs (id, source, geometry) lives in the 1px footer row instead, so a document
  // shared with a client is not covered in machine metadata.
  //
  // The warning is NOT hidden with it, and that is deliberate: it is a RELEASE GATE, not clutter. A tab
  // that still says "230 of 230 severities were proposed by an agent" is a tab that has not been reviewed,
  // and burying that line in a 1px row at the bottom would let an unreviewed document go to a client
  // looking finished. It disappears on its own the moment the severities are triaged by a human
  // (severitySource: owner) — because then it is no longer true.
  if (proposed.length) {
    notes.push({ row: 0, col: C.n, note:
      `⚠ ${proposed.length} of ${issues.length} severities on this tab were PROPOSED BY AN AGENT, not triaged\n`
      + 'by a human. The source tracker records no severity, so they were derived from the severity decision\n'
      + 'tree; each cell notes the branch that produced it.\n\n'
      + 'A proposed severity is a HYPOTHESIS, and every count on this tab is built out of them.\n'
      + 'Review them before this document goes to anyone outside the team — this note disappears by itself\n'
      + 'once they are triaged.' });
  }

  // sites → modules (pages) → issues
  S.sites.forEach((site, si) => {
    if (si > 0) { grid.push(blank()); spacerRows.push(grid.length - 1); merges.push({ r0: grid.length - 1, r1: grid.length, c0: 0, c1: C.total }); }
    const siteRow = grid.length;
    const band = blank();
    band[C.n] = site.name;
    grid.push(band);
    merges.push({ r0: siteRow, r1: siteRow + 1, c0: 0, c1: C.total });          // A:H — one bar, as in the original
    siteRows.push({ row: siteRow, si });
    if (WITH_CELL_NOTES) notes.push({ row: siteRow, col: C.n, note: `site: ${site.id}${site.url ? `\n${site.url}` : ''}\n`
      + `${site.pages.length} module(s) · ${site.pages.reduce((a, p) => a + p.issues.length, 0)} issue(s) found` });
    const groupStart = grid.length;

    // An `unplaced` band (conventionally "General") always renders LAST within its site, whatever order the
    // JSON happens to be in. It is a debt, and a debt belongs at the end of the list, not interleaved with
    // the real modules — and it is scoped to THIS site: a document covering several sites gets one per site,
    // never a shared bucket that would merge the unplaced bugs of two different products.
    const ordered = [...site.pages.filter((p) => !p.unplaced), ...site.pages.filter((p) => p.unplaced)];
    ordered.forEach((page) => {
      const p = grid.length;
      const pb = blank();
      pb[C.n] = page.name;
      pb[C.cnt] = `=${A1C(C.n)}${p + 1}`;                                        // the owner's mirror formula
      grid.push(pb);
      const lbl = blank();
      SCALE.forEach((s, i) => { lbl[C.cnt + i] = s; });
      grid.push(lbl);
      grid.push(blank());                                                        // counters — filled once the span is known

      const first = grid.length + 1;
      page.issues.forEach((it, k) => {
        const r = blank();
        r[C.n] = k + 1;                                                          // per-module ordinal, restarts — the owner's
        r[C.summary] = it.summary;
        r[C.severity] = it.severity;
        r[C.notes] = it.notes || '';
        if (WITH_ID) r[C.id] = it.id;

        // What the team typed on the previous tab wins over what the JSON remembers — it is the newer
        // judgement, and it exists nowhere else. Every disagreement is REPORTED, so the JSON (which is
        // the record) gets written back rather than quietly left stale.
        const byPos = carried.get(gidx);
        const c = (byPos && sameSummary(byPos.summary, it.summary)) ? byPos : carriedByText.get(normTxt(it.summary));
        if (byPos && !c) unmatched.push(`row ${gidx + 1} on the tab ("${String(byPos.summary).slice(0, 60)}…") matches no row in the JSON`);
        if (c) {
          if (c.severity && c.severity !== it.severity) {
            drifted.push(`${it.id}  severity: JSON "${it.severity}" → TAB "${c.severity}"`);
            r[C.severity] = c.severity;
          }
          if (c.notes && c.notes !== (it.notes || '')) {
            drifted.push(`${it.id}  notes: TAB has "${String(c.notes).slice(0, 50)}…"`);
            r[C.notes] = c.notes;
          }
        }
        if (WITH_STATUS) r[C.status] = (c && c.status) || it.status || 'unknown';
        gidx++;
        grid.push(r);
        const row = grid.length - 1;

        const ev = it.evidence || [];
        const bits = [`id: ${it.id}`];
        if (it.bugId) bits.push(`bug record: ${it.bugId}`);
        if (it.trackerRef) bits.push(`tracker: ${it.trackerRef}`);
        if (it.foundOn) bits.push(`found on: ${it.foundOn}`);
        if (it.reportedAt) bits.push(`reported: ${it.reportedAt}`);
        if (ev.length) {
          bits.push('evidence:');
          ev.forEach((e) => bits.push(`  • ${e.kind || 'other'}${e.hostRisk === 'expiring' ? '  [LINK MAY EXPIRE]' : ''}: ${e.url}`));
        } else {
          bits.push('⚠ no evidence link on this row.');
        }
        if (WITH_CELL_NOTES) notes.push({ row, col: C.summary, note: bits.join('\n') });
        // The cell says ONE thing: which branch of the severity tree produced this rating (owner's call,
        // 14/07 — the full disclaimer belongs on the column header, not repeated 230 times).
        // The provenance is not lost: the Severity HEADER note carries the "N of M are agent-proposed"
        // warning, the build prints it every run, and the JSON keeps the source and the branch per row.
        if (it.severityRationale) notes.push({ row, col: C.severity, note: `branch: ${it.severityRationale}` });
      });
      const last = grid.length;
      const empty = page.issues.length === 0;

      SCALE.forEach((s, i) => {
        grid[p + 2][C.cnt + i] = empty ? 0 : `=COUNTIF(${SEVC}${first}:${SEVC}${last}${SEP}"${s}")`;
      });
      if (WITH_PAGE_TOTALS) grid[p + 2][C.total] = `=${SCALE.map((_, i) => `${A1C(C.cnt + i)}${p + 3}`).join('+')}`;
      if (WITH_STATUS) {
        grid[p + 2][C.unresolved] = empty ? 0
          : `=${SCALE.map((_, i) => `${A1C(C.cnt + i)}${p + 3}`).join('+')}-(${notOwedIn(A1C(C.status), first, last)})`;
      }
      pageTotalRows.push({ row: p + 2, first, last, count: page.issues.length });

      merges.push({ r0: p, r1: p + 3, c0: 0, c1: LASTLEFT + 1 }, { r0: p, r1: p + 1, c0: C.cnt, c1: C.total });
      pageRows.push(p);
      if (WITH_CELL_NOTES) notes.push({ row: p, col: C.n, note: `module: ${site.id}/${page.id}${page.url ? `\n${page.url}` : ''}`
        + (empty ? '\n\nTested — no issues found. An empty band and an absent band say different things.' : '') });
      if (!empty) { issueRanges.push({ r0: first - 1, r1: last }); rowGroups.push({ r0: first - 1, r1: last, depth: 2 }); }
    });
    if (grid.length > groupStart + 1) rowGroups.push({ r0: groupStart, r1: grid.length, depth: 1 });
    // The Total column is merged down the whole site — the owner's I5:I290. It keeps the column reading as
    // ONE figure per site instead of a ladder of empty cells. It is also why per-module totals are an
    // OPTION and not a default: the two cannot both have that column.
    if (!WITH_PAGE_TOTALS) siteTotalMerges.push({ r0: siteRow, r1: grid.length });
  });

  // A 1px footer row: everything the TOOL needs to know about this tab, out of the reader's way. It also
  // carries the `bs:` marker the adopt-guard looks for, so a rebuild can still tell its own tab from a
  // hand-made one.
  footerRow = grid.length;
  grid.push(blank());
  const modCount = S.sites.reduce((a, st) => a + st.pages.length, 0);
  const srcCount = {};
  for (const it of issues) if (it.moduleSource) srcCount[it.moduleSource] = (srcCount[it.moduleSource] || 0) + 1;
  notes.push({ row: footerRow, col: C.n, note:
    `bs: ${S.summaryId}\n${S.project}${S.environment ? ` · ${S.environment}` : ''}\n`
    + `Generated ${S.generatedAt} from ${S.source.kind}${S.source.ref ? `\nsource: ${S.source.ref}` : ''}\n`
    + (S.source.note ? `\n${S.source.note}\n` : '')
    + `\n${S.sites.length} site(s) · ${modCount} module(s) · ${issues.length} bug(s) found`
    + `\nSeverity scale: ${SCALE.join(' > ')}`
    + (Object.keys(srcCount).length ? `\nmoduleSource: ${Object.entries(srcCount).map(([k, v]) => `${k} ${v}`).join(' · ')}` : '')
    + '\n\nEvery count on this tab is a FORMULA over the rows above it. Type a number into a counter cell and\n'
    + 'the document starts lying the moment the next row is added.\n'
    + 'Rebuilt by bs-sheet.mjs — the JSON is the record, this tab is a projection of it.' });

  // RECONCILIATION. The grand total counts the WHOLE severity column; the module counters count their own
  // ranges. A row outside every module band is counted by NOTHING. The tool checks this at build time
  // from the ranges it just laid out — always, whether or not the guard cell is switched on.
  const covered = pageTotalRows.reduce((a, p) => a + p.count, 0);
  if (covered !== issues.length) {
    die(`reconciliation failed: ${issues.length} issue(s) in the record, but the module bands cover ${covered}.\n`
      + '  A row outside every band is counted by no formula on the tab. Refusing to publish an under-report.', 1);
  }
  if (WITH_RECONCILE) {
    const sum = pageTotalRows.map((p) => `SUM(${A1C(C.cnt)}${p.row + 1}:${A1C(C.total - 1)}${p.row + 1})`).join('+');
    grid[3][C.total] = `=IF(${A1C(C.total)}3<>${sum}${SEP}"⚠ rows outside every module band"${SEP}"reconciled")`;
  }
  for (const m of siteTotalMerges) merges.push({ r0: m.r0, r1: m.r1, c0: C.total, c1: C.total + 1 });
}

// ── formatting ────────────────────────────────────────────────────────────────────────────
const F = (o) => {
  const f = { verticalAlignment: o.v || 'MIDDLE', wrapStrategy: o.wrap || 'OVERFLOW_CELL',
    textFormat: { fontFamily: 'Arial', fontSize: o.size || 10, bold: !!o.bold, foregroundColor: o.fg || BLACK } };
  if (o.bg) f.backgroundColor = o.bg;
  if (o.h) f.horizontalAlignment = o.h;
  return f;
};
const FIELDS = 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)';
const SEV_DV = { condition: { type: 'ONE_OF_LIST', values: SCALE.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true };

// Keyed by NAME for the scales the kit knows; anything else falls back to a position ramp, because a
// colour invented for a severity the kit has never heard of would be a guess dressed up as a convention.
// Override wholesale with SEVERITY_COLORS='{"Blocker":{"bg":"#990000","fg":"#ffffff"}}'.
const SEVERITY_COLORS = Object.assign({
  Critical: { bg: '#e03029' },
  Major: { bg: '#eeb700' },
  Minor: { bg: '#2d6591' },
  Trivial: { bg: '#52a700' },
}, JSON.parse(process.env.SEVERITY_COLORS || '{}'));
const EMPTY_SEV_BG = process.env.SEVERITY_EMPTY_COLOR || '#cccccc';   // a row with NO severity — see below
// The palette lives HERE (or in SEVERITY_COLORS), and deliberately NOT on the Sheet. Three things make
// reading it back off the tab impossible or actively harmful, all learned the hard way:
//   • Sheets' coloured DROPDOWN CHIPS — the natural way to do this by hand — are not exposed by the API
//     at all: they cannot be written, and cannot even be read.
//   • A conditional format OVERRIDES a manual fill, so a colour painted onto a cell that is under a rule
//     is invisible; the owner picks a colour, sees nothing change, and gives up.
//   • Reading the fills back resurrects the PREVIOUS build's palette and silently overrides the new one.
// So: to change the colours, change them here or pass SEVERITY_COLORS. One place, and it wins.
const RAMP = ['#e03029', '#eeb700', '#2d6591', '#52a700', '#7f7f7f', '#cccccc'];
const sevColor = (name, i) => SEVERITY_COLORS[name] || { bg: RAMP[Math.min(i, RAMP.length - 1)] };
// Text colour is DERIVED from the background, not hardcoded: the owner can hand the kit any palette, and a
// hardcoded black would go unreadable on his first dark colour. Rec. 709 luminance, the usual threshold.
const readableFg = (bgHex) => {
  const c = (i) => { const v = parseInt(bgHex.slice(1 + i * 2, 3 + i * 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * c(0) + 0.7152 * c(1) + 0.0722 * c(2);
  return L > 0.42 ? '#000000' : '#ffffff';
};

// What each severity MEANS, hovering on the label that counts it. The scale belongs to the client, so the
// text is keyed by name and falls back to silence for a name the kit does not know — a definition invented
// for someone else's scale would be worse than none. Override per project with SEVERITY_HELP (JSON).
//
// THIS IS THE OWNER'S CALIBRATION (Vadym, 14/07), and it OVERRIDES the kit's default tree. It is stricter:
// a blocked core flow with no workaround is CRITICAL here, not Major, and "broken but there is a workaround"
// is MAJOR, not Minor. Anything touching PAYMENT or SUBSCRIPTION is Critical, full stop.
//
// These notes ARE the criteria a human will validate the numbers against — so the agent must rate with
// exactly this text and nothing else. An earlier version of these notes said the OPPOSITE of the tree the
// agent had rated with (it had Major as "broken, but there IS a workaround"), so the sheet taught one rule
// while the numbers on it were made with another, and owner and agent would have disagreed forever without
// finding out why. Change the calibration, change the ratings, in the same pass.
const SEVERITY_HELP = Object.assign({
  Critical: 'Critical — a BLOCKER.\n'
    + 'The product cannot be used: a core flow is blocked, or the user cannot get into the app at all '
    + '(Sign up / Login broken), data is lost or corrupted, the app crashes, or a security hole is open — '
    + 'and there is no workaround.\n'
    + 'ANY failure involving PAYMENT or SUBSCRIPTION is Critical. So is NO ACCESS TO CORE FUNCTIONALITY.\n'
    + 'Ship-blocker: it must be fixed before the release goes out.',
  Major: 'Major\n'
    + 'A core feature is broken or gives the wrong result, but the user can still get the job done — through '
    + 'a workaround, another path, or by retrying.\n'
    + 'It hits everyone who meets it. Fixed before the release as well.',
  Minor: 'Minor\n'
    + 'The feature works, but not as specified: wrong behaviour in a SECONDARY flow (account settings, '
    + 'notifications, and the like), a layout that breaks at some specific width, a control that is awkward '
    + 'but usable.\n'
    + 'A deviation from the design belongs HERE when it HIDES, CUTS or OBSCURES something: text truncated, '
    + 'elements overlapping, a needed element not shown.\n'
    + 'NOBODY IS BLOCKED. Fixed when there is a chance.',
  Trivial: 'Trivial\n'
    + 'Cosmetic only — a deviation from the design with NO CONSEQUENCE: padding, a colour off the mockup, an '
    + 'icon size, a typo, an animation that is not smooth.\n'
    + 'THE USER SEES EVERYTHING AND UNDERSTANDS EVERYTHING. Functionally it all works.\n'
    + 'That is the whole line between Trivial and Minor: if the deviation HIDES, CUTS or OBSCURES anything, '
    + 'it is Minor.\n'
    + 'Fixed when there is an opportunity, once the more serious issues are out of the way.',
}, JSON.parse(process.env.SEVERITY_HELP || '{}'));

function planFormat() {
  const R = [];
  const autofit = [];
  const rng = (r0, r1, c0, c1) => ({ sheetId: GID, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 });
  const fmt = (r0, r1, c0, c1, f) => R.push({ repeatCell: { range: rng(r0, r1, c0, c1), cell: { userEnteredFormat: f }, fields: FIELDS } });
  const border = (r0, r1, c0, c1, b = ALL_BORDERS) => R.push({ updateBorders: Object.assign({ range: rng(r0, r1, c0, c1) }, b) });
  const height = (r0, r1, px) => R.push({ updateDimensionProperties: { range: { sheetId: GID, dimension: 'ROWS', startIndex: r0, endIndex: r1 }, properties: { pixelSize: px }, fields: 'pixelSize' } });

  cols.forEach((c, i) => R.push({ updateDimensionProperties: { range: { sheetId: GID, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: c.width }, fields: 'pixelSize' } }));
  // NO baseline paint. The reference leaves the cells it does not use UNFORMATTED, and painting them
  // white is a visible change to a document we promised to reproduce. The rebuild already wipes formats.

  // header
  fmt(0, 3, 0, C.cnt, F({ bg: HEAD_BG, size: 19, bold: true, fg: HEAD_FG, h: 'CENTER' }));
  fmt(0, 3, C.notes, C.notes + 1, F({ bg: HEAD_BG, size: 19, bold: true, fg: HEAD_FG, h: 'CENTER', wrap: 'WRAP' }));
  border(0, 3, 0, C.cnt);
  fmt(0, 1, C.cnt, C.total, F({ bg: CNTHEAD_BG, size: 12, bold: true, h: 'CENTER' }));
  fmt(1, 2, C.cnt, C.total, F({ bg: SEVLBL_BG, size: 12, bold: true, h: 'CENTER' }));
  border(1, 2, C.cnt, C.total);
  R.push({ setDataValidation: { range: rng(1, 2, C.cnt, C.total), rule: SEV_DV } });    // the label cells carry it too
  SCALE.forEach((sev, i) => {
    const help = SEVERITY_HELP[sev];
    if (help) R.push({ updateCells: { range: rng(1, 2, C.cnt + i, C.cnt + i + 1), rows: [{ values: [{ note: help }] }], fields: 'note' } });
  });
  fmt(2, 3, C.cnt, C.total, F({ bg: COUNT_BG, size: 13, bold: true, h: 'CENTER', v: 'BOTTOM' }));
  border(2, 3, C.cnt, C.total, OPEN_BOTTOM);
  fmt(3, 4, 0, C.cnt, F({ bg: STRIP_BG, size: 14, bold: true, h: 'LEFT' }));
  fmt(3, 4, C.cnt, C.total, F({ bg: STRIP_BG, size: 12, bold: true, h: 'CENTER' }));
  border(3, 4, C.cnt, C.total, OPEN_BOTTOM);
  fmt(0, 2, C.total, C.total + 1, F({ bg: CNTHEAD_BG, size: 10, bold: true, h: 'CENTER', v: 'BOTTOM' }));
  // The owner's rich-text header (hand-tuned on the live tab 15/07/2026, read back as ground
  // truth): "Total count of issues:" at 11pt, "(All modules)" in white — ONE cell, so this is
  // textFormatRuns over the base Arial-10-bold-black, not a repeatCell. Runs die whenever the
  // cell VALUE is rewritten; they live here in planFormat() precisely because it runs after
  // values.update. startIndex 23 = the char after "Total count of issues:\n".
  R.push({ updateCells: { range: rng(0, 1, C.total, C.total + 1), rows: [{ values: [{ textFormatRuns: [
    { format: { fontSize: 11 } },
    { startIndex: 22, format: {} },
    { startIndex: 23, format: { foregroundColor: rgb('#ffffff') } },
  ] }] }], fields: 'textFormatRuns' } });
  fmt(2, 4, C.total, C.total + 1, F({ bg: CNTHEAD_BG, size: 21, bold: true, fg: WHITE, h: 'CENTER' }));   // the headline number
  border(0, 4, C.total, C.total + 1);
  if (WITH_STATUS) {
    fmt(0, 2, C.unresolved, C.unresolved + 1, F({ bg: CNTHEAD_BG, size: 10, bold: true, h: 'CENTER', v: 'BOTTOM' }));
    fmt(2, 4, C.unresolved, C.unresolved + 1, F({ bg: CNTHEAD_BG, size: 21, bold: true, fg: WHITE, h: 'CENTER' }));
    border(0, 4, C.unresolved, C.unresolved + 1);
  }

  // sites — one bar across A:H, exactly as in the original (the Total column stays clear)
  for (const { row, si } of siteRows) {
    fmt(row, row + 1, 0, C.total, F({ bg: SITE_PALETTE[si % SITE_PALETTE.length], size: 18, bold: true, fg: HEAD_FG, h: 'CENTER', wrap: 'WRAP' }));
    border(row, row + 1, 0, C.total, { bottom: BORDER, left: BORDER, right: BORDER });
    height(row, row + 1, 43);
  }
  for (const row of spacerRows) { fmt(row, row + 1, 0, C.total, F({ bg: SPACER_BG })); height(row, row + 1, 22); }

  // modules
  for (const p of pageRows) {
    fmt(p, p + 3, 0, LASTLEFT + 1, F({ bg: PAGE_BG, size: 14, bold: true, h: 'LEFT' }));
    border(p, p + 3, 0, LASTLEFT + 1);
    fmt(p, p + 1, C.cnt, C.total, F({ bg: PAGE_MIRROR, size: 13, bold: true, h: 'CENTER', v: 'BOTTOM', wrap: 'WRAP' }));
    fmt(p + 1, p + 2, C.cnt, C.total, F({ bg: SEVLBL_BG, size: 12, bold: true, h: 'CENTER' }));
    border(p + 1, p + 2, C.cnt, C.total);
    R.push({ setDataValidation: { range: rng(p + 1, p + 2, C.cnt, C.total), rule: SEV_DV } });
    fmt(p + 2, p + 3, C.cnt, C.total, F({ bg: COUNT_BG, size: 13, bold: true, h: 'CENTER', v: 'BOTTOM' }));
    border(p + 2, p + 3, C.cnt, C.total);
    height(p, p + 1, 29); height(p + 1, p + 2, 27); height(p + 2, p + 3, 28);
    if (WITH_PAGE_TOTALS) { fmt(p + 2, p + 3, C.total, C.total + 1, F({ bg: PAGE_MIRROR, size: 13, bold: true, fg: WHITE, h: 'CENTER' })); border(p + 2, p + 3, C.total, C.total + 1); }
  }

  // issue rows — only the columns the original uses; the counter columns stay untouched
  for (const { r0, r1 } of issueRanges) {
    fmt(r0, r1, C.n, C.n + 1, F({ bg: ROW_BG, size: 14, bold: true, h: 'CENTER' }));
    fmt(r0, r1, C.summary, C.summary + 1, F({ bg: ROW_BG, size: 10, h: 'LEFT', v: 'BOTTOM', wrap: 'WRAP' }));
    fmt(r0, r1, C.severity, C.severity + 1, F({ bg: SEV_BG, size: 12, bold: true, h: 'CENTER' }));
    fmt(r0, r1, C.notes, C.notes + 1, F({ bg: ROW_BG, size: 10, v: 'BOTTOM', wrap: 'WRAP' }));
    border(r0, r1, 0, LASTLEFT + 1);
    // NO fixed height. A bug summary is a sentence, not a number: pinned at 21px the text is clipped and the
    // row lies about what it says. The rows are auto-fitted below so every summary is readable in full.
    autofit.push({ r0, r1 });
    // The dropdown the owner's own sheet carries. NOT strict: the reference flags an out-of-scale value
    // with a red corner rather than rejecting the keystroke — and a rejected keystroke is a fight with the
    // person filling the sheet, while the builder already refuses to publish such a row anyway.
    R.push({ setDataValidation: { range: rng(r0, r1, C.severity, C.severity + 1), rule: SEV_DV } });
    if (WITH_ID) R.push({ repeatCell: { range: rng(r0, r1, C.id, C.id + 1), cell: { userEnteredFormat: { backgroundColor: ROW_BG, horizontalAlignment: 'LEFT', verticalAlignment: 'MIDDLE', textFormat: { fontFamily: 'Roboto Mono', fontSize: 9, foregroundColor: rgb('#666666') } } }, fields: FIELDS } });
    if (WITH_STATUS) {
      fmt(r0, r1, C.status, C.status + 1, F({ bg: WHITE, size: 10, bold: true, h: 'CENTER' }));
      R.push({ setDataValidation: { range: rng(r0, r1, C.status, C.status + 1), rule: { condition: { type: 'ONE_OF_LIST', values: STATUSES.map((v) => ({ userEnteredValue: v })) }, strict: true, showCustomUi: true } } });
    }
  }
  if (WITH_STATUS) {
    const stRanges = issueRanges.map(({ r0, r1 }) => rng(r0, r1, C.status, C.status + 1));
    for (const [st, color] of Object.entries(STATUS_COLOR)) {
      R.push({ addConditionalFormatRule: { index: 0, rule: { ranges: stRanges, booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: st }] }, format: { backgroundColor: color } } } } });
    }
  }

  if (WITH_SEV_COLORS) {
    // Paint the label cells with the palette as their STORED background too — not only through the rule.
    // That is what makes an owner-painted colour survive: the next run reads it back off the tab.
    SCALE.forEach((sev, i) => {
      const c = sevColor(sev, i);
      const fg = rgb(c.fg || readableFg(c.bg));
      fmt(1, 2, C.cnt + i, C.cnt + i + 1, F({ bg: rgb(c.bg), size: 12, bold: true, h: 'CENTER', fg }));
      for (const p of pageRows) fmt(p + 1, p + 2, C.cnt + i, C.cnt + i + 1, F({ bg: rgb(c.bg), size: 12, bold: true, h: 'CENTER', fg }));
    });
    // One rule per severity, over every cell that NAMES a severity: the Severity column, the header labels,
    // and each module's label row. Keyed on the value, so the colour follows the data — not the cell.
    // ONLY the Severity column. The label cells are deliberately left OUT: a conditional format OVERRIDES
    // a manual fill in Sheets, so a rule on the labels makes them impossible to repaint — the owner picks a
    // colour, sees no change (the rule is drawing over it), and gives up. Cost us a round trip to find.
    // So the labels are a plain, hand-paintable PALETTE SWATCH, and the rules on the data column follow it:
    // paint a label, re-run, and the colour is adopted and carried down all 309 rows.
    // Reproduces what the owner gets from a coloured dropdown: the cell takes its colour FROM ITS VALUE.
    // It has to be conditional formatting, because Sheets' dropdown-chip colours are not exposed by the
    // API at all — they cannot be written and cannot even be read back. This looks identical, behaves
    // identically, AND survives a rebuild, which the chips do not.
    const dataCells = issueRanges.map(({ r0, r1 }) => rng(r0, r1, C.severity, C.severity + 1));
    const labelCells = [rng(1, 2, C.cnt, C.total), ...pageRows.map((p) => rng(p + 1, p + 2, C.cnt, C.total))];
    const targets = [...dataCells, ...labelCells];
    SCALE.forEach((sev, i) => {
      const c = sevColor(sev, i);
      const fg = c.fg || readableFg(c.bg);
      R.push({ addConditionalFormatRule: { index: 0, rule: { ranges: targets, booleanRule: {
        condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: sev }] },
        format: { backgroundColor: rgb(c.bg), textFormat: { foregroundColor: rgb(fg), bold: true } } } } } });
    });
    // An EMPTY severity cell goes grey — and that is not decoration. A row with no severity is counted by
    // no column: it is in the document, it is invisible to every total, and grey is the only thing standing
    // between it and a silent under-report. (The builder also refuses to publish one; this catches the ones
    // a human types in afterwards.)
    R.push({ addConditionalFormatRule: { index: 0, rule: { ranges: dataCells, booleanRule: {
      condition: { type: 'BLANK' }, format: { backgroundColor: rgb(EMPTY_SEV_BG) } } } } });
  } else {
    // The owner's own conditional format, reproduced: the first severity-label cell of every module band
    // lifts to a lighter shade when it is filled. A rule, not a painted cell.
    const lblFirst = pageRows.map((p) => rng(p + 1, p + 2, C.cnt, C.cnt + 1));
    if (lblFirst.length) {
      R.push({ addConditionalFormatRule: { index: 0, rule: { ranges: lblFirst, booleanRule: { condition: { type: 'NOT_BLANK' }, format: { backgroundColor: SEVLBL_E } } } } });
    }
  }
  for (const m of merges) R.push({ mergeCells: { range: rng(m.r0, m.r1, m.c0, m.c1), mergeType: 'MERGE_ALL' } });
  // Every issue row gets the height its own text needs — computed, because Sheets will not do it (see
  // rowHeight above). Consecutive rows of equal height are coalesced into one request.
  // A deliberate DEPARTURE from the reference, at the owner's request: there every issue row is pinned to
  // 21px, which is exactly why the summaries are clipped in it.
  for (const a of autofit) {
    let runStart = a.r0, runH = rowHeight(grid[a.r0]);
    for (let r = a.r0 + 1; r <= a.r1; r++) {
      const h = r < a.r1 ? rowHeight(grid[r]) : -1;
      if (h !== runH) { height(runStart, r, runH); runStart = r; runH = h; }
    }
  }

  const groups = [...rowGroups].sort((a, b) => a.depth - b.depth);
  for (const g of groups) R.push({ addDimensionGroup: { range: { sheetId: GID, dimension: 'ROWS', startIndex: g.r0, endIndex: g.r1 } } });
  // …and collapsed, as the reference is: you open it and see the modules, not 309 rows.
  for (const g of groups) R.push({ updateDimensionGroup: { dimensionGroup: { range: { sheetId: GID, dimension: 'ROWS', startIndex: g.r0, endIndex: g.r1 }, depth: g.depth, collapsed: true }, fields: 'collapsed' } });
  for (const n of notes) R.push({ updateCells: { range: rng(n.row, n.row + 1, n.col, n.col + 1), rows: [{ values: [{ note: n.note }] }], fields: 'note' } });
  height(0, 1, 30); height(1, 2, 21); height(2, 3, 29); height(3, 4, 23);
  if (footerRow >= 0) height(footerRow, footerRow + 1, 1);        // 1px: present for the tool, invisible to a reader
  R.push({ updateSheetProperties: { properties: { sheetId: GID, gridProperties: { frozenRowCount: HEADER_ROWS } }, fields: 'gridProperties.frozenRowCount' } });
  return R;
}
function planSetup(old, gid, title, rows, ncols, frozen, createdByUs, placeholderSheetId, sheetCount) {
  const R = [];
  if (old && old.properties.sheetId === gid) {
    const gp = old.properties.gridProperties;
    const whole = { sheetId: gid, startRowIndex: 0, endRowIndex: gp.rowCount || 1000, startColumnIndex: 0, endColumnIndex: gp.columnCount || 26 };
    R.push({ unmergeCells: { range: whole } });
    R.push({ updateCells: { range: whole, fields: 'userEnteredValue,userEnteredFormat,note,dataValidation' } });
    R.push({ updateBorders: { range: whole, top: { style: 'NONE' }, bottom: { style: 'NONE' }, left: { style: 'NONE' }, right: { style: 'NONE' }, innerHorizontal: { style: 'NONE' }, innerVertical: { style: 'NONE' } } });
    for (let i = (old.conditionalFormats || []).length - 1; i >= 0; i--) R.push({ deleteConditionalFormatRule: { sheetId: gid, index: i } });
    for (const g of old.rowGroups || []) R.push({ deleteDimensionGroup: { range: { sheetId: gid, dimension: 'ROWS', startIndex: g.range.startIndex, endIndex: g.range.endIndex } } });
    R.push({ updateSheetProperties: { properties: { sheetId: gid, title, gridProperties: { frozenRowCount: frozen, columnCount: ncols, rowCount: rows } }, fields: 'title,gridProperties(frozenRowCount,columnCount,rowCount)' } });
  } else {
    if (old) R.push({ deleteSheet: { sheetId: old.properties.sheetId } });
    R.push({ addSheet: { properties: { sheetId: gid, title, gridProperties: { frozenRowCount: frozen, columnCount: ncols, rowCount: rows } } } });
    if (createdByUs && sheetCount === 1) R.push({ deleteSheet: { sheetId: placeholderSheetId } });
  }
  return R;
}

// ── the derived "Left issues" tab — only when a Status column exists to derive it from ────
const LEFT_COLS = ['ID', 'Site', 'Module', 'Summary', 'Severity', 'Status', 'Notes'];
const MAP_COL = 8;
function buildLeft() {
  const w = () => Array.from({ length: MAP_COL + 3 }, () => '');
  const src = (col) => `'${qt(TAB)}'!${A1C(col)}${HEADER_ROWS + 1}:${A1C(col)}`;
  const isIssue = `ISNUMBER(${src(C.n)})`;
  const notRes = `${src(C.status)}<>"${RESOLVED}"`;
  const has = `${src(C.id)}<>""`;
  const flt = (col) => `=IFERROR(FILTER(${src(col)}${SEP}${isIssue}${SEP}${has}${SEP}${notRes})${SEP}"")`;
  const look = (n) => `=ARRAYFORMULA(IF(A4:A=""${SEP}""${SEP}IFERROR(VLOOKUP(A4:A${SEP}$${A1C(MAP_COL)}$4:$${A1C(MAP_COL + 2)}${SEP}${n}${SEP}FALSE)${SEP}"?")))`;
  const rows = [];
  const r1 = w(); r1[0] = 'Left issues — everything this document cannot prove fixed'; r1[MAP_COL] = 'id → site / module (generated)';
  const r2 = w(); r2[0] = `=IF(COUNTA(A4:A)=0${SEP}"Nothing outstanding."${SEP}COUNTA(A4:A)&" row(s) are NOT verified fixed")`; r2[MAP_COL] = 'Rebuilt by bs-sheet.mjs. Do not edit.';
  const r3 = w(); LEFT_COLS.forEach((h, i) => { r3[i] = h; }); r3[MAP_COL] = 'ID'; r3[MAP_COL + 1] = 'Site'; r3[MAP_COL + 2] = 'Module';
  const r4 = w();
  r4[0] = flt(C.id); r4[1] = look(2); r4[2] = look(3);
  r4[3] = flt(C.summary); r4[4] = flt(C.severity); r4[5] = flt(C.status); r4[6] = flt(C.notes);
  rows.push(r1, r2, r3, r4);
  issues.forEach((it, i) => {
    const r = rows[3 + i] || w();
    r[MAP_COL] = it.id; r[MAP_COL + 1] = it.site.name; r[MAP_COL + 2] = it.page.name;
    rows[3 + i] = r;
  });
  return rows;
}
function planLeftFormat(rows) {
  const R = [];
  const rng = (r0, r1, c0, c1) => ({ sheetId: LEFT_GID, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 });
  const fmt = (r0, r1, c0, c1, f) => R.push({ repeatCell: { range: rng(r0, r1, c0, c1), cell: { userEnteredFormat: f }, fields: FIELDS } });
  [150, 130, 200, 520, 100, 112, 240, 20, 150, 130, 200].forEach((px, i) => R.push({ updateDimensionProperties: { range: { sheetId: LEFT_GID, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } }));
  fmt(0, rows, 0, MAP_COL + 3, F({ bg: WHITE, h: 'LEFT', wrap: 'WRAP' }));
  fmt(0, 1, 0, 7, F({ bg: HEAD_BG, size: 14, bold: true, fg: HEAD_FG, h: 'LEFT' }));
  fmt(1, 2, 0, 7, F({ bg: rgb('#fce8b2'), size: 11, bold: true, h: 'LEFT' }));
  fmt(2, 3, 0, 7, F({ bg: rgb('#1e4f5b'), size: 11, bold: true, fg: WHITE, h: 'CENTER' }));
  fmt(0, rows, MAP_COL, MAP_COL + 3, F({ bg: ROW_BG, size: 8, fg: rgb('#888888'), h: 'LEFT' }));
  R.push({ mergeCells: { range: rng(0, 1, 0, 7), mergeType: 'MERGE_ALL' } }, { mergeCells: { range: rng(1, 2, 0, 7), mergeType: 'MERGE_ALL' } });
  R.push({ updateCells: { range: rng(0, 1, 0, 1), rows: [{ values: [{ note:
    `bs: ${S.summaryId} (derived)\nDERIVED TAB — every row is a FILTER over "${TAB}". Do not type into columns A–G.\n`
    + 'Change a Status there and this list changes itself. A hand-kept list of open issues drifts from its\n'
    + 'source — silently, and always in the flattering direction.' }] }], fields: 'note' } });
  R.push({ updateSheetProperties: { properties: { sheetId: LEFT_GID, gridProperties: { frozenRowCount: 3 } }, fields: 'gridProperties.frozenRowCount' } });
  return R;
}

// ── dry run ───────────────────────────────────────────────────────────────────────────────
if (DRY) {
  build(new Map());
  const plan = { tab: TAB, rows: grid.length, cols: NCOLS, scale: SCALE, sites: S.sites.length,
    modules: S.sites.reduce((a, s) => a + s.pages.length, 0), issues: issues.length,
    merges: merges.length, rowGroups: rowGroups.length, notes: notes.length, format: planFormat().length,
    options: { WITH_ID, WITH_STATUS, WITH_PAGE_TOTALS, WITH_RECONCILE } };
  if (PLAN_JSON) { console.log(JSON.stringify({ plan, grid }, null, 1)); process.exit(0); }
  console.log(`bs-sheet --dry-run: ${plan.sites} site(s) · ${plan.modules} module(s) · ${plan.issues} issue(s) found · scale [${SCALE.join(' > ')}]`);
  console.log(`  "${TAB}"  ${plan.rows} rows × ${plan.cols} cols · ${plan.merges} merges · ${plan.rowGroups} row groups · ${plan.notes} notes · ${plan.format} format requests`);
  console.log(`  options: ${Object.entries(plan.options).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none (pure owner format)'}`);
  if (warnings.length) { console.log(`\n${warnings.length} warning(s):`); warnings.forEach((w) => console.log(`  ⚠ ${w}`)); }
  process.exit(0);
}

// ── publish ───────────────────────────────────────────────────────────────────────────────
const PROJECT = process.env.PROJECT_NAME;
if (!PROJECT) die('PROJECT_NAME is required (it names the doc and its Drive folder).\n'
  + '  To validate and inspect without writing anything:  node tools/bs-sheet.mjs --dry-run', 2);
const DOC_NAME = process.env.SHEET_NAME || `Issues on ${PROJECT}`;
const ROOT_FOLDER = process.env.DRIVE_ROOT_FOLDER || 'ClaudeProjects';
const CATEGORY = process.env.DRIVE_CATEGORY || 'QA Documentation';
const TARGET = process.env.TARGET_SSID;

const { createRequire } = await import('node:module');
const mcpDir = process.env.MCP_SHEETS_DIR
  || (findUp(['QA-SetupKit/MCP-configurations/mcp-sheets/package.json', 'MCP-configurations/mcp-sheets/package.json']) || '').replace(/\/package\.json$/, '');
if (!mcpDir) die('mcp-sheets not found — set MCP_SHEETS_DIR (see MCP-configurations/README.md).', 2);
const req = createRequire(path.join(mcpDir, 'package.json'));
const { google } = req('googleapis');
const c0 = readJson(path.join(mcpDir, 'credentials.json'), 'cannot read mcp-sheets credentials.json');
const cred = c0.installed || c0.web;
const token = readJson(path.join(mcpDir, 'token.json'), 'cannot read mcp-sheets token.json — authorize once: node server.mjs --auth');
const auth = new google.auth.OAuth2(cred.client_id, cred.client_secret, (cred.redirect_uris && cred.redirect_uris[0]) || 'http://localhost:3456/oauth2callback');
auth.setCredentials(token);
if (token.expiry_date && Date.now() > token.expiry_date - 60000) {
  const { credentials } = await auth.refreshAccessToken();
  fs.writeFileSync(path.join(mcpDir, 'token.json'), JSON.stringify(credentials));
  auth.setCredentials(credentials);
}
const drive = google.drive({ version: 'v3', auth });
const sheets = google.sheets({ version: 'v4', auth });

const findFolder = async (name, parentId) => {
  const q = [`name = '${name.replace(/'/g, "\\'")}'`, "mimeType = 'application/vnd.google-apps.folder'", 'trashed = false',
    parentId ? `'${parentId}' in parents` : "'root' in parents"].join(' and ');
  const r = await drive.files.list({ q, fields: 'files(id)', spaces: 'drive' });
  return r.data.files[0]?.id || null;
};
const ensureFolder = async (name, parentId) => (await findFolder(name, parentId))
  || (await drive.files.create({ requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : undefined }, fields: 'id' })).data.id;

let ssId, createdByUs = false;
if (TARGET) ssId = TARGET;
else {
  const rootId = await findFolder(ROOT_FOLDER, null);
  if (!rootId) die(`Drive folder "${ROOT_FOLDER}" not found at the top level of the account.`, 2);
  const catId = await ensureFolder(CATEGORY, await ensureFolder(PROJECT, rootId));
  const prior = await drive.files.list({ q: `name = '${DOC_NAME.replace(/'/g, "\\'")}' and '${catId}' in parents and trashed = false`, fields: 'files(id)', spaces: 'drive' });
  if (prior.data.files[0]?.id) ssId = prior.data.files[0].id;
  else {
    ssId = (await drive.files.create({ requestBody: { name: DOC_NAME, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [catId] }, fields: 'id' })).data.id;
    createdByUs = true;
  }
}

const meta = await sheets.spreadsheets.get({ spreadsheetId: ssId });
const url = `https://docs.google.com/spreadsheets/d/${ssId}/edit`;
const old = meta.data.sheets.find((s) => s.properties.title === TAB || s.properties.sheetId === GID);
const oldLeft = meta.data.sheets.find((s) => s.properties.title === LEFT_TAB || s.properties.sheetId === LEFT_GID);
if (!process.env.BS_FORMULA_SEP) SEP = sepForLocale(meta.data.properties?.locale);

// Read the previous tab back: a Severity the owner triaged, a Status, a Notes line typed on the tab
// exist NOWHERE ELSE, and a rebuild that forgets them destroys the only record of what the team decided.
//
// This used to be a lie. `carried` was allocated, handed to build(), and never filled — so every
// rebuild silently wiped whatever a human had typed, and `drifted` never reported a thing. The comment
// promised the behaviour; the code did not have it.
//
// Rows are matched BY POSITION and verified BY TEXT. The owner's format has no id column (its № restarts
// at 1 in every module, so it cannot address a row), and the summary alone is not unique — on the
// reference board two pairs of bugs share a summary word for word. So: the Nth issue row on the tab is
// the Nth issue in the JSON as long as its summary still agrees; when the layout has shifted, fall back
// to matching on summaries that are unique, and report whatever is left over rather than guessing.
let wroteThis = false;
if (old) {
  try {
    const g = await sheets.spreadsheets.get({ spreadsheetId: ssId, ranges: [`'${qt(old.properties.title)}'`], includeGridData: true,
      fields: 'sheets(data(rowData(values(formattedValue,note))))' });
    const rowData = g.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
    // The `bs:` marker used to live on A1; it now lives in the 1px footer row. Look for it ANYWHERE in
    // column A, so a tab written by an older version of this tool is still recognised as ours.
    wroteThis = rowData.some((r) => /^bs:/m.test(String(r?.values?.[0]?.note || '')));

    // Locate the OLD tab's columns from its own header row. The option flags (BS_ID_COLUMN,
    // BS_STATUS_COLUMN) may differ from the previous build, and a fixed index would then read a
    // neighbouring column and "carry" the wrong value — worse than carrying nothing.
    let O = null;
    for (const r of rowData) {
      const hv = (r?.values ?? []).map((v) => normTxt(v?.formattedValue));
      const iSum = hv.indexOf('summary'), iSev = hv.indexOf('severity');
      if (iSum >= 0 && iSev >= 0) {
        O = { n: hv.indexOf('№'), summary: iSum, severity: iSev, status: hv.indexOf('status'), notes: hv.indexOf('notes') };
        break;
      }
    }
    if (wroteThis && O && O.n >= 0) {
      const dupText = new Set();
      let gi = 0;
      for (const r of rowData) {
        const vals = r?.values ?? [];
        const at = (i) => (i >= 0 ? String(vals[i]?.formattedValue ?? '') : '');
        // An issue row is the one with an ORDINAL in № — the band rows carry a name there, not a number.
        if (!/^\d+$/.test(at(O.n).trim()) || !at(O.summary).trim()) continue;
        const rec = { summary: at(O.summary), severity: at(O.severity).trim(), status: at(O.status).trim(), notes: at(O.notes) };
        carried.set(gi++, rec);
        const k = normTxt(rec.summary);
        if (carriedByText.has(k)) dupText.add(k); else carriedByText.set(k, rec);
      }
      dupText.forEach((k) => carriedByText.delete(k));   // ambiguous by text → position must settle it, or nothing does
    }
  } catch (e) {
    die(`could not read the existing tab (${e.message}). Refusing to rebuild: it would silently overwrite it.`, 1);
  }
}
if (old && !wroteThis && !process.env.BS_ALLOW_ADOPT) {
  die(`the tab "${old.properties.title}" already exists here and carries NO "bs:" note — nothing on it was written by this tool.\n`
    + '  Refusing to rebuild it. A hand-maintained tab is a document, not a cache.\n'
    + '  → point BS_TAB / BS_GID at a NEW tab, or set BS_ALLOW_ADOPT=1 to replace this one deliberately.', 1);
}

// The tab is a SHARED LINK. Whoever was handed `…/edit#gid=<GID>` keeps opening that exact
// carrier, so a rebuild that lands on a different spreadsheet — or on a new gid — kills their
// link while looking, in the UI, exactly like an update. The ledger remembers what a human eye
// cannot see. It refuses BEFORE the first mutating request: a half-written tab under a dead
// link is worse than no rebuild at all.
const ledgerMod = process.env.QA_LINK_LEDGER
  || findUp(['QA-SetupKit/Rules-Guide/link-ledger/link-ledger.mjs', 'Rules-Guide/link-ledger/link-ledger.mjs']);
if (ledgerMod) {
  const { assertStableLink, LinkLedgerError } = await import(`file://${ledgerMod}`);
  try {
    assertStableLink({ kind: 'sheet-tab', key: 'bug-summary/tab', id: ssId, gid: GID, title: TAB });
    if (WITH_STATUS) assertStableLink({ kind: 'sheet-tab', key: 'bug-summary/left-tab', id: ssId, gid: LEFT_GID, title: LEFT_TAB });
  } catch (e) {
    if (e instanceof LinkLedgerError) die(`${e.message}\n  Nothing was written.`, 1);
    throw e;
  }
} else {
  warn('link-ledger not found — the tab\'s link stability was NOT checked (set QA_LINK_LEDGER).');
}

build(carried);
const setup = planSetup(old, GID, TAB, grid.length, NCOLS, HEADER_ROWS, createdByUs, meta.data.sheets[0]?.properties.sheetId, meta.data.sheets.length);
if (WITH_STATUS) setup.push(...planSetup(oldLeft, LEFT_GID, LEFT_TAB, issues.length + 4, MAP_COL + 3, 3, false, null, meta.data.sheets.length));
await sheets.spreadsheets.batchUpdate({ spreadsheetId: ssId, requestBody: { requests: setup } });

await sheets.spreadsheets.values.update({ spreadsheetId: ssId, range: `'${qt(TAB)}'!A1`, valueInputOption: 'USER_ENTERED', requestBody: { values: grid } });
await sheets.spreadsheets.batchUpdate({ spreadsheetId: ssId, requestBody: { requests: planFormat() } });
if (WITH_STATUS) {
  const leftRows = buildLeft();
  await sheets.spreadsheets.values.update({ spreadsheetId: ssId, range: `'${qt(LEFT_TAB)}'!A1`, valueInputOption: 'USER_ENTERED', requestBody: { values: leftRows } });
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: ssId, requestBody: { requests: planLeftFormat(leftRows.length) } });
}

console.log(`bs-sheet: ${S.sites.length} site(s) · ${S.sites.reduce((a, s) => a + s.pages.length, 0)} module(s) · ${issues.length} issue(s) found · scale [${SCALE.join(' > ')}]`);
console.log(`  → "${TAB}"  ${url}#gid=${GID}`);
if (WITH_STATUS) console.log(`  → "${LEFT_TAB}" (derived)  ${url}#gid=${LEFT_GID}`);
const opts = Object.entries({ WITH_ID, WITH_STATUS, WITH_PAGE_TOTALS, WITH_RECONCILE }).filter(([, v]) => v).map(([k]) => k);
console.log(`  options: ${opts.join(', ') || 'none — the owner\'s format, unmodified'}`);
if (drifted.length) {
  console.log(`\n${drifted.length} row(s) where the TAB and the JSON disagree — the TAB won, and the JSON is now stale:`);
  drifted.slice(0, 15).forEach((d) => console.log(`  • ${d}`));
  if (drifted.length > 15) console.log(`  … and ${drifted.length - 15} more`);
  console.log('  The JSON is the RECORD; the tab is a view of it. Write these back:');
  console.log('    node tools/bs-severities-from-sheet.mjs      (severities → severities.json, severitySource "owner")');
  console.log('  Leave them only on the tab and the next rebuild from an unchanged JSON will look like a regression.');
}
if (unmatched.length) {
  console.log(`\n⚠ ${unmatched.length} row(s) on the previous tab could not be tied to a row in the JSON.`);
  unmatched.slice(0, 10).forEach((d) => console.log(`  • ${d}`));
  console.log('  Anything typed on those rows was NOT carried over. Check them before you trust this rebuild.');
}
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
}
