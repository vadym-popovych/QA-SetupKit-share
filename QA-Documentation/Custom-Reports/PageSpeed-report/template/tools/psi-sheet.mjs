// psi-sheet.mjs — build the PageSpeed report tab from pages.json + rounds/*.json.
//
// The rounds are the source of truth; the tab is a projection of them. Nothing here invents a
// number: every score, run and metric comes from a round JSON that psi-run.mjs collected.
//
//   node tools/psi-sheet.mjs --help
//   node tools/psi-sheet.mjs --dry-run          # validate + build + print the batchUpdate plan. No Google, no writes.
//   node tools/psi-sheet.mjs --dry-run --plan-json   # the same plan as JSON (diff it, assert on it)
//   PROJECT_NAME=Acme node tools/psi-sheet.mjs  # publish
//
// Env contract (no project data lives in this file):
//   PROJECT_NAME=<Project>        required to publish — names the doc and its Drive folder
//   PAGES=./pages.json            the inventory: sections → pages. It sets the ORDER of the tab.
//   ROUNDS_DIR=./rounds           one JSON per round; the blocks are laid out by round.date
//   PS_TAB="PageSpeed report"     tab title
//   PS_GID=820001                 fixed sheetId, so shared #gid= links survive a rebuild
//   TARGET_SSID=<spreadsheetId>   write the tab INTO an existing doc (the demo/validation path)
//   SHEET_NAME="<Project> — PageSpeed Insights Results"   doc title when the tool creates the file
//   DRIVE_ROOT_FOLDER=ClaudeProjects · DRIVE_CATEGORY=Performance   Drive placement, never the root
//   MCP_SHEETS_DIR=<path>         OAuth dir (auto-resolved by walking up to the nearest .mcp.json)
//   QA_SCHEMAS_VALIDATOR=<path>   validate.mjs override (auto-resolved the same way)
//   PS_FUTURE_ROUNDS=N            append N EMPTY, ready-to-fill blocks to the right (header
//                                 "Points from dd/mm/yyyy"), like the reference kept blank dated columns
//                                 ahead of time. They hold no data; when a round is collected, drop N by one.
//   PS_ALLOW_DROP=1               permit removing a round block that is on the tab but has no JSON
//   PS_ALLOW_ADOPT=1              permit REPLACING a tab this tool did not write (one with no
//                                 `round:` header notes — e.g. a tab a human maintains by hand).
//                                 Without it, such a tab is a REFUSAL: rebuilding it would destroy a
//                                 document the tool cannot read, and the comment carry-over — which
//                                 keys off those notes — would have nothing to carry.
//
// It refuses to publish rather than publish something misleading. The refusals are not paranoia:
// the pagespeed-round schema deliberately cannot express its own honesty contract (the kit's
// validator subset has no conditional keywords), so the checks it cannot make are made HERE.
// See SHEET_TEMPLATE.md § "What the generator refuses to do".

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const PLAN_JSON = process.argv.includes('--plan-json');

if (process.argv.includes('--help')) {
  console.log('psi-sheet — build the PageSpeed report tab from pages.json + rounds/*.json. Flags: --dry-run (validate, build and print the exact batchUpdate plan; touches no Google) · --plan-json (with --dry-run: print that plan as JSON) · --help. Env: PROJECT_NAME PAGES ROUNDS_DIR PS_TAB PS_GID TARGET_SSID SHEET_NAME DRIVE_ROOT_FOLDER DRIVE_CATEGORY MCP_SHEETS_DIR QA_SCHEMAS_VALIDATOR PS_ALLOW_DROP PS_ALLOW_ADOPT — see the file header.');
  process.exit(0);
}

const die = (msg, code = 1) => { console.error(`psi-sheet: ${msg}`); process.exit(code); };
const warnings = [];
const warn = (m) => warnings.push(m);

// ── geometry ──────────────────────────────────────────────────────────────────────────────
// A = Page. Then ONE 4-COLUMN BLOCK PER ROUND, repeated to the right:
//   Platform | Comments | Points | spacer      →  column count = 1 + 4 × rounds
// A published round is never overwritten; a new round is a new block. See SHEET_TEMPLATE.md.
const HEADER_ROWS = 3;
const WIDTH_PAGE = 299;
const WIDTH_BLOCK = [100, 133, 121, 15];        // Platform · Comments · Points · spacer
const LABEL_OF = { desktop: 'Desktop', mobile: 'Mobile' };
const CELL_TEXT = { 'n-a': 'n/a', error: 'error' };   // the JSON enum is a slug; the cell is the owner's literal

const rgb = (h) => ({ red: parseInt(h.slice(1, 3), 16) / 255, green: parseInt(h.slice(3, 5), 16) / 255, blue: parseInt(h.slice(5, 7), 16) / 255 });
const C = {
  headHdr: rgb('#699ebf'),    // Page / Platform / Comments header cells
  headPts: rgb('#146c8b'),    // the "Points from <date>" header cell
  spacerCol: rgb('#cccccc'),  // the 15px separator column, in the header
  band: rgb('#3d85c6'), bandTxt: rgb('#f3f3f3'),
  siteSep: rgb('#073763'),    // a darker full-width rule BETWEEN sites (sections), not within one
  spacerRow: rgb('#d9d9d9'),  // the full-width rule that closes every page block
  link: rgb('#1155cc'),
  green: rgb('#b6d7a8'), amber: rgb('#f6b26b'), red: rgb('#e06666'),   // Google's own score bands
  // A failed collection must never wear the colour of a catastrophic score, and neither state may be
  // mistaken for the other: n/a is quiet grey text on near-white, error is red bold on grey.
  naBg: rgb('#f3f3f3'), naTxt: rgb('#666666'),
  errBg: rgb('#d9d9d9'), errTxt: rgb('#cc0000'),
  white: rgb('#ffffff'), black: rgb('#000000'),
};

// ── inputs ────────────────────────────────────────────────────────────────────────────────
const ROOT = [process.cwd(), path.resolve(HERE, '..')]
  .find((d) => fs.existsSync(path.join(d, process.env.PAGES || 'pages.json'))) ?? process.cwd();
const PAGES_FILE = path.resolve(ROOT, process.env.PAGES || 'pages.json');
const ROUNDS_DIR = path.resolve(ROOT, process.env.ROUNDS_DIR || 'rounds');

const readJson = (p, what) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { die(`${what} — ${e.message}`, 2); }
};

if (!fs.existsSync(PAGES_FILE)) {
  die(`${PAGES_FILE} not found. The inventory is what the report is ABOUT, and it is what puts the\n`
    + '  sections and pages in order. Copy template/pages.example.json to pages.json and list your\n'
    + '  pages (or point PAGES=<path> at it).', 2);
}
const config = readJson(PAGES_FILE, `cannot read ${PAGES_FILE}`);

const PLATFORMS = (config.platforms ?? ['desktop', 'mobile']).map(String);
for (const p of PLATFORMS) if (!LABEL_OF[p]) die(`${PAGES_FILE}: platform "${p}" is neither desktop nor mobile`, 2);

// sections[] is canonical (it is the band order); a bare pages[] renders as one band.
const sections = (config.sections ?? [{ name: config.section || 'Pages', pages: config.pages }]).map((s, i) => {
  if (!Array.isArray(s.pages) || !s.pages.length) die(`${PAGES_FILE}: section ${i + 1} ("${s.name ?? '?'}") has no pages[]`, 2);
  return { name: s.name || `Section ${i + 1}`, pages: s.pages };
});

// Same join as psi-run.mjs (`new URL(path, baseUrl)`) — the two tools must resolve a page to the
// SAME url, or the report is about pages the collector never visited.
const joinUrl = (p) => {
  if (p.url) return p.url;
  if (!config.baseUrl || typeof p.path !== 'string') return null;
  try { return new URL(p.path, config.baseUrl).href; } catch (e) { die(`${PAGES_FILE}: page "${p.id}" — cannot join path "${p.path}" to baseUrl "${config.baseUrl}": ${e.message}`, 2); }
};

const pageById = new Map();
for (const s of sections) {
  for (const p of s.pages) {
    if (!p.id) die(`${PAGES_FILE}: a page in "${s.name}" has no id — the id is the key rounds are carried over by`, 2);
    if (pageById.has(p.id)) die(`${PAGES_FILE}: page id "${p.id}" is declared twice — ids key every round's results, they must be unique`, 2);
    // The URL is per-ENV, so it really lives in each round. This one is the INTENDED target of a page
    // no round has measured yet: it is never linked, only named in the note (see the link pass).
    pageById.set(p.id, { id: p.id, name: p.name || p.id, section: s.name, intendedUrl: joinUrl(p), urls: new Map() });
  }
}
if (!pageById.size) die(`${PAGES_FILE}: no pages`, 2);

// ── every round, against the schema, before anything is published ─────────────────────────
function findValidator() {
  if (process.env.QA_SCHEMAS_VALIDATOR) return process.env.QA_SCHEMAS_VALIDATOR;
  let dir = HERE;
  for (let i = 0; i < 12; i++) {
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

if (!fs.existsSync(ROUNDS_DIR)) die(`${ROUNDS_DIR} not found — collect a round first (tools/psi-run.mjs), or set ROUNDS_DIR.`, 2);
const roundFiles = fs.readdirSync(ROUNDS_DIR).filter((f) => f.endsWith('.json')).sort();
if (!roundFiles.length) {
  die(`no rounds in ${ROUNDS_DIR}. A report with no round is not an empty report — it is no report.\n`
    + '  Collect one:  PSI_API_KEY_FILE=... node tools/psi-run.mjs', 1);
}

const validator = findValidator();
if (!validator) {
  die('cannot find Rules-Guide/schemas/validate.mjs — set QA_SCHEMAS_VALIDATOR.\n'
    + '  An unvalidated round is not a source of truth, and a tidy Sheet built from one is a\n'
    + '  well-formatted lie. Refusing to guess.', 2);
}
let invalid = 0;
for (const f of roundFiles) {
  const r = spawnSync(process.execPath, [validator, 'pagespeed-round', path.join(ROUNDS_DIR, f)], { encoding: 'utf8' });
  if (r.status !== 0) {
    invalid++;
    console.error(`  INVALID  ${f}`);
    console.error((r.stderr || r.stdout).trim().split('\n').map((l) => '           ' + l).join('\n'));
  }
}
if (invalid) die(`${invalid} of ${roundFiles.length} round(s) fail the pagespeed-round schema — an invalid round is an error, not a row to skip. Fix the JSON.`, 1);

// ── parse the rounds, and make the checks the schema cannot ───────────────────────────────
// The schema has no conditional keywords, so it cannot say "status 'measured' requires score AND
// exactly runsPerPage runs". That check lands here, and it is a REFUSAL: a green number standing
// on fewer loads than the round claimed is the one failure this whole document type exists to
// prevent.
const byId = new Map();
const rounds = roundFiles.map((f) => {
  const raw = readJson(path.join(ROUNDS_DIR, f), `cannot read ${f}`);
  const { round, source, budgets } = raw;
  const id = round.id;
  if (byId.has(id)) die(`round id "${id}" is used by both ${byId.get(id)} and ${f}. Ids key the carry-over of comments and the identity of a block — two rounds cannot share one.`, 1);
  byId.set(id, f);

  const target = source.runsPerPage;
  const profiles = source.strategyProfiles;
  for (const p of profiles) {
    if (!PLATFORMS.includes(p)) {
      die(`${f}: the round covers platform "${p}", but ${path.basename(PAGES_FILE)} declares platforms [${PLATFORMS.join(', ')}].\n`
        + '  The tab would have no row for it — a number with no cell is a number nobody will ever see.', 1);
    }
  }

  const results = new Map();   // `${pageId} ${platform}` → result
  for (const page of raw.pages) {
    if (!pageById.has(page.id)) {
      die(`${f}: a result for page "${page.id}", which is not in ${path.basename(PAGES_FILE)}.\n`
        + '  A number whose page nobody declared has nowhere honest to go. Add the page to the\n'
        + '  inventory (it sets the order of the tab), or fix the round.', 1);
    }
    const known = pageById.get(page.id);
    known.urls.set(id, page.url);
    if (page.section !== known.section) {
      warn(`${f}: page "${page.id}" says section "${page.section}", the inventory says "${known.section}" — the tab follows the inventory.`);
    }

    for (const res of page.results) {
      const where = `${f}: "${page.id}"/${res.platform}`;
      const key = `${page.id} ${res.platform}`;
      if (results.has(key)) die(`${where} appears twice — one cell cannot hold two numbers.`, 1);
      if (!profiles.includes(res.platform)) {
        die(`${where}: the result exists, but source.strategyProfiles is [${profiles.join(', ')}].\n`
          + '  Either the round covered that platform or it did not; the block cannot say both.', 1);
      }

      if (res.status === 'measured') {
        if (res.score == null || !Array.isArray(res.runs)) {
          die(`${where}: status "measured" with no ${res.score == null ? 'score' : 'runs'}.\n`
            + '  A measurement with no runs behind it is an assertion, not a measurement. (The schema\n'
            + '  cannot express this — it has no conditional keywords — so the tool does.)', 1);
        }
        if (res.runs.length !== target) {
          die(`${where}: status "measured" with ${res.runs.length} run(s), but the round's target is ${target}.\n`
            + (res.runs.length < target
              ? `  A PageSpeed score is a lab metric from a single load, and one load is noise. A score\n`
                + `  standing on ${res.runs.length} run(s) is not the score of a ${target}-run round: record it as "not-run".\n`
                + '  Never a partial green number — that is the fabrication this document type exists to prevent.'
              : '  The round did more runs than it declared. Set source.runsPerPage to what was actually\n'
                + '  run — a median of 5 runs described as a median of 3 is a different measurement.'), 1);
        }
      } else if (res.score != null) {
        die(`${where}: status "${res.status}" carries a score (${res.score}).\n`
          + '  Only "measured" may carry a score. An empty/n-a/error cell with a number hiding in the\n'
          + '  JSON is a number waiting to be believed by the next tool that reads it.', 1);
      }

      // "n-a" and "error" are claims about the world, not placeholders. Without a comment they say nothing.
      if ((res.status === 'n-a' || res.status === 'error') && !res.comment) {
        die(`${where}: status "${res.status}" with no comment.\n`
          + '  "n/a" means the page does not exist there; "error" means the tool failed. Both are claims,\n'
          + '  and a claim with no explanation is a blank the reader has to fill in themselves.', 1);
      }
      // psi-run writes NEEDS-COMMENT when a comment is mandatory but only a human can write it.
      // That string is a DEMAND, not an explanation — publishing it would ship the demand as the answer.
      if (res.comment && /^NEEDS-COMMENT\b/.test(res.comment.trim())) {
        die(`${where}: the comment is still the collector's placeholder — "${res.comment.trim().slice(0, 60)}…".\n`
          + '  A NEEDS-COMMENT marker is a demand for a human explanation, not an explanation. Write the\n'
          + '  real comment into the round JSON, then publish.', 1);
      }
      if (res.status === 'error' && !res.error) warn(`${where}: status "error" with no error text — the failure is the evidence that the cell is empty for a reason.`);
      if (res.status === 'not-run' && res.runs?.length && !res.comment) {
        warn(`${where}: a partial "not-run" (${res.runs.length}/${target} runs) with no comment — the run count fell below target and nobody said why.`);
      }
      results.set(key, res);
    }
  }
  return { file: f, id, date: round.date, env: round.env, label: round.label, source, budgets, target, profiles, results };
});

// Chronological: the blocks read left→right as time moved. Same date → the id breaks the tie.
rounds.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));

// PS_FUTURE_ROUNDS=N appends N EMPTY blocks to the right — ready-to-fill templates for rounds not yet
// run, exactly as the reference sheet kept blank dated columns ahead of time. Their header is the
// literal placeholder "Points from dd/mm/yyyy" (the date format to write when the round happens); every
// cell is blank (not a zero). They carry no data, so the honesty guards above never see them — a future
// block is a column shape, not a measurement. When the round is collected, drop PS_FUTURE_ROUNDS by one
// and the real block takes its place.
const FUTURE_ROUNDS = Math.max(0, Math.min(24, parseInt(process.env.PS_FUTURE_ROUNDS || '0', 10) || 0));
for (let n = 1; n <= FUTURE_ROUNDS; n++) {
  rounds.push({
    id: `future-${n}`, date: `9999-12-${String(n).padStart(2, '0')}`, env: 'other',
    label: 'Points from dd/mm/yyyy', isFuture: true,
    source: { tool: 'psi-api', runsPerPage: config.runsPerPage || 3, strategyProfiles: PLATFORMS, collectedAt: '' },
    budgets: null, target: config.runsPerPage || 3, profiles: PLATFORMS, results: new Map(),
  });
}

const NCOLS = 1 + 4 * rounds.length;
const cols = (r) => ({ platform: 1 + 4 * r, comments: 2 + 4 * r, points: 3 + 4 * r, spacer: 4 + 4 * r });

// The newest round that actually MEASURED this page, and the url it measured. A page no round has
// visited has none — and it gets no link (see the link pass): the inventory's url may point at a
// different environment than the one this report is about.
const measuredUrl = (page) => {
  for (let i = rounds.length - 1; i >= 0; i--) {
    const u = page.urls.get(rounds[i].id);
    if (u) return { url: u, round: rounds[i] };
  }
  return null;
};

// The tab title / gid are part of the plan, so they are resolved before the plan is built.
const TAB = process.env.PS_TAB || 'PageSpeed report';
const GID = Number(process.env.PS_GID || 820001);

// ── formatting the numbers that go into a note ────────────────────────────────────────────
const LAB = { lcpMs: 'LCP', tbtMs: 'TBT', cls: 'CLS', fcpMs: 'FCP', speedIndexMs: 'SI', inpMs: 'INP' };
const ms = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`);
const fmtMetric = (k, v) => `${LAB[k] ?? k}: ${k === 'cls' ? Number(v).toFixed(3) : ms(Number(v))}`;
// Unknown keys ride through verbatim — a rename in the collector must never silently drop a number
// out of the note.
const fmtMetrics = (obj, skip = []) => Object.entries(obj || {})
  .filter(([k]) => !skip.includes(k)).map(([k, v]) => fmtMetric(k, v)).join(' · ');

// ── the model ─────────────────────────────────────────────────────────────────────────────
// prevComments: `${roundId} ${pageId}` → the comment a human typed straight into the tab. The round
// JSON wins whenever it has one; otherwise the typed comment survives the rebuild.
function build(prevComments) {
  const grid = [];
  const notes = [];
  const rowKind = [];
  const anchors = [];   // { row, page } — the top row of each page block
  const evidenceLinks = [];   // { row, col, label, url, tip } — the Platform cell links to the report
                              // of the run that produced the number in this row. See EVIDENCE below.
  const pushRow = (kind) => { grid.push(Array(NCOLS).fill('')); notes.push(Array(NCOLS).fill('')); rowKind.push(kind); return grid.length - 1; };

  const h = pushRow('header'); pushRow('header'); pushRow('header');
  grid[h][0] = 'Page';
  rounds.forEach((rd, r) => {
    const c = cols(r);
    grid[h][c.platform] = 'Platform';
    grid[h][c.comments] = 'Comments';
    grid[h][c.points] = rd.label;
    if (rd.isFuture) {
      notes[h][c.points] = 'Planned round — not collected yet.\nWhen you run it: replace the header date (dd/mm/yyyy) and collect with\n  psi-run.mjs --round <id> --env <env> --label "Points from dd/mm/yyyy (…)"\nThen drop PS_FUTURE_ROUNDS by one and rebuild — the real scores fill this block.';
      return;
    }
    notes[h][c.points] = [
      `round: ${rd.id}`,
      `env: ${rd.env} · tool: ${rd.source.tool}${rd.source.lighthouseVersion ? ` · Lighthouse ${rd.source.lighthouseVersion}` : ''}`,
      `collected: ${rd.source.collectedAt} · target ${rd.target} run(s) per page — the cell carries the MEDIAN, the runs are in each cell's note`,
      `platforms covered: ${rd.profiles.join(', ')}`,
      rd.budgets
        ? `budgets approved by ${rd.budgets.approvedBy} on ${rd.budgets.approvedOn} — a metric over budget is a FAIL`
        : 'no approved budget: these scores are REPORTED, not judged. The colour bands are Google\'s classification, not a pass/fail line.',
      'Lab, not field: one load on one machine. It is not what your users got.',
    ].join('\n');
  });

  // Two rounds are comparable only when the whole IDENTITY of the measurement matches: env, tool,
  // Lighthouse version and the run target. Google upgrades Lighthouse server-side and the scoring
  // weights change between majors — subtracting a 13.x score from an 11.x score reports a TOOL
  // upgrade as a product regression. So when they differ there is NO delta, and the note says why.
  const sameMeasurement = (a, b) => a.env === b.env
    && a.source.tool === b.source.tool
    && (a.source.lighthouseVersion ?? null) === (b.source.lighthouseVersion ?? null)
    && a.source.runsPerPage === b.source.runsPerPage;

  const whyNot = (p, cur) => {
    const w = [];
    if (p.env !== cur.env) w.push(`it ran in env "${p.env}", this one in "${cur.env}"`);
    if (p.source.tool !== cur.source.tool) w.push(`it used ${p.source.tool}, this one ${cur.source.tool}`);
    const pv = p.source.lighthouseVersion ?? 'an unrecorded Lighthouse version';
    const cv = cur.source.lighthouseVersion ?? 'an unrecorded Lighthouse version';
    if (pv !== cv) w.push(`it ran Lighthouse ${pv}, this one ${cv}`);
    if (p.source.runsPerPage !== cur.source.runsPerPage) w.push(`it took the median of ${p.source.runsPerPage} run(s), this one of ${cur.source.runsPerPage}`);
    return w;
  };

  // → { prev: {round, score} | null, blocked: {round, why[]} | null }
  const previous = (r, pageId, platform) => {
    let blocked = null;
    for (let i = r - 1; i >= 0; i--) {
      const p = rounds[i];
      const res = p.results.get(`${pageId} ${platform}`);
      if (!res || res.status !== 'measured') continue;
      if (sameMeasurement(p, rounds[r])) return { prev: { round: p, score: res.score }, blocked };
      if (!blocked) blocked = { round: p, why: whyNot(p, rounds[r]) };
    }
    return { prev: null, blocked };
  };

  const sectionRanges = [];   // { start, end } — the page-row span of each site, for a per-site row group
  sections.forEach((section, si) => {
    if (si > 0) pushRow('sitesep');   // a #073763 rule BETWEEN sites — never before the first
    grid[pushRow('band')][0] = section.name;
    const groupStart = grid.length;   // first page row of this site (the band is not in the group)

    for (const p of section.pages) {
      const page = pageById.get(p.id);
      const top = pushRow('page');
      for (let i = 1; i < PLATFORMS.length; i++) pushRow('page');
      anchors.push({ row: top, page });

      grid[top][0] = page.name;
      // The URL is part of the identity of the number, and it CHANGES between environments. Column A
      // can carry only one link, so it carries the newest MEASURED one — and the note carries every
      // URL the page was actually measured at, per round.
      const link = measuredUrl(page);
      const urlLines = [...page.urls].map(([rid, u]) => `${rid}: ${u}`);
      notes[top][0] = [
        `page: ${page.id}`,
        ...urlLines,
        link
          ? `the name links to the URL measured in ${link.round.id} (${link.round.env}) — the newest round that measured this page`
          : `no round has measured this page yet, so the name is NOT a link. The inventory would resolve it to ${page.intendedUrl || '(no URL)'}, but nothing has been measured there and it may not even be this report's environment.`,
      ].join('\n');

      rounds.forEach((rd, r) => {
        const c = cols(r);
        const said = new Map();   // comment text → the platforms that said it

        PLATFORMS.forEach((pf, i) => {
          const row = top + i;
          grid[row][c.platform] = LABEL_OF[pf];
          const res = rd.results.get(`${page.id} ${pf}`);

          if (!rd.profiles.includes(pf)) {                       // out of this round's scope
            notes[row][c.points] = `Not covered by ${rd.id} — the round ran ${rd.profiles.join(' + ')} only.\nAn empty cell is not a zero.`;
            return;
          }
          if (!res) {                                            // in scope, but never measured
            notes[row][c.points] = rd.isFuture
              ? `Planned round — not collected yet. This cell fills in when the round is run on ${pf}.\nAn empty cell is not a zero.`
              : `Not run in ${rd.id} (${rd.env}) — this page was not measured on ${pf}.\nAn empty cell is not a zero. It means nobody looked.`;
            return;
          }

          // EVIDENCE — the Platform cell ("Desktop"/"Mobile") links to the report of the run whose score
          // is in this row. psi-report.mjs renders the MEDIAN run that psi-run.mjs stored, so the two
          // agree by construction — but "by construction" is what every fabricated number was, so the
          // agreement is CHECKED. A link to a report showing a different score is worse than no link:
          // it makes the wrong number look audited.
          // Only a MEASURED cell may carry a link: a link's whole meaning is "the report of the run whose
          // score is beside it", and an n-a / not-run / error cell HAS no score. An evidence block on a
          // non-measured result is a leftover from a hand-edit (measured → n-a, say) — never render it as a
          // link, or the Sheet would open a full report from a cell that claims the page was not scored.
          if (res.evidence && res.status === 'measured') {
            const ev = res.evidence;
            // FAIL-CLOSED. runScore is the score INSIDE the linked report; the schema requires it, so its
            // absence here means a hand-edit deleted it — refuse rather than link an unauditable report.
            // (An absent runScore is `undefined !== res.score` → this fires; it is not silently trusted.)
            if (ev.runScore !== res.score) {
              die(`${rd.id} · ${page.name} (${page.id}) / ${LABEL_OF[pf]}: the cell says ${res.score} but the linked report shows ${ev.runScore ?? '(no runScore recorded)'}.\n`
                + '  The evidence belongs to a different run (or its runScore was removed). Re-run psi-report.mjs for this round\n'
                + '  (it renders the stored median run), or re-collect the round. REFUSING to publish a number whose own evidence contradicts it.', 1);
            }
            const url = ev.screenshotUrl || ev.reportUrl;
            if (url) {
              // The tip rides in the notes array, NOT in the link's own updateCells: the grid-wide note pass
              // below writes `note` for every cell, and a later updateCells with fields:note would clear a
              // note the link request had set. One source of truth for the note; the link never clobbered.
              notes[row][c.platform] = `PageSpeed report for the run that scored ${ev.runScore} — the very number in this row`
                + `${ev.capturedAt ? `\nRendered ${ev.capturedAt.slice(0, 16).replace('T', ' ')} from the stored median run` : ''}`
                + `${ev.reportUrl && ev.screenshotUrl ? `\nFull interactive report: ${ev.reportUrl}` : ''}`;
              evidenceLinks.push({ row, col: c.platform, label: LABEL_OF[pf], url });
            }
          } else if (res.evidence) {
            warn(`${rd.id} · ${page.name} (${page.id}) / ${LABEL_OF[pf]}: an evidence block sits on a ${res.status} cell — a report links a run that did not produce a published score. It is IGNORED (no link); remove it from the round JSON.`);
          }
          if (res.comment) {
            if (!said.has(res.comment)) said.set(res.comment, []);
            said.get(res.comment).push(LABEL_OF[pf]);
          }

          if (res.status === 'n-a' || res.status === 'error') {
            grid[row][c.points] = CELL_TEXT[res.status];
            notes[row][c.points] = [
              `${res.status === 'n-a' ? 'Not applicable' : 'Collection failed'} — ${rd.id} (${rd.env})`,
              res.comment,
              res.error && `error: ${res.error}`,
              'This is not a score, and it is not a zero.',
            ].filter(Boolean).join('\n');
            return;
          }

          if (res.status === 'not-run') {
            grid[row][c.points] = '';                            // empty = not run this round. Never 0.
            notes[row][c.points] = [
              `Not run — ${rd.id} (${rd.env})`,
              res.runs?.length ? `only ${res.runs.length} of ${rd.target} run(s) succeeded: ${res.runs.join(' · ')}` : null,
              res.runs?.length ? 'A median of a partial round is not the round\'s median — no score is published.' : null,
              res.error && `last error: ${res.error}`,
              res.comment,
              'An empty cell is not a zero.',
            ].filter(Boolean).join('\n');
            return;
          }

          // status "measured": score + exactly `target` runs, both already enforced above.
          grid[row][c.points] = res.score;
          const { prev, blocked } = previous(r, page.id, pf);
          const delta = prev ? res.score - prev.score : null;

          const budgetLines = [];
          if (rd.budgets) {
            const b = rd.budgets;
            // `floor` = higher is better (the Performance score). Everything else is a ceiling.
            const judge = (name, actual, limit, floor) => {
              if (actual == null || limit == null) return;
              const over = floor ? actual < limit : actual > limit;
              budgetLines.push(`${over ? 'OVER BUDGET' : 'within budget'} — ${name} ${actual} vs ${floor ? 'min' : 'max'} ${limit}`);
              if (over) warn(`${rd.id} · ${page.name} (${page.id}) / ${LABEL_OF[pf]}: ${name} ${actual} breaches the approved budget (${floor ? 'min' : 'max'} ${limit}) — FAIL. Budget approved by ${b.approvedBy} on ${b.approvedOn}.`);
            };
            judge('Performance', res.score, b.performance, true);
            judge('LCP (lab)', res.metrics?.lcpMs, b.lcpMs, false);
            judge('TBT (lab)', res.metrics?.tbtMs, b.tbtMs, false);
            judge('CLS (lab)', res.metrics?.cls, b.cls, false);
            // INP is a FIELD metric. Judging a field budget against a lab estimate would be judging
            // the wrong number, so an absent CrUX sample means "cannot judge" — not "passed".
            if (b.inpMs != null) {
              if (res.field?.inpMs != null) judge('INP (field)', res.field.inpMs, b.inpMs, false);
              else budgetLines.push(`INP budget ${b.inpMs} ms: no CrUX field sample for this URL — cannot judge (lab INP is an estimate, not the budgeted metric).`);
            }
          }

          notes[row][c.points] = [
            `Performance ${res.score} — median of ${res.runs.length} run(s): ${res.runs.join(' · ')}`,
            res.metrics ? `Lab (median run): ${fmtMetrics(res.metrics)}` : 'Lab metrics: not recorded.',
            res.field
              ? `Field (CrUX, real users, ${res.field.source}): ${fmtMetrics(res.field, ['source'])}`
                + (res.field.source === 'crux-origin' ? '\n  ↳ origin-level sample: that number describes the SITE, not this page.' : '')
              : 'Field (CrUX): no sample for this URL. Absent is not zero, and it is not good.',
            delta !== null
              ? `vs ${prev.round.id} (same env, same tool, same Lighthouse version, same run target): ${delta >= 0 ? '+' : ''}${delta}`
              : blocked
                ? `No delta: the previous round that measured this page (${blocked.round.id}, ${blocked.round.date}) is NOT comparable — ${blocked.why.join('; ')}.`
                  + ' Lighthouse changes its scoring weights between majors, so the difference of those two numbers would report a TOOL change as a product change.'
                : `No earlier comparable round measured this page — nothing to compare to.`,
            ...budgetLines,
            `${rd.env} · ${rd.source.tool}${rd.source.lighthouseVersion ? ` · Lighthouse ${rd.source.lighthouseVersion}` : ''} · ${res.collectedAt ?? rd.source.collectedAt}`,
          ].join('\n');

          const owed = [];
          if (res.score < 50) owed.push(`score ${res.score} < 50`);
          if (delta !== null && delta <= -10) owed.push(`dropped ${Math.abs(delta)} points vs ${prev.round.id} (same env, same tool, same Lighthouse version) — a regression CANDIDATE: reproduce it in a second round before filing it`);
          if (owed.length) res._owed = owed;
        });

        // The Comments cell is merged across the page's platform rows — the owner's geometry makes it
        // ONE comment per page per round. Two different comments are both kept, each labelled.
        let text = [...said].map(([txt, who]) => (who.length === PLATFORMS.length ? txt : `${who.join(', ')}: ${txt}`)).join('\n');
        if (!text) text = prevComments.get(`${rd.id} ${page.id}`) || '';
        grid[top][c.comments] = text;

        // The demand is discharged by the comment on the OWING RESULT, never by whatever text happens
        // to sit in the shared cell: a sentence about the other platform (or one carried over from an
        // older round) explains nothing about THIS number, and a merged cell makes that easy to miss.
        for (const pf of PLATFORMS) {
          const res = rd.results.get(`${page.id} ${pf}`);
          if (res?._owed && !res.comment) {
            warn(`${rd.id} · ${page.name} (${page.id}) / ${LABEL_OF[pf]}: COMMENT REQUIRED — ${res._owed.join('; ')}.`
              + ` The ${rd.id} round JSON carries no comment on this result, so the number is published with no explanation.`);
          }
        }
      });

      pushRow('spacer');   // the full-width grey rule that closes every page block
    }
    sectionRanges.push({ start: groupStart, end: grid.length });   // through the section's last spacer
  });
  return { grid, notes, rowKind, anchors, evidenceLinks, sectionRanges };
}

// ── the batchUpdate plan ──────────────────────────────────────────────────────────────────
// planSetup + planFormat are the ONLY place requests are built: --dry-run prints exactly what the
// publish path would send, because it calls the same two functions with the same model.
const colLetter = (i) => { let s = '', n = i + 1; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

// Contiguous runs of PAGE rows. Nothing else may ever be reached by a score rule: a header, a section
// band and the grey spacer rule are not cells that can hold a score.
const pageRuns = (rowKind) => {
  const runs = [];
  for (let i = 0; i < rowKind.length; i++) {
    if (rowKind[i] !== 'page') continue;
    const start = i;
    while (i + 1 < rowKind.length && rowKind[i + 1] === 'page') i++;
    runs.push([start, i + 1]);
  }
  return runs;
};

// createdByUs is the ONLY licence to delete the doc's last remaining tab. On any other path that tab
// belongs to somebody else — the reference document is exactly one tab with five rounds of history.
function planSetup({ old, sheetCount, createdByUs, rows, placeholderSheetId }) {
  const setup = [];
  if (old && old.properties.sheetId === GID) {
    const gp = old.properties.gridProperties || {};
    const whole = { sheetId: GID, startRowIndex: 0, endRowIndex: gp.rowCount || 1000, startColumnIndex: 0, endColumnIndex: gp.columnCount || 26 };
    setup.push({ unmergeCells: { range: whole } });
    setup.push({ updateCells: { range: whole, fields: '*' } });                  // values, formats, notes
    for (let i = (old.conditionalFormats || []).length - 1; i >= 0; i--) setup.push({ deleteConditionalFormatRule: { sheetId: GID, index: i } });
    // Groups survive an updateCells wipe — drop them explicitly, or every rebuild nests another layer.
    for (const grp of old.columnGroups || []) setup.push({ deleteDimensionGroup: { range: { sheetId: GID, dimension: 'COLUMNS', startIndex: grp.range.startIndex, endIndex: grp.range.endIndex } } });
    for (const grp of old.rowGroups || []) setup.push({ deleteDimensionGroup: { range: { sheetId: GID, dimension: 'ROWS', startIndex: grp.range.startIndex, endIndex: grp.range.endIndex } } });
    setup.push({ updateSheetProperties: { properties: { sheetId: GID, title: TAB, gridProperties: { frozenRowCount: HEADER_ROWS, frozenColumnCount: 1, columnCount: Math.max(gp.columnCount || 26, NCOLS + 1), rowCount: Math.max(gp.rowCount || 1000, rows + 50) } }, fields: 'title,gridProperties(frozenRowCount,frozenColumnCount,columnCount,rowCount)' } });
  } else {
    if (old) setup.push({ deleteSheet: { sheetId: old.properties.sheetId } });   // right title, wrong gid
    setup.push({ addSheet: { properties: { sheetId: GID, title: TAB, gridProperties: { frozenRowCount: HEADER_ROWS, frozenColumnCount: 1, columnCount: NCOLS + 1, rowCount: Math.max(1000, rows + 50) } } } });
    if (createdByUs && sheetCount === 1 && !old && placeholderSheetId != null) {
      setup.push({ deleteSheet: { sheetId: placeholderSheetId } });   // the placeholder of the doc WE just created
    }
  }
  return setup;
}

function planFormat({ grid, notes, rowKind, anchors, evidenceLinks = [], sectionRanges = [] }) {
  const N = grid.length;
  const rng = (r0, r1, c0, c1) => ({ sheetId: GID, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 });
  const merge = (r0, r1, c0, c1) => ({ mergeCells: { range: rng(r0, r1, c0, c1), mergeType: 'MERGE_ALL' } });
  const fmt = (r0, r1, c0, c1, f, fields) => ({ repeatCell: { range: rng(r0, r1, c0, c1), cell: { userEnteredFormat: f }, fields: `userEnteredFormat(${fields})` } });
  const width = (i, px) => ({ updateDimensionProperties: { range: { sheetId: GID, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } });
  const F = 'backgroundColor,textFormat,verticalAlignment,horizontalAlignment,wrapStrategy';
  const cell = (bg, fg, bold, size, halign, wrap) => ({
    backgroundColor: bg, textFormat: { foregroundColor: fg, bold, fontSize: size },
    verticalAlignment: 'MIDDLE', horizontalAlignment: halign || 'LEFT', wrapStrategy: wrap || 'WRAP',
  });

  const reqs = [
    width(0, WIDTH_PAGE),
    merge(0, HEADER_ROWS, 0, 1),
    fmt(0, HEADER_ROWS, 0, NCOLS, cell(C.headHdr, C.black, true, 14, 'CENTER'), F),
    fmt(HEADER_ROWS, N, 0, NCOLS, cell(C.white, C.black, false, 10, 'LEFT'), F),
    // Column A is plain black text by default; only a page with a MEASURED url gets the blue underline
    // of a link, in the link pass below. Blue text that is not a link is a promise the tab cannot keep.
    fmt(HEADER_ROWS, N, 0, 1, cell(C.white, C.black, false, 11, 'LEFT'), F),
  ];

  rounds.forEach((rd, r) => {
    const c = cols(r);
    WIDTH_BLOCK.forEach((px, i) => reqs.push(width(c.platform + i, px)));
    reqs.push(
      merge(0, HEADER_ROWS, c.platform, c.platform + 1),
      merge(0, HEADER_ROWS, c.comments, c.comments + 1),
      merge(0, HEADER_ROWS, c.points, c.points + 1),
      merge(0, HEADER_ROWS, c.spacer, c.spacer + 1),
      fmt(0, HEADER_ROWS, c.points, c.points + 1, cell(C.headPts, C.white, true, 13, 'CENTER'), F),
      fmt(0, HEADER_ROWS, c.spacer, c.spacer + 1, cell(C.spacerCol, C.black, false, 10, 'CENTER'), F),
      // The 15px spacer is ONE continuous grey rule the whole height of the tab, header included — it
      // reads as the divider between rounds, so its data cells carry the same #cccccc as its header
      // (the band and page-spacer rows repaint over it full-width below, so it yields on those rows).
      fmt(HEADER_ROWS, N, c.spacer, c.spacer + 1, cell(C.spacerCol, C.black, false, 10, 'CENTER'), F),
      fmt(HEADER_ROWS, N, c.platform, c.platform + 1, cell(C.white, C.black, false, 10, 'CENTER'), F),
      fmt(HEADER_ROWS, N, c.points, c.points + 1, cell(C.white, C.black, true, 10, 'CENTER'), F),
      { repeatCell: { range: rng(HEADER_ROWS, N, c.points, c.points + 1), cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0' } } }, fields: 'userEnteredFormat.numberFormat' } },
      // One collapsible group per round: Platform + Comments fold away, and Points (the score) STAYS —
      // so collapsing every round leaves a clean score-per-date matrix, which is the whole reason to
      // keep old rounds. The toggle sits on the right (columnGroupControlAfter). The 15px spacer is left
      // out of the group so consecutive blocks stay non-adjacent — Sheets merges adjacent same-depth
      // groups into one, which would collapse every round together.
      { addDimensionGroup: { range: { sheetId: GID, dimension: 'COLUMNS', startIndex: c.platform, endIndex: c.comments + 1 } } },
    );
  });
  reqs.push({ updateSheetProperties: { properties: { sheetId: GID, gridProperties: { columnGroupControlAfter: true } }, fields: 'gridProperties.columnGroupControlAfter' } });

  // One collapsible ROW group per site (section): its page rows fold under the band, so a many-site
  // report can hide the sites it is not looking at. The band and the #073763 site separator stay out
  // of the group — collapsing a site must still leave its heading and the divider visible. Only when
  // there is more than one site: a single-site report has nothing to separate or fold away.
  if (sectionRanges.length > 1) {
    for (const s of sectionRanges) {
      reqs.push({ addDimensionGroup: { range: { sheetId: GID, dimension: 'ROWS', startIndex: s.start, endIndex: s.end } } });
    }
  }

  // The page name spans its platform rows, and so does each round's comment — but a single-platform
  // report has nothing to span: a 1×1 MERGE_ALL is rejected by the API.
  if (PLATFORMS.length > 1) {
    for (const { row } of anchors) {
      reqs.push(merge(row, row + PLATFORMS.length, 0, 1));
      rounds.forEach((_, r) => reqs.push(merge(row, row + PLATFORMS.length, cols(r).comments, cols(r).comments + 1)));
    }
  }
  // Bands and spacer rows are painted last: they span the whole width and must win over the
  // per-column formats above.
  rowKind.forEach((kind, i) => {
    if (kind === 'band') reqs.push(fmt(i, i + 1, 0, NCOLS, cell(C.band, C.bandTxt, true, 16, 'LEFT', 'OVERFLOW_CELL'), F));
    if (kind === 'sitesep') reqs.push(fmt(i, i + 1, 0, NCOLS, cell(C.siteSep, C.siteSep, false, 10, 'LEFT'), F));
    if (kind === 'spacer') reqs.push(fmt(i, i + 1, 0, NCOLS, cell(C.spacerRow, C.black, false, 10, 'LEFT'), F));
  });

  // Page names are real links — a TextFormat link, not a HYPERLINK formula. The reference document's
  // locale is uk_UA, where a formula's argument separator is ';': a formula written with ',' renders as
  // #ERROR!. A link that lives in the format survives any locale, so the tab needs no formulas at all.
  for (const { row, page } of anchors) {
    const link = measuredUrl(page);
    if (!link) continue;   // never measured → plain text. Linking the inventory's url would put a
                           // STAGING address in a production report and call it the page that scored.
    reqs.push({
      updateCells: {
        start: { sheetId: GID, rowIndex: row, columnIndex: 0 },
        rows: [{ values: [{
          userEnteredValue: { stringValue: page.name },
          userEnteredFormat: { textFormat: { foregroundColor: C.link, fontSize: 11, bold: false, underline: true, link: { uri: link.url } } },
        }] }],
        fields: 'userEnteredValue,userEnteredFormat.textFormat',
      },
    });
  }

  // The Platform cell carries the evidence link (same TextFormat-link technique as the page name, for
  // the same locale reason). "Desktop" is not decoration: it is the way into the report that produced
  // the number beside it.
  for (const e of evidenceLinks) {
    reqs.push({
      updateCells: {
        start: { sheetId: GID, rowIndex: e.row, columnIndex: e.col },
        rows: [{ values: [{
          userEnteredValue: { stringValue: e.label },
          userEnteredFormat: {
            textFormat: { foregroundColor: C.link, fontSize: 11, bold: false, underline: true, link: { uri: e.url } },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        }] }],
        // NOTE is intentionally NOT set here — the tip lives in the notes grid (set in build()) so the
        // grid-wide note pass below is its single writer and cannot clobber it. See EVIDENCE in build().
        fields: 'userEnteredValue,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
      },
    });
  }

  // Notes for the whole grid, in one request. A score cell without a note is an unfinished cell: "73"
  // alone cannot tell anyone WHAT regressed — the note carries the runs, LCP/TBT/CLS, the CrUX field
  // data, the delta against the last comparable round, and the environment the number came from.
  reqs.push({
    updateCells: {
      start: { sheetId: GID, rowIndex: 0, columnIndex: 0 },
      rows: notes.map((r) => ({ values: r.map((n) => (n ? { note: n } : {})) })),
      fields: 'note',
    },
  });

  // Google's own classification of a Lighthouse score. It CLASSIFIES; it does not judge. A pass/fail
  // needs an owner-approved budget in the round JSON (and then it lives in the note, not in the colour).
  //
  // CUSTOM_FORMULA, not NUMBER_BETWEEN: Sheets coerces an EMPTY cell to 0 in a numeric condition, so a
  // NUMBER_BETWEEN(0,49) band paints every not-run cell the red of a catastrophic score — the exact
  // confusion this document type exists to prevent. And the ranges cover PAGE rows only: a header, a
  // section band and a spacer are not cells a score can live in.
  const runs = pageRuns(rowKind);
  const BANDS = [[90, 100, C.green], [50, 89, C.amber], [0, 49, C.red]];
  const anchorRow = runs.length ? runs[0][0] + 1 : HEADER_ROWS + 1;   // 1-based; the top-left of the first range
  rounds.forEach((_, r) => {
    const col = cols(r).points;
    const ranges = runs.map(([r0, r1]) => rng(r0, r1, col, col + 1));
    if (!ranges.length) return;
    const ref = `$${colLetter(col)}${anchorRow}`;   // absolute column, row relative to each range's top
    for (const [min, max, bg] of BANDS) {
      reqs.push({ addConditionalFormatRule: { rule: { ranges, booleanRule: {
        condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=AND(NOT(ISBLANK(${ref})), ISNUMBER(${ref}), ${ref}>=${min}, ${ref}<=${max})` }] },
        format: { backgroundColor: bg },
      } }, index: 0 } });
    }
    // The two literal states. They are not numbers, so no numeric band can reach them — and a failed
    // collection gets its OWN treatment (red bold on grey), never the red of a 0–49 score.
    const textRule = (text, bg, fg, bold) => ({ addConditionalFormatRule: { rule: { ranges, booleanRule: {
      condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: text }] },
      format: { backgroundColor: bg, textFormat: { foregroundColor: fg, bold } },
    } }, index: 0 } });
    reqs.push(textRule(CELL_TEXT['n-a'], C.naBg, C.naTxt, false), textRule(CELL_TEXT.error, C.errBg, C.errTxt, true));
  });

  // House rule: vertical MIDDLE on the whole used range, header row included.
  reqs.push(fmt(0, N, 0, NCOLS, { verticalAlignment: 'MIDDLE' }, 'verticalAlignment'));
  return reqs;
}

// ── dry run: everything above, none of Google ─────────────────────────────────────────────
if (DRY) {
  const model = build(new Map());
  const { grid, rowKind } = model;
  const W = Math.max(28, ...[...pageById.values()].map((p) => p.name.length + 12));
  const col = (s) => String(s === '' ? '·' : s).padStart(24);
  console.log(`PageSpeed report — ${process.env.PROJECT_NAME || '<PROJECT_NAME unset>'}`);
  console.log(`${pageById.size} page(s) × ${PLATFORMS.length} platform(s) × ${rounds.length} round(s) → ${NCOLS} columns × ${grid.length} rows`);
  console.log(`tab "${TAB}" · gid ${GID}\n`);
  console.log(''.padEnd(W) + rounds.map((r) => `${r.id} [${r.env}]`.padStart(24)).join(''));
  grid.forEach((row, i) => {
    if (rowKind[i] === 'header' || rowKind[i] === 'spacer') return;
    if (rowKind[i] === 'band') { console.log(`\n── ${row[0]} ${'─'.repeat(Math.max(1, W - row[0].length - 4))}`); return; }
    const label = `  ${row[0] || ''}`.padEnd(W - 10) + (rounds.length ? String(row[cols(0).platform]).padEnd(10) : '');
    console.log(label + rounds.map((_, r) => col(row[cols(r).points])).join(''));
  });

  // The plan itself — built by the same two functions the publish path calls. The doc is unknown here,
  // so the setup phase is shown for the case the tool cannot get wrong: adding the tab to a doc it did
  // NOT create (nothing of anyone else's is deleted).
  const setup = planSetup({ old: null, sheetCount: 1, createdByUs: false, rows: grid.length, placeholderSheetId: null });
  const format = planFormat(model);
  const plan = {
    spreadsheet: '(--dry-run: no document opened)',
    setup,
    values: { range: `'${TAB}'!A1`, valueInputOption: 'RAW', rows: grid.length, columns: NCOLS },
    format,
  };
  if (PLAN_JSON) {
    console.log('\n' + JSON.stringify(plan, null, 2));
  } else {
    const tally = (list) => [...list.reduce((m, r) => m.set(Object.keys(r)[0], (m.get(Object.keys(r)[0]) || 0) + 1), new Map())]
      .map(([k, n]) => `${k}×${n}`).join(' · ');
    console.log('\nbatchUpdate plan (exactly what publishing would send):');
    console.log(`  setup   : ${tally(setup) || '(none)'}`);
    console.log(`  values  : ${plan.values.rows} rows × ${plan.values.columns} cols, RAW, into ${plan.values.range}`);
    console.log(`  format  : ${tally(format)}`);
    console.log('  (--plan-json prints every request in full)');
  }

  console.log(`\n${warnings.length} warning(s)`);
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  console.log('\n--dry-run: rounds validated, tab built in memory. Nothing was written to Google.');
  // process.exit() drops whatever stdout has not flushed yet, and a piped --plan-json is big enough to
  // be cut in half — a truncated plan is a plan nobody can trust. Wait for the flush, then exit.
  await new Promise((r) => process.stdout.write('', r));
  process.exit(0);
}

// ── publish ───────────────────────────────────────────────────────────────────────────────
const PROJECT = process.env.PROJECT_NAME;
if (!PROJECT) {
  die('PROJECT_NAME is required (it names the doc and its Drive folder).\n'
    + '  e.g.  PROJECT_NAME=Acme node tools/psi-sheet.mjs\n'
    + '  To validate and inspect the tab without writing anything:  node tools/psi-sheet.mjs --dry-run', 2);
}
const DOC_NAME = process.env.SHEET_NAME || `${PROJECT} — PageSpeed Insights Results`;
const ROOT_FOLDER = process.env.DRIVE_ROOT_FOLDER || 'ClaudeProjects';
const CATEGORY = process.env.DRIVE_CATEGORY || 'Performance';
const TARGET = process.env.TARGET_SSID;

// OAuth (mcp-sheets), resolved by walking up — never an absolute path.
const { createRequire } = await import('node:module');
let mcpDir = process.env.MCP_SHEETS_DIR;
if (!mcpDir) {
  let dir = HERE;
  for (let i = 0; i < 12 && !mcpDir; i++) {
    for (const rel of ['QA-SetupKit/MCP-configurations/mcp-sheets', 'MCP-configurations/mcp-sheets']) {
      if (fs.existsSync(path.join(dir, rel, 'package.json'))) mcpDir = path.join(dir, rel);
    }
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
}
if (!mcpDir) die('mcp-sheets not found — set MCP_SHEETS_DIR (see MCP-configurations/README.md).', 2);

const req = createRequire(path.join(mcpDir, 'package.json'));
const { google } = req('googleapis');
const c0 = readJson(path.join(mcpDir, 'credentials.json'), 'cannot read mcp-sheets credentials.json — run the MCP setup first');
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

// createdByUs is set on exactly ONE branch: the file this run created. Every other document —
// TARGET_SSID, or one found in Drive by name — is somebody's existing work.
let ssId;
let createdByUs = false;
if (TARGET) {
  ssId = TARGET;                                    // demo/validation path: a tab inside an existing doc
} else {
  const rootId = await findFolder(ROOT_FOLDER, null);
  if (!rootId) {
    die(`Drive folder "${ROOT_FOLDER}" not found at the top level of the account.\n`
      + '  Create it once (or set DRIVE_ROOT_FOLDER) — writing QA docs to the Drive root collides with\n'
      + '  the owner\'s own folders.', 2);
  }
  const catId = await ensureFolder(CATEGORY, await ensureFolder(PROJECT, rootId));
  const prior = await drive.files.list({ q: `name = '${DOC_NAME.replace(/'/g, "\\'")}' and '${catId}' in parents and trashed = false`, fields: 'files(id)', spaces: 'drive' });
  if (prior.data.files[0]?.id) {
    ssId = prior.data.files[0].id;
  } else {
    ssId = (await drive.files.create({ requestBody: { name: DOC_NAME, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [catId] }, fields: 'id' })).data.id;
    createdByUs = true;
  }
}

const meta = await sheets.spreadsheets.get({ spreadsheetId: ssId });
const url = `https://docs.google.com/spreadsheets/d/${ssId}/edit`;
const old = meta.data.sheets.find((s) => s.properties.title === TAB || s.properties.sheetId === GID);

// ── read the previous tab back ────────────────────────────────────────────────────────────
// A comment typed straight into the tab exists NOWHERE ELSE. A rebuild that forgets it destroys the
// only record of WHY a number looked the way it did. Blocks are matched by the round id in the
// header note — not by the label — so renaming a block never orphans its comments.
const prevComments = new Map();
const onTab = new Set();
if (old) {
  try {
    const g = await sheets.spreadsheets.get({
      spreadsheetId: ssId,
      ranges: [`'${old.properties.title.replace(/'/g, "''")}'`],
      includeGridData: true,
      fields: 'sheets(data(rowData(values(formattedValue,note))))',
    });
    const rowData = g.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
    const commentColOf = new Map();                          // Comments column index → round id
    (rowData[0]?.values ?? []).forEach((cellData, c) => {
      const id = String(cellData?.note || '').match(/^round:\s*(\S+)/m)?.[1];
      if (id) { commentColOf.set(c - 1, id); onTab.add(id); }   // Comments sits one column left of Points
    });
    for (const row of rowData.slice(HEADER_ROWS)) {
      // Merged cells carry their value and note on the anchor cell only, so a row with a `page:` note
      // IS the top row of a page block — which is exactly where the merged Comments cell lives too.
      const pageId = String(row?.values?.[0]?.note || '').match(/^page:\s*(\S+)/m)?.[1];
      if (!pageId) continue;
      for (const [c, roundId] of commentColOf) {
        const text = row.values?.[c]?.formattedValue;
        if (text) prevComments.set(`${roundId} ${pageId}`, text);
      }
    }
  } catch (e) {
    die(`could not read the previous tab, so no comments could be carried over (${e.message}).\n`
      + '  Refusing to rebuild: a rebuild that cannot read the old tab would silently overwrite every\n'
      + '  comment the team typed. Fix access (or delete the tab deliberately) and re-run.', 1);
  }
}

// A tab this tool wrote always carries a `round:` note on every block header. A tab with NONE was
// written by somebody else — by hand, most likely, and by hand is exactly how the reference document
// is kept. Rebuilding it would wipe a document whose contents this tool cannot even read (the
// carry-over keys off those notes, so it would salvage nothing), and it would do it silently.
if (old && onTab.size === 0 && !process.env.PS_ALLOW_ADOPT) {
  die(`the tab "${old.properties.title}" already exists in this document, and it carries NO "round:" header note — nothing on it was written by this tool.\n`
    + '  Refusing to rebuild it. A hand-maintained tab is a document, not a cache: the comment carry-over\n'
    + '  keys off those notes, so it would salvage nothing, and every typed comment and every round of\n'
    + '  history on that tab would be gone with no way back.\n'
    + '  → point PS_TAB / PS_GID at a NEW tab (the safe move), or set PS_ALLOW_ADOPT=1 to take this one\n'
    + '    over deliberately, knowing its current contents will be REPLACED.', 1);
}

const dropped = [...onTab].filter((id) => !byId.has(id));
if (dropped.length && !process.env.PS_ALLOW_DROP) {
  die(`round(s) ${dropped.join(', ')} are published on the tab but have no JSON in ${path.basename(ROUNDS_DIR)}/.\n`
    + '  Rebuilding would delete a round that was already shared. rounds/ is append-only: restore the\n'
    + '  file, or set PS_ALLOW_DROP=1 if the round really was published in error.', 1);
}

// The tab is a SHARED LINK: rounds are handed over as `…/edit#gid=<PS_GID>`. A rebuild that lands
// on a different document — or on a new gid — kills that link while looking, in the UI, exactly
// like an update. The ledger remembers the carrier so this cannot happen quietly; it refuses
// BEFORE the first mutating request.
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
    assertStableLink({ kind: 'sheet-tab', key: 'pagespeed/tab', id: ssId, gid: GID, title: TAB });
  } catch (e) {
    if (e instanceof LinkLedgerError) die(`${e.message}\n  Nothing was written.`, 1);
    throw e;
  }
} else {
  warn('link-ledger not found — the tab\'s link stability was NOT checked (set QA_LINK_LEDGER).');
}

const model = build(prevComments);
const N = model.grid.length;

// ── clear, then write ─────────────────────────────────────────────────────────────────────
// Same order as the kit's other Sheets builders: unmerge + wipe first (values.update cannot write
// into an existing merge), then the values, then one formatting pass.
const setup = planSetup({
  old, sheetCount: meta.data.sheets.length, createdByUs, rows: N,
  placeholderSheetId: meta.data.sheets[0]?.properties.sheetId,
});
await sheets.spreadsheets.batchUpdate({ spreadsheetId: ssId, requestBody: { requests: setup } });

// RAW, not USER_ENTERED: the tab carries no formulas, so nothing needs parsing — and a page name that
// happens to start with "=" stays a page name. Scores are JS numbers, so they land as real numbers.
await sheets.spreadsheets.values.update({
  spreadsheetId: ssId, range: `'${TAB}'!A1`, valueInputOption: 'RAW', requestBody: { values: model.grid },
});

await sheets.spreadsheets.batchUpdate({ spreadsheetId: ssId, requestBody: { requests: planFormat(model) } });

console.log(`psi-sheet: ${pageById.size} page(s) × ${PLATFORMS.length} platform(s) × ${rounds.length} round(s) → tab "${TAB}"`
  + (prevComments.size ? ` · carried over ${prevComments.size} comment cell(s)` : ''));
console.log(`  blocks, left to right: ${rounds.map((r) => `${r.id} [${r.env}]`).join(' → ')}`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s) — the tab was written, but these are open:`);
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
}
console.log(`\n  ${url}#gid=${GID}`);
