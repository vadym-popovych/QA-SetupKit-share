// bs-severities-from-sheet.mjs — read the Severity column BACK off the tab into severities.json.
//
// THE OTHER HALF OF THE LOOP. `bs-from-redmine` proposes severities; a human validates them; and that
// validation happens where a human actually works — in the Sheet, on the dropdown, not by hand-editing a
// 230-entry JSON. This tool closes the loop: it reads what the owner typed and writes it into the RECORD,
// so the next rebuild carries his judgement instead of the agent's hypothesis.
//
// Without it, the owner's triage lives ONLY on the tab, and the first rebuild from an unchanged JSON
// quietly reverts all of it — which is exactly the data loss `bs-sheet`'s carry-over exists to prevent.
//
//   SUMMARY=./bug-summary.json TARGET_SSID=<id> BS_TAB="Statistic" node tools/bs-severities-from-sheet.mjs --dry-run
//   … --reviewed-all -o ./severities.json
//
// Env: SUMMARY · TARGET_SSID · BS_TAB / BS_GID · SEVERITY_FILE (the existing one, to preserve rationales)
// Flags: --dry-run (read + report, write nothing) · --reviewed-all · -o <file>
//
// ── WHAT THIS TOOL REFUSES TO DO ──────────────────────────────────────────────────────────
// It cannot tell "the owner read this row and agreed with me" from "the owner never got to this row".
// Both leave the cell exactly as the agent wrote it. So it does NOT promote an unchanged severity to
// `owner` on its own — that would fabricate a human triage for every row nobody looked at, which is the
// one thing the whole severitySource mechanism exists to make impossible.
//
//   changed on the tab   → severitySource "owner". He demonstrably touched it.
//   unchanged on the tab → stays "agent-proposed", and the tool says how many.
//   --reviewed-all       → the OWNER asserts he went through every row; unchanged ones become "owner" too.
//
// The assertion is his to make, and the flag is how he makes it. The tool will not make it for him.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const REVIEWED_ALL = process.argv.includes('--reviewed-all');
const die = (m, c = 1) => { console.error(`bs-severities-from-sheet: ${m}`); process.exit(c); };
if (process.argv.includes('--help')) {
  console.log('bs-severities-from-sheet — read the Severity column back off the tab into severities.json, so the owner\'s '
    + 'triage becomes the record instead of living only in Sheets. Changed cells → severitySource "owner"; unchanged ones stay '
    + '"agent-proposed" unless --reviewed-all asserts every row was reviewed. Env: SUMMARY TARGET_SSID BS_TAB BS_GID SEVERITY_FILE · -o <file>');
  process.exit(0);
}

const argOut = (() => { const i = process.argv.indexOf('-o'); return i > 0 ? process.argv[i + 1] : null; })();
const readJson = (p, m) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { die(`${m}: ${e.message}`, 2); } };
const findUp = (rels) => {
  let dir = HERE;
  for (let i = 0; i < 12; i++) {
    for (const rel of rels) if (fs.existsSync(path.join(dir, rel))) return path.join(dir, rel);
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  return null;
};

// ── the record: gives us the row ORDER, the ids, and what the agent proposed ───────────────
const SUMMARY_PATH = process.env.SUMMARY || path.join(process.cwd(), 'bug-summary.json');
if (!fs.existsSync(SUMMARY_PATH)) die(`no summary at ${SUMMARY_PATH} — set SUMMARY=<path>.`, 2);
const S = readJson(SUMMARY_PATH, 'cannot read the summary');
const SCALE = S.severityScale || [];

const issues = [];   // in TAB ORDER — sites → modules → rows, exactly as bs-sheet lays them out
for (const site of S.sites ?? []) for (const page of site.pages ?? []) for (const it of page.issues ?? []) {
  issues.push({ id: it.id, summary: it.summary, severity: it.severity, module: page.name });
}
if (!issues.length) die('the summary has no issues in it.', 2);

const SSID = process.env.TARGET_SSID;
if (!SSID) die('TARGET_SSID is required — the document to read the severities out of.', 2);
const TAB = process.env.BS_TAB || 'Statistic';
const GID = process.env.BS_GID ? Number(process.env.BS_GID) : null;

// Existing severities: we keep each row's `severityRationale`, because a rationale the agent wrote is
// still the reason the number STARTED where it did — losing it would make an owner's later change
// unauditable ("it says Major now; what did it say before, and why?").
const SEV_PATH = process.env.SEVERITY_FILE || argOut || path.join(path.dirname(SUMMARY_PATH), 'severities.json');
const prior = fs.existsSync(SEV_PATH) ? readJson(SEV_PATH, 'cannot read the existing severities') : {};

// ── read the tab ──────────────────────────────────────────────────────────────────────────
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
const sheets = google.sheets({ version: 'v4', auth });

const meta = await sheets.spreadsheets.get({ spreadsheetId: SSID, fields: 'sheets.properties(sheetId,title)' });
const tab = meta.data.sheets.find((s) => s.properties.title === TAB || (GID !== null && s.properties.sheetId === GID));
if (!tab) die(`no tab "${TAB}"${GID !== null ? ` / gid ${GID}` : ''} in that document.`, 1);

const g = await sheets.spreadsheets.get({ spreadsheetId: SSID, ranges: [`'${tab.properties.title.replace(/'/g, "''")}'`],
  includeGridData: true, fields: 'sheets(data(rowData(values(formattedValue,note))))' });
const rowData = g.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
if (!rowData.some((r) => /^bs:/m.test(String(r?.values?.[0]?.note || '')))) {
  die(`the tab "${tab.properties.title}" carries no "bs:" note — this tool did not write it, so its columns are not\n`
    + '  the ones we would be reading. Point BS_TAB/BS_GID at the tab bs-sheet built.', 1);
}

const normTxt = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const sameSummary = (a, b) => normTxt(a).slice(0, 120) === normTxt(b).slice(0, 120);

// Columns come from the tab's OWN header row — the option flags may have differed when it was built.
let O = null;
for (const r of rowData) {
  const hv = (r?.values ?? []).map((v) => normTxt(v?.formattedValue));
  const iSum = hv.indexOf('summary'), iSev = hv.indexOf('severity');
  if (iSum >= 0 && iSev >= 0) { O = { n: hv.indexOf('№'), summary: iSum, severity: iSev }; break; }
}
if (!O || O.n < 0) die('could not find the header row (№ / Summary / Severity) on that tab.', 1);

const tabRows = [];
for (const r of rowData) {
  const vals = r?.values ?? [];
  const at = (i) => (i >= 0 ? String(vals[i]?.formattedValue ?? '') : '');
  if (!/^\d+$/.test(at(O.n).trim()) || !at(O.summary).trim()) continue;    // band rows carry a name, not an ordinal
  tabRows.push({ summary: at(O.summary), severity: at(O.severity).trim() });
}

// ── match, and REFUSE to guess ────────────────────────────────────────────────────────────
if (tabRows.length !== issues.length) {
  die(`the tab has ${tabRows.length} bug row(s) and the summary has ${issues.length}. They are not the same document.\n`
    + '  Rebuild the tab from this summary first (bs-sheet.mjs), or point SUMMARY at the JSON it was built from.\n'
    + '  Reading severities across a mismatch would attach the owner\'s judgement to the WRONG bugs.', 1);
}

const out = {};
const changed = [], unchanged = [], offScale = [], blank = [], mismatch = [];
issues.forEach((it, i) => {
  const row = tabRows[i];
  if (!sameSummary(row.summary, it.summary)) { mismatch.push(`row ${i + 1}: tab says "${row.summary.slice(0, 50)}…", JSON says "${it.summary.slice(0, 50)}…"`); return; }
  const sev = row.severity;
  const was = prior[it.id] || {};
  if (!sev) { blank.push(`${it.id} — ${it.summary.slice(0, 60)}`); out[it.id] = { ...was }; return; }
  if (SCALE.length && !SCALE.includes(sev)) { offScale.push(`${it.id}: "${sev}" is not in the scale [${SCALE.join(', ')}]`); return; }

  if (sev !== it.severity) {
    changed.push(`${it.id}  ${it.severity} → ${sev}   ${it.summary.slice(0, 55)}`);
    out[it.id] = { severity: sev, severitySource: 'owner',
      severityRationale: `owner triage on the tab (was "${it.severity}" — ${was.severityRationale || 'agent-proposed'})` };
  } else {
    unchanged.push(it.id);
    out[it.id] = REVIEWED_ALL
      ? { severity: sev, severitySource: 'owner', severityRationale: `owner reviewed and kept the agent's rating (${was.severityRationale || 'agent-proposed'})` }
      : { severity: sev, severitySource: was.severitySource || 'agent-proposed', severityRationale: was.severityRationale };
  }
});

if (mismatch.length) {
  console.error(`\n⛔ ${mismatch.length} row(s) on the tab do not line up with the summary:`);
  mismatch.slice(0, 10).forEach((m) => console.error(`  • ${m}`));
  die('the tab and the summary have drifted apart. Rebuild the tab, then read it back.', 1);
}
if (offScale.length) {
  console.error(`\n⛔ ${offScale.length} severity value(s) are outside the scale — no counter on the tab counts them:`);
  offScale.forEach((m) => console.error(`  • ${m}`));
  die('fix them on the tab (the Severity column is a dropdown for exactly this reason), then re-run.', 1);
}

console.log(`bs-severities-from-sheet: "${tab.properties.title}" — ${tabRows.length} row(s) read`);
console.log(`  ${changed.length} changed by the owner · ${unchanged.length} left as the agent rated them${blank.length ? ` · ${blank.length} BLANK` : ''}`);
if (changed.length) {
  console.log('\nChanged:');
  changed.slice(0, 40).forEach((c) => console.log(`  • ${c}`));
  if (changed.length > 40) console.log(`  … and ${changed.length - 40} more`);
}
if (blank.length) {
  console.log(`\n⚠ ${blank.length} row(s) have an EMPTY severity cell — counted by no column, invisible in every total:`);
  blank.slice(0, 10).forEach((b) => console.log(`  • ${b}`));
}

const owner = Object.values(out).filter((v) => v.severitySource === 'owner').length;
const proposed = Object.values(out).filter((v) => v.severitySource === 'agent-proposed').length;
console.log(`\nAfter this write: ${owner} owner-triaged · ${proposed} still agent-proposed.`);
if (proposed && !REVIEWED_ALL) {
  console.log(`\n  ${unchanged.length} row(s) are UNCHANGED, and this tool cannot tell whether you read them and agreed`);
  console.log('  or never got to them — both leave the cell exactly as the agent wrote it. They stay "agent-proposed".');
  console.log('  Been through every row? Say so, and they become yours:  --reviewed-all');
  console.log('  It is your assertion to make. The tool will not make it for you.');
}

if (DRY) { console.log('\n--dry-run: nothing written.'); process.exit(0); }
const dest = argOut || SEV_PATH;
fs.writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`);
console.log(`\n→ ${dest}`);
console.log('  Now re-run bs-from-redmine with SEVERITY_FILE=<this>, then rebuild the tab.');
