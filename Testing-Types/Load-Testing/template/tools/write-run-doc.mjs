// Render a per-run Google Doc report from a PROJECT-SUPPLIED content file and file it into a
// Drive date-folder (<DRIVE_ROOT_FOLDER, default ClaudeProjects> / <PROJECT_NAME> / Load Testing
// / Reports / <date>). Reuses the mcp-sheets OAuth (drive + documents scope). Idempotent: an
// existing same-named doc in the folder is UPDATED IN PLACE, keeping its id — so a link shared
// with the owner survives every re-run (link-stability invariant; see the comment at the lookup).
// Only stray duplicates left by older runs are trashed. This header said "trashed and recreated"
// until 28/07/2026, describing behaviour the code had already stopped doing — a reader would have
// concluded that shared links die on every run, which is the opposite of what it guarantees.
//
// NO project data lives in this tool — the narrative comes from a JSON content file, so the kit
// ships a generic renderer and each project supplies its own run write-up (see run-doc.example.json).
//
//   PROJECT_NAME=<Project> RUN_DOC_CONTENT=./run-doc.json \
//     NODE_PATH=<mcp>/node_modules node tools/write-run-doc.mjs
//
// Link stability is machine-checked: the doc id is recorded per RUN in the project's
// `.link-ledger.json` (QA_LINK_LEDGER overrides the module path; deliberate re-point:
// LINK_LEDGER_ADOPT=1) and a re-run that would land on a DIFFERENT document refuses
// before anything is trashed or wiped.
//
// Content JSON shape (see run-doc.example.json):
//   { "runId": "2026-07-06-slotfill", "date": "2026-07-06",
//     "titleSuffix": "Load Test Report",                 // optional; default "Load Test Report"
//     "subtitle": [ "Run ID: … · Date: … · Env: …", "Scenario: … · Method: …" ],
//     "sections": [ { "heading": "1. Purpose",
//                     "paragraphs": [ "…" ],             // plain paragraphs
//                     "metrics": [ ["Virtual users","20"], … ] } ] }  // bold "label: value" lines
//
// Prints { documentId, docLink, folderLink } as JSON.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

// Find the shared mcp-sheets install by walking UP from this file — never a path on one
// person's laptop (that is exactly what made the kit unportable). Override with MCP_SHEETS_DIR.
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

const PROJECT = process.env.PROJECT_NAME;            // e.g. "<Project>" — names the Drive folder
if (!PROJECT) {
  console.error('write-run-doc: PROJECT_NAME is not set — it names the Drive folder the report lands in.');
  process.exit(2);
}
const CONTENT_PATH = process.env.RUN_DOC_CONTENT;    // project-supplied narrative (JSON)
if (!CONTENT_PATH) {
  console.error('write-run-doc: RUN_DOC_CONTENT is not set — this renderer carries no run data.');
  console.error('  Point it at a JSON content file (see run-doc.example.json for the shape).');
  process.exit(2);
}
let content;
try {
  content = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));
} catch (e) {
  console.error(`write-run-doc: cannot read RUN_DOC_CONTENT (${CONTENT_PATH}): ${e.message}`);
  process.exit(2);
}
if (!content.runId || !content.date || !Array.isArray(content.sections)) {
  console.error('write-run-doc: content must have { runId, date, sections[] } (see run-doc.example.json).');
  process.exit(2);
}

const creds = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'credentials.json')));
const token = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'token.json')));
const c = creds.installed || creds.web;
const oauth = new google.auth.OAuth2(c.client_id, c.client_secret,
  (c.redirect_uris && c.redirect_uris[0]) || 'http://localhost:3456');
oauth.setCredentials(token);
const docs = google.docs({ version: 'v1', auth: oauth });
const drive = google.drive({ version: 'v3', auth: oauth });

const RUN_ID = content.runId;
const DATE = content.date;
const TITLE = `${PROJECT} — ${content.titleSuffix || 'Load Test Report'} — ${RUN_ID}`;

// ---- Build the doc body from the content file ----
const requests = [];
let cursor = 1;
function add(text, opts = {}) {
  requests.push({ insertText: { location: { index: cursor }, text } });
  const start = cursor, end = cursor + text.length;
  if (opts.style) requests.push({ updateParagraphStyle: {
    range: { startIndex: start, endIndex: end },
    paragraphStyle: { namedStyleType: opts.style },
    fields: 'namedStyleType' } });
  if (opts.bold) requests.push({ updateTextStyle: {
    range: { startIndex: start, endIndex: opts.boldLen ? start + opts.boldLen : end },
    textStyle: { bold: true }, fields: 'bold' } });
  cursor = end;
}
const H2 = t => add(t + '\n', { style: 'HEADING_2' });
const P  = t => add(t + '\n', { style: 'NORMAL_TEXT' });
const M  = (label, val) => add(`${label}: ${val}\n`, { style: 'NORMAL_TEXT', bold: true, boldLen: label.length + 1 });

add(TITLE + '\n', { style: 'TITLE' });
for (const line of content.subtitle || []) P(line);
for (const s of content.sections) {
  if (s.heading) H2(s.heading);
  for (const p of s.paragraphs || []) P(p);
  for (const m of s.metrics || []) M(m[0], String(m[1]));
}

// ---- Create doc, apply content, move into date-folder ----
async function ensureFolder(name, parentId) {
  const q = [`name = '${name.replace(/'/g, "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.folder'", 'trashed = false'];
  q.push(parentId ? `'${parentId}' in parents` : "'root' in parents");
  const r = await drive.files.list({ q: q.join(' and '), fields: 'files(id)', spaces: 'drive' });
  if (r.data.files.length) return r.data.files[0].id;
  const f = await drive.files.create({ requestBody: {
    name, mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : undefined }, fields: 'id' });
  return f.data.id;
}

// Everything created in Drive lives under a single root folder, never at Drive root next to
// the user's OWN project folders (workspace CLAUDE.md, Drive-structure convention). The root
// name defaults to ClaudeProjects; override with DRIVE_ROOT_FOLDER for a different account.
const DRIVE_ROOT = process.env.DRIVE_ROOT_FOLDER || 'ClaudeProjects';
let parent = null;
for (const seg of [DRIVE_ROOT, PROJECT, 'Load Testing', 'Reports', DATE]) parent = await ensureFolder(seg, parent);

// A same-titled doc is UPDATED IN PLACE — a shared link must survive a re-run (universal
// link-stability invariant, Project-Configuration rule 10; the Docs analogue of the Sheets
// fixed-gid rule). Only stray duplicates from older runs are trashed.
//
// "Updated in place" is a promise nobody can verify by looking: a recreated doc is identical
// in the UI and every shared link to the old one is already dead. The ledger records this
// run's documentId keyed by RUN ID (the purpose — a retitled re-run is a NEW doc the title
// lookup cannot find, and it gets REFUSED, not silently re-recorded) and refuses a re-run
// that would land on a different document, before a stray is trashed or a body wiped.
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
if (!ledger) console.error('write-run-doc: WARNING — link-ledger not found, the doc\'s link stability was NOT checked (set QA_LINK_LEDGER).');
const guardDocLink = (id) => {
  if (!ledger) return;
  try {
    ledger.assertStableLink({ kind: 'doc', key: `load-testing/run-doc/${RUN_ID}`, id, title: TITLE });
  } catch (e) {
    if (e instanceof ledger.LinkLedgerError) {
      console.error(`write-run-doc: ${e.message}\n  The report doc was not touched.`);
      process.exit(1);
    }
    throw e;
  }
};
const prior = await drive.files.list({
  q: `name = '${TITLE.replace(/'/g, "\\'")}' and '${parent}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.document'`,
  fields: 'files(id)', spaces: 'drive' });
let documentId;
if (prior.data.files.length) {
  documentId = prior.data.files[0].id;
  guardDocLink(documentId);                                 // before ANY mutation below
  for (const stray of prior.data.files.slice(1))
    await drive.files.update({ fileId: stray.id, requestBody: { trashed: true } });
  const cur = await docs.documents.get({ documentId });
  const end = cur.data.body.content.at(-1).endIndex;
  if (end > 2) await docs.documents.batchUpdate({ documentId, requestBody: { requests: [
    { deleteContentRange: { range: { startIndex: 1, endIndex: end - 1 } } }] } });
} else {
  const doc = await docs.documents.create({ requestBody: { title: TITLE } });
  documentId = doc.data.documentId;
  await drive.files.update({ fileId: documentId, addParents: parent, fields: 'id' });
  guardDocLink(documentId);      // first sighting of this run — or a refusal if the run's
                                 // recorded doc exists but the title lookup missed it (retitle)
}
await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
const meta = await drive.files.get({ fileId: documentId, fields: 'webViewLink' });

console.log(JSON.stringify({
  documentId, docLink: meta.data.webViewLink,
  folderLink: `https://drive.google.com/drive/folders/${parent}` }, null, 2));
