// axe-core accessibility scan via Playwright. Copy to
// <Project>/Accessibility-Testing/tools/, fill PAGES + AUTH, run: node a11y-scan.mjs
// Output: scans/<slug>.json per page + summary.json + console table
// (violations by WCAG criterion × impact). Paths are anchored to this script's
// folder, so the run directory doesn't matter.
//
// Prereqs (in tools/ or any ancestor folder of it):
//   npm i playwright axe-core && npx playwright install chromium
import { chromium } from 'playwright';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');
const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));

// ==== FILL PER PROJECT ====
// Env wins over the literal: unattended runs (CI-Integration kit) set BASE_URL, and a URL
// hardcoded in a tool that runs unattended is how a scan ends up aimed at the wrong env.
const BASE = process.env.BASE_URL ?? 'https://staging.example.com';   // TODO: staging only, never prod
const PAGES = [                                        // TODO: reuse UI-Automation routes
  { slug: 'home', path: '/' },
  { slug: 'login', path: '/login' },
];
const AUTH = null;                                     // TODO: null | { user, pass, loginPath }
// ==========================

const outDir = path.join(TOOLS_DIR, '..', 'scans');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();

if (AUTH) {
  await page.goto(BASE + AUTH.loginPath);
  // TODO: adapt selectors to the project's login form (see UI-Automation locators)
  await page.fill('input[type="email"]', AUTH.user);
  await page.fill('input[type="password"]', AUTH.pass);
  await page.keyboard.press('Enter');
  await page.waitForLoadState('networkidle');
}

const summary = [];
for (const p of PAGES) {
  try {
    await page.goto(BASE + p.path, { waitUntil: 'networkidle', timeout: 30000 });
    await page.addScriptTag({ path: AXE_PATH });
    const result = await page.evaluate(async () =>
      await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] } }));
    fs.writeFileSync(path.join(outDir, `${p.slug}.json`), JSON.stringify(result, null, 2));
    for (const v of result.violations) {
      summary.push({
        page: p.slug, rule: v.id, impact: v.impact,
        wcag: v.tags.filter(t => /^wcag\d/.test(t)).join(','),
        nodes: v.nodes.length, help: v.help,
      });
    }
    console.log(`${p.slug}: ${result.violations.length} violation rules, ${result.incomplete.length} needs-review`);
  } catch (e) {
    // one bad page (goto timeout, networkidle never settles on polling SPAs) must
    // not kill the run — record it and keep sweeping
    summary.push({ page: p.slug, rule: 'SCAN-FAILED', impact: 'n/a', wcag: '', nodes: 0, help: e.message });
    console.error(`${p.slug}: SCAN-FAILED — ${e.message}`);
  }
}
await browser.close();

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.table(summary.map(({ page, rule, impact, wcag, nodes }) => ({ page, rule, impact, wcag, nodes })));
console.log(`\nDetail JSONs in ${outDir}/. Triage: 'incomplete' = needs-review, not violations;`);
console.log('shared-component duplicates across pages = ONE bug (dedup rule).');
