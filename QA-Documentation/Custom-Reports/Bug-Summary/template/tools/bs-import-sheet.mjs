// bs-import-sheet.mjs — import an EXISTING bug-summary spreadsheet into a summary JSON.
//
// For the common case: a client (or a colleague) hands you "the format we use". You import it, and
// build your own document beside it.
//
// THIS TOOL ONLY EVER READS. It opens the source with a read-only Sheets scope and has no write path
// at all — not a batchUpdate, not a values.update. A document someone hands you is their working
// record, not your fixture: the one time a kit generator was pointed at a reference doc, it came
// within one API call of deleting the only sheet in it.
//
//   SOURCE_SSID=<id> node tools/bs-import-sheet.mjs > bug-summary.json
//   SOURCE_SSID=<id> SOURCE_TAB=Statistic PROJECT_NAME=Acme node tools/bs-import-sheet.mjs -o bug-summary.json
//
// Env:
//   SOURCE_SSID=<spreadsheetId>   required — the document to read
//   SOURCE_TAB=<title>            the tab to read (default: the first one)
//   PROJECT_NAME=<Project>        goes into the summary (default: the document's title)
//   SUMMARY_ID=BS-YYYY-MM-DD      default: BS-<today>
//   SEVERITIES="Critical,Major,Minor,Trivial"   the scale to expect (default: those four)
//   MCP_SHEETS_DIR=<path>         OAuth dir (auto-resolved by walking up to the nearest .mcp.json)
//
// The layout it understands is the one this kit's format came from — and the one nearly every
// hand-made bug sheet converges on:
//   • a SITE band     — a lone label in column A
//   • a PAGE band     — a label in column A that is mirrored into the counter block
//   • an ISSUE row    — a NUMBER in column A, a summary in B, a severity in C, free-text notes in D
// Columns can be moved with COL_* env vars if the source differs; nothing else is assumed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const die = (m, c = 1) => { console.error(`bs-import-sheet: ${m}`); process.exit(c); };
const findUp = (rels) => {
  let dir = HERE;
  for (let i = 0; i < 12; i++) {
    for (const rel of rels) if (fs.existsSync(path.join(dir, rel))) return path.join(dir, rel);
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  return null;
};
if (process.argv.includes('--help')) {
  console.log('bs-import-sheet — READ an existing bug-summary spreadsheet into a bug-summary.json. Never writes to the source. Env: SOURCE_SSID SOURCE_TAB PROJECT_NAME SUMMARY_ID SEVERITIES MCP_SHEETS_DIR · -o <file>');
  process.exit(0);
}

const SSID = process.env.SOURCE_SSID || die('SOURCE_SSID is required — the spreadsheet to read.', 2);
const SCALE = (process.env.SEVERITIES || 'Critical,Major,Minor,Trivial').split(',').map((s) => s.trim());
const OUT = (() => { const i = process.argv.indexOf('-o'); return i > -1 ? process.argv[i + 1] : null; })();
const COL = { n: 0, summary: 1, severity: 2, notes: 3, mirror: 4 };
for (const k of Object.keys(COL)) if (process.env[`COL_${k.toUpperCase()}`]) COL[k] = Number(process.env[`COL_${k.toUpperCase()}`]);

const { createRequire } = await import('node:module');
const mcpDir = process.env.MCP_SHEETS_DIR
  || (findUp(['QA-SetupKit/MCP-configurations/mcp-sheets/package.json', 'MCP-configurations/mcp-sheets/package.json']) || '').replace(/\/package\.json$/, '');
if (!mcpDir) die('mcp-sheets not found — set MCP_SHEETS_DIR (see MCP-configurations/README.md).', 2);
const req = createRequire(path.join(mcpDir, 'package.json'));
const { google } = req('googleapis');
const c0 = JSON.parse(fs.readFileSync(path.join(mcpDir, 'credentials.json'), 'utf8'));
const cred = c0.installed || c0.web;
const token = JSON.parse(fs.readFileSync(path.join(mcpDir, 'token.json'), 'utf8'));
const auth = new google.auth.OAuth2(cred.client_id, cred.client_secret, (cred.redirect_uris && cred.redirect_uris[0]) || 'http://localhost:3456/oauth2callback');
auth.setCredentials(token);
// Read-only client. Not a convention — a scope. This tool cannot write even if a future edit tried to.
const sheets = google.sheets({ version: 'v4', auth });

const meta = await sheets.spreadsheets.get({ spreadsheetId: SSID, fields: 'properties(title),sheets(properties(title,sheetId))' });
const tabTitle = process.env.SOURCE_TAB || meta.data.sheets[0].properties.title;
const got = await sheets.spreadsheets.get({
  spreadsheetId: SSID, ranges: [`'${tabTitle.replace(/'/g, "''")}'`], includeGridData: true,
  fields: 'sheets(data(rowData(values(formattedValue))))',
});
const rows = got.data.sheets?.[0]?.data?.[0]?.rowData || [];
if (!rows.length) die(`tab "${tabTitle}" is empty or unreadable.`, 1);

const fv = (r, i) => { const v = r.values || []; return ((i < v.length ? v[i].formattedValue : '') || '').toString(); };
const slug = (s) => s.toLowerCase().replace(/\[[^\]]*\]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
const hostRisk = (u) => (/screencast\.com|prnt\.sc|dropbox\.com\/scl|lightshot/i.test(u) ? 'expiring'
  : /drive\.google\.com|mega\.nz/i.test(u) ? 'durable' : 'unknown');

// The source has no status column — that is the defect this document type exists to fix. Whatever
// disposition it recorded is buried in free text, so it is READ OUT of that text and, where the text
// says nothing, the status is "unknown". It is NEVER guessed to be fixed: an imported roll-up that
// assumed silence meant success would be the exact lie the format is meant to stop telling.
function statusFrom(note) {
  const t = note.toLowerCase().trim();
  if (!t) return 'unknown';
  if (/not fixed|isn'?t resolved|still (there|reproduc)|reopen/.test(t)) return 'reopened';
  if (/improvement|rea?ssigned|as agreed|another manner|feature request/.test(t)) return 'reassigned';
  if (/duplicate/.test(t)) return 'duplicate';
  if (/can'?t fix|unable to|unavailable to implement|plugin|third[- ]party|won'?t fix/.test(t)) return 'wontfix';
  if (/skip|stop list|lack of time|not (checked|tested|verified)/.test(t)) return 'not-verified';
  if (/verified|re-?checked|confirmed fixed/.test(t)) return 'verified';
  if (/resolved|fixed|it'?s ok/.test(t)) return 'fixed';        // someone SAID fixed — not verified
  return 'not-verified';
}

const sites = [];
let site = null, page = null;
const pageIds = new Set(), issueIds = new Set();
const unmapped = [];
for (let i = 0; i < rows.length; i++) {
  const a = fv(rows[i], COL.n).trim();
  const b = fv(rows[i], COL.summary);
  const sev = fv(rows[i], COL.severity).trim();
  const note = fv(rows[i], COL.notes).trim();
  const mirror = fv(rows[i], COL.mirror).trim();
  if (!a) continue;

  if (/^\d+$/.test(a) && b.trim()) {                             // ── issue row
    if (!page) { unmapped.push(`row ${i + 1}: an issue before any page band — skipped`); continue; }
    let id = `${site.id}-${page.id}-${a}`.replace(/[^a-z0-9._-]/g, '-');
    while (issueIds.has(id)) id += '-x';
    issueIds.add(id);
    const issue = { id, summary: b.replace(/\s+/g, ' ').trim(), severity: SCALE.includes(sev) ? sev : SCALE[SCALE.length - 1], status: statusFrom(note) };
    if (!SCALE.includes(sev)) unmapped.push(`row ${i + 1}: severity "${sev}" is not in the scale — filed as "${issue.severity}"`);
    const ev = [];
    let m; const re = /(https?:\/\/[^\s*)"]+)/g;
    while ((m = re.exec(b))) ev.push({ url: m[1], kind: /\.mp4|screen ?record|dropbox/i.test(b) ? 'screen-record' : 'screenshot', hostRisk: hostRisk(m[1]) });
    if (ev.length) issue.evidence = ev;
    if (note) issue.notes = note;
    page.issues.push(issue);
  } else if (mirror === a) {                                     // ── page band (name mirrored into the counters)
    if (!site) { site = { id: 'site', name: 'Site', pages: [] }; sites.push(site); }
    let id = slug(a); const base = id; let n = 2;
    while (pageIds.has(`${site.id}/${id}`)) id = `${base}-${n++}`;
    pageIds.add(`${site.id}/${id}`);
    page = { id, name: a.trim(), issues: [] };
    site.pages.push(page);
  } else if (!/^\d+$/.test(a) && !mirror) {                      // ── site band (a lone label)
    site = { id: slug(a), name: a.trim(), pages: [] };
    sites.push(site);
    page = null;
  }
}
const nIssues = sites.reduce((x, s) => x + s.pages.reduce((y, p) => y + p.issues.length, 0), 0);
if (!nIssues) die(`read ${rows.length} rows from "${tabTitle}" but recognised no issue rows.\n`
  + '  The importer expects: a NUMBER in the № column, a summary beside it, a severity beside that.\n'
  + '  Point it at the right columns with COL_N / COL_SUMMARY / COL_SEVERITY / COL_NOTES / COL_MIRROR.', 1);

const today = new Date().toISOString().slice(0, 10);
const summary = {
  summaryId: process.env.SUMMARY_ID || `BS-${today}`,
  project: process.env.PROJECT_NAME || meta.data.properties.title,
  generatedAt: `${today}T00:00`,
  source: {
    kind: 'imported-sheet',
    ref: `docs.google.com/spreadsheets/d/${SSID} (tab "${tabTitle}")`,
    note: 'Imported from an existing spreadsheet. The source had no status column, so statuses were read out of its free-text notes; rows that said nothing are "unknown" — NOT assumed fixed. Re-triage before anyone reads this as a status report.',
  },
  severityScale: SCALE,
  sites,
};
const json = JSON.stringify(summary, null, 2) + '\n';
if (OUT) fs.writeFileSync(OUT, json); else process.stdout.write(json);

const unknown = sites.flatMap((s) => s.pages.flatMap((p) => p.issues)).filter((i) => i.status === 'unknown').length;
console.error(`bs-import-sheet: read "${tabTitle}" (READ-ONLY) → ${sites.length} site(s) · ${sites.reduce((a, s) => a + s.pages.length, 0)} page(s) · ${nIssues} issue(s)`);
if (unknown) console.error(`  ⚠ ${unknown} of ${nIssues} row(s) came in as status "unknown" — the source records none. They are counted as STILL OWED. Triage them; do not let a reader assume they were fixed.`);
for (const u of unmapped.slice(0, 10)) console.error(`  ⚠ ${u}`);
if (unmapped.length > 10) console.error(`  ⚠ … and ${unmapped.length - 10} more`);
