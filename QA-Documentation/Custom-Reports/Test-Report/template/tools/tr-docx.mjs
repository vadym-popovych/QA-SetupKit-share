// Build the end-of-engagement Test report as a .docx and import it to Drive WITH CONVERSION,
// so the document carries a REAL Table of Contents and REAL footer page numbers — the two
// things the Docs API cannot insert (there is no insertTableOfContents / page-number-field
// request; checked against the batchUpdate request list). Conversion preserves both: proven
// by rendering the owner's reference through a convert-copy, and by the 17/07 spike showing
// `drive.files.update` with .docx media keeps the SAME fileId (the stable-link invariant).
//
// Inputs are UNCHANGED from tr-doc.mjs — this is a RENDER-layer replacement only:
//   - the NARRATIVE config (test-report.schema.json), and
//   - the NUMBERS record (bug-summary.schema.json) — every count in "Test results" is COMPUTED
//     here, never typed in.
//
//   PROJECT_NAME=<Project> TR_CONFIG=./report-config.json TR_SUMMARY=./bug-summary.json \
//     node tools/tr-docx.mjs
//
// Optional: TR_TITLE · TR_RESULTS_NOTE=1 · DRIVE_ROOT_FOLDER (default ClaudeProjects) ·
//           MCP_SHEETS_DIR · TR_TARGET_ID (upload onto an existing doc id — used to verify
//           against a throwaway without touching the owner's stable sandbox link).
//
// ⚠️ NOT YET THE ENTRY POINT (17/07): `tr-doc.mjs` still is. This engine renders clean — TOC and
// footer numbers baked and render-verified, no orphaned headings, no split tables — but the owner
// has not finished validating pages 6–12. Swap only on his word.
//
// THE LAYOUT LOOP is the heart of this file: page numbers and page breaks move each other, so the
// engine builds, RENDERS, measures the render, adjusts, and rebuilds until the render agrees with
// the document on both. Two owner rules are enforced that way (17/07):
//   · a section heading is never left alone at the foot of a page  → keepNext (Docs honours this
//     between paragraphs, and between a paragraph and a table);
//   · a table is never broken across a page — it is carried over whole → an explicit page break
//     before it, because Docs IGNORES keep-with-next across table rows (measured: the property is
//     imported onto the cells and does nothing).
// Nothing is ever adjusted to make a check pass: the render is the oracle, and a number that
// cannot be located in it is refused, not invented.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

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
const {
  Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber, TableOfContents,
  AlignmentType, ImageRun, BorderStyle, LevelFormat, HeadingLevel,
  Table, TableRow, TableCell, WidthType, VerticalAlign, HeightRule,
} = require('docx');
const JSZip = require('jszip');   // explicit dependency: the TOC cached result is injected into
                                  // the packaged .docx XML (the library cannot express it)

const die = (msg) => { console.error(`tr-docx: ${msg}`); process.exit(2); };
const refuse = (msg) => { console.error(`tr-docx REFUSES: ${msg}`); process.exit(1); };

// ---- Inputs -------------------------------------------------------------------------------
const PROJECT = process.env.PROJECT_NAME;
if (!PROJECT) die('PROJECT_NAME is not set — it names the Drive folder the report lands in.');
const readJson = (envName) => {
  const p = process.env[envName];
  if (!p) die(`${envName} is not set — this renderer carries no engagement data of its own.`);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { die(`cannot read ${envName} (${p}): ${e.message}`); }
};
const cfg = readJson('TR_CONFIG');
const sum = readJson('TR_SUMMARY');

// ---- Marry the two inputs, refuse what would misreport (ported verbatim from tr-doc.mjs) ---
if (!cfg.project || !sum.project || cfg.project !== sum.project)
  refuse(`config is for "${cfg.project}" but the summary record is for "${sum.project}" — a report must not marry a narrative to another engagement's numbers.`);
const SCALE = sum.severityScale;
if (!Array.isArray(SCALE) || !SCALE.length) refuse('the summary record has no severityScale — no columns to count into.');
const sites = sum.sites || [];
if (!sites.length) refuse('the summary record has no sites — nothing to report.');

const warnings = [];
let totalIssues = 0, proposed = 0, notClosed = 0;
const CLOSED = new Set(['verified', 'fixed', 'reassigned']);
for (const site of sites) for (const page of site.pages || []) for (const it of page.issues || []) {
  if (!SCALE.includes(it.severity))
    refuse(`issue ${it.id || '(no id)'} on "${page.name}" has severity "${it.severity}" outside the scale [${SCALE.join(', ')}] — no column would count it, so it would vanish from every total.`);
  totalIssues++;
  if (it.severitySource && it.severitySource !== 'owner') proposed++;
  if (!CLOSED.has(it.status)) notClosed++;
}
if (proposed)
  warnings.push(`${proposed} of ${totalIssues} severities are not owner-validated (severitySource != owner) — every statistic in this report is built out of them. Get the owner's validation before this document leaves the team.`);

// General is the placement debt band — rendered LAST within its site (Bug-Summary rule).
const orderedPages = (site) => {
  const pages = (site.pages || []).slice();
  const gi = pages.findIndex((p) => p.name === 'General');
  if (gi >= 0) pages.push(pages.splice(gi, 1)[0]);
  return pages;
};

// ---- Test Design library (genericised from the owner's reference document) -----------------
const LIB = {
  smoke: { name: 'Smoke Testing',
    goal: 'to validate the release, find all Blocker and Critical severity defects and prevent extra effort and time loss.',
    process: ['High-priority functionality checks are defined and executed;',
      'All functions that occur on a periodic schedule will be executed or launched at the appropriate time;',
      'Testing will include using only valid data.'],
    completion: ['All planned tests have been executed;', 'All identified defects have been addressed.'] },
  functional: { name: 'Functional Testing',
    goal: 'Ensure proper target-of-test functionality, including navigation, data entry, processing, and retrieval.',
    process: ['Execute each use case, use-case flow, or function, using valid and invalid data, to verify the following:',
      'The expected results occur when valid data is used;',
      'The appropriate error or warning messages are displayed when invalid data is used;',
      'Each business rule is properly applied.'],
    completion: ['All planned tests have been executed successfully;', 'All identified defects have been addressed.'] },
  ui: { name: 'User Interface Testing',
    goal: 'prevent visual defects from appearing on the production.',
    process: ['Checking UI elements on desktop, tablet and mobile resolutions,',
      'with checking the proper work of animations, graphs etc.'],
    completion: ['All planned tests have been executed successfully;', 'All identified defects have been addressed.'] },
  acceptance: { name: 'Acceptance Testing',
    goal: 'to validate components, find all Blocker and Critical severity defects and prevent extra effort and time loss during regression testing.',
    process: ['Execute each use case, use-case flow, or function, using valid and invalid data, to verify the following:',
      'The expected results occur when valid or invalid data is used;',
      'The appropriate error or warning messages are displayed when invalid data is used.'],
    completion: ['All planned tests have been executed;', 'All identified defects have been addressed.'] },
  regression: { name: 'Regression Testing',
    goal: 'validate the release build, execute all test cases and prevent appearing issues on the production.',
    process: ['All test cases are defined and executed;', 'Testing will include using valid and invalid data.'],
    completion: ['All planned tests have been executed;', 'All identified defects have been addressed.'] },
};
const designSections = (cfg.testDesign || []).map((t) => {
  if (t.type === 'custom') {
    if (!t.name || !t.goal || !t.process?.length || !t.completion?.length)
      refuse(`custom test type needs name, goal, process[] and completion[] — got "${t.name || '(unnamed)'}".`);
    return t;
  }
  const lib = LIB[t.type];
  if (!lib) refuse(`unknown test type "${t.type}".`);
  return { name: t.name || lib.name, goal: t.goal || lib.goal,
    process: t.process || lib.process, completion: t.completion || lib.completion };
});
if (!designSections.length) refuse('testDesign is empty — a report must say which testing was actually performed.');
if (notClosed > 0 && designSections.some((s) => s.completion.some((l) => /all identified defects have been addressed/i.test(l))))
  warnings.push(`the Completion Criteria claim "All identified defects have been addressed", but ${notClosed} of ${totalIssues} issues in the record are not verified/fixed/reassigned. Reword the criteria in the config, or reconcile the record — the tables will contradict the claim.`);
if (!cfg.environment?.groups?.length)
  refuse('environment.groups is missing/empty — the environment is a fact about what was actually used; there is no default device list.');

// Objective scope: config override, else derived from the record's pages (General excluded).
// ⚠️ Deriving the scope from the RECORD describes where bugs were FOUND, not what was TESTED —
// the owner flagged this 17/07 and PARKED the fix (screens-not-bug-titles taxonomy). See the
// handoff: do not change the taxonomy here without his decision.
const scope = cfg.objective?.scope
  || Object.fromEntries(sites.map((s) => [s.name, orderedPages(s).filter((p) => p.name !== 'General').map((p) => `${p.name};`)]));
if (cfg.objective?.scope) {
  for (const site of sites) {
    const listed = new Set(Object.values(cfg.objective.scope).flat().map((l) => l.replace(/[;.]\s*$/, '').toLowerCase()));
    for (const p of site.pages || [])
      if (p.name !== 'General' && (p.issues || []).length && !listed.has(p.name.toLowerCase()))
        warnings.push(`objective.scope override drops "${p.name}" (${site.name}) which has counted bugs — the scope claims less than the results show.`);
  }
}

// ---- Typography, measured off the reference render (17/07) ---------------------------------
// docx units: twips (1/20 pt). Line spacing: 240 = single, 276 ≈ 1.15, 360 = 1.5.
const PT = (pt) => pt * 20;
const GRAY = '666666';
const FONT = 'Arial';
const LINE_15 = 360, LINE_115 = 276, LINE_1 = 240;

const P = (opts) => new Paragraph({ ...opts });
const run = (text, o = {}) => new TextRun({ text, font: FONT, ...o });

// Every heading that the TOC covers, in document order — the bake loop resolves each one's real
// page from a render and writes them into the TOC field's cached result.
const tocEntries = [];
const track = (text, level) => { tocEntries.push({ text, level, page: null }); };

// Section heading: black, 16pt, first line indented 36pt (matches the reference).
// keepNext on a HEADING is the owner's rule (17/07): when only the heading itself fits at the
// foot of a page, carry it to the next one — a section title stranded away from its first line
// reads as a mistake. This is a PARAGRAPH-level keep, which Google Docs does honour; the same
// property on a table CELL does not affect table pagination (measured — see the handoff).
const H2 = (text, o = {}) => (track(text, 1), P({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: PT(18), after: PT(6) },
  indent: { firstLine: PT(36) },
  keepNext: true,
  children: [run(text, { size: 32, color: '000000', bold: false })],
  ...o,
}));
// Subsection heading: GREY BOLD (spec item 12/16 — the reference's H3 is bold; the old engine
// rendered it non-bold, which flattened the blocks).
const H3 = (text, o = {}) => (track(text, 2), P({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: PT(14), after: PT(4) },
  keepNext: true,
  children: [run(text, { size: 28, color: GRAY, bold: true })],
  ...o,
}));
// Body prose: 12pt, 1.5 spacing, first line indented 36pt.
const PROSE = (text, o = {}) => P({
  spacing: { line: LINE_15, after: 0 },
  indent: { firstLine: PT(36) },
  children: [run(text, { size: 24, ...(o.color ? { color: o.color } : {}) })],
  ...(o.indent ? { indent: o.indent } : {}),
});
// A label:value paragraph where only the label is bold ("Goal:", "Note:").
const LABELLED = (label, rest, o = {}) => P({
  spacing: { line: LINE_15, after: 0 },
  indent: o.indent ?? { left: PT(72), firstLine: 0 },
  children: [run(label, { size: 24, bold: true }), run(rest, { size: 24 })],
});
const BLANK = (o = {}) => P({
  spacing: { line: LINE_1, after: 0 },
  pageBreakBefore: o.breakBefore === true,
  children: [run('', { size: o.size ?? 24 })],
});

// The body is built INSIDE a function because the layout loop re-emits it: a page break inserted
// to keep a table whole moves everything after it, so the document has to be rebuilt and
// re-measured. `breaks` is a Set of table keys that must start on a fresh page (owner's rule,
// 17/07: "краще перенеси її на наступну сторінку, щоб же вона не була розірвана").
const GRAND_TOTAL_KEY = '__grand_total__';
const tableKey = (siteName, pageName) => `${siteName}|${pageName}`;
function buildBody(breaks) {
  tocEntries.length = 0;      // repopulated on every rebuild — never let it accumulate
  const body = [];

// ---- Title page ---------------------------------------------------------------------------
// The reference places the block ~40% down, right-aligned, with a rule between TEST REPORT and
// the date, and the signature at the foot.
for (let i = 0; i < 15; i++) body.push(BLANK());
body.push(P({
  alignment: AlignmentType.RIGHT,
  spacing: { after: 0 },
  children: [run(cfg.project, { size: 40, bold: true, allCaps: false, smallCaps: true })],
}));
body.push(P({
  alignment: AlignmentType.RIGHT,
  spacing: { after: PT(6) },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 2, color: '000000' } },
  children: [run('TEST REPORT', { size: 32, bold: true })],
}));
body.push(P({
  alignment: AlignmentType.RIGHT,
  children: [run(cfg.date, { size: 32, italics: true })],
}));
for (let i = 0; i < 23; i++) body.push(BLANK(22));
if (cfg.preparedBy)
  body.push(P({ alignment: AlignmentType.RIGHT, children: [run(`prepared by ${cfg.preparedBy}`, { size: 20 })] }));

// ---- Table of Contents page ---------------------------------------------------------------
// THE POINT OF THIS ENGINE: a real TOC field. Google Docs converts it to a native TOC on
// import, so the page numbers are live and update — they are never typed in (typed numbers go
// stale on the first edit = a fabricated fact in a client-facing document).
// The heading is itself HEADING_2, so the TOC lists "Table of Contents … 1" first, as the
// reference does (spec item 2).
track('Table of Contents', 1);
body.push(P({
  heading: HeadingLevel.HEADING_2,
  pageBreakBefore: true,
  spacing: { after: PT(12) },          // spec item 6: blank line before the first entry
  children: [run('Table of Contents', { size: 32, color: '000000' })],
}));
// The field itself stays — that is what makes Drive's import produce a NATIVE Docs TOC element
// (verified: documents.get returns tableOfContents:1), which keeps the outline and the refresh
// button. The library emits `begin … separate … end` with an EMPTY cached result, which is why
// the first render came back blank; the bake step injects the cached paragraphs between
// `separate` and `end`. See injectTocCache() below.
body.push(new TableOfContents('Table of Contents', {
  hyperlink: true,
  headingStyleRange: '2-3',
}));

// ---- Purpose of the document --------------------------------------------------------------
body.push(H2('Purpose of the document', { pageBreakBefore: true }));
for (const p of cfg.purpose || [
  `This test report is designed to prescribe the scope, approach, resources, and schedule of all testing activities of the project “${cfg.project}”.`,
  'The report identifies the items that were tested, the features that were tested, the types of testing that were performed, and the resources to complete testing.',
]) body.push(PROSE(p));

// ---- Test Objective -----------------------------------------------------------------------
body.push(H2('Test Objective'));
body.push(PROSE(cfg.objective?.intro
  || 'To test all tasks planned for the Sprint and validate that the application correctly supports main business flows and processes such as:'));
// spec item 8: a blank line after the intro, the bold group heading, then ANOTHER blank line.
body.push(BLANK());
for (const [siteName, lines] of Object.entries(scope)) {
  body.push(P({ spacing: { line: LINE_15, after: 0 }, children: [run(siteName, { size: 26, bold: true })] }));
  body.push(BLANK());
  // spec items 9/10: tight single-spaced bullets; `●` = screen, `○` = its nested elements.
  // A scope line may be a plain string or { text, children: [] } for the second level.
  for (const l of lines) {
    const text = typeof l === 'string' ? l : l.text;
    body.push(P({
      bullet: { level: 0 },
      spacing: { line: LINE_1, after: 0 },
      children: [run(text, { size: 24 })],
    }));
    for (const sub of (typeof l === 'string' ? [] : l.children || []))
      body.push(P({ bullet: { level: 1 }, spacing: { line: LINE_1, after: 0 }, children: [run(sub, { size: 24 })] }));
  }
}

// ---- Test Environment and Tools -----------------------------------------------------------
body.push(H2('Test Environment and Tools'));
body.push(H3('Mobile devices/browsers'));
for (const g of cfg.environment.groups) {
  body.push(P({ spacing: { line: LINE_15, after: 0 }, children: [run(`${g.name}:`, { size: 24, bold: true })] }));
  for (const it of g.items)
    body.push(P({ bullet: { level: 1 }, spacing: { line: LINE_1, after: 0 }, children: [run(`${it};`, { size: 24 })] }));
}
if (cfg.environment.note)
  // spec item 15: the block keeps its indent on wrapped lines (the old engine let wraps fall
  // back to the left margin).
  body.push(LABELLED('Note: ', cfg.environment.note, { indent: { left: PT(36), firstLine: PT(36) } }));
// spec item 16: owner's call — Testing Tools stays a SUBSECTION (no "1.1." numbering), styled
// like the reference's H3 (grey bold). The reference contradicts itself here (outline =
// subsection, page render = black bold section with "1.1.") — a Word artifact, not copied.
body.push(H3('Testing Tools'));
for (const t of cfg.tools || ['Dev Tools', 'Bug Tracking Tool'])
  body.push(P({ bullet: { level: 0 }, spacing: { line: LINE_1, after: 0 }, children: [run(`${t};`, { size: 24 })] }));

// ---- Test Design and Execution ------------------------------------------------------------
body.push(H2('Test Design and Execution'));
body.push(PROSE(
  `The following types of testing were performed: ${[...(cfg.alsoPerformed || []), ...designSections.map((s) => s.name)].join(', ')}.`,
  { color: GRAY },
));
for (const s of designSections) {
  // spec item 14: a bigger gap between type blocks than the old engine had.
  body.push(H3(s.name, { indent: { left: PT(108) }, spacing: { before: PT(24), after: PT(6) } }));
  body.push(LABELLED('Goal: ', s.goal));
  body.push(P({ spacing: { line: LINE_15, after: 0 }, indent: { left: PT(72) },
    children: [run('Process description:', { size: 24, bold: true })] }));
  // spec item 13: bullets inside the type blocks sit ~18pt deeper than the old engine's.
  for (const l of s.process)
    body.push(P({ bullet: { level: 1 }, spacing: { line: LINE_15, after: 0 }, children: [run(l, { size: 24 })] }));
  body.push(P({ spacing: { line: LINE_15, after: 0 }, indent: { left: PT(72) },
    children: [run('Completion Criteria:', { size: 24, bold: true })] }));
  for (const l of s.completion)
    body.push(P({ bullet: { level: 1 }, spacing: { line: LINE_15, after: 0 }, children: [run(l, { size: 24 })] }));
}

// ---- Test results -------------------------------------------------------------------------
track('Test results', 1);
body.push(P({
  heading: HeadingLevel.HEADING_2,
  alignment: AlignmentType.CENTER,
  spacing: { before: PT(18), after: PT(6) },
  keepNext: true,          // same owner rule as H2/H3 — this heading is built by hand (centred,
                           // bold) instead of via H2(), which is exactly how it got missed once.
  // When the grand-total table has to be carried to a fresh page, the break goes HERE, not on
  // the table: breaking at the table would leave this heading orphaned on the previous page.
  pageBreakBefore: breaks.has(GRAND_TOTAL_KEY),
  children: [run('Test results', { size: 32, bold: true, color: '000000' })],
}));
if (process.env.TR_RESULTS_NOTE === '1')
  body.push(PROSE(`At the time of reporting, ${notClosed} of the ${totalIssues} issues counted below are not verified fixed.`));

// ---- Test results tables (ported from tr-doc.mjs; palette read from the owner's reference
// and his live Bug-summary Sheet — his call 15/07, not eyeballed) ---------------------------
const countRow = (issues) => SCALE.map((s) => issues.filter((i) => i.severity === s).length);
const S = SCALE.length;
const RANK_BG = ['e03029', 'eeb700', '2d6591', '52a700'];
const RANK_FG = ['ffffff', null, 'ffffff', 'ffffff'];   // null = keep black (2nd chip), as in tr-doc
const TEAL = '41859a', SLATE = '6c8194', MODULE = '119ed2', BAND = '3d85c6', SPACER = 'd9d9d9';
const multiSite = sites.length > 1;
const TW = (pt) => Math.round(pt * 20);

// One cell: centered text, explicit size/colour/bold, background, vertical centre.
// `keep` sets w:keepNext on the cell's paragraphs, which keeps this row with the NEXT one.
// Applied to every row but the last, it stops a table breaking across a page — the 17/07 render
// caught a module band ("Search") stranded alone at the foot of a page with its chips and counts
// on the next one, which reads as an empty module in a client-facing report.
const TD = (text, o = {}) => new TableCell({
  shading: o.bg ? { fill: o.bg } : undefined,
  verticalAlign: VerticalAlign.CENTER,
  columnSpan: o.colSpan, rowSpan: o.rowSpan,
  children: (o.lines || [{ text: String(text ?? ''), size: o.size, color: o.fg }]).map((ln) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_1, after: 0 },
      keepNext: o.keep === true,
      children: [run(ln.text, {
        size: (ln.size ?? o.size ?? 10) * 2,
        bold: o.bold !== false,
        ...(ln.color ? { color: ln.color } : {}),
      })],
    })),
});
const sevHeaderTDs = (keep) => SCALE.map((name, i) =>
  TD(name, { bg: RANK_BG[i] || SLATE, fg: RANK_FG[i] === undefined ? 'ffffff' : (RANK_FG[i] || undefined), size: 12, keep }));
const countTDs = (counts, keep) => counts.map((n) => TD(n, { bg: SLATE, size: 13, keep }));

// Grand total: "Total count per Severity" band, the chips, the counts, and the all-modules
// total. The label cell keeps the owner's Bug-summary Sheet style (line 1 black 11pt bold,
// line 2 white 10pt bold) — his explicit call, twice.
const totals = SCALE.map((s) => sites.flatMap((x) => x.pages || []).flatMap((p) => p.issues || []).filter((i) => i.severity === s).length);
body.push(new Table({
  columnWidths: [...Array.from({ length: S }, () => TW(Math.floor(336 / S))), TW(116)],
  rows: [
    new TableRow({ height: { value: TW(23), rule: HeightRule.ATLEAST }, children: [
      TD('Total count per Severity', { bg: TEAL, fg: 'ffffff', size: 12, colSpan: S, keep: true }),
      TD(null, { bg: TEAL, rowSpan: 2, keep: true, lines: [
        { text: 'Total count of issues:', size: 11, color: '000000' },
        { text: '(All modules)', size: 10, color: 'ffffff' }] }),
    ] }),
    new TableRow({ height: { value: TW(19), rule: HeightRule.ATLEAST }, children: sevHeaderTDs(true) }),
    new TableRow({ height: { value: TW(22), rule: HeightRule.ATLEAST }, children: [
      ...countTDs(totals, true),
      TD(totals.reduce((a, b) => a + b, 0), { bg: TEAL, fg: 'ffffff', size: 21, rowSpan: 2, keep: true }),
    ] }),
    new TableRow({ height: { value: TW(18), rule: HeightRule.ATLEAST }, children: [
      TD('', { bg: SPACER, colSpan: S }),
    ] }),
  ],
}));

for (const site of sites) {
  if (multiSite) {
    body.push(BLANK());
    body.push(new Table({
      columnWidths: [TW(468)],
      rows: [new TableRow({ height: { value: TW(32), rule: HeightRule.ATLEAST },
        children: [TD(site.name, { bg: BAND, fg: 'f3f3f3', size: 18 })] })],
    }));
  }
  for (const page of orderedPages(site)) {
    // The spacer goes BEFORE the table so it can carry the page break: Google Docs honours
    // keep-with-next between a PARAGRAPH and a table, but ignores it between table ROWS
    // (measured 17/07 — keepWithNext is imported onto the cells and does nothing), so a break
    // on the preceding paragraph is the only way to carry a table over whole.
    // It is also structural regardless: OOXML merges two ADJACENT tables into one.
    body.push(BLANK({ breakBefore: breaks.has(tableKey(site.name, page.name)) }));
    // The reference's module tables are NOT full width: 105/105/75/75 pt, left-aligned.
    const widths = S === 4 ? [105, 105, 75, 75]
      : Array.from({ length: S }, (_, i) => (i < Math.ceil(S / 2) ? 105 : 75));
    body.push(new Table({
      columnWidths: widths.map(TW),
      alignment: AlignmentType.LEFT,
      rows: [
        new TableRow({ height: { value: TW(22), rule: HeightRule.ATLEAST }, children: [
          TD(multiSite ? `${page.name} [${site.name}]` : page.name, { bg: MODULE, size: 13, colSpan: S, keep: true }),
        ] }),
        new TableRow({ height: { value: TW(20), rule: HeightRule.ATLEAST }, children: sevHeaderTDs(true) }),
        new TableRow({ height: { value: TW(21), rule: HeightRule.ATLEAST }, children: countTDs(countRow(page.issues || [])) }),
      ],
    }));
  }
}
  return body;
}

// ---- Header (logo) + footer (real page-number field) ---------------------------------------
async function fetchLogo(url) {
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) { warnings.push(`logoUrl fetch failed (${res.status}) — the report is being built WITHOUT the header logo.`); return null; }
  return Buffer.from(await res.arrayBuffer());
}
const logo = await fetchLogo(cfg.logoUrl);
// Read out of the reference's own word/header1.xml, not eyeballed: one paragraph, image extent
// 1452563×372219 EMU = 114×29 pt (→ 152×39 px at the 96dpi the library converts from), and the
// paragraph carries 1.5 line spacing — that taller line box is what sits the logo lower and
// pushes the body down the page. (The old engine faked the same effect with a 115pt top margin;
// this reproduces the cause instead of the symptom.)
const headerChildren = logo
  ? [P({ spacing: { line: LINE_15 }, children: [new ImageRun({ data: logo, transformation: { width: 152, height: 39 } })] })]
  : [P({ children: [run('')] })];

const footer = new Footer({
  children: [P({
    alignment: AlignmentType.RIGHT,
    children: [run('Page '), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })],
  })],
});

// Page geometry read straight out of the reference's own <w:sectPr> (17/07) — not guessed:
//   <w:pgSz w:h="16834" w:w="11909"/>            → A4 (docx defaults to LETTER: wrong pagination)
//   <w:pgMar top/bottom/left/right="1440" header/footer="720"/>
//   <w:pgNumType w:start="0"/>                   → the title page is page 0, so the TOC reads
//                                                  "Page 1" exactly as the reference does
//   <w:titlePg w:val="1"/>                       → page 1 takes its own header/footer
// Only headerReference type="default" exists there: the title page carries NO logo, so `first`
// is deliberately an EMPTY header (not a copy of the default one).
const packDoc = (breaks) => Packer.toBuffer(new Document({
  creator: cfg.preparedBy || 'QA',
  title: process.env.TR_TITLE || `${cfg.project}: Test report — ${cfg.date}`,
  styles: {
    default: {
      document: { run: { font: FONT, size: 24 } },
      heading2: { run: { font: FONT, size: 32, bold: false, color: '000000' }, paragraph: { spacing: { before: PT(18), after: PT(6) } } },
      heading3: { run: { font: FONT, size: 28, bold: true, color: GRAY }, paragraph: { spacing: { before: PT(14), after: PT(4) } } },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11909, height: 16834 },
        // top/header are the two MEASURED values, not the reference's declared ones: the reference
        // declares top=1440 (72pt), but its rendered body starts ~115pt down because Word's layout
        // of its 1.5-spaced header line box pushes it there. We match the RENDER, not the
        // attribute (the same 115pt the old engine arrived at empirically and the owner accepted),
        // because a different toolchain will not reproduce Word's header maths on its own.
        margin: { top: 2300, right: 1440, bottom: 1440, left: 1440, header: 1080, footer: 720 },
        pageNumbers: { start: 0 },
      },
      titlePage: true,
    },
    headers: { default: new Header({ children: headerChildren }), first: new Header({ children: [P({ children: [run('')] })] }) },
    footers: { default: footer, first: new Footer({ children: [P({ children: [run('')] })] }) },
    children: buildBody(breaks),
  }],
}));
const outPath = process.env.TR_DOCX_OUT || path.join(process.cwd(), 'tr-report.docx');

// ---- Auth + Drive -------------------------------------------------------------------------
const creds = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'credentials.json')));
const token = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'token.json')));
const cAuth = creds.installed || creds.web;
const oauth = new google.auth.OAuth2(cAuth.client_id, cAuth.client_secret,
  (cAuth.redirect_uris && cAuth.redirect_uris[0]) || 'http://localhost:3456');
oauth.setCredentials(token);
const drive = google.drive({ version: 'v3', auth: oauth });

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TITLE = process.env.TR_TITLE || `${cfg.project}: Test report — ${cfg.date}`;

// Drive folder cascade: <root>/<Project>/QA Documentation/Test Reports/ (workspace convention —
// never the Drive root, never someone's own root folders).
async function ensureFolder(name, parentId) {
  const q = [`name='${name.replace(/'/g, "\\'")}'`, "mimeType='application/vnd.google-apps.folder'",
    'trashed=false', parentId ? `'${parentId}' in parents` : `'root' in parents`].join(' and ');
  const found = await drive.files.list({ q, fields: 'files(id)', pageSize: 1 });
  if (found.data.files.length) return found.data.files[0].id;
  const made = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : undefined },
    fields: 'id',
  });
  return made.data.id;
}

let documentId = process.env.TR_TARGET_ID || null;
let folderId = null;
if (!documentId) {
  const root = await ensureFolder(process.env.DRIVE_ROOT_FOLDER || 'ClaudeProjects', null);
  const proj = await ensureFolder(PROJECT, root);
  const qadoc = await ensureFolder('QA Documentation', proj);
  folderId = await ensureFolder('Test Reports', qadoc);
  // Stable link (Gate q.1): a same-titled rebuild UPDATES THE SAME DOC in place — the id and
  // every shared link survive. Never "upload a new one + trash the old".
  const existing = await drive.files.list({
    q: [`name='${TITLE.replace(/'/g, "\\'")}'`, `'${folderId}' in parents`, 'trashed=false'].join(' and '),
    fields: 'files(id)', pageSize: 1,
  });
  if (existing.data.files.length) documentId = existing.data.files[0].id;
}

// ---- TOC bake ------------------------------------------------------------------------------
// Owner's decision 17/07 ("Запікаємо"): the TOC must arrive populated, as his Word reference
// does. Word bakes a CACHED RESULT into the field; the docx library emits `begin … separate …
// end` with nothing between, which is why the first render came back blank.
//
// The numbers are DERIVED FROM A RENDER and GRADED BY A RENDER — never typed, never guessed.
// The loop below only converges when the numbers written into the document equal the pages the
// render actually shows. There is no expected value to "adjust" into agreement: the render is
// the oracle. (Loop-Engineering: maker-checker; fix the harness, never the expectation.)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Right tab at the text edge: pgSz 11909 − left 1440 − right 1440 (read from the reference's
// own sectPr). The reference uses leader="none" — numbers hard against the margin, no dots.
const TAB_POS = 11909 - 1440 - 1440;
const tocParaXml = ({ text, level, page }) => {
  const bold = level === 1 ? '<w:b w:val="1"/><w:bCs w:val="1"/>' : '';
  // Level 2 indent 360 twips = 18pt — the reference's sub-entry indent (the old engine used 36pt).
  const ind = level === 2 ? '<w:ind w:left="360"/>' : '';
  const rPr = `<w:rPr><w:rFonts w:ascii="Arial" w:cs="Arial" w:eastAsia="Arial" w:hAnsi="Arial"/>${bold}`
    + '<w:color w:val="000000"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';   // sz 22 = 11pt, per the reference
  return `<w:p><w:pPr><w:tabs><w:tab w:val="right" w:leader="none" w:pos="${TAB_POS}"/></w:tabs>`
    + `<w:spacing w:before="60" w:line="240" w:lineRule="auto"/>${ind}</w:pPr>`
    + `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
    + `<w:r>${rPr}<w:tab/><w:t>${esc(page)}</w:t></w:r></w:p>`;
};
const SEP = '<w:fldChar w:fldCharType="separate"/></w:r></w:p>';
const END = '<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>';
async function injectTocCache(baseBuf, entries) {
  const zip = await JSZip.loadAsync(baseBuf);
  let xml = await zip.file('word/document.xml').async('string');
  const i = xml.indexOf(SEP), j = xml.indexOf(END, i);
  if (i < 0 || j < 0) die('TOC field markers not found in the generated .docx — the docx library changed its output shape; re-read what it emits before touching this.');
  xml = xml.slice(0, i + SEP.length) + entries.map(tocParaXml).join('') + xml.slice(j);
  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

// ---- Don't silently overwrite someone's edits ----------------------------------------------
// Uploading .docx media REPLACES the document wholesale. On 17/07 this engine rebuilt a document
// while the owner had it open and was editing it — his changes went, and nothing warned. So: after
// every write, remember the version we produced; before the FIRST write of a run, refuse if the
// document has moved since. TR_FORCE=1 overrides — deliberately, out loud, never by default.
const statePath = path.join(path.dirname(outPath), '.tr-doc-state.json');
const readState = () => { try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { return {}; } };
const rememberVersion = async () => {
  const m = await drive.files.get({ fileId: documentId, fields: 'version,modifiedTime' });
  const st = readState();
  st[documentId] = { version: m.data.version, modifiedTime: m.data.modifiedTime, writtenBy: 'tr-docx' };
  fs.writeFileSync(statePath, JSON.stringify(st, null, 2));
};
async function guardAgainstClobber() {
  const known = readState()[documentId];
  if (!known) {
    warnings.push(`this run has no record of previously writing "${TITLE}" (${documentId}), so it cannot tell whether anyone edited it since. It was overwritten anyway — if that document held someone's manual work, recover it from File > Version history in the Docs UI.`);
    return;
  }
  const m = await drive.files.get({ fileId: documentId, fields: 'version,modifiedTime' });
  if (String(m.data.version) === String(known.version)) return;      // untouched since our write
  if (process.env.TR_FORCE === '1') {
    warnings.push(`"${TITLE}" was modified after this tool last wrote it (${known.modifiedTime} → ${m.data.modifiedTime}) and TR_FORCE=1 overwrote those changes. Recover them from File > Version history if they mattered.`);
    return;
  }
  refuse(`"${TITLE}" (${documentId}) has been modified since this tool last wrote it `
    + `(ours: ${known.modifiedTime}, now: ${m.data.modifiedTime}). Uploading would REPLACE the whole `
    + `document and destroy those edits. Nothing was written. Look at the document first; then either `
    + `fold the change into the config/record and rebuild, or re-run with TR_FORCE=1 to overwrite on purpose.`);
}

let firstWrite = true;
const upload = async (buffer) => {
  fs.writeFileSync(outPath, buffer);
  if (documentId) {
    if (firstWrite) { await guardAgainstClobber(); firstWrite = false; }
    await drive.files.update({ fileId: documentId, media: { mimeType: DOCX_MIME, body: fs.createReadStream(outPath) } });
    await rememberVersion();
  } else {
    const made = await drive.files.create({
      requestBody: { name: TITLE, mimeType: 'application/vnd.google-apps.document', parents: [folderId] },
      media: { mimeType: DOCX_MIME, body: fs.createReadStream(outPath) },
      fields: 'id',
    });
    documentId = made.data.id;
  }
};

const pdfPath = `${outPath}.pdf`;
let havePoppler = true;
async function renderPages(layout = false) {
  if (!layout) {
    const pdf = await drive.files.export({ fileId: documentId, mimeType: 'application/pdf' }, { responseType: 'arraybuffer' });
    fs.writeFileSync(pdfPath, Buffer.from(pdf.data));
  }
  // pdftotext when present (faster, and `-layout` keeps table rows on one line); else the
  // bundled Swift/PDFKit sibling — the kit must not REQUIRE poppler, or a colleague's clean
  // clone is broken (same shape as tr-render.mjs).
  try {
    const args = layout ? ['-layout', pdfPath, '-'] : [pdfPath, '-'];
    const all = execFileSync('pdftotext', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const pages = all.split('\f');
    if (pages.at(-1) === '') pages.pop();
    return pages;
  } catch {
    havePoppler = false;
    const swift = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pdf-page-text.swift');
    const all = execFileSync('swift', [swift, pdfPath], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return all.split(/^=== page \d+ ===$/m).slice(1);
  }
}

// ---- Split-table detection ------------------------------------------------------------------
// Owner's rule (17/07): a table must never be broken across a page — carry it whole to the next
// one. Google Docs offers no way to say so (keep-with-next is ignored across table rows), so the
// engine measures the render and inserts an explicit page break before any table that split.
//
// Read from a `-layout` render, where a table comes out as three lines:
//     <band name>
//     Critical   Major   Minor   Trivial
//        1         6       21      17
// A table is SPLIT when that triple does not fit on one page. Plain (non-layout) extraction is
// useless here — it emits each cell on its own line and re-orders them.
// pdftotext returns zero-width characters inside the text ("Table of Contents​") — naive
// equality fails, so normalise before matching (trap found 17/07).
const norm = (s) => String(s || '').replace(/[​‌‍﻿­]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const lines = (t) => String(t || '').split('\n').map(norm).filter(Boolean);
const toks = (l) => String(l).replace(/[​‌‍﻿­]/g, '').trim().split(/\s{2,}|\t+/).map((s) => s.trim()).filter(Boolean);
const isSevLine = (l) => { const t = toks(l); return t.length === SCALE.length && t.every((x, i) => x === SCALE[i]); };
const isNumsLine = (l) => { const t = toks(l); return t.length >= 1 && t.every((x) => /^\d+$/.test(x)); };
const bandNames = new Map();     // rendered band text -> table key
for (const site of sites) for (const p of orderedPages(site))
  bandNames.set(norm(sites.length > 1 ? `${p.name} [${site.name}]` : p.name), tableKey(site.name, p.name));
bandNames.set(norm('Total count per Severity'), GRAND_TOTAL_KEY);

function detectSplitTables(pagesLayout) {
  const found = new Set();
  for (const raw of pagesLayout) {
    const ls = String(raw).split('\n').map((l) => l.replace(/\s+$/, ''))
      .filter((l) => l.trim() && !/^\s*Page \d+\s*$/.test(l));
    for (let i = 0; i < ls.length; i++) {
      const key = bandNames.get(norm(ls[i]));
      if (!key) continue;
      // A whole table needs the chips line AND the counts line on this same page, right after it.
      const sev = ls[i + 1], nums = ls[i + 2];
      if (!sev || !isSevLine(sev) || !nums || !isNumsLine(nums)) found.add(key);
    }
  }
  return found;
}

// A heading occupies a LINE OF ITS OWN. Substring matching is not good enough and is not a
// theoretical worry — it silently produced a wrong TOC on the first bake run (17/07): the
// section's own intro sentence, "The following types of testing were performed: Smoke Testing,
// Functional Testing, …", contains every type heading, so every one of them resolved to that
// sentence's page. Worse, the loop CONVERGED on it, because the maker and the checker shared
// the same broken matcher — a maker-checker is worthless when both sides ask the same wrong
// question. Match whole lines.
function resolvePages(pages, entries) {
  const tocIdx = pages.findIndex((t) => lines(t).some((l) => l === 'table of contents'));
  if (tocIdx < 0) refuse('the render contains no "Table of Contents" page — cannot locate the TOC, and its page numbers will not be invented.');
  const tocPdfPage = tocIdx + 1;
  const out = [];
  // The TOC page lists every heading too (as entries), so start AFTER it and walk the headings
  // in document order (trap found 17/07).
  let from = tocPdfPage + 1;
  for (const e of entries) {
    if (norm(e.text) === 'table of contents') { out.push({ ...e, page: tocPdfPage - 1 }); continue; }
    let found = 0;
    for (let p = from; p <= pages.length; p++)
      if (lines(pages[p - 1]).some((l) => l === norm(e.text))) { found = p; from = p; break; }
    if (!found) refuse(`heading "${e.text}" was not found on a line of its own anywhere in the render — refusing to invent a page number for it.`);
    // pgNumType starts at 0 (the reference's own sectPr), so the printed page = pdf page − 1.
    out.push({ ...e, page: found - 1 });
  }
  return out;
}

// ---- The layout loop ------------------------------------------------------------------------
// One fixed point over TWO things at once, because they move each other: a page break inserted to
// keep a table whole re-paginates the document, which changes the TOC's numbers. It converges only
// when the render agrees with the document on BOTH — the numbers written match the pages they
// land on, and no table is split. Nothing is ever "adjusted to agree": the render is the oracle.
const samePages = (a, b) => a.length === b.length && a.every((x, i) => x.page === b[i].page);
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
let baked = tocEntries.map((e) => ({ ...e, page: 1 }));   // placeholders: same line count, so
                                                          // pagination matches the final list
let breaks = new Set();
let converged = false, measured = null, lastPages = null, splits = new Set();
for (let iter = 1; iter <= 6 && !converged; iter++) {
  await upload(await injectTocCache(await packDoc(breaks), baked));
  lastPages = await renderPages();
  measured = resolvePages(lastPages, tocEntries);
  splits = detectSplitTables(await renderPages(true));
  const numbersAgree = samePages(baked, measured);
  const layoutAgrees = splits.size === 0;
  if (numbersAgree && layoutAgrees) { converged = true; break; }
  const nextBreaks = new Set([...breaks, ...splits]);
  if (numbersAgree && sameSet(nextBreaks, breaks)) break;   // stuck: a split we cannot heal
  console.error(`tr-docx: layout iteration ${iter} — ${numbersAgree ? 'numbers ok' : 'pagination moved'}`
    + `, ${splits.size} split table(s)${splits.size ? ': ' + [...splits].join(', ') : ''}; rebuilding.`);
  baked = measured;
  breaks = nextBreaks;
}
if (!converged && !samePages(baked, measured)) {
  // Never "fix" this by writing the numbers anyway: an unconverged bake means the page numbers
  // in the document do not match the document. Stop and escalate (LOOP_RULES).
  refuse('the TOC bake did not converge in 6 iterations — the page numbers would not match the render. Nothing was baked; escalate rather than ship numbers that disagree with the document.');
}
if (splits.size)
  warnings.push(`${splits.size} table(s) are still split across a page break after ${breaks.size} forced break(s): ${[...splits].join(', ')}. The numbers are correct, but the layout is not what the owner asked for — do not ship this without looking.`);

// Orphan check, against the FINAL render. It walks `tocEntries` — the same list the document was
// built from — deliberately: the first version of this check used a hand-typed list of headings,
// missed "Test results" (which is built by hand rather than via H2()), and reported the document
// clean while the owner was looking at the orphan. A checker that does not share the maker's
// source of truth is not a checker.
const orphans = [];
for (const p of lastPages) {
  const ls = lines(p).filter((l) => !/^page \d+$/.test(l));
  if (!ls.length) continue;
  const hit = tocEntries.find((e) => norm(e.text) === ls.at(-1));
  if (hit) orphans.push(hit.text);
}
if (orphans.length)
  warnings.push(`${orphans.length} heading(s) are stranded alone at the foot of a page with their content overleaf: ${orphans.join(', ')}. keep-with-next is set on every heading, so if this persists the next block is a TABLE — Google Docs ignores keep-with-next across table pagination, and the fix is an explicit page break, which changes layout and is the owner's call.`);

console.log(JSON.stringify({
  documentId,
  docLink: `https://docs.google.com/document/d/${documentId}/edit`,
  folderLink: folderId ? `https://drive.google.com/drive/folders/${folderId}` : null,
  docxPath: outPath,
  tocBaked: baked.map((e) => `${'  '.repeat(e.level - 1)}${e.text} … ${e.page}`),
  orphanedHeadings: orphans,
  warnings,
}, null, 2));
console.error('\ntr-docx: TOC page numbers are BAKED AT BUILD TIME and verified against a render of this exact build.'
  + '\n  They go stale if the document is edited afterwards — the TOC is a native Docs element, so the reader\'s'
  + '\n  remedy is the refresh button. Say this at hand-over.');
if (warnings.length) console.error(`\ntr-docx WARNINGS (repeat these to the owner with the link):\n- ${warnings.join('\n- ')}`);
