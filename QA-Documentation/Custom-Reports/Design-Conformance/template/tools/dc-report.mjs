#!/usr/bin/env node
// Design-Conformance — build the review page from findings JSON + its evidence clips.
//
// Self-contained by construction: every clip and poster is inlined as a data: URI, so the page can
// be published to any static host, mailed, or opened from disk years later and still play its own
// evidence. Nothing is fetched at view time.
//
// Usage:
//   node dc-report.mjs --findings=<findings.json> --out=<report.html> [--evidence=<dir>]
//
// The report is a PROJECTION of the findings file. Fix a wrong claim in the JSON and rebuild —
// never hand-edit the HTML, or the next rebuild silently reverts it and the two disagree.
//
// Refuses to build (exit 1) when:
//   • a finding names a clip that does not exist        — a claim with missing evidence
//   • a finding has no `requires` or no `observed`      — a verdict with only one side shown
//   • `severitySource` is absent on a finding carrying an `impact`
//        Impact is not a fact about the product; it is a judgement someone owns. An agent-proposed
//        rating that does not say it is proposed reads as the owner's call in the next meeting.
//
// Link stability: the report keeps the SAME output path across rebuilds, which is what keeps a
// shared link alive (Project-Configuration rule 10). Publish it through the HTML-Reports kit and
// the URL is stable too — never "upload a new one and delete the old".
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=')];
}));
const need = (k) => { if (!args[k]) { console.error(`dc-report: need --${k}=`); process.exit(2); } return args[k]; };

const FINDINGS = resolve(need('findings'));
const OUT = resolve(need('out'));
const EVIDENCE = resolve(args.evidence || join(dirname(FINDINGS), 'evidence'));

const doc = JSON.parse(readFileSync(FINDINGS, 'utf8'));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MIME = { mp4: 'video/mp4', webm: 'video/webm', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
const dataUri = (p) => {
  const ext = p.split('.').pop().toLowerCase();
  return `data:${MIME[ext] || 'application/octet-stream'};base64,${readFileSync(p).toString('base64')}`;
};

// ── fail closed ──────────────────────────────────────────────────────────────────────────────────
const problems = [];
for (const f of doc.findings || []) {
  if (!f.requires) problems.push(`${f.id}: no "requires" — a conflict must quote what the spec asks`);
  if (!f.observed) problems.push(`${f.id}: no "observed" — a conflict must state what the design does`);
  if (f.impact && !f.severitySource) {
    problems.push(`${f.id}: has "impact" but no "severitySource" (owner | agent-proposed)`);
  }
  for (const c of f.clips || []) {
    if (!existsSync(join(EVIDENCE, c.file))) problems.push(`${f.id}: clip not found — ${c.file}`);
    if (c.poster && !existsSync(join(EVIDENCE, c.poster))) problems.push(`${f.id}: poster not found — ${c.poster}`);
  }
}
if (problems.length) {
  console.error('dc-report: refusing to build —');
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(1);
}

const proposed = (doc.findings || []).filter((f) => f.severitySource && f.severitySource !== 'owner');

// ── render ───────────────────────────────────────────────────────────────────────────────────────
const clipHtml = (c) => {
  const poster = c.poster ? ` poster="${dataUri(join(EVIDENCE, c.poster))}"` : '';
  return `<figure><video controls preload="metadata" playsinline${poster} `
    + `src="${dataUri(join(EVIDENCE, c.file))}"></video>`
    + (c.caption ? `<figcaption>${esc(c.caption)}</figcaption>` : '')
    + '</figure>';
};

const findingHtml = (f) => `
  <article class="finding">
    <div class="rail">
      <span class="fid">${esc(f.id)}</span>
      ${f.impact ? `<span class="chip ${esc(f.impactClass || 'warn')}">${esc(f.impact)}</span>` : ''}
      ${f.story ? `<span class="chip acc">${esc(f.story)}</span>` : ''}
    </div>
    <div class="fbody">
      <h3>${esc(f.title)}</h3>
      <span class="label">${esc(f.requiresLabel || 'What the spec requires')}</span>
      <blockquote>${(Array.isArray(f.requires) ? f.requires : [f.requires]).map((q) => `<p>${q}</p>`).join('')}</blockquote>
      <span class="label">What the design does</span>
      ${(Array.isArray(f.observed) ? f.observed : [f.observed]).map((p) => `<p>${p}</p>`).join('')}
      ${(f.clips || []).map(clipHtml).join('')}
      ${(f.notes || []).map((p) => `<p>${p}</p>`).join('')}
      ${f.decision ? `<div class="verdict"><span class="label">${esc(f.decisionLabel || 'Decision needed')}</span><p>${f.decision}</p></div>` : ''}
    </div>
  </article>`;

const coverageHtml = !doc.coverage?.length ? '' : `
<section class="sect">
  <h2>${esc(doc.coverageTitle || 'Coverage')}</h2>
  ${doc.coverageLede ? `<p class="lede">${doc.coverageLede}</p>` : ''}
  <div class="tblwrap"><table>
    <thead><tr>${(doc.coverageColumns || ['Item', 'Design surface', 'Verdict']).map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${doc.coverage.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
</section>`;

const sectionHtml = (s) => `
<section class="sect">
  <h2>${esc(s.title)}</h2>
  ${s.lede ? `<p class="lede">${s.lede}</p>` : ''}
  ${(s.body || []).map((p) => `<p>${p}</p>`).join('')}
  ${s.list ? `<${s.ordered ? 'ol' : 'ul'}>${s.list.map((li) => `<li>${li}</li>`).join('')}</${s.ordered ? 'ol' : 'ul'}>` : ''}
</section>`;

const CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'dc-report.css'), 'utf8');

const html = `<title>${esc(doc.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=JetBrains+Mono:wght@400;600&display=swap">
<style>${CSS}</style>
<div class="wrap">
<header class="mast">
  ${doc.eyebrow ? `<p class="eyebrow">${esc(doc.eyebrow)}</p>` : ''}
  <h1>${esc(doc.headline)}</h1>
  ${doc.standfirst ? `<p class="standfirst">${doc.standfirst}</p>` : ''}
</header>
${!doc.meta?.length ? '' : `<dl class="meta">${doc.meta.map((m) => `<div><dt>${esc(m.label)}</dt><dd>${m.value}</dd></div>`).join('')}</dl>`}
${!doc.tally?.length ? '' : `<div class="tally">${doc.tally.map((t) => `<div><span class="n ${esc(t.tone || 'mute')}">${esc(t.n)}</span><span class="l">${t.label}</span></div>`).join('')}</div>`}
${(doc.sectionsBefore || []).map(sectionHtml).join('')}
${!doc.findings?.length ? '' : `<section class="sect"><h2>${esc(doc.findingsTitle || 'Findings')}</h2>${doc.findings.map(findingHtml).join('')}</section>`}
${coverageHtml}
${(doc.sectionsAfter || []).map(sectionHtml).join('')}
${doc.footer ? `<footer><p>${doc.footer}</p></footer>` : ''}
</div>`;

writeFileSync(OUT, html);
const mb = (statSync(OUT).size / 1e6).toFixed(2);
console.log(`dc-report: wrote ${basename(OUT)} (${mb} MB, evidence inlined)`);
if (Number(mb) > 16) console.warn('  ⚠ over 16 MB — too large for an Artifact; re-encode the clips smaller.');
if (proposed.length) {
  console.warn(`  ⚠ ${proposed.length} finding(s) carry an agent-proposed impact rating: `
    + `${proposed.map((f) => f.id).join(', ')}.`);
  console.warn('    Repeat this in the message that carries the link — an unreviewed rating must not');
  console.warn('    reach the owner looking like their own call.');
}
