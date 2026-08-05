// bs-from-redmine.mjs — pull the bugs off a Redmine board and roll them up into a bug-summary JSON.
//
// READ-ONLY. Every call is a GET. This tool never creates, updates, moves or closes anything.
//
//   REDMINE_PROJECT_ID=<project id> node tools/bs-from-redmine.mjs -o bug-summary.json
//   REDMINE_PROJECT_ID=<project id> node tools/bs-from-redmine.mjs --dry-run      # print what it would produce
//
// Env:
//   REDMINE_URL=https://…            the board (required)
//   REDMINE_PROJECT_ID=<id|ident>    the project (required — the tool refuses to sweep a whole board)
//   REDMINE_TOKEN / REDMINE_TOKEN_FILE   API key (auto-resolved from MCP-configurations/redmine/.token)
//   SITE_NAME="<Project>"       the site band on the Sheet (default: the Redmine project name)
//   SEVERITIES="Critical,Major,Minor,Trivial"        the engagement's scale, most severe first
//   SEVERITY_FILE=./severities.json  { "<row-id>": "Major", … } — WHERE THE SEVERITIES COME FROM (see below)
//   MODULE_MAP=./modules.json        { "<candidate>": "<canonical module>" | null to drop } — the OWNER's
//                                    call on how the board's container names collapse into real modules
//   PLACEMENT_FILE=./placements.json { "<row-id>": "<module>" | {"module":"…","source":"owner"} } — a per-BUG
//                                    placement, for the ones no rule can reach. An agent that reads the bug
//                                    and decides is recorded as "agent-placed": a judgement, not a fact.
//                                    Every unplaced row is written to placement-triage.json so it can be filled.
//   MODULE_INFER=0                   turn OFF inferring a module from the bug's own summary text (see below)
//   MODULE_FALLBACK="General"        the band for bugs the board cannot place (default "General"; set to 0
//                                    to drop them instead — see the note below before you do)
//   SUMMARY_ID=BS-YYYY-MM-DD · ENVIRONMENT="staging"
//
// ── WHERE THE BUGS ACTUALLY ARE ───────────────────────────────────────────────────────────
// Two shapes on the same board, and a tool that knows only the first one misses most of the bugs:
//
//   1. CHECKLIST CONTAINERS. One issue per module — "[BUGS] User profile", "[BUG] Home screen",
//      "[pixel-perfect] Settings" — with an EMPTY description and the individual bugs living as
//      numbered CHECKLIST items inside it. They are reachable, but not where anyone looks:
//      GET /issues/<id>/checklists.json   (there is no /checklists.json collection endpoint, and
//      `?include=checklists` on the issue returns nothing — both 404 / silently empty.)
//      On the reference board this is 20 issues holding 111 bugs.
//
//   2. DESCRIPTION CONTAINERS. Same idea, different habit: the subject names a SCREEN ("The Library
//      screen", "Select Genre screen") and the bugs are NUMBERED POINTS in the description. Different
//      people on the same team file differently, and a tool that knows only one habit silently collapses
//      an issue holding six bugs into a single row.
//
//   3. STANDALONE BUG ISSUES — one Redmine issue = one bug. Their module comes from the PARENT.
//
// ── WHERE THE SEVERITY COMES FROM: NOWHERE ────────────────────────────────────────────────
// Redmine has NO severity field. Not a core field, not a custom field, and `priority` sits at its
// default on almost every bug, so it is not a proxy — it is noise. Severity is assigned by a human,
// or PROPOSED by an agent from the severity decision tree.
// This tool therefore REFUSES to invent one. With no SEVERITY_FILE it writes a TRIAGE file — every
// row, with the fields needed to rate it — and exits 3. Rate them (or have an agent propose them,
// marked `agent-proposed` with its `severityRationale`), then re-run. There is no --assume-minor.
// A severity is the unit every statistic in the document is built out of; a default would be a lie
// with a number attached.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const die = (m, c = 1) => { console.error(`bs-from-redmine: ${m}`); process.exit(c); };
if (process.argv.includes('--help')) {
  console.log('bs-from-redmine — READ-ONLY pull of a Redmine board into a bug-summary.json. Reads BOTH checklist containers (the bugs live as checklist items: GET /issues/<id>/checklists.json) and standalone bug issues. Redmine has no severity field, so with no SEVERITY_FILE it writes a triage file and exits 3 rather than inventing one. Env: REDMINE_URL REDMINE_PROJECT_ID REDMINE_TOKEN(_FILE) SITE_NAME SEVERITIES SEVERITY_FILE SUMMARY_ID ENVIRONMENT · -o <file>');
  process.exit(0);
}

const findUp = (rels) => {
  let dir = HERE;
  for (let i = 0; i < 12; i++) {
    for (const rel of rels) if (fs.existsSync(path.join(dir, rel))) return path.join(dir, rel);
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  return null;
};
const URL_BASE = (process.env.REDMINE_URL || '').replace(/\/$/, '') || die('REDMINE_URL is required (e.g. https://tracker.example.com).', 2);
const PROJECT = process.env.REDMINE_PROJECT_ID || die('REDMINE_PROJECT_ID is required — this tool will not sweep an entire board.', 2);
const tokenFile = process.env.REDMINE_TOKEN_FILE
  || findUp(['QA-SetupKit/MCP-configurations/redmine/.token', 'MCP-configurations/redmine/.token']);
const TOKEN = process.env.REDMINE_TOKEN || (tokenFile && fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8').trim() : null);
if (!TOKEN) die('no API key — set REDMINE_TOKEN, or put it in MCP-configurations/redmine/.token (see that folder\'s README).', 2);

const SCALE = (process.env.SEVERITIES || 'Critical,Major,Minor,Trivial').split(',').map((s) => s.trim());
const OUT = (() => { const i = process.argv.indexOf('-o'); return i > -1 ? process.argv[i + 1] : null; })();

const api = async (p) => {
  const r = await fetch(`${URL_BASE}/${p}`, { headers: { 'X-Redmine-API-Key': TOKEN } });
  if (r.status === 404) return null;
  if (!r.ok) die(`GET /${p} → HTTP ${r.status}. Check REDMINE_URL and the API key.`, 2);
  return r.json();
};

// ── module names ──────────────────────────────────────────────────────────────────────────
// The container's SUBJECT names the module: "[BUGS] User profile" → "User profile". The tags are the
// team's, not the kit's — they are stripped, not interpreted. What is left IS the module.
const TAG = /^\s*\[[^\]]*\]\s*/;                                  // [BUGS] · [BUG] · [IOS Bugs] · [pixel-perfect] · [BUGS-Admin Panel]
const NOISE = [/\(draft\)\s*$/i, /\btask issues?\s*$/i, /\bbugs?\s*$/i, /\bissues?\s*$/i, /[\s.:,-]+$/];
const moduleOf = (subject) => {
  let s = String(subject || '').trim().replace(/^the\s+/i, '');   // "The Library screen" and "Library screen" are one module
  const tag = (s.match(TAG) || [''])[0].replace(/[[\]]/g, '').trim();   // keep the tag's own words: "IOS Bugs", "pixel-perfect"
  s = s.replace(TAG, '').trim().replace(/^the\s+/i, '');
  for (const re of NOISE) s = s.replace(re, '').trim();
  // "[IOS Bugs] Issues faced on iOS platform" → the tag is the module, the rest is prose
  if (!s || s.length < 3) s = tag.replace(/\bbugs?\b/i, '').trim();
  // "BUG #59470 (List of chapters)" → the parenthetical is the module
  const paren = s.match(/^BUG\s*#?\d+\s*\((.+)\)\s*$/i);
  if (paren) s = paren[1].trim();
  return s;
};
// A parent that names a QA ACTIVITY is not a module. Filing bugs under "Smoke/Regression testing" would
// invent a module that does not exist in the product — measured on the reference board, doing that blindly
// would have swallowed 55 of 125 bugs into one fake bucket.
const ACTIVITY = /(smoke|regression|retest|re-test|testing|qa\b|sprint|release|acceptance|epic|bug ?fix(ing)?|post[- ]release)/i;

// Two containers can name the SAME screen differently — "[pixel-perfect] Settings screen" and
// "The Settings screen (UI/UX)" — and a roll-up that files them as two modules counts one screen twice.
// The tool DETECTS the collision and says so; it does not merge them, because deciding that two names mean
// one module is a product judgement, not a string operation. MODULE_MAP is where the owner records it.
const canon = (m) => m.toLowerCase()
  .replace(/\([^)]*\)/g, ' ')                                         // "(UI/UX)", "(Draft)" — decoration, not identity
  .replace(/\b(the|a|an|screen|screens|flow|flows|page|pages|section|module)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim();
// A container whose subject reads like a DEFECT ("Rating stars jump when text area expands") is not naming a
// module — it is a bug with sub-bugs. Filing its children under it invents a module that no one would
// recognise, so it is flagged for the owner rather than silently promoted.
const READS_LIKE_A_BUG = /\b(isn'?t|aren'?t|doesn'?t|don'?t|not |no |jumps?|opens?|shows?|breaks?|fails?|missing|overlap|crash|wrong|incorrect|without|disappears?|persists?|stuck|loop|error|cropped|cut off|truncat)/i;
// A subject that IS a place, not a sentence: "The Library screen", "Select Genre screen". Deliberately
// strict — it must END in a place noun and stay short. Anything looser and a bug's own title ("Accepted
// shared book disappears from the carousel…") gets promoted into a module, which is the failure this whole
// cascade exists to avoid.
const NAMES_A_PLACE = /^(the\s+)?[\w\s/&'’-]{3,40}\s(screen|page|flow|tab|section|menu|carousel)s?\s*$/i;
// ── inferring a module from the bug's OWN TEXT ────────────────────────────────────────────
// "The Notifications screen shows hardcoded mock data" says where it lives. Reading that is an INFERENCE,
// not a fact off the board — so it is used under strict conditions and it is RECORDED as an inference
// (moduleSource: "summary-inferred"), never passed off as something the tracker said:
//   • the text must name EXACTLY ONE place. "on the List and Detail screens" names two, and a coin-flip
//     between them would put the bug in the wrong module — the one failure this whole cascade exists to
//     avoid. Ambiguous → it stays in General.
//   • an existing module wins over a new one: if the text names a place the board already has a module for,
//     that module is used, so the inference cannot fragment "Settings screen" into a second near-duplicate.
// MODULE_INFER=0 turns it off entirely, and every such bug falls back to General.
// NOTE the missing "and": "on the List and Detail screens" names TWO places, and an earlier version of
// this regex swallowed the conjunction and invented a module called "Library and Story screen" — a place
// that does not exist, holding a bug that belongs to two that do. The BOTH_RE below catches that shape
// first and returns both, which makes the bug ambiguous, which sends it to General. Correct outcome.
const PLACE_RE = /(?:^|\s|["“'‘(])((?:[A-Z][\w'’&-]*)(?:\s+(?:[A-Z][\w'’&-]*|of|the|your|a|my)){0,3})\s+(screen|page|tab|section|carousel|menu|flow)s?\b/g;
const BOTH_RE = /\b([A-Z][\w'’-]*)\s+and\s+([A-Z][\w'’-]*)\s+(screens|pages|tabs|flows|sections)\b/g;
const PLATFORM = /^(android|ios|iphone|ipad|web|mobile|desktop)\s+/i;   // a platform is not a place
const placesIn = (text) => {
  const out = new Map();
  const t = String(text || '').replace(/https?:\/\/\S+/g, ' ');       // a URL is not a place
  const add = (raw) => {
    // Strip the article, do not reject on it. Rejecting "The Notifications screen" because it starts with
    // "The" threw away the clearest signal in the whole sentence — the bug was literally naming its screen.
    const name = raw.replace(PLATFORM, '').replace(/^(the|a|an)\s+/i, '').replace(/\s+/g, ' ').trim();
    if (!name || /^(this|that|next|previous|same|other|first|last)\b/i.test(name)) return;
    out.set(canon(name), name);
  };
  let m;
  BOTH_RE.lastIndex = 0;
  while ((m = BOTH_RE.exec(t))) {                                      // "Library and Story screens" → two places
    const noun = m[3].replace(/s$/, '');
    add(`${m[1]} ${noun}`);
    add(`${m[2]} ${noun}`);
  }
  PLACE_RE.lastIndex = 0;
  while ((m = PLACE_RE.exec(t))) add(`${m[1].trim()} ${m[2].toLowerCase()}`);
  return [...out.entries()];                                          // [canonical, pretty]
};

// Bugs filed as numbered points inside one description. Two or more points → it is a container, not a bug.
const splitPoints = (desc) => {
  const lines = String(desc || '').split(/\r?\n/);
  const pts = [];
  for (const l of lines) {
    const m = l.match(/^\s*(\d{1,2})[.)]\s+(.{10,})$/);
    if (m) pts.push(m[2].trim());
    else if (pts.length && l.trim() && !/^\s*$/.test(l)) pts[pts.length - 1] += ' ' + l.trim();
  }
  // One point counts too: the subject already said the SCREEN, so the description is the bug. Without this
  // the row's summary would read "The Relationship screen" — a place, not a defect, and useless to a reader.
  return pts.length >= 1 ? pts : null;
};

// ── pull ──────────────────────────────────────────────────────────────────────────────────
const skipped = [];
const inferred = [];
const ambiguous = [];
let descContainers = 0;
const INFER = process.env.MODULE_INFER !== '0';
const PLACEMENTS = process.env.PLACEMENT_FILE && fs.existsSync(process.env.PLACEMENT_FILE)
  ? JSON.parse(fs.readFileSync(process.env.PLACEMENT_FILE, 'utf8')) : {};
const placementOf = (id) => {
  const v = PLACEMENTS[id];
  if (!v) return null;
  return typeof v === 'string' ? { module: v, source: 'agent-placed' } : { module: v.module, source: v.source === 'owner' ? 'owner-mapped' : 'agent-placed' };
};
const project = await api(`projects/${PROJECT}.json`);
if (!project) die(`project "${PROJECT}" not found on ${URL_BASE}.`, 2);
const SITE = process.env.SITE_NAME || project.project.name;

const issues = [];
for (let off = 0; ; off += 100) {
  const d = await api(`issues.json?project_id=${PROJECT}&status_id=*&limit=100&offset=${off}`);
  if (!d) break;
  issues.push(...d.issues);
  if (issues.length >= d.total_count) break;
}
const byId = new Map(issues.map((i) => [i.id, i]));

// Every issue is probed for a checklist: on this board the containers are ordinary issues, and nothing
// about them says so from the outside — not the tracker, not the description (it is empty).
const containers = [];
for (const i of issues) {
  const d = await api(`issues/${i.id}/checklists.json`);
  const items = (d && d.checklists) || [];
  if (!items.length) continue;
  // A checklist on a Task is a to-do list, not a bug list. Only Bug issues (or a subject the team tagged as
  // bugs) carry defects — harvesting the rest would count planned work as defects found.
  const isBugs = i.tracker.name.toLowerCase() === 'bug' || /\[[^\]]*bugs?[^\]]*\]/i.test(i.subject);
  if (!isBugs) { skipped.push({ ref: `#${i.id}`, subject: i.subject, why: `tracker "${i.tracker.name}" with a checklist — a to-do list, not bugs` }); continue; }
  containers.push({ issue: i, items });
}
const containerIds = new Set(containers.map((c) => c.issue.id));
const MODULE_MAP_RAW = process.env.MODULE_MAP && fs.existsSync(process.env.MODULE_MAP)
  ? JSON.parse(fs.readFileSync(process.env.MODULE_MAP, 'utf8')) : {};
// Looked up by CANONICAL form: "The Settings screen (UI/UX)" and "Settings screen (UI/UX)" are the same key.
// A map that breaks the moment someone drops an article is a map nobody will keep up to date.
const MODULE_MAP = new Map(Object.entries(MODULE_MAP_RAW).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [canon(k), v]));
const mapLookup = (m) => (MODULE_MAP.has(canon(m)) ? { hit: true, to: MODULE_MAP.get(canon(m)) } : { hit: false });

// A bug the board cannot place does NOT get dropped. Dropping it under-reports the grand total — the one
// number this document exists to produce — and it does so silently: nobody counts what is not on the page.
// It goes to an explicit "General" band instead. That is not a guess: it is the document saying "this bug
// was found, and the board does not say where it lives". General is a DEBT, and it is meant to look like one.
// (Setting MODULE_FALLBACK=0 restores the old drop-and-report behaviour. It will under-report. Say so.)
const FALLBACK = process.env.MODULE_FALLBACK === '0' ? null : (process.env.MODULE_FALLBACK || 'General');

const knownCanon = new Map();   // canonical form → the module name the board actually uses
const rows = [];          // { module, summary, evidence, status, trackerRef, id }
const unplaced = [];      // rows the board cannot place — they land in General, and they are LISTED
const suspect = [];       // containers whose subject reads like a defect, not a module
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
const evidenceOf = (text) => {
  const out = [];
  const re = /(https?:\/\/[^\s*)"']+)/g;
  let m;
  while ((m = re.exec(text))) {
    const url = m[1].replace(/[.,;]+$/, '');
    out.push({ url,
      kind: /\.mp4|screen ?record|dropbox|loom/i.test(text) ? 'screen-record' : 'screenshot',
      hostRisk: /screencast\.com|prnt\.sc|lightshot|dropbox\.com\/scl/i.test(url) ? 'expiring'
        : /drive\.google\.com|mega\.nz/i.test(url) ? 'durable' : 'unknown' });
  }
  return out;
};

// 1) checklist containers — the module is the container's subject
for (const { issue, items } of containers) {
  let mod = moduleOf(issue.subject);
  const hitC = mapLookup(mod);
  const mappedContainer = hitC.hit;
  if (mappedContainer) mod = hitC.to;                                 // the owner's call wins
  if (!mod) { unplaced.push({ ref: `#${issue.id}`, subject: issue.subject, why: 'the container subject yields no module name', n: items.length }); mod = FALLBACK; }
  if (!mod) continue;
  if (READS_LIKE_A_BUG.test(mod) && !(moduleOf(issue.subject) in MODULE_MAP)) {
    suspect.push({ ref: `#${issue.id}`, name: mod, n: items.length });
  }
  items.forEach((it, k) => {
    const text = String(it.subject || '').replace(/^\s*\d+[.)]\s*/, '').trim();   // drop the "1. " the team types
    if (!text) return;
    rows.push({
      module: mod,
      moduleSource: mappedContainer ? 'owner-mapped' : 'container',
      // The id addresses the ROW, so it is built from the TRACKER, never from the module name. Deriving it
      // from the module meant that the moment the owner merged two modules in MODULE_MAP, every severity
      // rating and every reference keyed to those rows was orphaned. Ids must survive a rename.
      id: `rm-${issue.id}-${k + 1}`,
      summary: text,
      evidence: evidenceOf(text),
      // A ticked checklist item means THE TEAM TICKED IT — not that QA re-verified it against the original
      // repro. So it is `fixed`, never `verified`. That distinction is the whole point of the status enum.
      status: it.is_done ? 'fixed' : 'open',
      trackerRef: `${URL_BASE}/issues/${issue.id}#checklist-${it.id}`,
    });
  });
}

for (const r of rows) knownCanon.set(canon(r.module), r.module);   // the modules the BOARD named, before inference

// 2+3) everything else: a description container (subject = a screen, bugs = numbered points), or a
// standalone bug (one issue = one bug, module from the parent).
for (const i of issues) {
  if (containerIds.has(i.id)) continue;                 // already harvested as a checklist container
  if (i.tracker.name.toLowerCase() !== 'bug') continue; // tasks/epics are not bugs
  const points = NAMES_A_PLACE.test(i.subject) ? splitPoints(i.description) : null;

  let mod = null, why = 'no parent, and the subject alone does not name a module';
  if (NAMES_A_PLACE.test(i.subject) && !ACTIVITY.test(i.subject)) {
    mod = moduleOf(i.subject);                          // the subject IS the place
  } else {
    const parent = i.parent && byId.get(i.parent.id);
    if (parent) {
      if (ACTIVITY.test(parent.subject)) why = `parent #${parent.id} "${parent.subject.slice(0, 40)}" is a QA activity, not a module`;
      else mod = moduleOf(parent.subject) || null;
    }
  }
  const hit = mod ? mapLookup(mod) : { hit: false };
  const mapped = hit.hit;
  if (mapped) { if (hit.to === null) why = 'dropped by MODULE_MAP'; mod = hit.to; }
  let src = mod ? (mapped ? 'owner-mapped' : (NAMES_A_PLACE.test(i.subject) ? 'subject' : 'parent')) : null;

  const status = /deployed|closed|resolved/i.test(i.status.name) ? 'fixed' : 'open';
  const make = (text, id) => {
    let m2 = mod, s2 = src;
    const hand = placementOf(id);                        // a per-bug decision beats every rule
    if (hand) { m2 = hand.module; s2 = hand.source; }
    if (!m2 && INFER) {                                   // the bug's own words may say where it lives
      const found = placesIn(text);
      if (found.length === 1) {
        const [c, pretty] = found[0];
        const existing = knownCanon.get(c);               // an existing module wins over a new one
        m2 = existing || pretty;
        const h2 = mapLookup(m2);
        if (h2.hit) m2 = h2.to;
        s2 = 'summary-inferred';
        inferred.push({ ref: `#${i.id}`, into: m2, from: text.slice(0, 60) });
      } else if (found.length > 1) {
        ambiguous.push({ ref: `#${i.id}`, places: found.map((f) => f[1]) });
      }
    }
    if (!m2) { unplaced.push({ ref: `#${i.id}`, subject: i.subject, why, n: 1 }); m2 = FALLBACK; s2 = 'unplaced'; }
    if (!m2) return;
    rows.push({ module: m2, moduleSource: s2, id, summary: text,
      evidence: evidenceOf(text), status, trackerRef: `${URL_BASE}/issues/${i.id}` });
  };

  if (points) { descContainers++; points.forEach((text, k) => make(text, `rm-${i.id}-${k + 1}`)); }
  else make(i.subject, `rm-${i.id}`);
}

// Collapse spellings of the SAME name onto the first one seen — "notification Settings screen" and
// "Notification Settings screen" are one module, and that is a fact about strings, not a product decision.
// (Genuinely different names that merely look alike are still only FLAGGED — see `collisions`.)
{
  const rep = new Map();
  for (const r of rows) { const c = canon(r.module); if (!rep.has(c)) rep.set(c, r.module); }
  for (const r of rows) r.module = rep.get(canon(r.module));
}

if (!rows.length) die(`read ${issues.length} issue(s) from "${project.project.name}" and produced no bug rows.\n`
  + '  Checked BOTH shapes: checklist containers (GET /issues/<id>/checklists.json) and standalone Bug issues.\n'
  + '  If the board really holds bugs, the conventions differ from this one — do not force it.', 1);

// ── severity: the tool will not invent one ────────────────────────────────────────────────
// ── WHAT IS STILL OWED ────────────────────────────────────────────────────────────────────
// The single easiest way to produce a wrong document is to STOP HERE. The tool has done the mechanical
// half; the half that decides what the numbers MEAN is the agent's, and it is spelled out in the
// playbooks. So the tool ends by saying, out loud, what has not been done — because an agent that sees
// "230 bug rows" and no complaint will believe it has finished.
const stillOwed = () => {
  // Read `known` directly, not the sev() helper: that one is declared further down, so calling stillOwed()
  // from the EARLY exit path (no severities yet) hit its temporal dead zone — and the agent who stops
  // earliest is exactly the one who most needs this report.
  const rated = (id) => { const v = known[id]; return typeof v === 'string' ? { severity: v } : (v || {}); };
  const owed = [];
  const inferredN = rows.filter((r) => r.moduleSource === 'summary-inferred').length;
  const unplacedN = rows.filter((r) => r.moduleSource === 'unplaced').length;
  const proposedN = rows.filter((r) => rated(r.id).severitySource === 'agent-proposed').length;
  const ownerN = rows.filter((r) => rated(r.id).severitySource === 'owner').length;
  if (collisions.length) owed.push(`${collisions.length} module name(s) look like the same thing twice → the OWNER decides. Record it in MODULE_MAP.`);
  if (suspect.length) owed.push(`${suspect.length} container(s) are named after a DEFECT, not a module → the owner decides where those bugs live.`);
  if (unplacedN) owed.push(`${unplacedN} bug(s) sit in "${FALLBACK}" → READ them and place the ones you honestly can (PLACEMENT_PLAYBOOK.md, step 6). What is left there is a declared debt, not a shrug.`);
  if (inferredN) owed.push(`${inferredN} module(s) were INFERRED from the bug's own wording — a judgement, not something the board said. Spot-check them.`);
  if (proposedN) owed.push(`${proposedN} severit(y|ies) are AGENT-PROPOSED → the OWNER must validate them before this goes to anyone outside the team.`);
  if (!ownerN && !proposedN) owed.push('NO severities have been assigned yet → rate them (SEVERITY_PLAYBOOK.md). The tracker has none, and this tool will not invent any.');

  if (owed.length) {
    console.error('\n  ── STILL OWED — the document is NOT finished ─────────────────────────────────');
    owed.forEach((o, i) => console.error(`   ${i + 1}. ${o}`));
    console.error('\n  The tool did the mechanical half. The half that decides what the numbers MEAN is yours:');
    console.error('    SEVERITY_PLAYBOOK.md  — the scale, and how to rate against it');
    console.error('    PLACEMENT_PLAYBOOK.md — the cascade, and what must stay in "General"');
    console.error('  Stopping here produces a document that LOOKS finished and is not.');
  } else {
    console.error('\n  ✓ Nothing owed: every module is placed or declared, every severity is owner-validated.');
  }
};

const SEV_FILE = process.env.SEVERITY_FILE;
const known = SEV_FILE && fs.existsSync(SEV_FILE) ? JSON.parse(fs.readFileSync(SEV_FILE, 'utf8')) : {};
const missing = rows.filter((r) => !known[r.id]);
const bad = rows.filter((r) => known[r.id] && !SCALE.includes(typeof known[r.id] === 'string' ? known[r.id] : known[r.id].severity));

const modules = [...new Set(rows.map((r) => r.module))];
const collisions = (() => {
  const by = new Map();
  for (const m of modules) { const k = canon(m); if (!by.has(k)) by.set(k, []); by.get(k).push(m); }
  return [...by.values()].filter((v) => v.length > 1);
})();
const report = () => {
  console.error(`bs-from-redmine: "${project.project.name}" — ${issues.length} issue(s) scanned`);
  const fromChecklist = rows.filter((r) => r.trackerRef.includes('#checklist')).length;
  console.error(`  ${containers.length} checklist container(s) → ${fromChecklist} bug row(s)`);
  console.error(`  ${descContainers} description container(s) (numbered points under a screen name)`);
  console.error(`  ${rows.length - fromChecklist} row(s) from description containers + standalone bug issues`);
  console.error(`  → ${rows.length} bug row(s) across ${modules.length} module(s)`);
  if (unplaced.length) {
    const n = unplaced.reduce((a, u) => a + u.n, 0);
    if (FALLBACK) {
      console.error(`\n  ⚠ ${n} bug(s) the board cannot place → filed under "${FALLBACK}". They are COUNTED (dropping them`);
      console.error('    would under-report the grand total, which is the one number this document exists to produce),');
      console.error(`    but "${FALLBACK}" is a debt, not a module: it means nobody can say where these bugs live.`);
    } else {
      console.error(`\n  ⛔ ${n} bug(s) have no determinable module and MODULE_FALLBACK=0 — they are DROPPED.`);
      console.error('    The grand total on the Sheet will therefore UNDER-REPORT what was found. Say so, or use General.');
    }
    unplaced.slice(0, 10).forEach((u) => console.error(`      ${u.ref}  ${u.subject.slice(0, 50)}  — ${u.why}`));
    if (unplaced.length > 10) console.error(`      … and ${unplaced.length - 10} more`);
    console.error('    To place them: give them a parent that names a module, put them in a checklist container,');
    console.error('    or record your call in MODULE_MAP. Nothing is guessed on your behalf.');
  }
  if (inferred.length) {
    console.error(`\n  · ${inferred.length} bug(s) were placed by INFERRING the screen from the bug's own text. That is an`);
    console.error('    inference, not something the board said — recorded as moduleSource "summary-inferred".');
    inferred.slice(0, 8).forEach((i2) => console.error(`      ${i2.ref} → "${i2.into}"   ← "${i2.from}…"`));
    if (inferred.length > 8) console.error(`      … and ${inferred.length - 8} more`);
  }
  if (ambiguous.length) {
    console.error(`\n  ⚠ ${ambiguous.length} bug(s) name MORE THAN ONE place, so they stay in "${FALLBACK}". Picking one would be a`);
    console.error('    coin-flip, and a bug in the wrong module corrupts the very statistic this document produces:');
    ambiguous.slice(0, 6).forEach((a) => console.error(`      ${a.ref}  ${a.places.map((p) => `"${p}"`).join(' / ')}`));
  }
  if (collisions.length) {
    console.error(`\n  ⚠ ${collisions.length} module name(s) look like the SAME thing said twice. Left as-is — merging them is`);
    console.error('    a product judgement, not a string operation. If they ARE one module, say so in MODULE_MAP,');
    console.error('    or the document counts one screen twice:');
    collisions.forEach((c) => console.error(`      ${c.map((m) => `"${m}"`).join('  ==  ')}`));
  }
  if (suspect.length) {
    console.error(`\n  ⚠ ${suspect.length} container(s) whose subject reads like a DEFECT, not a module — their bugs are filed`);
    console.error('    under a "module" no one would recognise. Rename on the board, or map them:');
    suspect.forEach((s2) => console.error(`      ${s2.ref}  "${s2.name}"  (${s2.n} bug(s))`));
  }
  if (skipped.length) {
    console.error(`\n  · ${skipped.length} checklist(s) skipped (not bug lists): ${skipped.map((s2) => s2.ref).join(', ')}`);
  }
};

// Whatever is still unplaced gets written out, so it can be placed by a human or by an agent that reads it.
const stillUnplaced = rows.filter((r) => r.moduleSource === 'unplaced');
if (stillUnplaced.length && OUT && !DRY) {
  const f = path.join(path.dirname(OUT), 'placement-triage.json');
  fs.writeFileSync(f, JSON.stringify(Object.fromEntries(stillUnplaced.map((r) => [r.id,
    { module: null, summary: r.summary, tracker: r.trackerRef }])), null, 2) + '\n');
  console.error(`\n  · the ${stillUnplaced.length} unplaced row(s) were written to ${f} — fill in "module" and re-run with PLACEMENT_FILE.`);
}

if (bad.length) { report(); die(`\n${bad.length} row(s) in ${SEV_FILE} carry a severity outside [${SCALE.join(', ')}].`, 1); }

if (missing.length) {
  report();
  // WHERE the triage file goes: beside -o, and NOWHERE ELSE. It used to default to the CWD, which on a
  // --dry-run without -o meant it wrote PROJECT DATA INTO THE KIT. A tool that guesses a destination will
  // eventually guess someone else's folder — and a dry run must write nothing at all, by definition.
  const triage = OUT ? path.join(path.dirname(OUT), 'severity-triage.json') : null;
  if (triage && !DRY) {
    fs.writeFileSync(triage, JSON.stringify(Object.fromEntries(missing.map((r) => [r.id,
      { severity: null, severitySource: null, severityRationale: null, module: r.module, summary: r.summary, tracker: r.trackerRef }])), null, 2) + '\n');
  }
  console.error(`\n  ⛔ ${missing.length} of ${rows.length} row(s) have NO SEVERITY, and Redmine has no severity field to take it from.`);
  if (triage && !DRY) console.error(`     Written to ${triage} — one entry per row, with what you need to rate it.`);
  else if (DRY) console.error('     (--dry-run: nothing written. Re-run with -o <file> to get the triage file beside it.)');
  else console.error('     Pass -o <file> and the triage file is written beside it. Without it there is nowhere to put it,\n     and this tool will NOT guess a folder.');
  console.error('     Fill in `severity` (a human triage → severitySource "owner"), or have an agent propose one');
  console.error('     (severitySource "agent-proposed" + severityRationale naming the decision-tree branch —');
  console.error('     it is a HYPOTHESIS, and every count in the document will be built out of it).');
  if (triage && !DRY) console.error(`     Then re-run with SEVERITY_FILE=${triage}.`);
  console.error('\n  This tool has no --assume-minor and never will: a default severity is a lie with a number attached.');
  stillOwed();                                   // the agent who stops EARLIEST is the one who most needs this
  process.exit(3);
}

// ── emit ──────────────────────────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const sev = (id) => (typeof known[id] === 'string' ? { severity: known[id] } : known[id]);
const summary = {
  summaryId: process.env.SUMMARY_ID || `BS-${today}`,
  project: project.project.name,
  generatedAt: `${today}T00:00`,
  ...(process.env.ENVIRONMENT ? { environment: process.env.ENVIRONMENT } : {}),
  source: { kind: 'tracker-export', ref: `${URL_BASE}/projects/${PROJECT}`,
    note: `Pulled read-only from Redmine: ${containers.length} checklist container(s) + standalone Bug issues. `
      + 'Redmine records NO severity, so every severity here was assigned outside the tracker — see severitySource on each row. '
      + (inferred.length ? `${inferred.length} row(s) were placed by INFERRING the screen from the bug's own wording (moduleSource "summary-inferred") — an inference, not a fact from the board. ` : '')
      + (unplaced.length
        ? `${unplaced.reduce((a, u) => a + u.n, 0)} bug(s) could not be placed by the board and sit under "${FALLBACK}" — counted, but unplaced: that band is a debt, not a module.`
        : 'Every bug resolved to a module.') },
  severityScale: SCALE,
  // General goes LAST, and it belongs to THIS site. A document covering several sites gets one General per
  // site — never a shared bucket: merging the unplaced bugs of two products into one band would invent a
  // relationship that does not exist.
  sites: [{ id: slug(SITE), name: SITE, pages: [...modules.filter((m) => m !== FALLBACK), ...modules.filter((m) => m === FALLBACK)].map((m) => ({
    id: slug(m), name: m,
    ...(m === FALLBACK ? { unplaced: true } : {}),
    issues: rows.filter((r) => r.module === m).map((r, k) => {
      const s = sev(r.id);
      const out = { id: r.id, summary: r.summary, severity: s.severity, status: r.status, trackerRef: r.trackerRef };
      if (r.moduleSource) out.moduleSource = r.moduleSource;
      if (s.severitySource) out.severitySource = s.severitySource;
      if (s.severityRationale) out.severityRationale = s.severityRationale;
      if (r.evidence.length) out.evidence = r.evidence;
      return out;
    }),
  })) }],
};

report();

if (DRY) { console.error('\n--dry-run: nothing written.'); process.exit(0); }
const json = JSON.stringify(summary, null, 2) + '\n';
if (OUT) { fs.writeFileSync(OUT, json); console.error(`\n  → ${OUT}`); } else process.stdout.write(json);
