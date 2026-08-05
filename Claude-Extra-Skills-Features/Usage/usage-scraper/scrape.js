// Usage-page scraper for claude.ai (Pro rolling-limit "% used / resets in ...").
// Modes:
//   node scrape.js --login-open   -> opens a visible Chrome (separate profile) on
//                                    claude.ai, stays open ~4 min so you can log in.
//                                    Cookies persist to ./profile automatically.
//   node scrape.js                -> headless: navigate to the usage page, extract
//                                    "% used" + reset, write ~/.claude/usage-snapshot.json
//   node scrape.js --dump         -> same, but also print the page innerText (debug)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE = path.join(__dirname, 'profile');
const OUT = path.join(process.env.HOME, '.claude', 'usage-snapshot.json');
const LOGIN = process.argv.includes('--login-open');
const DUMP = process.argv.includes('--dump') || LOGIN;
// candidate URLs to try in order
const URLS = (process.env.USAGE_URL ? [process.env.USAGE_URL] : [
  'https://claude.ai/settings/usage',
  'https://claude.ai/settings/billing',
  'https://claude.ai/settings',
]);

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: !LOGIN,
    channel: 'chrome',
    viewport: { width: 1280, height: 950 },
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  if (LOGIN) {
    await page.goto('https://claude.ai/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    console.log('LOGIN WINDOW OPEN — log into claude.ai. Cookies save automatically.');
    await page.waitForTimeout(240000); // 4 min to log in
    await ctx.close();
    console.log('login window closed; session saved to', PROFILE);
    return;
  }

  let result = null;
  for (const url of URLS) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) { console.error('goto', url, '->', e.message); continue; }
    await page.waitForTimeout(2500);
    const cur = page.url();
    if (/login|\/auth|signin/i.test(cur)) {
      console.error('NOT LOGGED IN (redirected to', cur, ') -> run: node scrape.js --login-open');
      await ctx.close(); process.exit(2);
    }
    const text = await page.evaluate(() => document.body.innerText);
    if (DUMP) { console.log('=== URL:', cur, '==='); console.log(text.slice(0, 3500)); console.log('--- end dump ---'); }
    const pct = (text.match(/(\d{1,3})\s*%\s*used/i) || [])[1];
    const reset = (text.match(/resets?[^\n]{0,40}/i) || [])[0];
    if (pct || /current session|usage/i.test(text)) {
      const lines = text.split('\n').map(s => s.trim()).filter(Boolean)
        .filter(l => /%|resets?|current session|weekly|all models|usage|limit/i.test(l));
      result = { ts: new Date().toISOString(), url: cur, percentUsed: pct ? Number(pct) : null, reset: reset || null, lines: lines.slice(0, 30) };
      break;
    }
  }
  if (result) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
    console.log('SNAPSHOT:', JSON.stringify(result, null, 2));
  } else {
    console.error('Could not find usage info on the tried pages (see dump above).');
  }
  await ctx.close();
})();
