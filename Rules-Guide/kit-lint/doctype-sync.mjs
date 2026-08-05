// doctype-sync.mjs — does every document type the kit ships have a row on the owner's
// "Doc-type validation" tracker?  READ-ONLY on the Sheet: it never writes, never rebuilds.
//
//   DOCTYPE_SSID=<sheet-id> node Rules-Guide/kit-lint/doctype-sync.mjs           # report
//   DOCTYPE_SSID=<sheet-id> node Rules-Guide/kit-lint/doctype-sync.mjs --strict  # exit 1 if unregistered
//
// The tracker's Sheet id is the OWNER'S document and never ships with the kit — pass it via
// `DOCTYPE_SSID` (workspace-side registries record it; on the reference machine the Demo project's
// wrapper sets it). `DOCTYPE_TAB` overrides the tab name (default "Doc-type validation").
//
// WHY THIS EXISTS (03/08/2026; ported to the kit 05/08/2026). The standing rule is "a new document
// type in the kit → a row on the tracker the SAME day", because that tab is how the owner tracks
// what is and is not yet covered. A forgotten row does not look like anything: the kit is fine, the
// tab is fine, and a whole doc type is simply invisible to the person using the tab to decide what
// to work on next. It had already been forgotten once. Every other standing duty in this workspace
// that could be checked mechanically IS checked — kit-lint, --committed, autonomy-eval — and this
// one was still running on memory.
//
// WHAT IT CAN AND CANNOT PROVE (the same discipline lib-validate-grid.mjs states about itself):
//   it proves    — a doc type the kit ships has NO row that names any of its artifacts;
//                  a row names an artifact that no longer exists in the kit (a rename broke it).
//   it does NOT  — judge whether a row's STATUS is truthful. "Validated" means the OWNER validated
//                  it; no script can know that, and a script that guessed would be the fabricated
//                  Pass this workspace exists to prevent. Statuses are read and shown, never checked.
//
// MATCHING. A doc type is REGISTERED when some tracker row mentions one of its distinctive artifact
// filenames (tools, generators, schemas). That is deliberate rather than name-matching: the row title
// is prose the owner writes ("Bug report / candidate" for the Bug-Reports folder), and matching prose
// to folder names needs a judgement call. The `Kit template / tool` column already names real files,
// so the tracker itself carries the link — this only reads it back.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// The kit root is two levels up from this script — no author-machine path, works in any clone.
const KIT = process.env.KIT_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MCP = `${KIT}/MCP-configurations/mcp-sheets`;
const ID = process.env.DOCTYPE_SSID;
const TAB = process.env.DOCTYPE_TAB || 'Doc-type validation';
const STRICT = process.argv.includes('--strict');

const die = (m, c = 2) => { console.error(`doctype-sync: ${m}`); process.exit(c); };
if (!fs.existsSync(KIT)) die(`no kit at ${KIT} — set KIT_DIR.`);
if (!ID) die('DOCTYPE_SSID is not set — the tracker Sheet id is the owner\'s document and does not ship with the kit.\n'
  + '  Set it in the environment (the workspace project memory records where the tracker lives).');

// Files that exist in EVERY module and therefore identify nothing.
const GENERIC = /^(README|SETUP|SHEET_TEMPLATE|DOC_TEMPLATE|CLAUDE\.starter|.*_RULES|package(-lock)?|allow|modules)\.(md|json)$/i;
const ARTIFACT = /\.(mjs|js|sh|gs|schema\.json)$/;

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};

/** Distinctive filenames inside a folder — the names a tracker row would cite. */
const artifactsIn = (dir) => [...new Set(walk(dir)
  .map((f) => path.basename(f))
  .filter((b) => ARTIFACT.test(b) && !GENERIC.test(b)))];

// ── The universe of doc types ─────────────────────────────────────────────────────────────────────
// The canon: "QA-Documentation/: one subfolder per document TYPE — the folder IS the type boundary",
// with Custom-Reports/ as a nested GROUP whose members are types in their own right. Plus the
// standalone document templates other kits ship (*.template.md) — a template IS a document type,
// which is why the tracker already carries rows for RTM, SESSION, MATRIX and the rest.
const QADOC = path.join(KIT, 'QA-Documentation');
const GROUPS = new Set(['Custom-Reports']);
const types = [];
const subdirs = (d) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);

for (const name of subdirs(QADOC)) {
  if (GROUPS.has(name)) {
    for (const member of subdirs(path.join(QADOC, name))) {
      types.push({ label: `${name}/${member}`, kind: 'folder', names: artifactsIn(path.join(QADOC, name, member)) });
    }
  } else {
    types.push({ label: name, kind: 'folder', names: artifactsIn(path.join(QADOC, name)) });
  }
}
// A *.template.md that lives inside a doc-type folder is part of that type, not a type of its own.
for (const f of walk(KIT).filter((f) => f.endsWith('.template.md'))) {
  if (f.startsWith(QADOC + path.sep)) continue;
  types.push({ label: path.relative(KIT, f), kind: 'template', names: [path.basename(f)] });
}

// ── The tracker ───────────────────────────────────────────────────────────────────────────────────
const require = createRequire(path.join(MCP, 'package.json'));
let sheets;
try {
  const { google } = require('googleapis');
  const cr = JSON.parse(fs.readFileSync(`${MCP}/credentials.json`, 'utf8'));
  const tk = JSON.parse(fs.readFileSync(`${MCP}/token.json`, 'utf8'));
  const c = cr.installed || cr.web;
  const o = new google.auth.OAuth2(c.client_id, c.client_secret, 'http://localhost:3456');
  o.setCredentials(tk);
  sheets = google.sheets({ version: 'v4', auth: o });
} catch (e) {
  die(`cannot reach the Sheets API via ${MCP} — ${e.message}\n`
    + '  This check reads the LIVE tab on purpose: it is richer than any builder\'s seed list, because\n'
    + '  rows get appended and statuses hand-edited directly. Re-auth with `node server.mjs --auth`.');
}

const res = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `${TAB}!A2:D200` })
  .catch((e) => die(`cannot read "${TAB}" — ${e.message}`));
const rows = (res.data.values || []).filter((r) => (r[0] || '').trim());
if (!rows.length) die(`"${TAB}" has no rows — refusing to report every doc type as unregistered off an empty read.`, 1);

const haystack = rows.map((r) => `${r[0] || ''} ${r[1] || ''}`).join(' \n ').toLowerCase();
const registered = (t) => t.names.some((n) => haystack.includes(n.toLowerCase()));

// ── Report ────────────────────────────────────────────────────────────────────────────────────────
const missing = types.filter((t) => !registered(t));
const noArtifacts = types.filter((t) => !t.names.length);

// Reverse direction: a row that cites a file the kit no longer has — a rename that silently
// disconnected the owner's tracker from the thing it tracks.
const kitFiles = new Set(walk(KIT).map((f) => path.basename(f)));
const stale = [];
// Longest extension first — `json` before `js`, or every *.schema.json row reports a phantom
// "*.schema.js". And a citation written with a wildcard (`bug-spec*.example.json`) names a FAMILY of
// files, not one file: the `*` never reaches the match, so it is detected by looking at the character
// in front of it. Both of these produced false "the kit no longer has this" on the first run — a check
// that cries wolf gets muted, and a muted check is worse than none.
for (const r of rows) {
  const cell = `${r[1] || ''}`;
  const seen = new Set();
  for (const m of cell.matchAll(/[\w-][\w.-]*\.(?:mjs|json|js|sh|gs|md)(?![\w])/g)) {
    const cited = m[0];
    // Walk back to where the citation really starts: `bug-spec*.example.json` makes the match begin at
    // "example.json", so looking one character back finds a "." and misses the wildcard entirely.
    let s = m.index;
    while (s > 0 && /[\w.*-]/.test(cell[s - 1])) s--;
    if (cell.slice(s, m.index).includes('*') || seen.has(cited)) continue;
    seen.add(cited);
    if (!kitFiles.has(cited)) stale.push({ row: r[0], cited });
  }
}

const byStatus = {};
for (const r of rows) byStatus[(r[2] || '—').trim()] = (byStatus[(r[2] || '—').trim()] || 0) + 1;

console.log(`doctype-sync · ${types.length} doc type(s) in the kit · ${rows.length} row(s) on "${TAB}"`);
console.log(`  tracker status: ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(' · ')}  (read, not checked — only the owner can say "Validated")`);

if (noArtifacts.length) {
  console.log(`\n  ℹ ${noArtifacts.length} doc type(s) ship no distinctive artifact, so this check cannot speak for them:`);
  noArtifacts.forEach((t) => console.log(`     • ${t.label}`));
}
if (stale.length) {
  console.log(`\n  ⚠ ${stale.length} tracker row(s) cite a file the kit no longer has — a rename broke the link:`);
  stale.forEach((s) => console.log(`     • "${s.row}" cites ${s.cited}`));
}
if (missing.length) {
  console.log(`\n  ✗ ${missing.length} doc type(s) have NO row that names any of their artifacts:`);
  missing.forEach((t) => console.log(`     • ${t.label}  (${t.names.slice(0, 4).join(', ')}${t.names.length > 4 ? ', …' : ''})`));
  console.log('\n  Add a row to the LIVE tab the same day — format and dropdown copied from the neighbour row.');
  console.log('  Do NOT rebuild the tab to add it: the tracker builder deletes and recreates, and the live');
  console.log('  rows carry hand-edited statuses and notes that exist nowhere else.');
} else {
  console.log('\n  ✓ every doc type the kit ships is named by a tracker row.');
}

if (STRICT && (missing.length || stale.length)) process.exit(1);
