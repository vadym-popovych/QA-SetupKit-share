// Render a Drive document to per-page PNGs — the eyes of the verify-by-RENDER rule
// (TEST_REPORT_RULES §7). Works for any Drive file, not just test reports:
//   - a native Google Doc is exported straight to PDF;
//   - a non-native file (e.g. a client's reference .docx) is exported through a CONVERT-COPY
//     that is trashed afterwards — the original is never touched (read-only rule).
//
//   node tr-render.mjs <driveFileId> <out-prefix>
//     → <out-prefix>.pdf + <out-prefix>-pNN.png (@2x)
//
// PNG rendering: pdftoppm when present, else the bundled render-pdf.swift (macOS
// CoreGraphics — no brew dependencies). Compare the pages WITH YOUR OWN EYES; an owner's
// screenshot is a trigger, never the verification loop.
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

const [fileId, prefix] = process.argv.slice(2);
if (!fileId || !prefix) { console.error('usage: node tr-render.mjs <driveFileId> <out-prefix>'); process.exit(2); }

const creds = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'credentials.json')));
const token = JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'token.json')));
const c = creds.installed || creds.web;
const oauth = new google.auth.OAuth2(c.client_id, c.client_secret,
  (c.redirect_uris && c.redirect_uris[0]) || 'http://localhost:3456');
oauth.setCredentials(token);
const drive = google.drive({ version: 'v3', auth: oauth });

const meta = await drive.files.get({ fileId, fields: 'mimeType,name' });
let exportId = fileId, copyId = null;
if (!meta.data.mimeType.startsWith('application/vnd.google-apps.')) {
  // Someone's file (docx, …): never export-convert in place — copy-convert, export, trash.
  const copy = await drive.files.copy({ fileId,
    requestBody: { name: 'tmp-render-conversion (auto-trashed)', mimeType: 'application/vnd.google-apps.document' } });
  exportId = copyId = copy.data.id;
}
const pdf = await drive.files.export({ fileId: exportId, mimeType: 'application/pdf' }, { responseType: 'arraybuffer' });
const pdfPath = `${prefix}.pdf`;
fs.writeFileSync(pdfPath, Buffer.from(pdf.data));
if (copyId) await drive.files.update({ fileId: copyId, requestBody: { trashed: true } });

const swift = path.join(path.dirname(fileURLToPath(import.meta.url)), 'render-pdf.swift');
try {
  execFileSync('pdftoppm', ['-png', '-r', '144', pdfPath, `${prefix}-p`], { stdio: 'inherit' });
} catch {
  execFileSync('swift', [swift, pdfPath, prefix], { stdio: 'inherit' });
}
console.log(JSON.stringify({ source: meta.data.name, pdf: pdfPath, pages: `${prefix}-pNN.png` }));
