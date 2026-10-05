#!/usr/bin/env node
// Design-Conformance — read a design bundle's OWN screen/story annotations into a map.
//
// Modern design exports (Claude Design, Figma "dev-ready" HTML, storybook-style bundles) often ship
// a machine-readable cross-reference: each mounted node carries data-story-id / data-screen-id /
// data-epic-id / data-route / data-state, and a hidden index lists every screen the design claims
// to cover. Reading that beats inferring coverage from the pictures — it is the DESIGNER'S claim
// about what a screen implements, so a disagreement found against it is a real disagreement rather
// than the reviewer's interpretation.
//
// Most of those attributes are set at mount time by the app's own framework, so grepping the file
// finds only the handful that are static and misses every screen. This drives the bundle like a
// user and snapshots the annotations at each labelled step.
//
// Usage:
//   PLAYWRIGHT_DIR=<dir with node_modules/playwright> [UI_FLOW_CHANNEL=chrome] \
//     node dc-map.mjs --src=<bundle .html|url> --out=<story-map.json> [--walk=<walk.mjs>]
//        [--attrs=data-story-id,data-screen-id,...] [--manifest-selector='a[href^="#scr-"]']
//
// Without --walk it reads only the landing screen plus the manifest — enough to answer "what does
// this design claim to cover", not "what does each screen do". A walk module default-exports
// `async (f, mark) => {}`; `f` is the kit's flow helper (tap / expect / scrollToEnd / restart) and
// `mark(label)` snapshots the annotations currently mounted.
//
//   export default async (f, mark) => {
//     await mark('LANDING');
//     await f.tap('Get started');
//     await mark('ONBOARDING');
//   };
//
// Fails loudly: a walk step that cannot find its control aborts with the label it died on, because
// a map that silently stops halfway reads as "the design covers less than it does".
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRecorder } from './lib-ui-flow.mjs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=')];
}));
const need = (k) => { if (!args[k]) { console.error(`dc-map: need --${k}=`); process.exit(2); } return args[k]; };

const SRC = need('src');
const OUT = resolve(need('out'));
const ATTRS = (args.attrs || 'data-screen-id,data-story-id,data-epic-id,data-flow,data-route,data-state')
  .split(',').map((s) => s.trim()).filter(Boolean);
// A design bundle's hidden "index of screens" is a manifest of what it CLAIMS to cover. Its default
// shape here is anchor links to screen ids; override for a bundle that indexes some other way.
const MANIFEST_SEL = args['manifest-selector'] || 'a[href^="#scr-"]';

const walk = args.walk
  ? (await import(pathToFileURL(resolve(args.walk)).href)).default
  : null;

const rec = await createRecorder({ src: SRC, out: resolve(OUT, '..'), video: false });
const steps = [];

const { result } = await rec.clip('dc-map', async (f) => {
  const mark = async (label) => {
    steps.push({ step: label, annotated: await f.annotations(ATTRS) });
  };
  const manifest = await f.page.evaluate(
    (sel) => Array.from(document.querySelectorAll(sel)).map((el) => el.textContent.trim()),
    MANIFEST_SEL);
  if (walk) {
    await walk(f, mark);
  } else {
    await mark('LANDING');
  }
  return { manifest };
});
await rec.close();

const map = { source: SRC, capturedAttrs: ATTRS, manifest: result.manifest, walk: steps };
writeFileSync(OUT, JSON.stringify(map, null, 2));

console.log(`screens claimed by the manifest: ${result.manifest.length}`);
if (!walk) {
  console.log('no --walk given: only the landing screen was annotated.');
  console.log('Coverage read from this file alone is NOT a coverage claim — say so in the report.');
}
for (const s of steps) {
  const ids = [...new Set(s.annotated.map((a) => a['story-id']).filter(Boolean))];
  console.log(`  ${s.step.padEnd(30)} ${ids.length ? ids.join(' / ') : '— no story annotation —'}`);
}
