#!/usr/bin/env node
// Turn "which element is wrong" into an annotated bug screenshot — taking the box from the
// captured HIERARCHY, never from eyeballed pixels (EMULATOR_RULES: a hand-drawn box is wrong
// the next time the layout shifts and cannot be regenerated).
//
//   node annotate-from-hierarchy.mjs <targets.json>
//
// targets.json:
// {
//   "shot": "runs/<date>/probe/<NNN>-<step>.png",            // its .json sibling is the hierarchy
//   "out":  "runs/<date>/annotated/<BUG-ID>.png",
//   "targets": [
//     { "match": "<visible text>",           // substring of accessibilityText/text (or "re:<regex>")
//       "color": "red", "label": "<what is wrong here>",
//       "labelPos": "above", "arrow": "left", "pad": 6 },
//     { "rect": [24, 300, 369, 360], "color": "green", "label": "expected" }  // points, fallback
//   ]
// }
// Coordinates in the dump are POINTS; the screenshot is pixels. The scale comes from the root
// node's own bounds, so it is right on any device class without being told the device.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { execFileSync } from 'child_process';

const specPath = process.argv[2];
if (!specPath) { console.error('usage: annotate-from-hierarchy.mjs <targets.json>'); process.exit(2); }
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const shot = resolve(spec.shot);
const dump = shot.replace(/\.png$/, '.json');
if (!existsSync(dump)) { console.error(`no hierarchy dump next to the shot: ${dump}`); process.exit(2); }

const parseBounds = (b) => {
  const m = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(b || '');
  return m ? m.slice(1).map(Number) : null;
};
const nodes = [];
(function walk(n) {
  if (!n || typeof n !== 'object') return;
  const a = n.attributes || {};
  const box = parseBounds(a.bounds);
  if (box) nodes.push({ text: [a.accessibilityText, a.text, a.title, a.value, a.hintText].filter(Boolean).join(' | '), box });
  (n.children || []).forEach(walk);
})(JSON.parse(readFileSync(dump, 'utf8')));

// scale: the widest node IS the screen (the app window's own bounds)
const screenW = Math.max(...nodes.map(n => n.box[2]));
const { width: imgW } = (() => {
  const out = execFileSync('sips', ['-g', 'pixelWidth', shot]).toString();
  return { width: Number(/pixelWidth:\s*(\d+)/.exec(out)[1]) };
})();
const S = imgW / screenW;
if (!Number.isFinite(S) || S <= 0) { console.error('cannot derive the point→pixel scale'); process.exit(2); }

const annotations = [];
const misses = [];
for (const t of spec.targets) {
  let box = t.rect;
  if (!box) {
    const needle = t.match || '';
    const re = needle.startsWith('re:') ? new RegExp(needle.slice(3), 'i') : null;
    const hits = nodes.filter(n => n.text && (re ? re.test(n.text) : n.text.toLowerCase().includes(needle.toLowerCase())));
    if (!hits.length) { misses.push(needle); continue; }
    // the tightest match wins — a parent container that merely CONTAINS the text is not the element
    hits.sort((a, b) => (a.box[2] - a.box[0]) * (a.box[3] - a.box[1]) - (b.box[2] - b.box[0]) * (b.box[3] - b.box[1]));
    box = hits[t.index || 0].box;
  }
  const pad = t.pad ?? 4;
  const [x1, y1, x2, y2] = [(box[0] - pad) * S, (box[1] - pad) * S, (box[2] + pad) * S, (box[3] + pad) * S].map(Math.round);
  annotations.push({ xy: [x1, y1, x2, y2], color: t.color || 'red', ...(t.label ? { label: t.label, labelPos: t.labelPos || 'above' } : {}) });
  if (t.arrow) {
    // the arrow starts clear of the box and points at its edge, so it never covers the defect
    const dx = Math.round(imgW * 0.18), midY = Math.round((y1 + y2) / 2);
    const fromLeft = t.arrow === 'left';
    annotations.push({ type: 'arrow', color: t.color || 'red',
      from: fromLeft ? [Math.max(8, x1 - dx), midY] : [Math.min(imgW - 8, x2 + dx), midY],
      to:   fromLeft ? [x1 - 6, midY] : [x2 + 6, midY] });
  }
}
if (misses.length) { console.error('no element matched: ' + misses.map(m => JSON.stringify(m)).join(', ')); process.exit(3); }

mkdirSync(dirname(resolve(spec.out)), { recursive: true });
const tmp = resolve(spec.out) + '.annotate.json';
writeFileSync(tmp, JSON.stringify({ src: shot, out: resolve(spec.out), annotations }, null, 2));
execFileSync('python3', [resolve(dirname(new URL(import.meta.url).pathname), 'annotate.py'), tmp], { stdio: 'inherit' });
console.log(JSON.stringify({ out: spec.out, scale: Number(S.toFixed(3)), screenPoints: screenW, imagePixels: imgW, boxes: annotations.filter(a => a.xy).length, arrows: annotations.filter(a => a.type === 'arrow').length }));
