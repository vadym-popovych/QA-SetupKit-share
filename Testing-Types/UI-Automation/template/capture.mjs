// UI-Automation kit — phase-1 DOM capture (QA-SetupKit/Testing-Types/UI-Automation)
// Usage: node capture.mjs config.json
// Captures every page from config into <outDir>/dom-snapshots + /screenshots.
// Extend per project for phase 2+ (clicks into forms/cards/tabs) — see SETUP.md §4:
// only click selectors you have SEEN in phase-1 snapshots, never assumed ones.
import { chromium } from 'playwright';
import fs from 'fs';

const cfg = JSON.parse(fs.readFileSync(process.argv[2] || 'config.json', 'utf8'));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
fs.mkdirSync(`${cfg.outDir}/dom-snapshots`, { recursive: true });
fs.mkdirSync(`${cfg.outDir}/screenshots`, { recursive: true });

async function dump(page, name) {
  fs.writeFileSync(`${cfg.outDir}/dom-snapshots/${name}.html`, await page.content());
  await page.screenshot({ path: `${cfg.outDir}/screenshots/${name}.png` }).catch(() => {});
  log('dumped', name, '| url:', page.url());
}
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(cfg.settleMs ?? 10000);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: cfg.viewport });
const page = await ctx.newPage();
page.on('pageerror', () => {});

// pages flagged beforeAuth (login screen itself)
for (const p of cfg.pages.filter(p => p.beforeAuth)) {
  await page.goto(cfg.baseUrl + p.path, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await settle(page);
  await dump(page, p.name);
}

// auth
if (cfg.auth.mode === 'creatio-api') {
  const r = await ctx.request.post(cfg.baseUrl + cfg.auth.creatioApi.loginPath, {
    data: { UserName: cfg.auth.user, UserPassword: cfg.auth.password },
  });
  log('auth', r.status(), (await r.text()).slice(0, 120)); // expect "Code":0
} else if (cfg.auth.mode === 'form') {
  const f = cfg.auth.form;
  await page.goto(cfg.baseUrl + f.loginUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator(f.userSelector).fill(cfg.auth.user);
  await page.locator(f.passwordSelector).fill(cfg.auth.password);
  await page.locator(f.submitSelector).click();
  await page.waitForURL(new RegExp(f.successUrlPattern), { timeout: 60000 });
  log('auth via form ok');
}

for (const p of cfg.pages.filter(p => !p.beforeAuth)) {
  await page.goto(cfg.baseUrl + p.path, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await settle(page);
  await dump(page, p.name);
}

await browser.close();
log('done');
