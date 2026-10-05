#!/usr/bin/env node
// Export Figma frames to PNG files — the missing half of a design-compliance evidence shot.
//
//   FIGMA_TOKEN_FILE=<path> node figma-export.mjs <fileKey> <nodeId[,nodeId...]> --out=<dir> [--scale=2]
//
// Why this exists: the Figma Dev Mode MCP renders a node INTO THE CONVERSATION, which is enough to
// look at but not enough to build evidence with — a collage is assembled from files on disk. Without
// this, a design-deviation bug can only ever show the actual state and describe the expected one in
// words; with it, "actual | expected" fits in one image (17/08/2026).
//
// Token: a Figma personal access token with File content READ ONLY. Give it via FIGMA_TOKEN_FILE
// (a gitignored file — the workspace convention) or FIGMA_TOKEN. Never inline it in a command.
// fileKey is the segment after /design/ in the file URL:
//   https://www.figma.com/design/<fileKey>/<name>?node-id=1-2
// Node ids may be written 1:2 or 1-2; both are accepted.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || 'true'];
}));
const pos = process.argv.slice(2).filter(a => !a.startsWith('--'));
const [fileKey, nodeArg] = pos;
if (!fileKey || !nodeArg) {
  console.error('usage: FIGMA_TOKEN_FILE=<path> figma-export.mjs <fileKey> <nodeId[,nodeId...]> --out=<dir> [--scale=2]');
  process.exit(2);
}
const OUT = args.out || '.';
const SCALE = args.scale || '2';

const token = (process.env.FIGMA_TOKEN
  || (process.env.FIGMA_TOKEN_FILE && readFileSync(process.env.FIGMA_TOKEN_FILE, 'utf8')
      .split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).join('').trim())
  || '').trim();
if (!token) { console.error('figma-export: no token — set FIGMA_TOKEN_FILE (gitignored file) or FIGMA_TOKEN'); process.exit(2); }

const ids = nodeArg.split(',').map(s => s.trim().replace('-', ':')).filter(Boolean);
mkdirSync(OUT, { recursive: true });

const api = async (url) => {
  const r = await fetch(url, { headers: { 'X-Figma-Token': token } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.err || j.error) throw new Error(`${r.status} ${j.err || j.message || JSON.stringify(j).slice(0, 200)}`);
  return j;
};

const j = await api(`https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(ids.join(','))}&format=png&scale=${SCALE}`);
let ok = 0;
for (const [id, url] of Object.entries(j.images || {})) {
  if (!url) { console.error(`  ${id}: Figma returned no image (node missing, or empty at this scale)`); continue; }
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const file = `${OUT}/${id.replace(':', '-')}.png`;
  writeFileSync(file, buf);
  console.log(`${id}\t${file}\t${buf.length} bytes`);
  ok++;
}
if (!ok) { console.error('figma-export: nothing exported'); process.exit(1); }
