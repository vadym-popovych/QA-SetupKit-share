// Visual regression: capture + pixelmatch diff vs golden baselines.
// Copy to <Project>/Visual-Regression/tools/. All artefact paths are anchored to
// this script's folder (golden/current/diff/report.json land in
// <Project>/Visual-Regression/ regardless of the run directory).
// Prereqs (in tools/ or any ancestor): npm i playwright pixelmatch pngjs
//                                      && npx playwright install chromium
//
//   node tools/visual-diff.mjs --baseline   # (re)write golden/ — ONLY on owner approval
//   node tools/visual-diff.mjs              # capture current/, diff vs golden/, write diff/ + report.json
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

// The golden-master guard runs BEFORE the heavy third-party imports (pixelmatch/pngjs), so it
// fires even in an environment where those aren't installed — and so a CI runner is refused
// before it can do any capture. A golden changes only on OWNER approval, logged in BASELINES.md;
// re-baselining under CI (no owner present) is a fabricated Pass, so it is refused outright.
const isBaseline = process.argv.includes('--baseline');
if (isBaseline && (process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI)) {
  console.error('visual-diff: --baseline is FORBIDDEN under CI. A golden is re-recorded only on an');
  console.error('  owner-approved change, logged in BASELINES.md (VISUAL_REGRESSION_RULES). In CI a');
  console.error('  visual diff is fixed by fixing the app, not by re-recording the baseline that caught it.');
  process.exit(2);
}

const { chromium } = await import('playwright');
const { default: pixelmatch } = await import('pixelmatch');
const { PNG } = await import('pngjs');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ==== FILL PER PROJECT ====
// Env wins over the literal: unattended runs (CI-Integration kit) set BASE_URL, and a URL
// hardcoded in a tool that runs unattended is how a diff ends up aimed at the wrong env.
const BASE = process.env.BASE_URL ?? 'https://staging.example.com';   // TODO: staging only
const VIEWPORT = { width: 1440, height: 900 };
const THRESHOLD_PCT = 0.1;                          // % changed pixels → needs a human look
const PAGES = [                                     // TODO: reuse UI-Automation routes
  { slug: 'home', path: '/' },
];
const MASKS = ['[data-testid="clock"]', '.ad-slot']; // TODO: variable regions to hide
// ==========================

const outDir = path.join(ROOT, isBaseline ? 'golden' : 'current');
const goldenDir = path.join(ROOT, 'golden');
const diffDir = path.join(ROOT, 'diff');
for (const d of [outDir, diffDir]) fs.mkdirSync(d, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const report = [];

for (const p of PAGES) {
  try {
    await page.goto(BASE + p.path, { waitUntil: 'networkidle', timeout: 30000 });
    await page.addStyleTag({ content: `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}` });
    await page.evaluate(() => document.fonts.ready);
    for (const sel of MASKS) await page.evaluate(s =>
      document.querySelectorAll(s).forEach(el => { el.style.visibility = 'hidden'; }), sel);
    const file = path.join(outDir, `${p.slug}.png`);
    await page.screenshot({ path: file, fullPage: true });

    if (!isBaseline) {
      const goldenPath = path.join(goldenDir, `${p.slug}.png`);
      if (!fs.existsSync(goldenPath)) { report.push({ page: p.slug, verdict: 'NO-BASELINE' }); continue; }
      const golden = PNG.sync.read(fs.readFileSync(goldenPath));
      const current = PNG.sync.read(fs.readFileSync(file));
      if (golden.width !== current.width || golden.height !== current.height) {
        report.push({ page: p.slug, verdict: 'SIZE-CHANGED', golden: `${golden.width}x${golden.height}`, current: `${current.width}x${current.height}` });
        continue;
      }
      const diff = new PNG({ width: golden.width, height: golden.height });
      const changed = pixelmatch(golden.data, current.data, diff.data, golden.width, golden.height, { threshold: 0.1 });
      const pct = +(100 * changed / (golden.width * golden.height)).toFixed(3);
      const over = pct > THRESHOLD_PCT;
      if (over) fs.writeFileSync(path.join(diffDir, `${p.slug}.png`), PNG.sync.write(diff));
      report.push({ page: p.slug, changedPct: pct, verdict: over ? 'NEEDS-HUMAN-LOOK' : 'pass' });
    }
  } catch (e) {
    // one bad page must not kill the run — record and continue
    report.push({ page: p.slug, verdict: 'CAPTURE-FAILED', error: e.message });
    console.error(`${p.slug}: CAPTURE-FAILED — ${e.message}`);
  }
}
await browser.close();

if (isBaseline) {
  console.log(`Baselines written to ${outDir} — log page/build/date/approver in BASELINES.md`);
} else {
  fs.writeFileSync(path.join(ROOT, 'report.json'), JSON.stringify(report, null, 2));
  console.table(report);
  console.log('Every NEEDS-HUMAN-LOOK: intended → re-baseline (owner OK, log it) | unintended → BUG-NNN tag UI | noise → fix determinism');
}
