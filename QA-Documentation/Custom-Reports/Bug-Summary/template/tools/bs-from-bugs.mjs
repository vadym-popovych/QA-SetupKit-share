// bs-from-bugs.mjs — roll up the kit's bug RECORDS into a bug-summary JSON.
//
// This is the boundary between the two doc types, made mechanical: Bug-Reports owns the record
// (repro, expected, actual, evidence, tracker id); Bug-Summary COUNTS those records. The roll-up is
// derived from them, so the two cannot drift — and every row names the record it came from.
//
//   BUGS_DIR=./bug-reports PROJECT_NAME=Acme node tools/bs-from-bugs.mjs -o bug-summary.json
//
// Env:
//   BUGS_DIR=<dir>            directory of BUG-NNN.json files (bug.schema.json). Default: ./bug-reports
//   PROJECT_NAME=<Project>    required
//   SUMMARY_ID=BS-YYYY-MM-DD  default: BS-<today>
//   ENVIRONMENT="staging"     the build the issues were found on
//   SEVERITIES="Critical,Major,Medium,Low"   the scale for THIS document, most severe first.
//                             Default: the kit's own bug severities, in order. A client scale
//                             (Critical,Major,Minor,Trivial) needs SEVERITY_MAP.
//   SEVERITY_MAP='{"Low":"Minor","Info":"Trivial"}'   bug.schema severity → this document's scale
//   SITE_FROM=component|layer|tag:<prefix>    where the SITE comes from. Default: component before "/"
//   PAGE_FROM=component                       where the PAGE comes from. Default: component after "/"
//   MODULE_FALLBACK="General" the band that holds records which do not say where they live.
//                             Default "General". MODULE_FALLBACK=0 leaves them OUT instead — the
//                             roll-up then UNDER-REPORTS, so it says so loudly and exits non-zero.
//
// PLACEMENT — PLACEMENT_PLAYBOOK.md rule 1, and the reason this file was rewritten (03/08/2026).
// An earlier version DROPPED every record whose `component` did not name both a site and a page. It
// reads like the honest move — nothing is filed under a guess — and it is the opposite one: the bug
// then appears NOWHERE, and the grand total, the single number this document exists to produce,
// under-reports what was found. Quietly, because nobody counts what is not on the page.
// Unplaceable records now go to a **General** band instead: counted, visible, rendered LAST, one per
// site, flagged `unplaced: true`. Nothing is filed under a guess AND nothing is dropped — those were
// never the only two options. The sibling bs-from-redmine.mjs has always worked this way; this file
// simply did not, and a kit tool that contradicts the kit's own playbook is worse than no tool.
//
// PROVENANCE. Every row records HOW it got its module (`moduleSource`) and WHERE its severity came
// from (`severitySource`), because downstream everything reads them as facts. Here both answers are
// the same one: the bug RECORD said so. `moduleSource: "record"` — a declared field on a
// human-authored record, not something this tool inferred from prose. `severitySource: "tracker"` —
// the source system recorded it; this roll-up never invents a severity, and it never claims one was
// triaged by the owner. A record that does not say where it lives gets `moduleSource: "unplaced"`,
// which is what puts it in General.
//
// The one thing that still stops the build: a severity outside the document's scale. It cannot be
// emitted schema-valid, it cannot go to General (General is about PLACE, not severity), and dropping
// it would under-report — so the build fails closed and prints the SEVERITY_MAP that fixes it.

import fs from 'node:fs';
import path from 'node:path';

const die = (m, c = 1) => { console.error(`bs-from-bugs: ${m}`); process.exit(c); };
if (process.argv.includes('--help')) {
  console.log('bs-from-bugs — roll kit bug records (bug.schema.json) up into a bug-summary.json. Env: BUGS_DIR PROJECT_NAME SUMMARY_ID ENVIRONMENT SEVERITIES SEVERITY_MAP SITE_FROM PAGE_FROM MODULE_FALLBACK · -o <file>');
  process.exit(0);
}

const BUGS_DIR = process.env.BUGS_DIR || './bug-reports';
const PROJECT = process.env.PROJECT_NAME || die('PROJECT_NAME is required.', 2);
const SCALE = (process.env.SEVERITIES || 'Critical,Major,High,Medium,Low,Info').split(',').map((s) => s.trim());
const SEV_MAP = process.env.SEVERITY_MAP ? JSON.parse(process.env.SEVERITY_MAP) : {};
const SITE_FROM = process.env.SITE_FROM || 'component';
const PAGE_FROM = process.env.PAGE_FROM || 'component';
// "General" is a DEBT band, not a module — see bug-summary.schema.json `pages[].unplaced`. Turning it
// off is allowed, but it is the under-reporting option, so it is opt-in and it is never silent.
const FALLBACK = process.env.MODULE_FALLBACK === '0' ? null : (process.env.MODULE_FALLBACK || 'General');
const OUT = (() => { const i = process.argv.indexOf('-o'); return i > -1 ? process.argv[i + 1] : null; })();

if (!fs.existsSync(BUGS_DIR)) die(`no bug records at ${BUGS_DIR} — set BUGS_DIR.`, 2);
const files = fs.readdirSync(BUGS_DIR).filter((f) => /^BUG-\d+.*\.json$/.test(f)).sort();
if (!files.length) die(`no BUG-NNN.json files in ${BUGS_DIR}.`, 1);

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
// bug.schema status → this document's status. The one that matters: "fixed" in a bug record means a
// developer said so. It is NOT carried over as verified — this roll-up only calls a bug fixed when QA
// re-verified it against the original repro.
const STATUS_OF = { open: 'open', fixed: 'fixed', verified: 'verified', reopened: 'reopened', wontfix: 'wontfix', duplicate: 'duplicate' };

/** Read the SITE off a record, per SITE_FROM. Returns null when the record does not say. */
function siteOf(b) {
  const comp = String(b.component || '').trim();
  if (SITE_FROM === 'layer') return String(b.layer || '').trim() || null;
  if (SITE_FROM.startsWith('tag:')) {
    const pref = SITE_FROM.slice(4);
    const t = (b.tags || []).find((x) => String(x).startsWith(pref));
    return t ? String(t).slice(pref.length).trim() || null : null;
  }
  return (comp.includes('/') ? comp.split('/')[0] : comp).trim() || null;
}

/** Read the PAGE off a record, per PAGE_FROM. Returns null when the record does not say. */
function pageOf(b) {
  const comp = String(b.component || '').trim();
  if (PAGE_FROM !== 'component') return null;
  return comp.includes('/') ? comp.split('/').slice(1).join('/').trim() || null : null;
}

const bySite = new Map();
const unmappableSeverity = [];   // cannot be emitted at all — these STOP the build
const unplaced = [];             // no place named — these go to General, and they are LISTED
const dropped = [];              // only reachable with MODULE_FALLBACK=0
let n = 0;

for (const f of files) {
  const full = path.join(BUGS_DIR, f);
  let b;
  try { b = JSON.parse(fs.readFileSync(full, 'utf8')); }
  catch (e) { die(`${f} is not valid JSON — ${e.message}\n  A record this tool cannot read is a bug it cannot count. Fix the file and re-run.`, 2); }

  const sev = SEV_MAP[b.severity] || b.severity;
  if (!SCALE.includes(sev)) {
    unmappableSeverity.push(`${b.id}: severity "${b.severity}"${SEV_MAP[b.severity] ? ` → "${sev}"` : ''} is not in the scale [${SCALE.join(', ')}]`);
    continue;
  }

  let siteRaw = siteOf(b);
  let pageRaw = pageOf(b);
  // The cascade, shortest possible version — a record has one declared place or it has none:
  //   both named        → moduleSource "record"    (the record says so)
  //   site only / none  → moduleSource "unplaced"  (General, per site where the site IS known)
  const placed = Boolean(siteRaw && pageRaw);
  if (!placed) {
    unplaced.push(`${b.id}: component "${String(b.component || '')}" does not name ${siteRaw ? 'a page' : 'a site and a page'}`);
    if (!FALLBACK) { dropped.push(b.id); continue; }
    siteRaw = siteRaw || FALLBACK;
    pageRaw = FALLBACK;
  }

  const siteId = slug(siteRaw), pageId = slug(pageRaw);
  if (!bySite.has(siteId)) bySite.set(siteId, { id: siteId, name: siteRaw.trim(), pages: new Map() });
  const site = bySite.get(siteId);
  if (!site.pages.has(pageId)) site.pages.set(pageId, { id: pageId, name: pageRaw.trim(), issues: [] });
  const issue = {
    id: `${siteId}-${pageId}-${slug(b.id)}`,
    bugId: b.id,
    summary: b.summary,
    severity: sev,
    // A record with no status is NOT assumed fixed. It is "unknown", and it is counted as still owed.
    status: STATUS_OF[b.status] || 'unknown',
    // Both provenance fields are mandatory in this document — a module and a severity that cannot be
    // told apart from a guess get counted as facts by every reader downstream.
    moduleSource: placed ? 'record' : 'unplaced',
    severitySource: 'tracker',
  };
  if (b.tags?.length) issue.notes = b.tags.join(', ');
  if (b.date) issue.reportedAt = b.date;
  if (b.evidence?.length) {
    issue.evidence = b.evidence.map((e) => {
      const url = typeof e === 'string' ? e : e.url;
      return { url, kind: 'screenshot', hostRisk: /screencast\.com|prnt\.sc|dropbox\.com\/scl/i.test(url) ? 'expiring' : /drive\.google\.com|mega\.nz/i.test(url) ? 'durable' : 'unknown' };
    });
  }
  site.pages.get(pageId).issues.push(issue);
  n++;
}

// Fail closed. A severity outside the scale is fixable in one env var; a document that quietly leaves
// those bugs out is not fixable at all once it has been sent.
if (unmappableSeverity.length) {
  console.error(`bs-from-bugs: ${unmappableSeverity.length} record(s) carry a severity this document's scale cannot express:`);
  unmappableSeverity.slice(0, 10).forEach((u) => console.error(`     • ${u}`));
  if (unmappableSeverity.length > 10) console.error(`     … and ${unmappableSeverity.length - 10} more`);
  die('map them with SEVERITY_MAP, or widen SEVERITIES, and re-run.\n'
    + '  They are NOT dropped for you: a roll-up missing bugs it could not classify under-reports the\n'
    + '  grand total, which is the one number this document exists to produce.', 1);
}
if (!n) die(`read ${files.length} bug record(s) and produced no rows.`, 1);

const FALLBACK_ID = FALLBACK ? slug(FALLBACK) : null;
// General is rendered LAST — within its site, and as a site when the record named no site at all. A
// debt belongs at the end of the list, not interleaved with real modules (schema: pages[].unplaced).
const last = (id) => (id === FALLBACK_ID ? 1 : 0);
const sites = [...bySite.values()]
  .sort((a, b2) => last(a.id) - last(b2.id))
  .map((s) => ({
    id: s.id,
    name: s.name,
    pages: [...s.pages.values()]
      .sort((a, b2) => last(a.id) - last(b2.id))
      .map((p) => (p.id === FALLBACK_ID ? { ...p, unplaced: true } : p)),
  }));

const today = new Date().toISOString().slice(0, 10);
const emitted = sites.reduce((a, s) => a + s.pages.reduce((x, p) => x + p.issues.length, 0), 0);
// The grand total is the number this document exists to produce, so it is reconciled here rather than
// trusted: every record either became a row or is named above as one that could not.
if (emitted !== n) die(`internal: built ${emitted} row(s) from ${n} mapped record(s) — refusing to emit a total that does not reconcile.`, 1);
if (FALLBACK && emitted !== files.length) die(`internal: ${files.length} record(s) in, ${emitted} row(s) out, and none were reported as excluded — refusing to emit.`, 1);

const summary = {
  summaryId: process.env.SUMMARY_ID || `BS-${today}`,
  project: PROJECT,
  generatedAt: `${today}T00:00`,
  ...(process.env.ENVIRONMENT ? { environment: process.env.ENVIRONMENT } : {}),
  source: {
    kind: 'kit-bug-records',
    ref: path.resolve(BUGS_DIR),
    note: `Rolled up from ${n} bug record(s). Each row names the record it came from (bugId); every severity was recorded by the source system, not assigned here (severitySource "tracker").`
      + (unplaced.length && FALLBACK ? ` ${unplaced.length} record(s) do not say where they live and sit under "${FALLBACK}" — counted, but unplaced: that band is a debt, not a module.` : ''),
  },
  severityScale: SCALE,
  ...(Object.keys(SEV_MAP).length ? { severityMap: Object.fromEntries(Object.entries(SEV_MAP).map(([k, v]) => [v, k])) } : {}),
  sites,
};
const json = JSON.stringify(summary, null, 2) + '\n';
if (OUT) fs.writeFileSync(OUT, json); else process.stdout.write(json);

console.error(`bs-from-bugs: ${n} of ${files.length} bug record(s) → ${sites.length} site(s) · ${sites.reduce((a, s) => a + s.pages.length, 0)} page(s)`);
if (unplaced.length && FALLBACK) {
  console.error(`  ⚠ ${unplaced.length} record(s) sit under "${FALLBACK}" — counted and visible, but the document cannot say where they live:`);
  unplaced.slice(0, 10).forEach((u) => console.error(`     • ${u}`));
  if (unplaced.length > 10) console.error(`     … and ${unplaced.length - 10} more`);
  console.error('  That band is a DEBT. It shrinks by fixing the `component` on the records — not by hiding it.');
}
if (dropped.length) {
  console.error(`  ⚠ MODULE_FALLBACK=0 — ${dropped.length} record(s) were left OUT: ${dropped.slice(0, 10).join(', ')}${dropped.length > 10 ? ' …' : ''}`);
  console.error(`  The grand total in this document therefore UNDER-REPORTS what was found: ${emitted} of ${files.length}.`);
  console.error('  Say so wherever this document is handed over, or drop MODULE_FALLBACK=0 and use General.');
  process.exit(1);
}
