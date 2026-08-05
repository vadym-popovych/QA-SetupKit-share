// tc.mjs — the Test-Cases harness. Zero dependencies for validate/index/gaps.
// Copy to <Project>/QA-Documentation/test-cases/tools/ and run from `test-cases/`:
//
//   node tools/tc.mjs                 # validate + index + gaps (the default: all three)
//   node tools/tc.mjs validate        # every case is schema-valid, or the suite is not a suite
//   node tools/tc.mjs index           # regenerate TEST_CASES.md (a PROJECTION — never edited by hand)
//   node tools/tc.mjs gaps            # what the strategy says needs cases, and has none
//   node tools/tc.mjs sheet           # build/refresh the executable Google-Sheets view (needs mcp-sheets)
//
// Why a tool at all: TEST_CASES_RULES says "coverage is claimable only via technique" and
// "the JSON is the source of truth; TEST_CASES.md is a projection". Both are promises, and a
// promise nothing checks is a wish. This checks them.
//
// The gaps command is the one that earns its keep: it reads the strategy and reports every unit
// at risk >= 6 with no case pointing at it. That number is the honest coverage claim — "24 cases
// written" is not.
//
// `sheet` env contract (no project data lives in this file):
//   PROJECT_NAME=<Project>            required — names the doc and its Drive folder
//   SHEET_NAME="<Project> — Test Cases"   optional — doc title (default: "<PROJECT_NAME> — Test Cases")
//   TC_TAB="Test Cases"               optional — tab title
//   TARGET_SSID=<spreadsheetId>       optional — write the tab INTO an existing doc instead of
//                                     creating one (the demo/validation path; real projects get
//                                     their own file)
//   TC_GID=<n>                        optional — fixed sheetId so shared #gid links survive a rebuild
//   DRIVE_ROOT_FOLDER=ClaudeProjects  optional — Drive root (never the Drive root folder itself)
//   DRIVE_CATEGORY=Test-Cases         optional — category folder under <Project>
//   MCP_SHEETS_DIR=<path>             optional — OAuth dir (auto-resolved by walking up otherwise)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Anchor to the CURRENT PROJECT, not to this file. When the project's tools/tc.mjs is a POINTER
// to the kit copy (the anti-drift convention), import.meta.url resolves into QA-SetupKit — and a
// tool that anchors to itself would then look for the project's cases inside the kit. Learned the
// hard way, the moment the first pointer was created.
const ROOT = [process.cwd(), path.resolve(HERE, '..')]
  .find((d) => fs.existsSync(path.join(d, 'cases'))) ?? process.cwd();
const CASES_DIR = path.join(ROOT, 'cases');
const cmd = process.argv[2] ?? 'all';

if (!fs.existsSync(CASES_DIR)) {
  console.error(`tc: ${CASES_DIR} not found — run me from <Project>/QA-Documentation/test-cases/ (tools/tc.mjs).`);
  process.exit(2);
}

const cases = fs.readdirSync(CASES_DIR).filter((f) => /^TC-\d+\.json$/.test(f)).sort()
  .map((f) => {
    try {
      return { file: f, ...JSON.parse(fs.readFileSync(path.join(CASES_DIR, f), 'utf8')) };
    } catch (e) {
      console.error(`tc: ${f} is not parseable JSON — ${e.message}`);
      process.exit(1);
    }
  });

if (!cases.length) {
  // An empty suite passing its checks is exactly the kind of green that means nothing.
  console.error('tc: no cases found — an empty suite is not a passing suite');
  process.exit(1);
}

// ── locate the schema validator (walk up; never an absolute path) ─────────────────────────
function findValidator() {
  if (process.env.QA_SCHEMAS_VALIDATOR) return process.env.QA_SCHEMAS_VALIDATOR;
  let dir = HERE;
  for (let i = 0; i < 10; i++) {
    for (const rel of [['QA-SetupKit', 'Rules-Guide', 'schemas', 'validate.mjs'], ['Rules-Guide', 'schemas', 'validate.mjs']]) {
      const p = path.join(dir, ...rel);
      if (fs.existsSync(p)) return p;
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

function validate() {
  const validator = findValidator();
  if (!validator) {
    console.error('tc: cannot find Rules-Guide/schemas/validate.mjs — set QA_SCHEMAS_VALIDATOR.');
    console.error('  An unvalidated case set is not a source of truth. Refusing to pretend otherwise.');
    process.exit(2);
  }
  let bad = 0;
  for (const c of cases) {
    const r = spawnSync(process.execPath, [validator, 'test-case', path.join(CASES_DIR, c.file)], { encoding: 'utf8' });
    if (r.status !== 0) { bad++; console.log(`  INVALID  ${c.file}\n${(r.stdout || r.stderr).trim().split('\n').map((l) => '           ' + l).join('\n')}`); }
  }
  console.log(`validate: ${cases.length - bad}/${cases.length} cases schema-valid`);
  return bad;
}

// ── strategy (shared by gaps + sheet) ─────────────────────────────────────────────────────
function loadStrategy() {
  const p = [
    path.resolve(ROOT, '../../Test-Strategy/strategy.json'),
    path.resolve(ROOT, '../../../Test-Strategy/strategy.json'),
  ].find(fs.existsSync);
  return p ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

// Band order: strategy.modules[] first, in declared order; any area NOT listed still renders
// (after the listed ones) — a case must never be swallowed by a silent "Other" bucket.
function groupByModule() {
  const strat = loadStrategy();
  const declared = strat?.modules ?? [];
  const byArea = new Map();
  for (const c of cases) {
    if (!byArea.has(c.area)) byArea.set(c.area, []);
    byArea.get(c.area).push(c);
  }
  const listed = declared.filter((m) => byArea.has(m));
  const unlisted = [...byArea.keys()].filter((a) => !declared.includes(a));
  if (unlisted.length && declared.length) {
    for (const a of unlisted) console.log(`  note: area "${a}" is not in strategy.json modules[] — rendered after the declared ones`);
  }
  return [...listed, ...unlisted].map((m) => [m, byArea.get(m)]);
}

// ── the projection ────────────────────────────────────────────────────────────────────────
function index() {
  const byArea = {};
  for (const c of cases) (byArea[c.area] ??= []).push(c);
  const techniques = {};
  for (const c of cases) techniques[c.technique ?? 'unstated'] = (techniques[c.technique ?? 'unstated'] ?? 0) + 1;
  const prio = {};
  for (const c of cases) prio[c.priority] = (prio[c.priority] ?? 0) + 1;
  const regression = cases.filter((c) => c.traceability?.bug);

  const L = [
    '# Test cases — index',
    '',
    '> **Generated by `tools/tc.mjs index` — do not edit by hand.** The `cases/*.json` files are',
    '> the source of truth; this file is a projection of them (TEST_CASES_RULES).',
    '',
    `**${cases.length} cases** · ` + Object.entries(prio).sort().map(([k, v]) => `${k}: ${v}`).join(' · '),
    '',
    '## Coverage claim — technique × count',
    '',
    'Coverage is claimable only via technique. "N cases written" is not a coverage claim.',
    '',
    '| Technique | Cases |',
    '|---|---|',
    ...Object.entries(techniques).sort((a, b) => b[1] - a[1]).map(([t, n]) => `| ${t} | ${n} |`),
    '',
    `## Regression core (bug-derived) — ${regression.length}`,
    '',
    regression.length ? '| Case | Guards | Cadence |\n|---|---|---|' : '_none yet_',
    ...regression.map((c) => `| ${c.id} | ${c.traceability.bug} | ${c.cadence ?? 'every-round'} |`),
    '',
    '## Cases by module',
    '',
    '| Module | Case | Title | Priority | Unit | Technique | Oracle |',
    '|---|---|---|---|---|---|---|',
    ...Object.keys(byArea).sort().flatMap((area) =>
      byArea[area].map((c) => `| ${area} | ${c.id} | ${c.title} | ${c.priority} | ${c.traceability?.strategyUnit ?? '—'} | ${c.technique ?? '—'} | ${c.oracle?.type ?? '—'} |`)),
    '',
  ];
  fs.writeFileSync(path.join(ROOT, 'TEST_CASES.md'), L.join('\n'));
  console.log(`index: TEST_CASES.md regenerated (${cases.length} cases, ${Object.keys(techniques).length} techniques)`);
}

// ── the check that actually finds things ──────────────────────────────────────────────────
function gaps() {
  const strat = loadStrategy();
  if (!strat) {
    console.log('gaps: no strategy.json found — cannot say what SHOULD have cases.');
    console.log('  (Without a strategy, a case set can only claim "we wrote some tests".)');
    return 0;
  }
  // The unit a case covers is traceability.strategyUnit — NOT `area` (that is the product module,
  // the Sheet band). A case with no unit is untraced: it cannot claim coverage of anything.
  const untraced = cases.filter((c) => !c.traceability?.strategyUnit);
  const covered = new Set(cases.map((c) => c.traceability?.strategyUnit).filter(Boolean));
  const risky = strat.riskMatrix.filter((u) => u.risk >= 6);
  const missing = risky.filter((u) => !covered.has(u.id));
  const known = new Set(strat.scope.in.map((u) => u.id));
  const orphans = [...covered].filter((a) => !known.has(a));

  console.log(`gaps: ${risky.length} units at risk >= 6 · ${risky.length - missing.length} have cases · ${missing.length} do not`);
  for (const u of missing.sort((a, b) => b.risk - a.risk)) {
    console.log(`  UNCOVERED  ${u.id} (risk ${u.risk}, ${u.depth})  ${u.fear}`);
  }
  for (const o of orphans) console.log(`  ORPHAN     case points at unit "${o}", which is not in the strategy scope`);
  for (const c of untraced) console.log(`  UNTRACED   ${c.id} declares no traceability.strategyUnit — it covers nothing the strategy asked for`);
  return missing.length + orphans.length + untraced.length;
}

// ── the executable view: one tab, one band per module ─────────────────────────────────────
// The JSONs stay the source of truth; this tab is the thing a human actually runs a round in,
// so it carries the ONE column the JSONs deliberately do not: the run Status.
//   Passed / Failed / Skipped / Blocked  —  Blocked ("could not run: environment") is not
//   Skipped ("will not run") and neither ever becomes Passed because the round ended.
async function sheet() {
  const PROJECT = process.env.PROJECT_NAME;
  if (!PROJECT) {
    console.error('tc sheet: PROJECT_NAME is required (it names the doc and its Drive folder).');
    console.error('  e.g.  PROJECT_NAME=Acme node tools/tc.mjs sheet');
    process.exit(2);
  }
  const DOC_NAME = process.env.SHEET_NAME || `${PROJECT} — Test Cases`;
  const TAB = process.env.TC_TAB || 'Test Cases';
  const GID = Number(process.env.TC_GID || 810001);
  const ROOT_FOLDER = process.env.DRIVE_ROOT_FOLDER || 'ClaudeProjects';
  const CATEGORY = process.env.DRIVE_CATEGORY || 'Test-Cases';
  const TARGET = process.env.TARGET_SSID;

  // ---- OAuth (mcp-sheets), resolved by walking up — never an absolute path ----
  const { createRequire } = await import('node:module');
  let mcpDir = process.env.MCP_SHEETS_DIR;
  if (!mcpDir) {
    let dir = HERE;
    for (let i = 0; i < 10 && !mcpDir; i++) {
      for (const rel of ['QA-SetupKit/MCP-configurations/mcp-sheets', 'MCP-configurations/mcp-sheets']) {
        if (fs.existsSync(path.join(dir, rel, 'package.json'))) mcpDir = path.join(dir, rel);
      }
      const up = path.dirname(dir); if (up === dir) break; dir = up;
    }
  }
  if (!mcpDir) {
    console.error('tc sheet: mcp-sheets not found — set MCP_SHEETS_DIR (QA-SetupKit/MCP-configurations/README.md).');
    process.exit(2);
  }
  const req = createRequire(path.join(mcpDir, 'package.json'));
  const { google } = req('googleapis');
  const c0 = JSON.parse(fs.readFileSync(path.join(mcpDir, 'credentials.json'), 'utf8'));
  const cred = c0.installed || c0.web;
  const token = JSON.parse(fs.readFileSync(path.join(mcpDir, 'token.json'), 'utf8'));
  const auth = new google.auth.OAuth2(cred.client_id, cred.client_secret, (cred.redirect_uris && cred.redirect_uris[0]) || 'http://localhost:3456/oauth2callback');
  auth.setCredentials(token);
  if (token.expiry_date && Date.now() > token.expiry_date - 60000) {
    const { credentials } = await auth.refreshAccessToken();
    fs.writeFileSync(path.join(mcpDir, 'token.json'), JSON.stringify(credentials));
    auth.setCredentials(credentials);
  }
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  // ---- the grid ----
  // Layout follows the owner's reference template (compact; the same Module-band / result-mirror
  // shape as checklist v5), 16 columns:
  //   A Priority · B Summary · C:D Preconditions · E:G Steps · H Expected result · I Status
  //   · J:M Comments · N spacer · O:P per-row result mirror + per-module counters
  // Technique / Oracle / Traceability are DELIBERATELY not columns here (owner's call: the shared
  // doc stays readable). They are not lost: they live in the case JSON and TEST_CASES.md, and each
  // Summary cell carries them as a cell NOTE, so a reader can always ask "why is this a case?".
  // The case columns (A..H) are written once; everything a ROUND records — status, comments and the
  // result mirror — is one SECTION, repeated to the right, one per round. Same convention as the
  // checklist's platform blocks: a new round never overwrites the last one's verdicts, it fills the
  // next block. Round 1 carries today's date; the empty ones are dated dd/mm/yyyy until they are run.
  const ROUNDS = Math.max(1, Number(process.env.TC_ROUNDS || 3));
  const BASE = 8;                                           // A..H — the case itself
  const SEC = 9;                                            // status · comments ×4 · spacer · mirror ×2 · spacer
  const NC = BASE + ROUNDS * SEC;
  const sec = (s) => {
    const b = BASE + s * SEC;
    return { status: b, cmt: b + 1, cmtEnd: b + 5, spacer: b + 5, mirror: b + 6, mirrorEnd: b + 8, tail: b + 8 };
  };
  const A1 = (i) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
  const STATUSES = ['Passed', 'Failed', 'Blocked', 'Skipped'];   // counter order, as the owner set it
  const PRIOS = ['High', 'Medium', 'Low'];
  const blank = (n) => Array(n).fill('');
  const row = (cells) => { const r = blank(NC); cells.forEach(([i, v]) => { r[i] = v; }); return r; };
  const today = new Date().toLocaleDateString('en-GB');     // dd/mm/yyyy, as in the reference's "Checked"
  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const caseRowIdx = new Map();   // TC-id → grid row index (used to carry a round's statuses over)
  const grid = [];
  const HEADER_ROWS = 6;    // title · 3 meta rows · a thin divider · the column headers
  const FIRST = HEADER_ROWS + 1;                            // first body row, 1-based (7)
  const LAST = 999;
  const stCol = (s) => A1(sec(s).status);
  const countStatus = (s, st) => `COUNTIF($${stCol(s)}$${FIRST}:$${stCol(s)}$${LAST},"${st}")`;

  // Same title convention as the checklist: the doc says WHEN it was last brought up to date, so a
  // reader never has to guess whether they are looking at a stale artefact.
  const r1 = [[0, `Test cases\nUp to date according to ${monthYear}`]];
  const r2 = [[0, 'Project:'], [1, PROJECT], [2, 'Cases counter by Priority'],
    [5, 'High'], [6, `=COUNTIF($A$${FIRST}:$A$${LAST},"High")`], [7, 'Total']];
  // The build the round was run against. Given explicitly (BUILD_VERSION) or read from a manifest
  // (PUBSPEC → "version: 1.2.3+45" → "Build 1.2.3 (45)"). If neither exists — a web app, typically —
  // the cell stays EMPTY. A test round pinned to a version nobody can verify is worse than one that
  // admits it doesn't know which build it saw.
  const buildVersion = () => {
    if (process.env.BUILD_VERSION) return process.env.BUILD_VERSION;
    const manifest = process.env.PUBSPEC;
    if (manifest && fs.existsSync(manifest)) {
      const m = fs.readFileSync(manifest, 'utf8').match(/^version:\s*([\d.]+)\+(\d+)/m);
      if (m) return `Build ${m[1]} (${m[2]})`;
    }
    return '';
  };
  const r3 = [[0, 'Latest version:'], [1, buildVersion()],
    [5, 'Medium'], [6, `=COUNTIF($A$${FIRST}:$A$${LAST},"Medium")`], [7, '=G2+G3+G4']];
  const r4 = [[0, 'Responsible:'], [1, process.env.RESPONSIBLE || 'QA'],
    [5, 'Low'], [6, `=COUNTIF($A$${FIRST}:$A$${LAST},"Low")`]];
  const r5 = [[0, 'Priority'], [1, 'Summary'], [2, 'Preconditions'], [4, 'Steps'], [7, 'Expected result']];
  for (let s = 0; s < ROUNDS; s++) {
    const S = sec(s);
    r1.push([S.cmt, 'Available statuses / summary counters'], [S.mirror, `Checked\n${s === 0 ? today : 'dd/mm/yyyy'}`]);
    r2.push([S.status, 'Check status'], [S.mirror, 'Total / module counter:'],
      ...STATUSES.map((st, i) => [S.cmt + i, st]));
    r3.push(...STATUSES.map((st, i) => [S.cmt + i, `=${countStatus(s, st)}`]));
    // "Not run cases" is the number that keeps the round honest (a case nobody touched is not a Pass).
    // It is a subtraction of the four statuses — never COUNTA of the status column, because the band
    // rows carry a formula there and COUNTA would count them as "run", under-reporting what is owed.
    r4.push([S.cmt, `="Not run cases: "&(COUNTA($B$${FIRST}:$B$${LAST})-${STATUSES.map((st) => countStatus(s, st)).join('-')})`],
      [S.mirror, 'Passed'], [S.mirror + 1, 'Failed']);
    r5.push([S.cmt, 'Comments']);
  }
  grid.push(row(r1));
  grid.push(row(r2));
  grid.push(row(r3));
  grid.push(row(r4));
  grid.push(row([]));      // the divider row: a thin gray rule between the meta block and the table
  grid.push(row(r5));

  const bands = [];        // {row0, firstCase, lastCase}
  let caseCount = 0;
  const notes = [];        // [rowIndex0, note] — technique/oracle/traceability, on the Summary cell
  for (const [mod, inMod] of groupByModule()) {
    const bandRow0 = grid.length;                            // band = 2 merged rows (checklist v5 shape)
    grid.push(row([[0, mod]]));
    grid.push(row([]));
    const first1 = grid.length + 1;                          // 1-based row of the first case in this band
    for (const c of inMod) {
      const rowNo = grid.length + 1;
      caseRowIdx.set(c.id, grid.length);
      const cells = [
        [0, c.priority],
        [1, `${c.id} — ${c.title}`],
        [2, (c.preconditions || []).join('\n')],
        [4, (c.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')],
        [7, c.expected],
      ];
      for (let s = 0; s < ROUNDS; s++) {   // each round mirrors its OWN status column — empty until run
        cells.push([sec(s).mirror, `=IF(${stCol(s)}${rowNo}="","",${stCol(s)}${rowNo})`]);
      }
      grid.push(row(cells));
      notes.push([grid.length - 1, [
        `technique: ${c.technique || '—'}`,
        `oracle: ${c.oracle?.type || '—'}${c.oracle?.source ? ' — ' + c.oracle.source : ''}`,
        `traceability: ${[c.traceability?.strategyUnit && `unit ${c.traceability.strategyUnit}`,
          c.traceability?.risk != null && `risk ${c.traceability.risk}`,
          c.traceability?.bug, c.traceability?.endpoint].filter(Boolean).join(' · ') || '—'}`,
        `lifecycle: ${c.status || 'draft'}`,
      ].join('\n')]);
      caseCount++;
    }
    const last1 = grid.length;                               // 1-based row of the last case in this band
    for (let s = 0; s < ROUNDS; s++) {                       // per round: the "unresolved" flag + module counters
      const S = sec(s), col = stCol(s);
      // the mirror repeats the module title (a formula, not a copy — rename the band, both follow)
      grid[bandRow0][S.mirror] = `=$A${bandRow0 + 1}`;
      grid[bandRow0][S.status] = `=IF(COUNTIF(${col}${first1}:${col}${last1},"Failed")>0,"Not all issues are resolved!","")`;
      grid[bandRow0 + 1][S.mirror] = `=COUNTIF(${col}${first1}:${col}${last1},"Passed")`;
      grid[bandRow0 + 1][S.mirror + 1] = `=COUNTIF(${col}${first1}:${col}${last1},"Failed")`;
    }
    bands.push({ row0: bandRow0, first1, last1 });
  }
  const N = grid.length;
  for (let s = 0; s < ROUNDS; s++) {                         // top-of-sheet totals = sum of the module counters
    const S = sec(s), P = A1(S.mirror), Fa = A1(S.mirror + 1);
    grid[HEADER_ROWS - 1][S.mirror] = bands.length ? '=' + bands.map((b) => `${P}${b.row0 + 2}`).join('+') : 0;
    grid[HEADER_ROWS - 1][S.mirror + 1] = bands.length ? '=' + bands.map((b) => `${Fa}${b.row0 + 2}`).join('+') : 0;
  }

  // ---- where it lives ----
  const findFolder = async (name, parentId) => {
    const q = [`name = '${name.replace(/'/g, "\\'")}'`, "mimeType = 'application/vnd.google-apps.folder'", 'trashed = false',
      parentId ? `'${parentId}' in parents` : "'root' in parents"].join(' and ');
    const r = await drive.files.list({ q, fields: 'files(id)', spaces: 'drive' });
    return r.data.files[0]?.id || null;
  };
  const ensureFolder = async (name, parentId) => (await findFolder(name, parentId))
    || (await drive.files.create({ requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : undefined }, fields: 'id' })).data.id;

  // Re-runs must be IDEMPOTENT in the strong sense: same document id, same tab gid. Trashing the
  // file and creating a fresh one (the first version of this tool did) mints a new id every run —
  // every link anyone shared to the previous one dies. So: reuse the file if it exists, and always
  // rebuild the TAB at a fixed gid.
  let ssId;
  if (TARGET) {
    ssId = TARGET;                                   // demo/validation path: a tab inside an existing doc
  } else {
    const rootId = await findFolder(ROOT_FOLDER, null);
    if (!rootId) {
      console.error(`tc sheet: Drive folder "${ROOT_FOLDER}" not found at the top level of the account.`);
      console.error('  Create it once (or set DRIVE_ROOT_FOLDER) — writing QA docs to the Drive root collides with the owner\'s own folders.');
      process.exit(2);
    }
    const catId = await ensureFolder(CATEGORY, await ensureFolder(PROJECT, rootId));
    const prior = await drive.files.list({ q: `name = '${DOC_NAME.replace(/'/g, "\\'")}' and '${catId}' in parents and trashed = false`, fields: 'files(id)', spaces: 'drive' });
    ssId = prior.data.files[0]?.id
      || (await drive.files.create({ requestBody: { name: DOC_NAME, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [catId] }, fields: 'id' })).data.id;
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId: ssId });
  const url = `https://docs.google.com/spreadsheets/d/${ssId}/edit`;
  const gid = GID;
  const setup = [];
  if (meta.data.properties.locale !== 'en_US') {
    // Formulas are written with ',' separators; a non-en_US locale turns every one into #ERROR!.
    setup.push({ updateSpreadsheetProperties: { properties: { locale: 'en_US' }, fields: 'locale' } });
    console.log('  note: document locale set to en_US (comma-separated formulas would otherwise break)');
  }
  const old = meta.data.sheets.find((s) => s.properties.title === TAB || s.properties.sheetId === GID);

  // A rebuild must NEVER wipe a round. Status and Comments are typed into the Sheet — they exist
  // nowhere else — so read them back and re-attach them by case id before the tab is cleared.
  // Without this, adding a single case to the suite silently erases everything the team ran.
  let carriedCount = 0;
  if (old) {
    try {
      const prev = await sheets.spreadsheets.values.get({ spreadsheetId: ssId, range: `'${old.properties.title}'!A1:${A1(NC + SEC)}999` });
      for (const r of prev.data.values || []) {
        const id = String(r[1] || '').match(/^(TC-\d+)/)?.[1];
        const idx = id == null ? null : caseRowIdx.get(id);
        if (idx == null) continue;
        for (let s = 0; s < ROUNDS; s++) {   // every round's verdicts survive, not just the latest one
          const S = sec(s);
          const status = r[S.status] || '';
          const comment = r[S.cmt] || '';
          if (status) { grid[idx][S.status] = status; carriedCount++; }
          if (comment) { grid[idx][S.cmt] = comment; carriedCount++; }
        }
      }
    } catch (e) {
      // Never swallow this: a silent failure here means a round's verdicts vanish on the next
      // rebuild and nobody finds out until they look for them.
      console.error(`tc sheet: WARNING — could not read the previous tab, so no statuses were carried over (${e.message})`);
    }
  }

  if (old && old.properties.sheetId === GID) {
    // The tab is already at our gid — CLEAR and reuse it. (Deleting and re-adding the same gid is
    // what a naive rebuild does, and it fails outright when this is the document's only sheet.)
    const g = old.properties.gridProperties || {};
    const whole = { sheetId: GID, startRowIndex: 0, endRowIndex: g.rowCount || 1000, startColumnIndex: 0, endColumnIndex: g.columnCount || 26 };
    setup.push({ unmergeCells: { range: whole } });
    setup.push({ updateCells: { range: whole, fields: '*' } });                    // values, formats, notes, validation
    for (let i = (old.conditionalFormats || []).length - 1; i >= 0; i--) {
      setup.push({ deleteConditionalFormatRule: { sheetId: GID, index: i } });     // descending — indexes shift
    }
    // groups survive an updateCells wipe — drop them explicitly, or every rebuild nests another layer
    for (const grp of old.rowGroups || []) setup.push({ deleteDimensionGroup: { range: { sheetId: GID, dimension: 'ROWS', startIndex: grp.range.startIndex, endIndex: grp.range.endIndex } } });
    for (const grp of old.columnGroups || []) setup.push({ deleteDimensionGroup: { range: { sheetId: GID, dimension: 'COLUMNS', startIndex: grp.range.startIndex, endIndex: grp.range.endIndex } } });
    setup.push({ updateSheetProperties: { properties: { sheetId: GID, title: TAB, gridProperties: { frozenRowCount: HEADER_ROWS, frozenColumnCount: BASE, columnCount: Math.max(g.columnCount || 26, NC + 1), rowCount: Math.max(g.rowCount || 1000, N + 50) } }, fields: 'title,gridProperties(frozenRowCount,frozenColumnCount,columnCount,rowCount)' } });
  } else {
    if (old) setup.push({ deleteSheet: { sheetId: old.properties.sheetId } });     // same title, wrong gid
    // Freeze the case block (A..H) as well as the header: scrolling right into round 3 must never
    // leave you looking at a status column with no idea which case it belongs to.
    setup.push({ addSheet: { properties: { sheetId: GID, title: TAB, gridProperties: { frozenRowCount: HEADER_ROWS, frozenColumnCount: BASE, columnCount: NC + 1, rowCount: Math.max(1000, N + 50) } } } });
    if (meta.data.sheets.length === 1 && !old) setup.push({ deleteSheet: { sheetId: meta.data.sheets[0].properties.sheetId } });  // the placeholder of a fresh doc
  }
  // The comment above promises "same document id, same tab gid" — this is what enforces it. The
  // team runs rounds against `…/edit#gid=<TC_GID>`; a rebuild that lands elsewhere kills that link
  // and looks, in the UI, exactly like an update. Refuses BEFORE the first mutating request.
  const ledgerMod = process.env.QA_LINK_LEDGER || (() => {
    let dir = HERE;
    for (let i = 0; i < 12; i++) {
      for (const rel of ['QA-SetupKit/Rules-Guide/link-ledger/link-ledger.mjs', 'Rules-Guide/link-ledger/link-ledger.mjs']) {
        if (fs.existsSync(path.join(dir, rel))) return path.join(dir, rel);
      }
      const up = path.dirname(dir); if (up === dir) break; dir = up;
    }
    return null;
  })();
  if (ledgerMod) {
    const { assertStableLink, LinkLedgerError } = await import(`file://${ledgerMod}`);
    try {
      assertStableLink({ kind: 'sheet-tab', key: 'test-cases/tab', id: ssId, gid: GID, title: TAB });
    } catch (e) {
      if (e instanceof LinkLedgerError) { console.error(`tc sheet: ${e.message}\n  Nothing was written.`); process.exit(1); }
      throw e;
    }
  } else {
    console.log('  note: link-ledger not found — the tab\'s link stability was NOT checked (set QA_LINK_LEDGER).');
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: ssId, requestBody: { requests: setup } });

  await sheets.spreadsheets.values.update({
    spreadsheetId: ssId, range: `'${TAB}'!A1`, valueInputOption: 'USER_ENTERED', requestBody: { values: grid },
  });

  // ---- palette + type scale ----
  // Reference template for the frame (title/meta/counters/headers), the owner's own edits for the
  // status block (4 counters, purple Blocked), and the CHECKLIST's colour for the band flag — the
  // same "Not all issues are resolved!" check must not look like two different things in two docs.
  const rgb = (hex) => ({ red: parseInt(hex.slice(1, 3), 16) / 255, green: parseInt(hex.slice(3, 5), 16) / 255, blue: parseInt(hex.slice(5, 7), 16) / 255 });
  const C = {
    tealDark: rgb('#134f5c'),   // title band + the meta rows
    tealMid: rgb('#146c8b'),    // section labels ("Cases counter by Priority", "Total")
    tealNotRun: rgb('#45818e'), // "Not run cases: N"
    steel: rgb('#699ebf'),      // "Check status" header
    blue: rgb('#3d85c6'),       // "Total / module counter"
    grayHdr: rgb('#d9d9d9'),    // column headers, module bands, Skipped chip
    grayLite: rgb('#efefef'),   // priority + status + comments cells
    grayLbl: rgb('#b7b7b7'),    // Skipped label
    grayBand: rgb('#cccccc'),   // band name mirror
    grayMirror: rgb('#e5e5e5'), // result mirror, nothing run yet
    greenLbl: rgb('#93c47d'), greenMid: rgb('#b6d7a8'), greenPale: rgb('#d9ead3'),
    greenTxt: rgb('#38761d'), greenTxtDark: rgb('#274e13'),
    redLbl: rgb('#ea6a6a'), redPale: rgb('#f4cccc'), redTxt: rgb('#d31414'), redTxtDark: rgb('#990000'),
    // Blocked wears the owner's purple: #8e7cc3 with dark #351c75 text — the same shade as its
    // counter, so the chip and the number that counts it read as one thing.
    purpleLbl: rgb('#674ea7'), purple: rgb('#8e7cc3'), purpleChip: rgb('#8e7cc3'), purpleTxt: rgb('#351c75'),
    flagTxt: rgb('#efefef'),                                  // module flag text (fires teal, see below)
    orange: rgb('#f6b26b'), orangeChip: rgb('#f9cb9c'), orangeTxt: rgb('#783f04'),   // High: counter · chip
    blueLite: rgb('#a4c2f4'),                                 // Medium (reference's counter colour)
    white: rgb('#ffffff'), black: rgb('#000000'), silver: rgb('#d9d9d9'),
  };
  const widths = [120, 260, 77, 124, 167, 87, 65, 200,                       // A is 120 so "Latest version:" fits on one line

    ...Array.from({ length: ROUNDS }, () => [180, 100, 100, 100, 100, 21, 69, 65, 21]).flat()];  // one per round
  const rng = (r0, r1, cA, cB) => ({ sheetId: gid, startRowIndex: r0, endRowIndex: r1, startColumnIndex: cA, endColumnIndex: cB });
  const cf = (ranges, text, format) => ({ addConditionalFormatRule: { rule: { ranges, booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: text }] }, format } }, index: 0 } });
  const merge = (r0, r1, cA, cB) => ({ mergeCells: { range: rng(r0, r1, cA, cB), mergeType: 'MERGE_ALL' } });
  const line = { style: 'SOLID', color: C.black };
  const boxed = (r0, r1, cA, cB) => ({ updateBorders: { range: rng(r0, r1, cA, cB), top: line, bottom: line, left: line, right: line, innerHorizontal: line, innerVertical: line } });
  const fmt = (r0, r1, cA, cB, f, fields) => ({ repeatCell: { range: rng(r0, r1, cA, cB), cell: { userEnteredFormat: f }, fields: `userEnteredFormat(${fields})` } });

  const F = 'backgroundColor,textFormat,verticalAlignment,horizontalAlignment,wrapStrategy';
  const cell = (bg, fg, bold, size, halign) => ({
    backgroundColor: bg, textFormat: { foregroundColor: fg, bold, fontSize: size },
    verticalAlignment: 'MIDDLE', horizontalAlignment: halign || 'LEFT', wrapStrategy: 'WRAP',
  });
  const reqs = [
    ...widths.map((w, i) => ({ updateDimensionProperties: { range: { sheetId: gid, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: w }, fields: 'pixelSize' } })),
    // the case columns (A..H) — written once, shared by every round
    merge(0, 1, 0, 8),
    fmt(0, 1, 0, NC, cell(C.tealDark, C.white, true, 13), F),
    fmt(0, 1, 0, 8, cell(C.tealDark, C.grayLite, true, 13, 'CENTER'), F),   // title
    merge(1, 4, 2, 5), merge(2, 4, 7, 8),
    fmt(1, 4, 0, 2, cell(C.tealDark, C.silver, true, 11), F),           // Project / Release / Responsible
    fmt(1, 4, 2, 5, cell(C.tealMid, C.white, true, 13), F),             // "Cases counter by Priority"
    fmt(1, 2, 5, 7, cell(C.orange, C.black, true, 12), F),              // High label + count
    fmt(2, 3, 5, 7, cell(C.blueLite, C.black, true, 12), F),            // Medium
    fmt(3, 4, 5, 7, cell(C.greenPale, C.black, true, 12), F),           // Low
    fmt(1, 4, 7, 8, cell(C.tealMid, C.white, true, 13, 'CENTER'), F),   // Total (label + value)
    merge(4, 5, 0, 8),                                                  // the divider row
    fmt(4, 5, 0, NC, cell(C.grayHdr, C.black, false, 10), F),
    { updateDimensionProperties: { range: { sheetId: gid, dimension: 'ROWS', startIndex: 4, endIndex: 5 }, properties: { pixelSize: 15 }, fields: 'pixelSize' } },
    merge(5, 6, 2, 4), merge(5, 6, 4, 7),
    fmt(5, 6, 0, 8, cell(C.tealNotRun, C.black, true, 16), F),          // column headers
    boxed(1, 4, 0, 8),                                                  // the meta/priority block is gridded
    fmt(HEADER_ROWS, N, 0, NC, cell(C.white, C.black, false, 10), F),   // body: wrap + vertical middle
    fmt(HEADER_ROWS, N, 0, 1, cell(C.grayLite, C.black, true, 12, 'CENTER'), F),    // Priority (chips from CF)
  ];

  // one round-section per pass — status · comments ×4 · spacer · mirror ×2 · spacer
  for (let s = 0; s < ROUNDS; s++) {
    const S = sec(s);
    reqs.push(
      merge(0, 1, S.cmt, S.cmt + 4), merge(0, 1, S.mirror, S.mirror + 2),
      fmt(0, 1, S.mirror, S.mirror + 2, cell(C.tealDark, C.white, true, 12, 'CENTER'), F),
      merge(1, 6, S.status, S.status + 1),                              // "Check status" — down to the header row
      fmt(1, 6, S.status, S.status + 1, cell(C.steel, C.black, true, 11, 'CENTER'), F),
      fmt(1, 2, S.cmt, S.cmt + 1, cell(C.greenLbl, C.black, true, 12, 'CENTER'), F),          // status labels
      fmt(1, 2, S.cmt + 1, S.cmt + 2, cell(C.redLbl, C.black, true, 12, 'CENTER'), F),
      fmt(1, 2, S.cmt + 2, S.cmt + 3, cell(C.purpleLbl, C.grayLite, true, 12, 'CENTER'), F),
      fmt(1, 2, S.cmt + 3, S.cmt + 4, cell(C.grayLbl, C.black, true, 12, 'CENTER'), F),
      fmt(2, 3, S.cmt, S.cmt + 1, cell(C.greenMid, C.black, true, 12, 'CENTER'), F),   // …their counts
      fmt(2, 3, S.cmt + 1, S.cmt + 2, cell(C.redPale, C.black, true, 12, 'CENTER'), F),
      fmt(2, 3, S.cmt + 2, S.cmt + 3, cell(C.purple, C.grayLite, true, 12, 'CENTER'), F),
      fmt(2, 3, S.cmt + 3, S.cmt + 4, cell(C.grayHdr, C.black, true, 12, 'CENTER'), F),
      merge(3, 5, S.cmt, S.cmt + 4),                                                   // "Not run cases: N" — over the divider
      fmt(3, 5, S.cmt, S.cmt + 4, cell(C.tealNotRun, C.black, true, 12, 'CENTER'), F),
      merge(1, 3, S.mirror, S.mirror + 2),
      fmt(1, 3, S.mirror, S.mirror + 2, cell(C.blue, C.black, true, 10, 'CENTER'), F), // "Total / module counter:"
      merge(3, 5, S.mirror, S.mirror + 1), merge(3, 5, S.mirror + 1, S.mirror + 2),    // Passed / Failed labels
      fmt(3, 5, S.mirror, S.mirror + 1, cell(C.greenMid, C.greenTxtDark, true, 11, 'CENTER'), F),
      fmt(3, 5, S.mirror + 1, S.mirror + 2, cell(C.redPale, C.redTxtDark, true, 11, 'CENTER'), F),
      fmt(5, 6, S.mirror, S.mirror + 1, cell(C.greenMid, C.greenTxtDark, true, 10, 'CENTER'), F),   // …their totals
      fmt(5, 6, S.mirror + 1, S.mirror + 2, cell(C.redPale, C.redTxtDark, true, 10, 'CENTER'), F),
      boxed(2, 3, S.cmt, S.cmt + 4),                                                  // the status counters are gridded
      merge(5, 6, S.cmt, S.cmt + 4),
      fmt(5, 6, S.cmt, S.cmt + 4, cell(C.grayHdr, C.black, true, 14, 'CENTER'), F),   // "Comments"
      fmt(0, N, S.spacer, S.spacer + 1, cell(C.grayHdr, C.black, false, 10), F),      // spacers
      fmt(0, N, S.tail, S.tail + 1, cell(C.grayHdr, C.black, false, 10), F),
      fmt(HEADER_ROWS, N, S.status, S.status + 1, cell(C.grayLite, C.black, true, 12, 'CENTER'), F),
      fmt(HEADER_ROWS, N, S.cmt, S.cmt + 4, cell(C.grayLite, C.black, false, 10), F),
      fmt(HEADER_ROWS, N, S.mirror, S.mirror + 2, cell(C.grayMirror, C.black, true, 12, 'CENTER'), F),
      // the round's own collapsible group: status + comments fold away, the result mirror stays
      { addDimensionGroup: { range: { sheetId: gid, dimension: 'COLUMNS', startIndex: S.status, endIndex: S.spacer + 1 } } },
    );
  }
  reqs.push({ updateSheetProperties: { properties: { sheetId: gid, gridProperties: { columnGroupControlAfter: true } }, fields: 'gridProperties.columnGroupControlAfter' } });

  // Dropdowns go on CASE rows only, never on a band row: a band is a heading, and a status you can
  // set on a heading is a status that means nothing.
  const dv = (r0, r1, cA, cB, values) => ({ setDataValidation: { range: rng(r0, r1, cA, cB), rule: { condition: { type: 'ONE_OF_LIST', values: values.map((v) => ({ userEnteredValue: v })) }, strict: false, showCustomUi: true } } });
  for (const b of bands) {
    reqs.push(dv(b.first1 - 1, b.last1, 0, 1, PRIOS));
    for (let s = 0; s < ROUNDS; s++) reqs.push(dv(b.first1 - 1, b.last1, sec(s).status, sec(s).status + 1, STATUSES));
    // one collapsible row group per module — fold a module away once it is green (checklist convention)
    reqs.push({ addDimensionGroup: { range: { sheetId: gid, dimension: 'ROWS', startIndex: b.first1 - 1, endIndex: b.last1 } } });
  }

  for (const b of bands) {
    const r0 = b.row0;                                            // band = 2 merged rows
    reqs.push(merge(r0, r0 + 2, 0, 8));
    reqs.push(fmt(r0, r0 + 2, 0, NC, cell(C.grayHdr, C.black, true, 15), F));                        // module name
    for (let s = 0; s < ROUNDS; s++) {
      const S = sec(s);
      reqs.push(merge(r0, r0 + 2, S.status, S.status + 1), merge(r0, r0 + 2, S.cmt, S.cmt + 4), merge(r0, r0 + 1, S.mirror, S.mirror + 2));
      // The band's status cell stays neutral while the module is clean; it turns teal the moment the
      // module has a Failed row (the CF below), so "this module still owes work" is visible at a glance.
      reqs.push(fmt(r0, r0 + 2, S.status, S.status + 1, cell(C.grayHdr, C.black, true, 10, 'CENTER'), F));
      // the mirror of the module name inherits the band's own look, so it reads as the same heading
      reqs.push(fmt(r0, r0 + 1, S.mirror, S.mirror + 2, cell(C.grayHdr, C.black, true, 11, 'CENTER'), F));
      reqs.push(fmt(r0 + 1, r0 + 2, S.mirror, S.mirror + 1, cell(C.greenMid, C.greenTxtDark, true, 10, 'CENTER'), F));
      reqs.push(fmt(r0 + 1, r0 + 2, S.mirror + 1, S.mirror + 2, cell(C.redPale, C.redTxtDark, true, 10, 'CENTER'), F));
    }
    // case rows of this band: merged Preconditions (C:D), Steps (E:G) + per round Comments and mirror
    for (let r = b.first1 - 1; r <= b.last1 - 1; r++) {
      reqs.push(merge(r, r + 1, 2, 4), merge(r, r + 1, 4, 7));
      for (let s = 0; s < ROUNDS; s++) reqs.push(merge(r, r + 1, sec(s).cmt, sec(s).cmt + 4), merge(r, r + 1, sec(s).mirror, sec(s).mirror + 2));
    }
  }

  // Technique / oracle / traceability ride along as a cell NOTE on the Summary — not a column
  // (owner's call: keep the shared doc compact), but never dropped: a case must always be able to
  // say which technique derived it and which oracle decides it.
  for (const [r, note] of notes) {
    reqs.push({ repeatCell: { range: rng(r, r + 1, 1, 2), cell: { note }, fields: 'note' } });
  }

  // Priority chips take the reference's own counter colours (G2:G4, next to the High/Medium/Low
  // labels) — so a row's priority reads the same as the number that counts it.
  const prio = [rng(HEADER_ROWS, N, 0, 1)];
  reqs.push(cf(prio, 'High', { backgroundColor: C.orangeChip, textFormat: { foregroundColor: C.orangeTxt, bold: true } }));
  reqs.push(cf(prio, 'Medium', { backgroundColor: C.blueLite, textFormat: { bold: true } }));
  reqs.push(cf(prio, 'Low', { backgroundColor: C.greenPale, textFormat: { bold: true } }));
  // Status chips (column I + the O:P mirror), in the owner's colours — Blocked is purple, distinct
  // from Skipped's gray: "could not run, still owed" must not look like "will not run".
  const status = [];
  for (let s = 0; s < ROUNDS; s++) {
    status.push(rng(HEADER_ROWS, N, sec(s).status, sec(s).status + 1), rng(HEADER_ROWS, N, sec(s).mirror, sec(s).mirror + 2));
  }
  reqs.push(cf(status, 'Passed', { backgroundColor: C.greenPale, textFormat: { foregroundColor: C.greenTxt, bold: true } }));
  reqs.push(cf(status, 'Failed', { backgroundColor: C.redPale, textFormat: { foregroundColor: C.redTxt, bold: true } }));
  reqs.push(cf(status, 'Blocked', { backgroundColor: C.purpleChip, textFormat: { foregroundColor: C.purpleTxt, bold: true } }));
  reqs.push(cf(status, 'Skipped', { backgroundColor: C.grayHdr, textFormat: { bold: true } }));
  // When a module's flag formula fires ("Not all issues are resolved!"), the cell goes teal —
  // the reference's own colour for exactly this check.
  const flagRanges = [];
  for (const b of bands) for (let s = 0; s < ROUNDS; s++) flagRanges.push(rng(b.row0, b.row0 + 2, sec(s).status, sec(s).status + 1));
  reqs.push(cf(flagRanges, 'Not all issues are resolved!',
    { backgroundColor: C.tealMid, textFormat: { foregroundColor: C.grayLite, bold: true } }));
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: ssId, requestBody: { requests: reqs } });

  console.log(`sheet: ${caseCount} cases in ${bands.length} module bands · tab "${TAB}"`
    + (carriedCount ? ` · carried over ${carriedCount} status/comment cell${carriedCount === 1 ? '' : 's'} from the previous build` : ''));
  console.log(`  ${url}#gid=${gid}`);
  return 0;
}

let bad = 0;
if (cmd === 'validate' || cmd === 'all') bad += validate();
if (cmd === 'index' || cmd === 'all') index();
if (cmd === 'gaps' || cmd === 'all') gaps();          // gaps are REPORTED, not failed: an uncovered
                                                      // unit is a decision for the owner, not a broken file
if (cmd === 'sheet') {
  // A Sheet built from cases that do not validate is a tidy-looking lie. Validate first, always.
  if (validate()) {
    console.error('tc sheet: refusing to publish a suite that is not schema-valid — fix the cases first.');
    process.exit(1);
  }
  await sheet();
}
if (!['validate', 'index', 'gaps', 'sheet', 'all'].includes(cmd)) {
  console.error(`tc: unknown command "${cmd}" — use validate | index | gaps | sheet (default: all)`);
  process.exit(2);
}
process.exit(bad ? 1 : 0);
