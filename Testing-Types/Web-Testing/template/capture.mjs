#!/usr/bin/env node
// Web-Testing kit — capture & machine checks (v2, lessons from <Project> landing round 1).
// Usage: PLAYWRIGHT_DIR=<scratchpad> node capture.mjs --out=runs/<date>-<slug>
//        [--browsers=chromium,firefox,webkit] [--url=<override>]
// Reads ../config.json (copy of config.template.json). Playwright resolved from
// PLAYWRIGHT_DIR (dir containing node_modules/playwright) or the script's own dir.
//
// Checks per browser×viewport combo:
//  - console/page errors, HTTP >=400, failed requests
//  - horizontal overflow (scrollWidth) + offender list
//  - FIXED-CLIP: children of position:fixed/sticky ancestors cut by the screen edge
//    (invisible to scrollWidth — the header-badge class of bug)
//  - scroll-reveal completeness, hidden-aware (display:none/zero-size => hiddenOk)
//  - animation inventory: WAAPI byName/playState + JS transform sampling (t0 vs t+2s)
//  - accordion open/close; carousel variant visibility + hover-pause where visible
//  - anchor targets for nav/footer hash links
//  - placeholder-link audit: href="#N", example.com, bare social roots, span-"links"
//  - shots: viewport hero, full page, per-section, accordion-open

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=') || 'true'];
}));

const CFG_PATH = join(__dirname, '..', 'config.json');
if (!existsSync(CFG_PATH)) {
  console.error(`capture: ${CFG_PATH} not found.`);
  console.error('  Copy config.template.json -> config.json and set baseUrl + pages (see SETUP.md).');
  process.exit(2);   // a missing config is a BLOCKED run, not a crash the reader must decode
}
const cfg = JSON.parse(readFileSync(CFG_PATH, 'utf8'));
const BASE_URL = args.url || cfg.baseUrl;
const OUT = args.out;
if (!OUT) { console.error('need --out=<runDir>'); process.exit(1); }
mkdirSync(join(OUT, 'shots'), { recursive: true });
mkdirSync(join(OUT, 'logs'), { recursive: true });

const pwDir = process.env.PLAYWRIGHT_DIR || __dirname;
const pw = await import(pathToFileURL(join(pwDir, 'node_modules', 'playwright', 'index.mjs')).href);

const BROWSERS = (args.browsers || 'chromium,firefox,webkit').split(',');
const ALL_VPS = [...cfg.viewports.mobile, ...cfg.viewports.tablet, ...cfg.viewports.desktop, ...cfg.viewports.large];
const SMOKE_VPS = cfg.smokeViewports || [[390, 844], [768, 1024], [1440, 900], [1920, 1080]];
const REVEAL = cfg.revealSelector || '[data-reveal]';
const REVEAL_CLASS = cfg.revealVisibleClass || 'is-visible';

const results = [];
// The run times itself so nobody has to guess. SETUP used to print "~5-8 min" — a figure the tool
// never measured and nobody could reproduce, while the real wall-clock is pages x viewports x
// engines and belongs to the site under test, not to the kit (28/07/2026).
const startedAt = Date.now();

for (const browserName of BROWSERS) {
  const vps = browserName === 'chromium' ? ALL_VPS : SMOKE_VPS;
  const browser = await pw[browserName].launch();
  for (const [w, h] of vps) {
    const tag = `${browserName}_${w}x${h}`;
    const r = { browser: browserName, viewport: `${w}x${h}`, consoleErrors: [], pageErrors: [], failedRequests: [], warnings: [] };
    // Phone widths get REAL device emulation (mobile UA + touch), not a bare viewport:
    // UA-driven UI (platform store badges, app banners) renders differently on real
    // devices — bare-viewport findings at mobile widths are false positives until
    // re-verified this way (<Project> landing lesson, 12/07/2026).
    // webkit pairs with iPhone UA, chromium/firefox with Android UA; firefox doesn't
    // support isMobile. Emulated state is recorded in r.emulation.
    let ctxOpts = { viewport: { width: w, height: h }, deviceScaleFactor: 1 };
    if (w < 768) {
      const preset = browserName === 'webkit' ? pw.devices['iPhone 14'] : pw.devices['Pixel 7'];
      ctxOpts = { ...preset, ...ctxOpts };
      if (browserName === 'firefox') delete ctxOpts.isMobile;
      r.emulation = browserName === 'webkit' ? 'iPhone 14 (iOS UA)' : 'Pixel 7 (Android UA)';
    }
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') r.consoleErrors.push(m.text().slice(0, 300)); });
    page.on('pageerror', e => r.pageErrors.push(String(e).slice(0, 300)));
    page.on('response', resp => { if (resp.status() >= 400) r.failedRequests.push(`${resp.status()} ${resp.url().slice(0, 200)}`); });
    page.on('requestfailed', req => r.failedRequests.push(`FAILED ${req.failure()?.errorText} ${req.url().slice(0, 200)}`));

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1200);
      r.title = await page.title();

      await page.screenshot({ path: join(OUT, 'shots', `${tag}_0-hero.png`) });

      // horizontal overflow + offenders (non-fixed elements)
      r.overflow = await page.evaluate(() => {
        const de = document.documentElement;
        const over = de.scrollWidth - de.clientWidth;
        const offenders = [];
        if (over > 1) {
          for (const el of document.querySelectorAll('body *')) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && (rect.right > de.clientWidth + 1 || rect.left < -1)) {
              if (getComputedStyle(el).position === 'fixed') continue;
              let sel = el.tagName.toLowerCase();
              if (typeof el.className === 'string' && el.className) sel += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
              offenders.push({ sel, left: Math.round(rect.left), right: Math.round(rect.right) });
              if (offenders.length >= 12) break;
            }
          }
        }
        return { overflowPx: over, offenders };
      });

      // FIXED-CLIP: visible children of fixed/sticky ancestors cut by the screen edge
      r.fixedClip = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const out = [];
        const fixedRoots = [...document.querySelectorAll('body *')].filter(el => {
          const p = getComputedStyle(el).position;
          return p === 'fixed' || p === 'sticky';
        });
        for (const root of fixedRoots) {
          for (const el of [root, ...root.querySelectorAll('*')]) {
            const rect = el.getBoundingClientRect();
            if (rect.width < 8 || rect.height < 8) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
            const cutRight = rect.right - vw, cutLeft = -rect.left;
            if (cutRight > 4 || cutLeft > 4) {
              let sel = el.tagName.toLowerCase();
              if (typeof el.className === 'string' && el.className) sel += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
              out.push({ sel, cutRightPx: Math.round(Math.max(0, cutRight)), cutLeftPx: Math.round(Math.max(0, cutLeft)) });
              if (out.length >= 10) return out;
            }
          }
        }
        return out;
      });

      // slow scroll to bottom (trigger IntersectionObserver reveals)
      await page.evaluate(async () => {
        const de = document.documentElement;
        const step = Math.round(window.innerHeight * 0.75);
        for (let y = 0; y < de.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise(res => setTimeout(res, 260));
        }
        window.scrollTo(0, de.scrollHeight);
        await new Promise(res => setTimeout(res, 500));
      });

      // reveal completeness — hidden-aware
      r.reveals = await page.evaluate(({ REVEAL, REVEAL_CLASS }) => {
        const all = [...document.querySelectorAll(REVEAL)];
        const stuck = [], hiddenOk = [];
        for (const el of all) {
          if (el.classList.contains(REVEAL_CLASS)) continue;
          const rect = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          let sel = el.tagName.toLowerCase();
          if (typeof el.className === 'string' && el.className) sel += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
          if (cs.display === 'none' || rect.width === 0 || rect.height === 0) hiddenOk.push(sel);
          else stuck.push({ sel, opacity: cs.opacity, top: Math.round(rect.top + scrollY) });
        }
        return { total: all.length, visible: all.length - stuck.length - hiddenOk.length, stuck, hiddenOk };
      }, { REVEAL, REVEAL_CLASS });

      // animation inventory (WAAPI) + JS-transform sampling of the carousel container
      const carSel = cfg.carouselContainerSelector;
      r.animations = await page.evaluate((carSel) => {
        const anims = document.getAnimations({ subtree: true });
        const byName = {};
        for (const a of anims) {
          const name = a.animationName || a.constructor.name;
          byName[name] = byName[name] || { count: 0, states: {} };
          byName[name].count++;
          byName[name].states[a.playState] = (byName[name].states[a.playState] || 0) + 1;
        }
        const cont = carSel ? [...document.querySelectorAll(carSel)].find(c => c.getClientRects().length) : null;
        return { byName, jsSample0: cont ? getComputedStyle(cont).transform : null };
      }, carSel);
      if (r.animations.jsSample0 !== null) {
        await page.waitForTimeout(2000);
        r.animations.jsSample2s = await page.evaluate((carSel) => {
          const cont = [...document.querySelectorAll(carSel)].find(c => c.getClientRects().length);
          return cont ? getComputedStyle(cont).transform : null;
        }, carSel);
        r.animations.jsMoves = r.animations.jsSample0 !== r.animations.jsSample2s;
        // hover-pause on the VISIBLE animated container (CSS animation-play-state)
        const contLoc = page.locator(carSel).first();
        const box = await contLoc.boundingBox().catch(() => null);
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 200));
          await page.waitForTimeout(300);
          r.animations.hoverPlayState = await page.evaluate((carSel) => {
            const cont = [...document.querySelectorAll(carSel)].find(c => c.getClientRects().length);
            return cont ? getComputedStyle(cont).animationPlayState : null;
          }, carSel);
          await page.mouse.move(0, 0);
        }
      }

      // accordion
      if (cfg.accordionSelector) {
        const acc = page.locator(cfg.accordionSelector).first();
        if (await acc.count()) {
          await acc.scrollIntoViewIfNeeded();
          await page.waitForTimeout(700);
          await acc.locator('summary, [role="button"], button').first().click();
          await page.waitForTimeout(500);
          r.accordionOpens = await acc.evaluate(el => el.open ?? el.getAttribute('aria-expanded') === 'true');
          await page.screenshot({ path: join(OUT, 'shots', `${tag}_accordion-open.png`) });
        }
      }

      // per-section shots
      for (const [name, sel] of (cfg.sections || [])) {
        const loc = page.locator(sel).first();
        if (await loc.count()) {
          await loc.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(750);
          await loc.screenshot({ path: join(OUT, 'shots', `${tag}_sec-${name}.png`), animations: 'disabled' }).catch(e => r.warnings.push(`shot ${name}: ${String(e).slice(0, 120)}`));
        } else r.warnings.push(`section not found: ${sel}`);
      }

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, 'shots', `${tag}_full.png`), fullPage: true, animations: 'disabled' }).catch(e => r.warnings.push(`fullpage: ${String(e).slice(0, 120)}`));

      // anchors + placeholder-link audit
      r.links = await page.evaluate(() => {
        const anchors = {}, placeholders = [];
        for (const a of document.querySelectorAll('a[href]')) {
          const href = a.getAttribute('href') || '';
          const m = href.match(/^\/?#([\w-]+)$/);
          if (m) anchors[href] = !!document.getElementById(m[1]);
          if (/^#\d*$/.test(href)) placeholders.push({ href, label: (a.getAttribute('aria-label') || a.textContent.trim()).slice(0, 60) });
          if (/https?:\/\/(www\.)?example\.com|@example\.com/.test(href)) placeholders.push({ href, label: a.textContent.trim().slice(0, 60) });
          if (/^https?:\/\/(www\.)?(instagram|x|twitter|tiktok|facebook|youtube)\.com\/?$/.test(href)) placeholders.push({ href, label: 'bare social root' });
        }
        const deadSpans = [...document.querySelectorAll('span[class*="link"]')]
          .filter(s => !s.closest('a') && s.textContent.trim())
          .map(s => s.textContent.trim().slice(0, 40));
        return { anchors, placeholders, deadSpans };
      });
    } catch (e) {
      r.fatal = String(e).slice(0, 500);
    }
    await ctx.close();
    results.push(r);
    console.log(`done ${tag}${r.fatal ? ' FATAL: ' + r.fatal : ''}`);
  }
  await browser.close();
}

writeFileSync(join(OUT, 'logs', 'capture-results.json'), JSON.stringify(results, null, 2));
for (const r of results) {
  const flags = [];
  if (r.fatal) flags.push('FATAL');
  if (r.overflow?.overflowPx > 1) flags.push(`OVERFLOW ${r.overflow.overflowPx}px`);
  if (r.fixedClip?.length) flags.push(`FIXED-CLIP ${r.fixedClip.length}`);
  if (r.reveals?.stuck?.length) flags.push(`STUCK-REVEALS ${r.reveals.stuck.length}`);
  if (r.consoleErrors?.length) flags.push(`CONSOLE-ERR ${r.consoleErrors.length}`);
  if (r.failedRequests?.length) flags.push(`REQ-FAIL ${r.failedRequests.length}`);
  if (r.accordionOpens === false) flags.push('ACCORDION-BROKEN');
  if (r.links?.placeholders?.length) flags.push(`PLACEHOLDER-LINKS ${r.links.placeholders.length}`);
  if (r.links?.deadSpans?.length) flags.push(`DEAD-SPAN-LINKS ${r.links.deadSpans.length}`);
  console.log(`${r.browser} ${r.viewport}: ${flags.length ? flags.join(' | ') : 'clean'}`);
}
const elapsedS = Math.round((Date.now() - startedAt) / 1000);
console.log(`captured ${results.length} combo(s) in ${Math.floor(elapsedS / 60)}m ${String(elapsedS % 60).padStart(2, '0')}s`);
console.log('CAPTURE_DONE');
