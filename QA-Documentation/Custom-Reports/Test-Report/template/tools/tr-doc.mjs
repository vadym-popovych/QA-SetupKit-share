// Build the end-of-engagement Test report as a Google Doc from TWO inputs:
//   - the NARRATIVE config (test-report config JSON — see ../test-report.example.json), and
//   - the NUMBERS record (a Bug-Summary JSON, bug-summary.schema.json) — every count in the
//     "Test results" tables is COMPUTED from it here, never typed into a cell.
// Layout/palette are the owner's reference document, read out of its .docx XML — see
// ../../DOC_TEMPLATE.md for the spec and the list of deliberate departures.
//
//   PROJECT_NAME=<Project> TR_CONFIG=./report-config.json TR_SUMMARY=./bug-summary.json \
//     node tools/tr-doc.mjs
//
// Optional: TR_TITLE (doc title override) · TR_RESULTS_NOTE=1 (adds an honest "not verified
// fixed" line under Test results — opt-in, the default output is the owner's format) ·
// DRIVE_ROOT_FOLDER (default ClaudeProjects) · MCP_SHEETS_DIR.
// The doc lands in <root>/<Project>/QA Documentation/Test Reports/; an existing doc with the
// same title in that folder is trashed first (idempotent re-run).
// Prints { documentId, docLink, folderLink, warnings } as JSON.
import fs from 'fs';
import path from 'path';
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

const die = (msg) => { console.error(`tr-doc: ${msg}`); process.exit(2); };
const refuse = (msg) => { console.error(`tr-doc REFUSES: ${msg}`); process.exit(1); };
const hex = (h) => { const n = parseInt(h.slice(1), 16);
  return { color: { rgbColor: { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 } } }; };

const PROJECT = process.env.PROJECT_NAME;
if (!PROJECT) die('PROJECT_NAME is not set — it names the Drive folder the report lands in.');
const readJson = (envName) => {
  const p = process.env[envName];
  if (!p) die(`${envName} is not set — this renderer carries no engagement data of its own.`);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { die(`cannot read ${envName} (${p}): ${e.message}`); }
};
const cfg = readJson('TR_CONFIG');       // narrative half (test-report.schema.json)
const sum = readJson('TR_SUMMARY');      // numbers half (bug-summary.schema.json)

// ---- Marry the two inputs, refuse what would misreport ----------------------------------
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

const countRow = (issues) => SCALE.map((s) => issues.filter((i) => i.severity === s).length);
// General is the placement debt band — rendered LAST within its site (Bug-Summary rule).
const orderedPages = (site) => {
  const pages = (site.pages || []).slice();
  const gi = pages.findIndex((p) => p.name === 'General');
  if (gi >= 0) pages.push(pages.splice(gi, 1)[0]);
  return pages;
};

// ---- Test Design library (genericised from the owner's reference document) ---------------
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

// ---- Auth -------------------------------------------------------------------------------
const creds = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'credentials.json')));
const token = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'token.json')));
const cAuth = creds.installed || creds.web;
const oauth = new google.auth.OAuth2(cAuth.client_id, cAuth.client_secret,
  (cAuth.redirect_uris && cAuth.redirect_uris[0]) || 'http://localhost:3456');
oauth.setCredentials(token);
const docs = google.docs({ version: 'v1', auth: oauth });
const drive = google.drive({ version: 'v3', auth: oauth });

// ---- Pass 1: the narrative, as one linear text batch -------------------------------------
const requests = [];
let cursor = 1;
function add(text, opts = {}) {
  requests.push({ insertText: { location: { index: cursor }, text } });
  const start = cursor, end = cursor + text.length;
  const ps = {}, pf = [];
  if (opts.style) { ps.namedStyleType = opts.style; pf.push('namedStyleType'); }
  if (opts.align) { ps.alignment = opts.align; pf.push('alignment'); }
  if (opts.pageBreakBefore) { ps.pageBreakBefore = true; pf.push('pageBreakBefore'); }
  // indentStart alone renders flush in the PDF export (the first line follows indentFirstLine,
  // which defaults to 0) — measured on iteration 2 of the visual loop, so the two travel together.
  if (opts.indent != null) { ps.indentStart = { magnitude: opts.indent, unit: 'PT' }; pf.push('indentStart'); }
  if (opts.firstLine != null || opts.indent != null) {
    ps.indentFirstLine = { magnitude: opts.firstLine ?? opts.indent, unit: 'PT' }; pf.push('indentFirstLine');
  }
  if (opts.line) { ps.lineSpacing = opts.line; pf.push('lineSpacing'); }
  if (opts.borderBottom) {
    ps.borderBottom = { color: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } },
      width: { magnitude: 1, unit: 'PT' }, padding: { magnitude: 2, unit: 'PT' }, dashStyle: 'SOLID' };
    pf.push('borderBottom');
  }
  if (pf.length) requests.push({ updateParagraphStyle: {
    range: { startIndex: start, endIndex: end }, paragraphStyle: ps, fields: pf.join(',') } });
  const ts = {}, tf = [];
  if (opts.size) { ts.fontSize = { magnitude: opts.size, unit: 'PT' }; tf.push('fontSize'); }
  if (opts.bold) { ts.bold = true; tf.push('bold'); }
  if (opts.italic) { ts.italic = true; tf.push('italic'); }
  if (opts.fg) { ts.foregroundColor = hex(opts.fg); tf.push('foregroundColor'); }
  if (opts.smallCaps) { ts.smallCaps = true; tf.push('smallCaps'); }
  if (tf.length) requests.push({ updateTextStyle: {
    range: { startIndex: start, endIndex: end - 1 > start ? end - 1 : end },
    textStyle: ts, fields: tf.join(',') } });
  if (opts.boldLen) requests.push({ updateTextStyle: {
    range: { startIndex: start, endIndex: start + opts.boldLen },
    textStyle: { bold: true }, fields: 'bold' } });
  cursor = end;
}
const H2 = (t) => add(t + '\n', { style: 'HEADING_2' });
const H3 = (t) => add(t + '\n', { style: 'HEADING_3' });
const P = (t, size = 12) => add(t + '\n', { style: 'NORMAL_TEXT', size });

// The TITLE PAGE, as in the reference: the block sits ~40% down, right-aligned, one rule
// between TEST REPORT and the date (a paragraph bottom border), the signature at the foot.
// The reference places all of it with empty paragraphs (15 above, 23 below) — reproduced
// verbatim; the content then starts on page 2 via pageBreakBefore on the first heading.
add('\n'.repeat(15));
add(`${cfg.project}\n`, { style: 'TITLE', size: 20, align: 'END', bold: true, smallCaps: true });
add('TEST REPORT\n', { style: 'TITLE', size: 16, align: 'END', bold: true, borderBottom: true });
add(`${cfg.date}\n`, { style: 'NORMAL_TEXT', size: 16, align: 'END', italic: true });
add('\n'.repeat(23), { style: 'NORMAL_TEXT', size: 11, align: 'START' });
if (cfg.preparedBy) add(`prepared by ${cfg.preparedBy}\n`, { style: 'NORMAL_TEXT', size: 10, align: 'END' });

// Table of Contents page (page 2 in the reference). The Docs API cannot insert the native
// TOC element, and page numbers cannot be computed without rendering — so this is the honest
// version: the section map, top-level bold, subsections indented, NO invented page numbers.
// The native TOC (with numbers) replaces it in one click: Insert > Table of contents.
add('Table of Contents\n', { style: 'HEADING_2', pageBreakBefore: true });
const tocEntries = [
  ['Purpose of the document', 0], ['Test Objective', 0], ['Test Environment and Tools', 0],
  ['Mobile devices/browsers', 1], ['Testing Tools', 1], ['Test Design and Execution', 0],
  ...designSections.map((s) => [s.name, 1]), ['Test results', 0]];
for (const [t, ind] of tocEntries)
  add(`${t}\n`, { style: 'NORMAL_TEXT', size: 12, bold: ind === 0, indent: ind ? 36 : 0, line: 150 });

// ---- Narrative typography, measured off the reference: prose = 12pt, first-line indent
// 36pt, line spacing 1.5; lists are REAL bullets; the per-type blocks sit left-indented 72pt
// with bold labels; type headings are HEADING_3 indented 108pt; the design intro is grey.
const GRAY = '#666666';
const bullets = [];        // paragraph ranges that become bullet-list items (created LAST)
const deepen = [];         // bulleted ranges that sit deeper (env devices, process/completion)
const H2N = (t, o = {}) => add(`${t}\n`, { style: 'HEADING_2', firstLine: 36, ...o });
const PROSE = (t, o = {}) => add(`${t}\n`, { size: 12, line: 150, firstLine: 36, ...o });
const LI = (t, deep) => { const s = cursor; add(`${t}\n`, { size: 12, line: 150 });
  bullets.push({ s, e: cursor }); if (deep) deepen.push({ s, e: cursor }); };

H2N('Purpose of the document', { pageBreakBefore: true });
for (const p of cfg.purpose || [
  `This test report is designed to prescribe the scope, approach, resources, and schedule of all testing activities of the project “${cfg.project}”.`,
  'The report identifies the items that were tested, the features that were tested, the types of testing that were performed, and the resources to complete testing.',
]) PROSE(p);

H2N('Test Objective');
PROSE(cfg.objective?.intro || 'To test all tasks planned for the Sprint and validate that the application correctly supports main business flows and processes such as:');
for (const [siteName, lines] of Object.entries(scope)) {
  add(`${siteName}\n`, { size: 13, bold: true, line: 150 });
  for (const l of lines) LI(l);
}

H2N('Test Environment and Tools');
add('Mobile devices/browsers\n', { style: 'HEADING_3' });
for (const g of cfg.environment.groups) {
  add(`${g.name}:\n`, { size: 12, bold: true, line: 150 });
  for (const it of g.items) LI(`${it};`, true);
}
if (cfg.environment.note) PROSE(`Note: ${cfg.environment.note}`, { boldLen: 5 });
add('Testing Tools\n', { style: 'HEADING_3' });
for (const t of cfg.tools || ['Dev Tools', 'Bug Tracking Tool']) LI(`${t};`);

H2N('Test Design and Execution');
PROSE(`The following types of testing were performed: ${[...(cfg.alsoPerformed || []), ...designSections.map((s) => s.name)].join(', ')}.`, { fg: GRAY });
for (const s of designSections) {
  add(`${s.name}\n`, { style: 'HEADING_3', indent: 108 });
  add(`Goal: ${s.goal}\n`, { size: 12, line: 150, indent: 72, boldLen: 5 });
  add('Process description:\n', { size: 12, line: 150, indent: 72, bold: true });
  for (const l of s.process) LI(l, true);
  add('Completion Criteria:\n', { size: 12, line: 150, indent: 72, bold: true });
  for (const l of s.completion) LI(l, true);
}

add('Test results\n', { style: 'HEADING_2', align: 'CENTER', bold: true });
if (process.env.TR_RESULTS_NOTE === '1')
  PROSE(`At the time of reporting, ${notClosed} of the ${totalIssues} issues counted below are not verified fixed.`);

// Bullets go LAST, in reverse document order (a bullet request can consume leading tabs and
// shift indices — none are used here, but reverse order keeps this safe regardless); the
// deeper lists then get their reference positions (bullet at 72pt, text at 90pt) — plain
// style updates, no index shifts.
for (const b of bullets.slice().reverse())
  requests.push({ createParagraphBullets: { range: { startIndex: b.s, endIndex: b.e }, bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });
for (const d of deepen)
  requests.push({ updateParagraphStyle: { range: { startIndex: d.s, endIndex: d.e },
    paragraphStyle: { indentFirstLine: { magnitude: 72, unit: 'PT' }, indentStart: { magnitude: 90, unit: 'PT' } },
    fields: 'indentFirstLine,indentStart' } });

// ---- Table specs, in document order (palette: DOC_TEMPLATE.md, read from the reference) ---
const S = SCALE.length;
// Table styling follows the owner's Bug-summary SHEET (his call, 15/07/2026): bold everywhere,
// severity chips 12pt (Trivial white like the sheet, not black like the .docx), counts 13pt,
// module band 13pt on #119ed2, site band 18pt — all read from the live sheet, not eyeballed.
const RANK_BG = ['#e03029', '#eeb700', '#2d6591', '#52a700'];
const RANK_FG = ['#ffffff', null, '#ffffff', '#ffffff'];
const TEAL = '#41859a', SLATE = '#6c8194', MODULE = '#119ed2', BAND = '#3d85c6', SPACER = '#d9d9d9';
const multiSite = sites.length > 1;
const cell = (r, c, text, o = {}) => ({ r, c, text: String(text), ...o });
const sevHeaderCells = (row) => SCALE.map((name, i) =>
  cell(row, i, name, { bg: RANK_BG[i] || SLATE, fg: RANK_FG[i] === undefined ? '#ffffff' : RANK_FG[i], size: 12, bold: true, vAlign: 'MIDDLE' }));
const countCells = (row, counts) => counts.map((n, i) => cell(row, i, n, { bg: SLATE, size: 13, bold: true, vAlign: 'MIDDLE' }));

const specs = [];
{ // grand total
  const totals = SCALE.map((s) => sites.flatMap((x) => x.pages || []).flatMap((p) => p.issues || []).filter((i) => i.severity === s).length);
  specs.push({
    rows: 4, cols: S + 1,
    cells: [
      cell(0, 0, 'Total count per Severity', { bg: TEAL, fg: '#ffffff', size: 12, bold: true, vAlign: 'MIDDLE' }),
      ...Array.from({ length: S - 1 }, (_, i) => cell(0, i + 1, '', { bg: TEAL })),
      // The owner keeps this ONE cell in his Bug-summary Sheet style (his call, 15/07 — twice):
      // line 1 black 11pt bold, line 2 white 10pt bold — not the .docx render's all-white.
      cell(0, S, 'Total count of issues:\n(All modules)', { bg: TEAL, bold: true, vAlign: 'MIDDLE',
        runs: [{ len: 23, size: 11, fg: '#000000' }, { len: 13, size: 10, fg: '#ffffff' }] }),
      ...sevHeaderCells(1), cell(1, S, '', {}),
      ...countCells(2, totals),
      cell(2, S, totals.reduce((a, b) => a + b, 0), { bg: TEAL, fg: '#ffffff', size: 21, bold: true, vAlign: 'MIDDLE' }),
      ...Array.from({ length: S }, (_, i) => cell(3, i, '', { bg: SPACER })), cell(3, S, '', {}),
    ],
    merges: [
      { r: 0, c: 0, rowSpan: 1, colSpan: S },
      { r: 0, c: S, rowSpan: 2, colSpan: 1 },
      { r: 2, c: S, rowSpan: 2, colSpan: 1 },
      { r: 3, c: 0, rowSpan: 1, colSpan: S },
    ],
    widths: [...Array.from({ length: S }, () => Math.floor(336 / S)), 116],
    rowHeightsPt: [23, 19, 22, 18],          // the reference's trHeight values, twips/20
  });
}
for (const site of sites) {
  if (multiSite) specs.push({
    rows: 1, cols: 1, rowHeightsPt: [32],
    cells: [cell(0, 0, site.name, { bg: BAND, fg: '#f3f3f3', size: 18, bold: true, vAlign: 'MIDDLE' })],
    merges: [], widths: [468],
  });
  for (const page of orderedPages(site)) specs.push({
    rows: 3, cols: S,
    cells: [
      cell(0, 0, multiSite ? `${page.name} [${site.name}]` : page.name, { bg: MODULE, size: 13, bold: true, vAlign: 'MIDDLE' }),
      ...Array.from({ length: S - 1 }, (_, i) => cell(0, i + 1, '', { bg: MODULE })),
      ...sevHeaderCells(1),
      ...countCells(2, countRow(page.issues || [])),
    ],
    merges: [{ r: 0, c: 0, rowSpan: 1, colSpan: S }],
    // The reference's module tables are NOT full-width: the .docx grid is 2100/2100/1500/1500
    // twips = 105/105/75/75 pt, 360pt total, left-aligned. Odd scales split the same way.
    widths: S === 4 ? [105, 105, 75, 75]
      : Array.from({ length: S }, (_, i) => (i < Math.ceil(S / 2) ? 105 : 75)),
    rowHeightsPt: [22, 20, 21],
  });
}

// ---- Resolve the TARGET document, run the three passes ------------------------------------
const dd = cfg.date.replace(/\//g, '.');
const TITLE = process.env.TR_TITLE || `${PROJECT}: Test report — ${dd}`;

async function ensureFolder(name, parentId) {
  const q = [`name = '${name.replace(/'/g, "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.folder'", 'trashed = false',
    parentId ? `'${parentId}' in parents` : "'root' in parents"];
  const r = await drive.files.list({ q: q.join(' and '), fields: 'files(id)', spaces: 'drive' });
  if (r.data.files.length) return r.data.files[0].id;
  const f = await drive.files.create({ requestBody: {
    name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : undefined }, fields: 'id' });
  return f.data.id;
}
const DRIVE_ROOT = process.env.DRIVE_ROOT_FOLDER || 'ClaudeProjects';
let parent = null;
for (const seg of [DRIVE_ROOT, PROJECT, 'QA Documentation', 'Test Reports']) parent = await ensureFolder(seg, parent);

// A same-titled doc in the folder is UPDATED IN PLACE, never trashed-and-recreated: a shared
// link must survive a rebuild (the Docs analogue of the Sheets fixed-gid rule). A new title
// (new edition date) still gets its own document.
const prior = await drive.files.list({
  q: `name = '${TITLE.replace(/'/g, "\\'")}' and '${parent}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.document'`,
  fields: 'files(id)', spaces: 'drive' });
// "Updated in place" is a promise nobody can verify by looking: a recreated doc is identical in
// the UI and every shared link to the old one is already dead. The ledger records this edition's
// documentId, keyed by its title, and refuses a rebuild that would land on a different document —
// before this tool trashes a stray or wipes a body.
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
const ledger = ledgerMod ? await import(`file://${ledgerMod}`) : null;
if (!ledger) warnings.push('link-ledger not found — the document\'s link stability was NOT checked (set QA_LINK_LEDGER).');
// Keyed by TITLE: a new edition date is a NEW document by design, and gets its own first sighting.
const guardDocLink = (id) => {
  if (!ledger) return;
  try {
    ledger.assertStableLink({ kind: 'doc', key: `test-report/${TITLE}`, id, title: TITLE });
  } catch (e) {
    if (e instanceof ledger.LinkLedgerError) refuse(`${e.message}\n  Nothing was written.`);
    throw e;
  }
};

let documentId;
if (prior.data.files.length) {
  documentId = prior.data.files[0].id;
  guardDocLink(documentId);                                 // before ANY mutation below
  for (const stray of prior.data.files.slice(1))            // duplicates from older runs
    await drive.files.update({ fileId: stray.id, requestBody: { trashed: true } });
  const cur = await docs.documents.get({ documentId });
  const wipe = [];
  const end = cur.data.body.content.at(-1).endIndex;
  if (end > 2) wipe.push({ deleteContentRange: { range: { startIndex: 1, endIndex: end - 1 } } });
  for (const hid of [cur.data.documentStyle?.defaultHeaderId, cur.data.documentStyle?.firstPageHeaderId])
    if (hid) wipe.push({ deleteHeader: { headerId: hid } });
  if (wipe.length) await docs.documents.batchUpdate({ documentId, requestBody: { requests: wipe } });
} else {
  const doc = await docs.documents.create({ requestBody: { title: TITLE } });
  documentId = doc.data.documentId;
  await drive.files.update({ fileId: documentId, addParents: parent, fields: 'id' });
  guardDocLink(documentId);                                 // first sighting of this edition
}
await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
// The reference's body starts ~115pt from the page top (its header pushes the text block
// down); mirroring it as the top margin keeps every page's vertical rhythm aligned.
await docs.documents.batchUpdate({ documentId, requestBody: { requests: [
  { updateDocumentStyle: { documentStyle: { marginTop: { magnitude: 115, unit: 'PT' } }, fields: 'marginTop' } }] } });

// Header with the company logo on every page (the reference has one). Opt-in via config
// logoUrl — a PUBLICLY fetchable image URL (the Docs backend downloads it server-side).
if (cfg.logoUrl) {
  const h = await docs.documents.batchUpdate({ documentId, requestBody: { requests: [
    { createHeader: { type: 'DEFAULT' } }] } });
  const headerId = h.data.replies[0].createHeader.headerId;
  // The reference title page carries NO logo — the header starts on page 2, so the first
  // page gets its own (empty, never-created) header via useFirstPageHeaderFooter.
  await docs.documents.batchUpdate({ documentId, requestBody: { requests: [
    { insertInlineImage: { location: { segmentId: headerId, index: 0 }, uri: cfg.logoUrl,
      objectSize: { width: { magnitude: 110, unit: 'PT' } } } },
    { updateDocumentStyle: { documentStyle: { useFirstPageHeaderFooter: true }, fields: 'useFirstPageHeaderFooter' } },
  ] } });
}
await docs.documents.batchUpdate({ documentId, requestBody: { requests:
  specs.map((s) => ({ insertTable: { endOfSegmentLocation: { segmentId: '' }, rows: s.rows, columns: s.cols } })) } });

const snap = await docs.documents.get({ documentId });
const tables = snap.data.body.content.filter((el) => el.table);
if (tables.length !== specs.length)
  die(`expected ${specs.length} tables in the created doc, found ${tables.length} — leaving the doc for inspection: https://docs.google.com/document/d/${documentId}`);

const fill = [];
for (let ti = specs.length - 1; ti >= 0; ti--) {
  const spec = specs[ti], el = tables[ti];
  const tStart = { index: el.startIndex };
  const rowsEl = el.table.tableRows;
  // 1. text (reverse cell order so earlier indices stay valid), with its char styles
  const withText = spec.cells.filter((c) => c.text !== '').sort((a, b) => (b.r - a.r) || (b.c - a.c));
  for (const c of withText) {
    const at = rowsEl[c.r].tableCells[c.c].content[0].startIndex;
    fill.push({ insertText: { location: { index: at }, text: c.text } });
    const range = { startIndex: at, endIndex: at + c.text.length };
    if (c.runs) {          // per-segment styling inside ONE cell (the two-line total label)
      let ofs = at;
      for (const run of c.runs) {
        fill.push({ updateTextStyle: { range: { startIndex: ofs, endIndex: ofs + run.len },
          textStyle: { fontSize: { magnitude: run.size, unit: 'PT' }, bold: !!c.bold, foregroundColor: hex(run.fg) },
          fields: 'fontSize,bold,foregroundColor' } });
        ofs += run.len;
      }
    } else {
      const ts = { fontSize: { magnitude: c.size || 10, unit: 'PT' } }, tf = ['fontSize'];
      if (c.fg) { ts.foregroundColor = hex(c.fg); tf.push('foregroundColor'); }
      if (c.bold) { ts.bold = true; tf.push('bold'); }
      fill.push({ updateTextStyle: { range, textStyle: ts, fields: tf.join(',') } });
    }
    fill.push({ updateParagraphStyle: { range, paragraphStyle: { alignment: 'CENTER' }, fields: 'alignment' } });
  }
  // 2. cell backgrounds + vertical alignment (reference table start — safe after inner inserts)
  for (const c of spec.cells) {
    const style = {}, f = [];
    if (c.bg) { style.backgroundColor = hex(c.bg); f.push('backgroundColor'); }
    style.contentAlignment = c.vAlign || 'MIDDLE'; f.push('contentAlignment');
    fill.push({ updateTableCellStyle: {
      tableRange: { tableCellLocation: { tableStartLocation: tStart, rowIndex: c.r, columnIndex: c.c }, rowSpan: 1, columnSpan: 1 },
      tableCellStyle: style, fields: f.join(',') } });
  }
  // 3. column widths
  spec.widths.forEach((w, i) => fill.push({ updateTableColumnProperties: {
    tableStartLocation: tStart, columnIndices: [i],
    tableColumnProperties: { widthType: 'FIXED_WIDTH', width: { magnitude: w, unit: 'PT' } },
    fields: 'widthType,width' } }));
  (spec.rowHeightsPt || []).forEach((h, ri) => fill.push({ updateTableRowStyle: {
    tableStartLocation: tStart, rowIndices: [ri],
    tableRowStyle: { minRowHeight: { magnitude: h, unit: 'PT' } }, fields: 'minRowHeight' } }));
  // 4. merges LAST for this table (they restructure it)
  for (const m of spec.merges) fill.push({ mergeTableCells: {
    tableRange: { tableCellLocation: { tableStartLocation: tStart, rowIndex: m.r, columnIndex: m.c },
      rowSpan: m.rowSpan, columnSpan: m.colSpan } } });
}
await docs.documents.batchUpdate({ documentId, requestBody: { requests: fill } });

const meta = await drive.files.get({ fileId: documentId, fields: 'webViewLink' });

for (const w of warnings) console.error(`tr-doc WARNING: ${w}`);
console.error('tr-doc note: the Docs API cannot insert a native Table of Contents — add one via Insert > Table of contents if the owner wants it.');
console.log(JSON.stringify({ documentId, docLink: meta.data.webViewLink,
  folderLink: `https://drive.google.com/drive/folders/${parent}`, warnings }, null, 2));
