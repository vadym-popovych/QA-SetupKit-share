// bs-evidence.mjs — fetch the evidence behind bug rows so a severity can be SEEN, not guessed.
//
// A severity is a judgement about CONSEQUENCE — does the defect hide, cut, block, corrupt? — and the bug's
// one-line summary very often does not say. "Text inside the tiles isn't shown according to design" is
// either a truncated label (Minor) or a different font (Trivial), and the sentence cannot tell you which.
// The screenshot can, in a second. So: when the wording does not settle it, LOOK.
//
//   SUMMARY=./bug-summary.json node tools/bs-evidence.mjs --ids rm-59351-4,rm-60945
//   SUMMARY=./bug-summary.json node tools/bs-evidence.mjs --unclear      # every row whose text hides its consequence
//   SUMMARY=./bug-summary.json node tools/bs-evidence.mjs --all
//
// Env:  OUT_DIR=./evidence   ·   PLAYWRIGHT_DIR=<node_modules holding playwright>   ·   VIDEO_FRAMES=9
//
// How each host has to be handled — none of them serve the image at the link you were given:
//   • prnt.sc / Lightshot  → the page's og:image IS the full screenshot. One fetch, no browser.
//   • monosnap.ai          → og:image is the SITE LOGO. The real image needs the page rendered.
//   • screencast.com       → og:image is a 392×360 THUMBNAIL. Too small to judge. Render the page.
//   • Dropbox / .mp4       → a screen RECORDING. Sampled into a CONTACT SHEET (see below).
// Rendering needs Playwright (the Web-Testing kit installs it). Without it, prnt.sc still works and the
// rest are reported as unfetched — the tool never pretends it saw something it did not.
//
// ── VIDEO ─────────────────────────────────────────────────────────────────────────────────
// Screen recordings are where the ugly bugs live, and they are unreadable as text. The tool plays the
// video in the HEADLESS BROWSER (Chromium decodes H.264 fine), seeks to N points, draws each onto a canvas
// grid and saves ONE contact sheet with timestamps. No ffmpeg: the one Playwright bundles is a stripped
// build that will not even demux an .mp4 (it exists to record webm), and the browser decodes anyway.
//
// WHAT A CONTACT SHEET CAN AND CANNOT SETTLE — say which, do not blur it:
//   ✓ navigation, redirects, error states, what disappeared, what was not saved — the SEQUENCE of screens.
//     (This is how "the user is thrown out of the review flow when he taps the text field" was confirmed:
//      frame 2 shows the rating screen with the input open, frame 3 shows the chapter text. Redirected.)
//   ✗ SMOOTHNESS. "The animation stutters", "there is a slight jitter" — nine stills cannot prove or
//     disprove that, and pretending otherwise is how a severity gets invented. Say the stills cannot settle
//     it and rate from the text, or ask a human to watch it. Do not guess from a grid.
//   ✗ audio. Not analysed at all.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const die = (m, c = 1) => { console.error(`bs-evidence: ${m}`); process.exit(c); };
if (process.argv.includes('--help')) {
  console.log('bs-evidence — fetch the evidence behind bug rows so a severity can be SEEN, not guessed. Flags: --ids a,b · --unclear (rows whose wording does not settle the consequence) · --all · --help. Env: SUMMARY OUT_DIR PLAYWRIGHT_DIR');
  process.exit(0);
}
const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };

const SUMMARY = process.env.SUMMARY || './bug-summary.json';
if (!fs.existsSync(SUMMARY)) die(`no summary at ${SUMMARY} — set SUMMARY=<path>.`, 2);
const S = JSON.parse(fs.readFileSync(SUMMARY, 'utf8'));
const OUT = process.env.OUT_DIR || path.join(path.dirname(SUMMARY), 'evidence');
fs.mkdirSync(OUT, { recursive: true });

const rows = [];
for (const site of S.sites) for (const page of site.pages) for (const it of page.issues) rows.push({ ...it, module: page.name });

// The rows whose SUMMARY DOES NOT SETTLE THE CONSEQUENCE. These are the ones a severity gets wrong: the
// sentence describes a deviation without saying whether anything is hidden, cut or unreadable because of it.
const UNCLEAR = /(not shown|isn'?t shown|does(n'?t| not) match|not match|mismatch|according to (the )?design|not fully|partially|smaller|larger|size|overlap|cropped|truncat|cut off|inconsistent|discrepancy|deviation|shown small)/i;
const wanted = (() => {
  const ids = arg('--ids');
  if (ids) return rows.filter((r) => ids.split(',').map((s) => s.trim()).includes(r.id));
  if (process.argv.includes('--all')) return rows;
  if (process.argv.includes('--unclear')) return rows.filter((r) => UNCLEAR.test(r.summary) && (r.evidence || []).length);
  die('say what to fetch: --ids a,b · --unclear · --all', 2);
})();
if (!wanted.length) die('nothing matched.', 1);

// ── resolve Playwright, or say plainly that we cannot render ──────────────────────────────
let chromium = null;
try {
  let dir = process.env.PLAYWRIGHT_DIR;
  if (!dir) {
    let d = HERE;
    for (let i = 0; i < 12 && !dir; i++) {
      const hit = path.join(d, 'node_modules', 'playwright');
      if (fs.existsSync(hit)) dir = path.join(d, 'node_modules');
      const up = path.dirname(d); if (up === d) break; d = up;
    }
  }
  if (dir) ({ chromium } = createRequire(path.join(dir, 'playwright', 'package.json'))('playwright'));
} catch { /* handled below */ }
if (!chromium) console.error('bs-evidence: Playwright not found — prnt.sc still works; monosnap/screencast will be REPORTED, not fetched.\n  Install it (see the Web-Testing kit) or set PLAYWRIGHT_DIR.\n');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const ogImage = async (url) => {
  const html = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
  const m = html.match(/<meta[^>]+(?:og:image|twitter:image)[^>]*content="([^"]+)"/i)
    || html.match(/<meta[^>]+content="([^"]+)"[^>]*(?:og:image|twitter:image)/i);
  return m ? m[1] : null;
};

const FRAMES = Math.max(2, Number(process.env.VIDEO_FRAMES || 9));
const browser = chromium ? await chromium.launch() : null;
const page = browser ? await browser.newPage({ viewport: { width: 1400, height: 1000 } }) : null;

// A Dropbox SHARE link serves an HTML player, not the file. This is the direct one.
const directVideo = (u) => u.replace('://www.dropbox.com', '://dl.dropboxusercontent.com').replace(/[?&]dl=\d/, '');

// Play → seek → draw onto a canvas grid → one PNG. Done entirely in the page: the browser is already the
// decoder, so nothing else has to be installed, and the sheet comes back as a single image to look at.
async function contactSheet(url, file) {
  const cols = 3, rows = Math.ceil(FRAMES / 3);
  await page.goto('about:blank');
  await page.setContent('<body style="margin:0;background:#111"></body>');
  const dataUrl = await page.evaluate(async ({ src, n, cols, rows }) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous'; v.muted = true; v.preload = 'auto'; v.src = src;
    document.body.appendChild(v);
    await new Promise((res, rej) => {
      // It may ALREADY be loaded by the time we listen — check readyState first, or you wait forever
      // for an event that has already fired. (Cost an hour once.)
      if (v.readyState >= 1) return res();
      v.addEventListener('loadedmetadata', res, { once: true });
      v.addEventListener('error', () => rej(new Error('decode failed')), { once: true });
      setTimeout(() => rej(new Error('video load timeout')), 45000);
    });
    const W = v.videoWidth, H = v.videoHeight, PAD = 8, LBL = 22;
    const c = document.createElement('canvas');
    c.width = cols * W + (cols - 1) * PAD;
    c.height = rows * (H + LBL) + (rows - 1) * PAD;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < n; i++) {
      const t = (v.duration * (i + 0.5)) / n;
      await new Promise((res) => { v.onseeked = res; v.currentTime = t; });
      await new Promise((res) => requestAnimationFrame(res));
      const x = (i % cols) * (W + PAD), y = Math.floor(i / cols) * (H + LBL + PAD);
      g.drawImage(v, x, y + LBL, W, H);
      g.fillStyle = '#000'; g.font = 'bold 15px monospace';
      g.fillText(`${i + 1}  ${t.toFixed(1)}s`, x + 4, y + 16);
    }
    return { png: c.toDataURL('image/png'), duration: v.duration, w: W, h: H };
  }, { src: url, n: FRAMES, cols, rows });
  fs.writeFileSync(file, Buffer.from(dataUrl.png.split(',')[1], 'base64'));
  return dataUrl;
}

const index = [];
for (const r of wanted) {
  for (const [k, ev] of (r.evidence || []).entries()) {
    const url = ev.url;
    const file = path.join(OUT, `${r.id}-${k + 1}.png`);
    const rec = { id: r.id, module: r.module, severity: r.severity, url, host: new URL(url).host, file: null, note: null, summary: r.summary };
    try {
      if (/\.mp4|\.mov|\.webm|dropbox\.com/i.test(url)) {
        if (!page) { rec.note = 'screen recording — needs a browser to sample. Playwright not available.'; }
        else {
          const f = file.replace(/\.png$/, '-frames.png');
          const m = await contactSheet(directVideo(url), f);
          rec.file = f; rec.video = { duration: Number(m.duration.toFixed(1)), size: `${m.w}x${m.h}`, frames: FRAMES };
          rec.note = 'contact sheet: it shows WHAT happened, not HOW SMOOTHLY. A smoothness/jitter bug cannot be settled from stills — say so rather than invent a severity.';
        }
      } else if (/prnt\.sc|lightshot/i.test(url)) {
        const img = await ogImage(url);                       // the og:image IS the full screenshot here
        if (!img) throw new Error('no og:image');
        const buf = Buffer.from(await (await fetch(img, { headers: { 'User-Agent': UA } })).arrayBuffer());
        fs.writeFileSync(file, buf);
        rec.file = file;
      } else if (page) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        // Dismiss the viewer's own cookie banner: it sits ON TOP of the screenshot and hides the part of the
        // defect you came to look at. (It hid the bottom of the very first capture.)
        for (const sel of ['button:has-text("Accept All")', 'button:has-text("Accept")', 'button:has-text("ACCEPT ALL")',
          '[aria-label*="accept" i]', '#onetrust-accept-btn-handler']) {
          try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 800 })) { await b.click({ timeout: 1500 }); break; } } catch { /* none */ }
        }
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(2500);
        await page.screenshot({ path: file });                // the viewer page, rendered — the image is in it
        rec.file = file;
      } else {
        rec.note = 'needs a rendered page (og:image is a logo or a thumbnail) — Playwright not available.';
      }
    } catch (e) {
      rec.note = `could not fetch: ${e.message.slice(0, 70)}`;
    }
    index.push(rec);
    console.error(`  ${rec.file ? '✓' : '·'} ${r.id.padEnd(12)} [${rec.host.padEnd(20)}] ${rec.file ? path.basename(rec.file) + (rec.video ? `  (${rec.video.duration}s · ${rec.video.frames} frames)` : '') : rec.note}`);
  }
}
if (browser) await browser.close();

fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1) + '\n');
const got = index.filter((i) => i.file).length;
console.error(`\nbs-evidence: ${got} of ${index.length} evidence item(s) fetched → ${OUT}`);
console.error('  LOOK at them before rating. A severity read off a sentence is a guess; one read off the screenshot is a judgement.');
const vids = index.filter((i) => i.video).length;
if (vids) {
  console.error(`  ${vids} screen recording(s) came back as CONTACT SHEETS. They settle sequence — redirects, error states,`);
  console.error('  what was lost. They do NOT settle smoothness: a jitter/animation bug cannot be judged from stills.');
  console.error('  Say that plainly instead of inventing a severity from a grid.');
}
