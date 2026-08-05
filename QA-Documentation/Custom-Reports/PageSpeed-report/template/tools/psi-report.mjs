#!/usr/bin/env node
/**
 * psi-report.mjs — turn the MEDIAN run of a round into the report the Sheet links to.
 *
 *   node psi-report.mjs --round r7                    # render + screenshot, keep it local
 *   node psi-report.mjs --round r7 --upload "<cmd>"   # …and publish it, writing the link into the round
 *
 * WHY THIS TOOL EXISTS
 * A PageSpeed score moves between runs of an unchanged page (we have measured 85 · 88 · 90 on one page
 * within the hour). So a report captured by re-analysing the page — a fresh pagespeed.web.dev run, a
 * screenshot taken "right after" — is evidence of a DIFFERENT load than the one whose number sits in
 * the cell. Anyone who opens the link then sees a number that contradicts the Sheet.
 * psi-run.mjs therefore keeps the raw Lighthouse Result of the MEDIAN run (`<round>.lhr/<page>-<platform>.json`),
 * and this tool renders THAT — with Lighthouse's own report generator, so it is the same long report
 * PageSpeed shows you, down to the audits. The number in the report is the number in the cell, by
 * construction. It is verified anyway (see the guard below) rather than assumed.
 *
 * The link is self-hosted on purpose: a pagespeed.web.dev /analysis/<id> URL expires after 30 days and
 * dies with the host (PAGESPEED_REPORT_RULES rule 16).
 *
 * FLAGS
 *   --round <id>        required — the round to build evidence for
 *   --rounds-dir <dir>  default: $ROUNDS_DIR, else ./rounds
 *   --out-dir <dir>     where the rendered .html/.png go. Default: ./evidence/<round>
 *   --upload "<cmd>"    the publisher. `{file}` is replaced with the artefact's path; the LAST https://
 *                       URL the command prints is taken as the link. Also $PSI_EVIDENCE_UPLOADER.
 *                       Example (Mega): --upload 'bash ../../MCP-configurations/mega/mega-upload.sh --evidence MyProject {file}'
 *                       Example (HTML-Reports publisher): --upload 'bash ../../.../publish-report.sh {file} Performance'
 *   --attach html|png   which artefact the Sheet's Platform cell links to. Default: png when a PNG is
 *                       produced, else html. Both are uploaded when both exist.
 *   --no-png            skip the screenshot (no Playwright needed; the .html is still rendered)
 *   --schemas <path>    validate.mjs. Also $QA_SCHEMAS_VALIDATOR. The round is re-validated after the
 *                       evidence is written; an invalid round is restored, not shipped.
 *   --help
 *
 * WITHOUT --upload the tool still renders everything and tells you where it is — it just writes NO
 * evidence links into the round, because a local path is not a link anyone else can open.
 *
 * DEPENDENCIES (this is the one kit tool that has them — `npm install` in this folder):
 *   lighthouse   the official report renderer (we render, we do not re-measure)
 *   playwright   full-page PNG of the rendered report
 */
import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import { pathToFileURL } from 'url';

const die = (msg, code = 2) => { console.error(`psi-report: ${msg}`); process.exit(code); };

const BOOL_FLAGS = new Set(['help', 'no-png']);
const VALUE_FLAGS = new Set(['round', 'rounds-dir', 'out-dir', 'upload', 'attach', 'schemas']);

export function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument "${a}"`);
    const [name, inline] = a.slice(2).split(/=(.+)/);
    if (BOOL_FLAGS.has(name)) { opts[name] = true; continue; }
    if (!VALUE_FLAGS.has(name)) {
      throw new Error(`unknown flag "--${name}" — REFUSING to run.\n  known flags: ${[...VALUE_FLAGS, ...BOOL_FLAGS].map((f) => `--${f}`).join(' ')}`);
    }
    const value = inline ?? argv[++i];
    if (value === undefined) throw new Error(`--${name} needs a value`);
    opts[name] = value;
  }
  return opts;
}

// The link is whatever URL the publisher printed last. A publisher that prints none has not published:
// we refuse rather than write a half-truth into the round.
export function extractUrl(stdout) {
  const urls = String(stdout).match(/https?:\/\/\S+/g);
  return urls ? urls[urls.length - 1].replace(/[),.]+$/, '') : null;
}

export function scoreOf(lhr) {
  const s = lhr?.categories?.performance?.score;
  return typeof s === 'number' ? Math.round(s * 100) : null;
}

async function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { die(e.message); }
  if (opts.help) { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]); return; }

  const round = opts.round || die('--round <id> is required');
  const roundsDir = path.resolve(opts['rounds-dir'] || process.env.ROUNDS_DIR || './rounds');
  const roundFile = path.join(roundsDir, `${round}.json`);
  const lhrDir = path.join(roundsDir, `${round}.lhr`);
  const outDir = path.resolve(opts['out-dir'] || `./evidence/${round}`);
  const uploadCmd = opts.upload || process.env.PSI_EVIDENCE_UPLOADER || null;
  const wantPng = !opts['no-png'];

  if (!fs.existsSync(roundFile)) die(`round not found: ${roundFile}`);
  if (!fs.existsSync(lhrDir)) {
    die(`no stored Lighthouse results for round "${round}" (${lhrDir}).\n`
      + '  psi-run.mjs writes them for every MEASURED result unless it was run with --no-lhr.\n'
      + '  They cannot be reconstructed later: re-measuring the page produces a DIFFERENT run, and a\n'
      + '  report of a different run is not evidence of this round\'s number. Re-collect the round.');
  }
  let data;
  try { data = JSON.parse(fs.readFileSync(roundFile, 'utf8')); }
  catch (e) { die(`${roundFile} is not valid JSON: ${e.message} — refusing to touch it`); }

  // Resolve the validator BEFORE rendering or uploading anything. The evidence link is written INTO the
  // round JSON, and an unvalidated round must never ship (psi-run.mjs deletes one; this tool refuses to
  // write one). Fail CLOSED here — not with a warning after the quota and uploads are already spent.
  const validator = opts.schemas || process.env.QA_SCHEMAS_VALIDATOR || findValidator();
  if (uploadCmd && !validator) {
    die('cannot find Rules-Guide/schemas/validate.mjs — pass --schemas <path> or set $QA_SCHEMAS_VALIDATOR.\n'
      + '  The evidence link rides inside the round JSON; an unvalidated round is not a source of truth, so\n'
      + '  this tool will not write one. (Nothing was rendered or uploaded.)', 3);
  }
  // Every cell we actually publish is collected here and written back in ONE re-read-and-merge step at
  // the end (see commit) — a blind rewrite from this in-memory snapshot would clobber any comment a human
  // typed into the round while we were rendering and uploading.
  const produced = [];   // { pageId, platform, evidence }

  const { ReportGenerator } = await import('lighthouse/report/generator/report-generator.js')
    .catch(() => die('the Lighthouse report renderer is not installed.\n  Run `npm install` in this tools/ folder (it needs `lighthouse`, and `playwright` for the PNG).\n  We RENDER the stored run — we never re-measure the page to make a picture.'));

  let browser = null;
  if (wantPng) {
    const pw = await import('playwright').catch(() => null);
    if (!pw) die('playwright is not installed (needed for the PNG).\n  Run `npm install` in this tools/ folder, or pass --no-png to render the .html only.');
    browser = await pw.chromium.launch();
  }

  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString();
  const day = stamp.slice(0, 10).split('-').reverse().join('.');       // dd.mm.yyyy — evidence convention
  let built = 0; let skipped = 0; const mismatches = [];

  for (const page of data.pages) {
    for (const res of page.results) {
      if (res.status !== 'measured') { skipped++; continue; }
      const lhrFile = path.join(lhrDir, `${page.id}-${res.platform}.json`);
      if (!fs.existsSync(lhrFile)) {
        skipped++;
        console.log(`  ${page.name} (${res.platform}) · no stored run — skipped (re-collect the round to get one)`);
        continue;
      }
      const lhr = JSON.parse(fs.readFileSync(lhrFile, 'utf8'));
      const runScore = scoreOf(lhr);

      // THE GUARD. If the stored run does not carry the cell's number, this report is evidence of some
      // other load — the exact failure this tool exists to prevent. Refuse the whole round: a partially
      // wrong evidence trail is worse than none, because it looks complete.
      if (runScore !== res.score) {
        mismatches.push(`${page.id} (${res.platform}): the cell says ${res.score}, the stored run says ${runScore}`);
        continue;
      }

      const base = `${day} - ${page.id} - ${res.platform} (score ${runScore})`;
      const htmlFile = path.join(outDir, `${base}.html`);
      fs.writeFileSync(htmlFile, ReportGenerator.generateReportHtml(lhr));

      let pngFile = null;
      if (browser) {
        const p = await browser.newPage({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 });
        await p.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
        await p.waitForTimeout(2000);                                   // the gauges animate in
        pngFile = path.join(outDir, `${base}.png`);
        await p.screenshot({ path: pngFile, fullPage: true });
        await p.close();
      }

      const evidence = { runScore, capturedAt: stamp };
      if (uploadCmd) {
        // The PNG is the artefact most evidence stores expect (and the one a reviewer opens on a phone);
        // the HTML is uploaded when it is what the cell should link to — `--attach html`, or there is no PNG.
        const attachHtml = opts.attach === 'html' || !pngFile;
        for (const [file, key] of [[pngFile, 'screenshotUrl'], [attachHtml ? htmlFile : null, 'reportUrl']]) {
          if (!file) continue;
          const cmd = uploadCmd.includes('{file}') ? uploadCmd.replaceAll('{file}', `"${file}"`) : `${uploadCmd} "${file}"`;
          let out;
          const saveThenDie = (msg) => {
            // A publisher failure part-way through spends real upload quota on the cells that DID succeed.
            // Persist those before stopping, so their links are recorded rather than lost with the process.
            if (produced.length) commit(roundFile, produced, validator);
            die(msg + `${produced.length ? `\n  (${produced.length} already-published cell(s) were saved to the round before stopping.)` : ''}`, 3);
          };
          try { out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
          catch (e) { saveThenDie(`the publisher failed for ${path.basename(file)}:\n  ${cmd}\n  ${(e.stderr || e.message || '').toString().trim().split('\n').slice(-1)[0]}`); }
          const url = extractUrl(out);
          if (!url) saveThenDie(`the publisher printed no URL for ${path.basename(file)} — nothing was published, so no link is written.\n  command: ${cmd}\n  output : ${out.trim().split('\n').slice(-2).join(' | ')}`);
          evidence[key] = url;
        }
      }
      // Both keys may be absent when there is no publisher — then the round records no link at all
      // (rather than a local path nobody else can open), and the tool says so at the end.
      if (evidence.reportUrl || evidence.screenshotUrl) produced.push({ pageId: page.id, platform: res.platform, evidence });
      built++;
      console.log(`  ${page.name} (${res.platform}) · ${runScore} → ${evidence.screenshotUrl || evidence.reportUrl || path.basename(htmlFile) + ' (local only)'}`);
    }
  }
  if (browser) await browser.close();

  if (mismatches.length) {
    console.error('\npsi-report: the stored run does NOT carry the score in the cell — REFUSING to attach it:');
    mismatches.forEach((m) => console.error(`  ✗ ${m}`));
    console.error('  A report of a different run is evidence of a different load. Re-collect the round so');
    console.error('  the stored median run and the published number are the same measurement.');
    console.error('  Nothing was written: a partially-correct evidence trail is worse than none.');
    process.exit(1);
  }

  // Write every published link back in ONE step that RE-READS the round from disk and merges only the
  // evidence objects onto it (see commit) — so a comment a human typed while we rendered/uploaded is not
  // clobbered, the write is atomic, and a link is never attached to a number the disk no longer carries.
  if (produced.length) {
    const { skipped } = commit(roundFile, produced, validator);
    if (skipped?.length) {
      console.error('\npsi-report: some cells changed on disk while this ran — their evidence was NOT attached:');
      skipped.forEach((s) => console.error(`  ⚠ ${s}`));
    }
  }

  console.log(`\n${built} report(s) built${uploadCmd ? ' and published' : ' locally (no --upload → no links written into the round)'}, ${skipped} result(s) skipped (not measured).`);
  console.log(`  artefacts: ${outDir}`);
  if (!uploadCmd) console.log('  Pass --upload "<cmd with {file}>" (or $PSI_EVIDENCE_UPLOADER) to publish them and link them from the Sheet.');
}

// Write the published evidence back into the round WITHOUT losing anyone else's concurrent work.
//   1. RE-READ the round from disk (not the snapshot we started from) — a human may have edited it while
//      we rendered and uploaded, and their words must survive.
//   2. Attach each evidence object only to a cell that on disk is STILL measured with the score we
//      rendered. If a concurrent psi-run re-collected the cell to a different number, its report is now of
//      a different load — skip it (reported), never hang it under the new number.
//   3. Merge into any existing evidence, so a link this run did not re-publish (e.g. an earlier PNG when
//      this run only refreshed the HTML) is kept, not dropped.
//   4. Write ATOMICALLY: a sibling temp, validated, then renamed over the original. A crash or a full disk
//      leaves the original round intact; an invalid result never replaces a valid file.
function commit(roundFile, produced, validator) {
  let cur;
  try { cur = JSON.parse(fs.readFileSync(roundFile, 'utf8')); }
  catch (e) { die(`${roundFile} became unreadable before the evidence could be written: ${e.message}`, 3); }
  const skipped = [];
  for (const { pageId, platform, evidence } of produced) {
    const res = cur.pages?.find((p) => p.id === pageId)?.results?.find((r) => r.platform === platform);
    if (!res) { skipped.push(`${pageId} (${platform}): the result is gone from the round on disk`); continue; }
    if (res.status !== 'measured' || res.score !== evidence.runScore) {
      skipped.push(`${pageId} (${platform}): the round on disk now reads ${res.status}${res.status === 'measured' ? ` ${res.score}` : ''}, not measured ${evidence.runScore} — evidence NOT attached (re-run psi-report)`);
      continue;
    }
    res.evidence = { ...(res.evidence || {}), ...evidence };
  }
  const tmp = `${roundFile}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(cur, null, 2) + '\n');
  const v = spawnSync(process.execPath, [validator, 'pagespeed-round', tmp], { encoding: 'utf8' });
  if (v.status !== 0) {
    fs.rmSync(tmp, { force: true });
    die(`writing the evidence would make the round INVALID — the round on disk was NOT touched:\n${(v.stdout || v.stderr || '').trim()}`, 3);
  }
  fs.renameSync(tmp, roundFile);
  return { skipped };
}

function findValidator() {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const c = path.join(dir, 'QA-SetupKit/Rules-Guide/schemas/validate.mjs');
    if (fs.existsSync(c)) return c;
    const c2 = path.join(dir, 'Rules-Guide/schemas/validate.mjs');
    if (fs.existsSync(c2)) return c2;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

// Importable for tests; runs only when executed directly (a symlinked copy resolves to the same file).
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)) {
  await main();
}
