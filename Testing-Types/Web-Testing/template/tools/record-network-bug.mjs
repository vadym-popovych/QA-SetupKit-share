#!/usr/bin/env node
// Web-Testing kit — record a REQUEST bug with the requests actually opened (WEB_TESTING_RULES rule 12).
//
// A screen record of a red row list only says "something failed". The developer needs the status
// line, what was sent and what came back — so this walks each complained-about request through
// Headers -> Payload -> Response, holding each tab long enough to read and scrolling when the
// content does not fit.
//
// Usage:
//   PLAYWRIGHT_DIR=<dir with node_modules/playwright> node record-network-bug.mjs \
//     --url=<page under test> --out=<file.mp4> \
//     --requests='<substring>,<substring>'            # rows to open, in order
//     [--tabs=Headers,Payload,Response] [--hold=3000] # ms held on each tab
//     [--filter=Fetch/XHR]                            # '' to leave the type filter alone
//     [--port=9237] [--width=1700] [--height=1000] [--page-width=1440] [--page-height=900]
//     [--settle=5000] [--boot=4000]                   # dead time after the reload / before DevTools is usable
//
// No screen-recording permission is involved: Chrome serves its own front-end over the debugging
// port, so DevTools is recorded as an ordinary page in a second browser.
//
// It FAILS LOUDLY (exit 1) when a named request never appeared or a tab could not be opened — a
// video that silently skipped half its evidence is worse than no video.
//
// Note on the Response viewer: it does not word-wrap. A large body scrolls vertically; a single
// very long line (a minified RSC/JSON payload) scrolls horizontally instead, and the tool picks
// whichever axis actually overflows.
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=')];
}));
const need = (k) => { if (!args[k]) { console.error(`record-network-bug: need --${k}=`); process.exit(2); } return args[k]; };

const URL_ = need('url');
const OUT = resolve(need('out'));
const REQUESTS = (args.requests || '').split(',').map(s => s.trim()).filter(Boolean);
if (!REQUESTS.length) { console.error('record-network-bug: need --requests=<substring>,<substring>'); process.exit(2); }
const TABS = (args.tabs ?? 'Headers,Payload,Response').split(',').map(s => s.trim()).filter(Boolean);
const HOLD = Number(args.hold ?? 3000);
const FILTER = args.filter ?? 'Fetch/XHR';
const PORT = Number(args.port ?? 9237);
const W = Number(args.width ?? 1700), H = Number(args.height ?? 1000);
const PW = Number(args['page-width'] ?? 1440), PH = Number(args['page-height'] ?? 900);
const SETTLE = Number(args.settle ?? 5000);   // the grid is idle long before this; longer only adds dead video
const BOOT = Number(args.boot ?? 4000);       // DevTools' own start-up before its toolbar is clickable

// Never let a recording of a real site land inside the kit. The kit ships to teammates and must
// name no client; a stray relative --out while cwd happened to be this directory once put a client
// site's video in the kit tree (caught before any commit, 20/08/2026). Refuse instead of trusting cwd.
for (let d = __dirname; ; d = dirname(d)) {
  if (existsSync(join(d, 'Rules-Guide', 'kit-lint'))) {   // d is the kit root => this is the kit's own copy
    if (OUT.startsWith(d + '/')) {
      console.error(`record-network-bug: --out points inside the kit (${OUT}).`);
      console.error('  Recordings hold real client screens; write them to <Project>/<Testing-Type>/ instead.');
      process.exit(2);
    }
    break;
  }
  const up = dirname(d);
  if (up === d) break;   // a project copy of this tool, no kit root above it — nothing to protect
}

const pwDir = process.env.PLAYWRIGHT_DIR || __dirname;
const pw = await import(pathToFileURL(join(pwDir, 'node_modules', 'playwright', 'index.mjs')).href);
// A machine whose browser build does not match the installed playwright can point at the binary it
// does have instead of re-downloading one.
const launchOpts = process.env.PLAYWRIGHT_CHROMIUM_EXE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXE } : {};

const pause = ms => new Promise(r => setTimeout(r, ms));
// A fresh directory per run: playwright names its webm by a random hash, so a leftover file from an
// earlier take can win any "pick one of them" rule and ship the WRONG recording under the new name.
const tmpDir = join(dirname(OUT), '.record-network-bug');
rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });
const problems = [];

// ---- the page under test, with its debugging port open -------------------------------------
const target = await pw.chromium.launch({ ...launchOpts, args: [`--remote-debugging-port=${PORT}`, '--remote-allow-origins=*'] });
const tp = await (await target.newContext({ viewport: { width: PW, height: PH } })).newPage();
await tp.goto(URL_, { waitUntil: 'domcontentloaded' });
await pause(1500);
const list = await (await fetch(`http://localhost:${PORT}/json/list`)).json();
const page = list.find(x => x.type === 'page' && x.url.startsWith(new URL(URL_).origin));
if (!page) { console.error('record-network-bug: no debuggable page for', URL_); process.exit(1); }

// ---- the recorded browser showing DevTools --------------------------------------------------
const rec = await pw.chromium.launch(launchOpts);
const rctx = await rec.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: tmpDir, size: { width: W, height: H } } });
await rctx.addInitScript({ path: join(__dirname, 'mouse-indicator.js') });   // so a click reads as a click
const dt = await rctx.newPage();
await dt.goto(`http://localhost:${PORT}/devtools/inspector.html?ws=localhost:${PORT}/devtools/page/${page.id}&panel=network`, { waitUntil: 'domcontentloaded' });
await pause(BOOT);

const click = async (box, label, after = 300) => {
  await dt.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
  await pause(150);
  await dt.mouse.down(); await pause(70); await dt.mouse.up();
  console.log('  click:', label);
  await pause(after);
};
// DevTools keeps the detail view of every previously selected request in the DOM, hidden. So a
// plain .first() on a tab label lands on a STALE tab strip whose boundingBox is null, and the tool
// concludes "the pane did not open" while the pane is open and correct. Always take the first match
// that is actually on screen.
const boxOf = async (loc) => {
  for (const el of await loc.all().catch(() => [])) {
    const b = await el.boundingBox().catch(() => null);
    if (b && b.width > 0 && b.height > 0) return b;
  }
  return null;
};

// The screencast pane mirrors the page into the left half of the window and squeezes the request
// details into an unreadable column — off, always.
const sc = await boxOf(dt.getByLabel('Toggle screencast'));
if (sc) await click(sc, 'screencast off'); else console.log('  (no screencast toggle — already off)');

await tp.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await pause(SETTLE);

if (FILTER) {
  const f = await boxOf(dt.getByText(FILTER, { exact: true }));
  if (f) await click(f, `${FILTER} filter`, 900);
  else problems.push(`type filter "${FILTER}" not found`);
}

// Whatever is scrollable inside the detail pane, shadow roots included. The panes are custom
// elements, so a plain querySelector misses their scroller.
const scrollerBelow = (yMin) => dt.evaluate((yMin) => {
  const seen = new Set(); let best = null;
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (seen.has(el)) continue; seen.add(el);
      const r = el.getBoundingClientRect();
      if (r.height > 120 && r.top >= yMin - 40) {
        const dy = el.scrollHeight - el.clientHeight, dx = el.scrollWidth - el.clientWidth;
        if (dy > 40 || dx > 200) {
          const score = Math.max(dy, dx / 4);
          if (!best || score > best.score) best = { score, dy, dx, x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document); return best;
}, yMin);

// Hold on a tab; if the content does not fit, spend part of the hold travelling to the rest of it.
const holdTab = async (yMin) => {
  const s = await scrollerBelow(yMin);
  if (!s) { await pause(HOLD); return; }
  await dt.mouse.move(s.x, s.y);
  const vertical = s.dy > 40;
  const total = vertical ? s.dy : s.dx;
  const steps = Math.min(12, Math.max(4, Math.round(total / 120)));
  await pause(Math.round(HOLD * 0.35));
  for (let i = 0; i < steps; i++) {
    await dt.mouse.wheel(vertical ? 0 : Math.ceil(total / steps), vertical ? Math.ceil(total / steps) : 0);
    await pause(Math.round(HOLD * 0.45 / steps));
  }
  console.log(`    scrolled ${vertical ? 'down' : 'right'} ${total}px (content taller/wider than the pane)`);
  await pause(Math.round(HOLD * 0.2));
};

// Same staleness trap as the tab strip: several .network-item-view nodes coexist, only one is on
// screen. Reading the first one reports a previous request's headers under the current one's name.
const paneText = () => dt.evaluate(() => {
  const p = [...document.querySelectorAll('.network-item-view')].find(e => e.getBoundingClientRect().width > 0);
  return p ? p.innerText.replace(/\s+/g, ' ') : '';
});

for (const key of REQUESTS) {
  console.log('request:', key);
  // Re-resolve the row every time: the grid re-renders on filtering and on new traffic, and a
  // locator held across a re-render points at nothing.
  const row = dt.locator('tr').filter({ hasText: key }).first();
  if (!(await boxOf(row))) { console.log('  MISSING — no row matched'); problems.push(`request row "${key}" never appeared`); continue; }

  // Opening the details shrinks the grid to a handful of visible rows; a row below that fold still
  // has a layout box, so clicking its coordinates silently hits whatever IS painted there. Bring it
  // into view, then land on the first tab and confirm the pane really switched — the video must not
  // show one request's headers under another request's name.
  // The confirmation has to read a tab that renders into the light DOM: Response and Payload live in
  // shadow roots, so a pane left on Response reads as empty and looks like a failure that is not one.
  let selected = false;
  for (let attempt = 0; attempt < 2 && !selected; attempt++) {
    // Only the SECOND attempt scrolls. Opening the details turns the request list into a narrow
    // full-height column that usually shows every row already, and the list is virtualised: forcing
    // a scroll recycles its <tr> nodes, so the node just measured can be a different request — or
    // the empty filler below the last row, whose click DESELECTS and closes the pane.
    if (attempt > 0) { await row.scrollIntoViewIfNeeded().catch(() => {}); await pause(300); }
    const b = await boxOf(row);
    if (!b) break;
    await click({ x: b.x + 60, y: b.y, width: 40, height: b.height }, `row ${key}`, 500);  // Name column; the row centre does not select
    const tb = await boxOf(dt.getByText(TABS[0], { exact: true }));
    if (!tb) {
      console.log(`    no ${TABS[0]} tab — the pane did not open`);
      // A guess about WHY is worth less than the picture. Dump every element the row locator
      // matched and a frame of the moment, so the next person fixes the real cause.
      const matches = await dt.locator('tr').filter({ hasText: key }).evaluateAll(els => els.map(e => {
        const r = e.getBoundingClientRect();
        return { text: e.innerText.replace(/\s+/g, ' ').slice(0, 60), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      })).catch(() => []);
      console.log('      row locator matched:', JSON.stringify(matches));
      const png = `${OUT.replace(/\.[^.]+$/, '')}-debug-${key.replace(/[^a-z0-9]+/gi, '-')}-${attempt}.png`;
      await dt.screenshot({ path: png }).catch(() => {});
      console.log('      frame saved:', png);
      continue;
    }
    await click(tb, `${TABS[0]} tab`, 250);
    selected = (await paneText()).includes(key);
    if (selected) {
      console.log(`    ${TABS[0]}:`, (await paneText()).slice(0, 160));
      await holdTab(tb.y + tb.height);
    }
  }
  if (!selected) { console.log('  NOT SELECTED — the details pane did not switch to it'); problems.push(`request "${key}" could not be selected`); continue; }

  for (const tab of TABS.slice(1)) {
    const tb = await boxOf(dt.getByText(tab, { exact: true }));
    if (!tb) { console.log('    MISSING tab', tab); problems.push(`"${key}": no ${tab} tab`); continue; }
    await click(tb, `${tab} tab`, 250);
    console.log(`    ${tab}:`, (await paneText()).slice(0, 160) || '(shadow-root pane — verify in the frames)');
    await holdTab(tb.y + tb.height);
  }
}
await pause(800);
await rctx.close(); await rec.close(); await target.close();

// ---- webm -> mp4 (playwright records webm; its bundled ffmpeg has no H.264) -------------------
const webm = readdirSync(tmpDir).filter(f => f.endsWith('.webm')).map(f => join(tmpDir, f))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
if (!webm) { console.error('record-network-bug: playwright produced no video'); process.exit(1); }
if (OUT.endsWith('.mp4')) {
  const r = spawnSync('ffmpeg', ['-y', '-i', webm, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', OUT], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('record-network-bug: ffmpeg failed; the webm is at', webm); process.exit(1); }
} else renameSync(webm, OUT);
console.log('saved:', OUT);

if (problems.length) {
  console.error('\nrecord-network-bug: the recording is INCOMPLETE —');
  for (const p of problems) console.error('  -', p);
  process.exit(1);   // never hand over a video as if it showed everything it was asked to show
}
