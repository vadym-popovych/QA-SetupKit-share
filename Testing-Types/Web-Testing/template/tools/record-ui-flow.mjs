#!/usr/bin/env node
// Web-Testing kit — record a UI FLOW as video, with Android-style tap dots (WEB_TESTING_RULES r.13).
//
// The sibling `record-network-bug.mjs` records one thing very well: a request opened through the
// DevTools tabs. This one is for the other half of the evidence problem — showing that a *flow*
// does something, which no screenshot can carry: that a control SKIPS a required step, that a guard
// refuses the last item, that a screen is reachable in one tap when the spec says it must not be.
//
// A library, not a CLI: a flow has waits, branches and assertions in it, so the caller writes the
// steps in JS and this module owns everything that is the same every time — browser, viewport, the
// tap indicator, one video per clip, and failing loudly when a named control never appeared.
//
//   import { createRecorder } from '<kit>/Testing-Types/Web-Testing/template/tools/record-ui-flow.mjs';
//
//   const rec = await createRecorder({ out: 'evidence', src: '<url or file>' });
//   await rec.clip('gate-is-skippable', async (f) => {
//     await f.tap('Continue with Google');
//     await f.tap('Skip', { hold: 2600 });
//     await f.expect('Pick apps to track');          // throws if it never renders
//   });
//   await rec.close();
//
// WHY TOUCH AND NOT MOUSE. Phone-shaped UIs are tapped, not clicked, and the kit's
// `touch-indicator.js` (Android's "Show taps") only draws for touch events. Playwright's
// `touchscreen.tap()` is instantaneous — the dot would flash for ~2 frames — so taps go through CDP
// with the finger held down for a readable moment. Chrome synthesises the click from `touchEnd`, so
// the app reacts exactly as it would to a real tap. Pass `pointer: 'mouse'` for a desktop UI, and
// the cursor-and-ring `mouse-indicator.js` is used instead.
//
// EVIDENCE HONESTY. The indicator is an overlay the harness draws, not part of the product — say so
// in the evidence note (same rule as `touch-indicator.js`). And a clip that quietly skipped half its
// steps is worse than no clip: every helper throws, `clip()` re-throws with the clip name, and
// nothing is left behind on failure.
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const INDICATOR = { touch: join(HERE, 'touch-indicator.js'), mouse: join(HERE, 'mouse-indicator.js') };

// Never let a recording of a real product land inside the kit. The kit ships to teammates and must
// name no client; the same guard exists in record-network-bug.mjs, for the same reason.
function refuseKitPath(out) {
  for (let d = HERE; ; d = dirname(d)) {
    if (existsSync(join(d, 'Rules-Guide', 'kit-lint'))) {
      if (out === d || out.startsWith(d + '/')) {
        throw new Error(`record-ui-flow: out points inside the kit (${out}).\n`
          + '  Recordings hold real product screens; write them to <Project>/<Testing-Type>/ instead.');
      }
      break;
    }
    const up = dirname(d);
    if (up === d) break;   // a project copy of this tool, no kit root above it — nothing to protect
  }
}

/**
 * @param {object} o
 * @param {string}  o.src            page under test — an http(s) URL or a local file path
 * @param {string}  o.out            directory the finished clips are written to (never inside the kit)
 * @param {string} [o.playwrightDir] dir holding node_modules/playwright; default env PLAYWRIGHT_DIR
 * @param {string} [o.channel]       browser channel, e.g. 'chrome'; default env UI_FLOW_CHANNEL, else
 *                                   playwright's own bundled build
 * @param {{width:number,height:number}} [o.viewport]  default 760×900 (phone-shaped mockups)
 * @param {'touch'|'mouse'} [o.pointer]                default 'touch'
 * @param {object} [o.tapStyle]      passed to the indicator: { size, fill, ring, glow }. The kit
 *                                   default dot is white and VANISHES on a light UI — override it.
 * @param {number} [o.tapHold]       ms the finger stays down, default 190
 * @param {number} [o.settle]        ms to wait after load before the first step, default 900
 * @param {boolean} [o.video]        default true. Set false to reuse the same walk engine for a
 *                                   non-recording pass — reading a mockup's own annotations, say —
 *                                   without paying for video encoding.
 */
export async function createRecorder(o) {
  const src = o.src ?? fail('src');
  const out = resolve(o.out ?? fail('out'));
  refuseKitPath(out);
  const pwDir = o.playwrightDir || process.env.PLAYWRIGHT_DIR;
  if (!pwDir) throw new Error('record-ui-flow: need playwrightDir (or PLAYWRIGHT_DIR) — the dir holding node_modules/playwright');
  const channel = o.channel || process.env.UI_FLOW_CHANNEL || undefined;
  const viewport = o.viewport || { width: 760, height: 900 };
  const pointer = o.pointer || 'touch';
  const tapHold = o.tapHold ?? 190;
  const settle = o.settle ?? 900;
  const url = /^https?:|^file:/.test(src) ? src : pathToFileURL(resolve(src)).href;

  mkdirSync(out, { recursive: true });
  const { chromium } = await import(pathToFileURL(join(pwDir, 'node_modules', 'playwright', 'index.mjs')).href);
  let browser;
  try {
    browser = await chromium.launch({ channel });
  } catch (e) {
    throw new Error(`record-ui-flow: could not launch chromium${channel ? ` (channel "${channel}")` : ''}.\n`
      + '  Either run `npx playwright install chromium`, or pass channel:"chrome" / UI_FLOW_CHANNEL=chrome\n'
      + `  to use the browser already on this machine. Original error: ${e.message}`);
  }

  const made = [];
  return {
    /** Record one clip. `steps(f)` receives the flow helpers; anything thrown fails the whole run. */
    async clip(name, steps) {
      const wantVideo = o.video !== false;
      const dir = join(out, `.rec-${name}`);
      rmSync(dir, { recursive: true, force: true });
      const ctx = await browser.newContext({
        viewport,
        hasTouch: pointer === 'touch',   // isMobile is deliberately NOT set: it changes layout
                                         // emulation, and most mockups are authored for desktop
        ...(wantVideo ? { recordVideo: { dir, size: viewport } } : {}),
      });
      if (o.tapStyle) {
        // Its own init script: they run in order, so the config exists before the indicator reads it.
        await ctx.addInitScript((s) => { window.__TOUCH_INDICATOR__ = s; }, o.tapStyle);
      }
      await ctx.addInitScript({ path: INDICATOR[pointer] });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      const cdp = pointer === 'touch' ? await ctx.newCDPSession(page) : null;
      await page.goto(url);
      await page.waitForTimeout(settle);

      const visible = (text, exact, nth) =>
        page.getByText(text, { exact }).locator('visible=true').nth(nth);

      const f = {
        page, errors,
        /** Reload and replay from the start — for branches that cannot be reached by going back. */
        async restart() { await page.goto(url); await page.waitForTimeout(settle); },
        /** Tap at raw viewport coordinates. */
        async tapAt(x, y) {
          if (cdp) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            await page.waitForTimeout(tapHold);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          } else {
            await page.mouse.move(x, y, { steps: 12 });
            await page.waitForTimeout(120);
            await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();
          }
        },
        /**
         * Tap a control by its visible text, then hold so the recording shows the result being read.
         * exact-by-default and visible-only on purpose: mockups often ship a hidden screen index
         * whose entries contain the same words as the real controls.
         */
        async tap(text, { hold = 1400, exact = true, nth = 0 } = {}) {
          const loc = visible(text, exact, nth);
          await loc.waitFor({ state: 'visible', timeout: 5000 });
          const box = await loc.boundingBox();
          if (!box) throw new Error(`tap("${text}"): matched but has no box — is it clipped to 0×0?`);
          await f.tapAt(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(hold);
        },
        /** Assert a control/label rendered. Use it for the "and it landed here" half of a finding. */
        async expect(text, { exact = true, timeout = 5000, hold = 0 } = {}) {
          await visible(text, exact, 0).waitFor({ state: 'visible', timeout })
            .catch(() => { throw new Error(`expect("${text}"): never became visible in ${timeout}ms`); });
          if (hold) await page.waitForTimeout(hold);
        },
        /** Count visible matches — e.g. "there are six Metric cards" before iterating them. */
        count(text, { exact = true } = {}) {
          return page.getByText(text, { exact }).locator('visible=true').count();
        },
        /** Scroll an inner scroller to its end (mockups usually scroll a div, not the window). */
        async scrollToEnd(selector, { hold = 800 } = {}) {
          const moved = await page.evaluate((s) => {
            const el = document.querySelector(s);
            if (!el) return false;
            el.scrollTop = el.scrollHeight; return true;
          }, selector);
          if (!moved) throw new Error(`scrollToEnd("${selector}"): no such element`);
          await page.waitForTimeout(hold);
        },
        async wait(ms) { await page.waitForTimeout(ms); },
        /**
         * Read data-* annotations off whatever is mounted right now. Design bundles increasingly
         * ship their own story/screen cross-reference; reading it beats inferring one from the
         * pictures, because it is the designer's claim rather than the reviewer's guess.
         */
        async annotations(attrs) {
          return page.evaluate((list) => {
            const sel = list.map((a) => `[${a}]`).join(',');
            return Array.from(document.querySelectorAll(sel)).map((el) => {
              const o = { tag: el.tagName.toLowerCase() };
              for (const a of list) if (el.hasAttribute(a)) o[a.replace(/^data-/, '')] = el.getAttribute(a);
              const t = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 70);
              if (t) o.text = t;
              return o;
            });
          }, attrs);
        },
      };

      let result;
      try {
        result = await steps(f);
        if (wantVideo) await page.waitForTimeout(1200);   // let the last state sit before the cut
      } catch (e) {
        await ctx.close();
        rmSync(dir, { recursive: true, force: true });
        throw new Error(`clip "${name}" failed: ${e.message}`);
      }
      await ctx.close();                        // playwright writes the video on context close
      if (!wantVideo) {
        made.push({ name, file: null, errors: [...errors], result });
        return { file: null, errors: [...errors], result };
      }
      const file = readdirSync(dir).find((x) => x.endsWith('.webm'));
      if (!file) { rmSync(dir, { recursive: true, force: true }); throw new Error(`clip "${name}": no video produced`); }
      const dest = join(out, `${name}.webm`);
      renameSync(join(dir, file), dest);
      rmSync(dir, { recursive: true, force: true });
      made.push({ name, file: dest, errors: [...errors], result });
      return { file: dest, errors: [...errors], result };
    },
    /** What was recorded, in order — including each clip's collected page errors. */
    get recorded() { return made; },
    async close() { await browser.close(); return made; },
  };
}

function fail(k) { throw new Error(`record-ui-flow: need ${k}`); }
