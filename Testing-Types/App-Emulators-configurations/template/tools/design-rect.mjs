// The DESIGN side of an evidence collage, boxed FROM THE DOM — never by eye (EMULATOR_RULES §3.7:
// frame coordinates come from element bounding boxes). Renders one frame of an HTML design export,
// saves that frame as a PNG, and prints the rect of every requested text IN THAT PNG's pixels, so
// the green box drawn by collage.py lands exactly on the element.
//
//   DESIGN_HTML=<export.html> PLAYWRIGHT_DIR=<dir with node_modules/playwright> \
//     node design-rect.mjs <frameId> <out.png> "<text>" ["<text>" | "re:<regex>" ...]
//
// Env:
//   DESIGN_HTML     the design export (HTML). Required. It stays where the owner keeps it — never
//                   copied into a repo (it is someone else's deliverable; cite it by name + hash).
//   PLAYWRIGHT_DIR  directory holding node_modules/playwright. Required.
//   FRAME_ATTR      attribute that names a frame (default "data-f").
//   PW_CHANNEL      browser channel (default "chrome" — the installed Chrome, no browser download).
//   DESIGN_WIDTH    viewport width in CSS px (default 560 — wide enough for one phone frame).
//
// Output (stdout, JSON): { frame, png, scale, rects: { "<text>": [x1,y1,x2,y2] | null } }
// A null rect means the text was not found in that frame — fix the query, never draw by hand.
// Matching is case-sensitive; the SMALLEST element containing the text wins.
//
// Why the polling: design exports often mount frame content lazily (virtualised canvases). One
// short wait returns an empty frame; the loop scrolls the frame into view and re-reads until every
// requested text is present (up to ~20 s), then screenshots the frame element itself.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DESIGN = process.env.DESIGN_HTML;
const PW = process.env.PLAYWRIGHT_DIR;
const ATTR = process.env.FRAME_ATTR || 'data-f';
const CHANNEL = process.env.PW_CHANNEL || 'chrome';
const WIDTH = Number(process.env.DESIGN_WIDTH || 560);
const [frameId, outPng, ...texts] = process.argv.slice(2);
if (!DESIGN || !PW || !frameId || !outPng || !texts.length) {
  console.error('usage: DESIGN_HTML=… PLAYWRIGHT_DIR=… node design-rect.mjs <frameId> <out.png> "<text>" …');
  process.exit(2);
}

const { chromium } = await import(pathToFileURL(path.join(PW, 'node_modules', 'playwright', 'index.mjs')).href);
const browser = await chromium.launch({ channel: CHANNEL });
const SCALE = 2;
const page = await browser.newPage({ viewport: { width: WIDTH, height: 1000 }, deviceScaleFactor: SCALE });
await page.goto(pathToFileURL(path.resolve(DESIGN)).href, { waitUntil: 'load', timeout: 120000 });
const frame = page.locator(`[${ATTR}="${frameId}"]`).first();
try { await frame.waitFor({ state: 'attached', timeout: 60000 }); }
catch { console.error(`design-rect: no [${ATTR}="${frameId}"] in ${path.basename(DESIGN)} — wrong frame id or FRAME_ATTR`); await browser.close(); process.exit(1); }

let found = {};
for (let i = 0; i < 30; i++) {
  await frame.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  found = await frame.evaluate((root, texts) => {
    const fb = root.getBoundingClientRect();
    const out = {};
    for (const t of texts) {
      const re = t.startsWith('re:') ? new RegExp(t.slice(3), 's') : null;
      let best = null;
      for (const el of root.querySelectorAll('*')) {
        const txt = (el.innerText || el.textContent || '').trim();
        if (!txt || !(re ? re.test(txt) : txt.includes(t))) continue;
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        const area = b.width * b.height;
        if (!best || area < best.area) best = { area, r: [b.left - fb.left, b.top - fb.top, b.right - fb.left, b.bottom - fb.top] };
      }
      out[t] = best ? best.r : null;
    }
    return out;
  }, texts);
  if (Object.values(found).every(Boolean)) break;
}
await frame.screenshot({ path: outPng });
await browser.close();
const rects = Object.fromEntries(Object.entries(found).map(([k, r]) => [k, r && r.map(v => Math.round(v * SCALE))]));
console.log(JSON.stringify({ frame: frameId, png: outPng, scale: SCALE, rects }, null, 2));
if (Object.values(rects).some(r => !r)) process.exitCode = 1;
