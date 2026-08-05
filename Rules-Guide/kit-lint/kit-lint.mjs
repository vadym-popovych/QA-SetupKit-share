// kit-lint.mjs — the kit's test for itself. Zero dependencies.
//
//   node Rules-Guide/kit-lint/kit-lint.mjs            # from the QA-SetupKit root (the WORKING TREE)
//   node Rules-Guide/kit-lint/kit-lint.mjs --quiet    # failures in full + one line proving it ran
//        (for the backup cron and the pre-push gate). It drops the per-check ✓ list, never a ✗ or its
//        detail, and it still prints the clean line: silence cannot be told apart from a run that
//        never fired, which is the false green this whole checker exists to prevent.
//   node Rules-Guide/kit-lint/kit-lint.mjs --committed # lint the COMMITTED state — what a clone gets
//   node Rules-Guide/kit-lint/kit-lint.mjs --write    # regenerate stale L12 index blocks in place
//
// "Clean on my disk" is not "clean in a clone". A fresh `git clone` contains only COMMITTED files, so
// a reference-fix left uncommitted — the classic aftermath of committing a `git mv` WITHOUT its
// link-fixes (this bit the HTML-Reports move on 13/07: working-tree lint green, five README links dead
// in a clone) — sails through the default run and breaks for the next person. `--committed` lints
// exactly `git archive HEAD`, and a structural change (move / rename / register a module) is not DONE
// until it is green.
//
// The checks are L1-L12; each one is defined at its own section below and listed with its
// rationale in README.md. Keep all three registers (this header, the README table, the NAMES map
// at the bottom) in step — on 28/07/2026 an audit found the README stopping at L9 while the code
// ran L10, which is how a check becomes invisible to the people meant to rely on it. (And on
// 29/07 the check list right below this paragraph was found still stopping at L6 while the code
// ran L11 — the register nearest the code drifted too. There is no register too close to drift.)
//
// Why this exists: QA-SetupKit is built on "never fake a Pass" — and until now it had no
// automated test of ITSELF. Every rule lives in three places (workspace CLAUDE.md, the kit's
// RULES, the starter block) and the sync rested entirely on discipline. Discipline drifts:
// the 12/07 folder migration left stale paths behind, and the kit's own docs point at tools
// that do not ship with it. A kit that promises a teammate "clone this and it works" must be
// able to CHECK that claim, not assert it.
//
// Checks (each is a promise the kit makes out loud somewhere):
//   L1  links       every relative link in a kit doc resolves
//   L2  tools       every tool a kit doc tells you to run actually ships with the kit
//   L3  portability no kit doc depends on the author's machine or projects
//   L4  shape       every kit has README + SETUP + <TYPE>_RULES + CLAUDE.starter
//   L5  wiring      every kit is registered in the root README and the folder map
//   L6  starters    every CLAUDE.starter points at its own RULES file
//   L7  english     shareable kit docs are in English (quotes/UI strings exempt)
//   L8  examples    every shipped *.example.json validates against its schema
//   L9  dead tools  every shipped executable is named by at least one doc
//   L10 client data nothing shipped names a real client, person, tracker or document
//   L11 badges      every maturity badge agrees with modules.json (single-sourced)
//   L12 projections every generated index block matches its declared source
//
// Exit 1 on any violation. A violation is not a style nit — each one is a place where a fresh
// clone would break in a teammate's hands.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ROOT is cwd by default; KIT_LINT_ROOT lets the self-test point kit-lint at a fixture mini-kit
// (a deliberately-broken one must make kit-lint exit nonzero — the "test for the tester").
const ROOT = process.env.KIT_LINT_ROOT || process.cwd();
const QUIET = process.argv.includes('--quiet');
const ALLOW_FILE = path.join(ROOT, 'Rules-Guide/kit-lint/allow.json');

if (!fs.existsSync(path.join(ROOT, 'Rules-Guide')) || !fs.existsSync(path.join(ROOT, 'README.md'))) {
  console.error('kit-lint: run me from the QA-SetupKit root');
  process.exit(2);
}

// --committed: lint what a fresh clone would get (the COMMITTED tree), not the working tree. Materialize
// `git archive HEAD` into a temp dir and run the lint THERE — untracked and uncommitted files simply are
// not in the archive, so a fix that exists only on disk cannot mask a broken link. This is the check the
// working-tree run structurally cannot make; run it before calling any structural change done.
if (process.argv.includes('--committed')) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-lint-committed-'));
  try {
    execSync(`git archive HEAD | tar -x -C ${JSON.stringify(tmp)}`, { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
  } catch {
    console.error('kit-lint --committed: could not `git archive HEAD` — run me inside the kit\'s git repo, and commit at least once first.');
    fs.rmSync(tmp, { recursive: true, force: true });
    process.exit(2);
  }
  if (!QUIET) console.log('kit-lint --committed: linting the COMMITTED tree (git archive HEAD) — exactly what a fresh clone receives.\n');
  const selfInClone = path.join(tmp, 'Rules-Guide/kit-lint/kit-lint.mjs');
  const r = spawnSync(process.execPath, [selfInClone, ...(QUIET ? ['--quiet'] : [])], { cwd: tmp, stdio: 'inherit' });
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(r.status ?? 2);
}

// Deliberate exceptions, each with a REASON. An allowlist without reasons rots into a
// dumping ground for "we'll fix it later".
const allow = fs.existsSync(ALLOW_FILE) ? JSON.parse(fs.readFileSync(ALLOW_FILE, 'utf8')) : { entries: [] };
const allowed = (check, file, needle) =>
  allow.entries.some((e) => e.check === check && e.file === file && (!e.match || needle.includes(e.match)));

// fixtures/ holds DELIBERATELY-broken inputs for the self-test — never scan them in a normal run,
// or the kit's own lint would go red on files that are supposed to be red.
const SKIP_DIRS = new Set(['node_modules', '.git', '.auth', 'dom-snapshots', 'fixtures']);
const docs = [];
const all = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else {
      const rel = path.relative(ROOT, p);
      all.push(rel);
      if (e.name.endsWith('.md')) docs.push(rel);
    }
  }
})(ROOT);

// What actually TRAVELS is what git tracks. The walk above sees the working tree, which also holds
// gitignored local state — the usage-scraper's Chrome profile alone contributed 39 phantom author
// paths the first time L3 was widened past docs (28/07/2026). Linting those is worse than noise:
// a checker that reports things a clone can never contain teaches people to skim its output.
// (Not a git repo → null, and every check falls back to the working tree, which errs safe.)
let shippedFiles = null;
try {
  // stderr silenced deliberately: under `--committed` this runs inside the extracted archive, which is
  // NOT a git repo, and git's `fatal: not a git repository` leaked into the pre-push gate's output —
  // an alarming line in the one report whose entire value is that it can be trusted at a glance.
  // The fallback is not a degradation there: the archive IS exactly what ships.
  shippedFiles = new Set(execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean));
} catch { /* not a git repo */ }
const ships = (f) => !shippedFiles || shippedFiles.has(f);

const violations = [];
const add = (check, file, msg) => violations.push({ check, file, msg });
const say = (m) => { if (!QUIET) console.log(m); };

// ── L1 · every relative link resolves ────────────────────────────────────────────────────
// A CLAUDE.starter.md is a PASTE BLOCK: it ends up in the teammate's workspace CLAUDE.md, so
// its links are relative to the workspace root (`QA-SetupKit/...`), not to the starter's own
// folder. Resolve them the way they will actually be read, or the lint invents failures.
const isStarter = (doc) => path.basename(doc) === 'CLAUDE.starter.md';
for (const doc of docs) {
  const text = fs.readFileSync(path.join(ROOT, doc), 'utf8');
  for (const m of text.matchAll(/\]\(([^)]+)\)/g)) {
    let target = m[1].trim();
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    target = target.split('#')[0];
    if (!target) continue;
    const tries = [path.resolve(path.dirname(path.join(ROOT, doc)), target)];
    if (isStarter(doc)) tries.push(path.join(ROOT, target.replace(/^QA-SetupKit\//, '')));
    if (!tries.some((t) => fs.existsSync(t)) && !allowed('L1', doc, target)) {
      add('L1', doc, `broken link → ${target}`);
    }
  }
}

// ── L2 · every tool a doc tells you to run ships with the kit ────────────────────────────
// Catches the exact failure the audit found: RULES that say "run tools/redmine-bug.mjs" when
// that file lives in the author's project folder and never travels with the clone.
const TOOL_RE = /`([^`\s]*?[\w-]+\.(?:mjs|js|py|sh))`/g;
// A tool "ships" if a file with that name exists ANYWHERE in the kit — usually under a kit's
// template/ (the project copy is made from it). What we are hunting is the tool that exists
// ONLY in the author's project folder, so a fresh clone is told to run a file it doesn't have.
const kitBasenames = new Set(all.map((f) => path.basename(f)));
for (const doc of docs) {
  const text = fs.readFileSync(path.join(ROOT, doc), 'utf8');
  for (const m of text.matchAll(TOOL_RE)) {
    const ref = m[1];
    if (/^https?:/.test(ref)) continue;                          // third-party URL, not ours to ship
    if (/^<|\$\{|\*/.test(ref)) continue;                        // placeholders
    if (/^(<Project>|<Name>|~|\/Users|\.\/runs)/.test(ref)) continue;
    if (kitBasenames.has(path.basename(ref))) continue;          // ships with the kit, somewhere
    if (allowed('L2', doc, ref)) continue;
    // NOTE: a bare filename used to be skipped here ("it's just prose"). That hole is how
    // `publish-report.sh` survived — LOAD_TESTING_RULES tells you to RUN it, and it ships
    // nowhere. An escape hatch in the check that exists to catch exactly this defect is worse
    // than no check. If a name is written as a runnable tool, it must exist.
    add('L2', doc, `doc points at a tool that does NOT ship with the kit → ${ref}`);
  }
}

// ── L3 · portability: no kit doc may depend on the author's machine or projects ──────────
// The autonomy mission in one check: a teammate with a clean clone must never be sent to a
// path that only exists on the author's laptop.
// What actually breaks a fresh clone is a doc that SENDS you somewhere that isn't there:
//   (a) an absolute home path on the author's machine  (/Users/<name>/… — case-sensitive: `/users/current`
//       is a Redmine API endpoint, not a filesystem path, and flagging it taught me that a
//       lint which cries wolf gets ignored exactly like a flaky gate);
//   (b) a markdown LINK whose target points into a project folder — a dead link in the clone.
// Naming a real project in PROSE ("Live example: <Project>/…") breaks nothing and
// is genuinely useful, so it is not a violation.
// 28/07/2026: the old client-name alternation was clobbered by the anonymization pass
// (names → "<Project>" placeholders) and silently matched nothing real — an anonymized
// checker is a neutered checker. Structural now: the workspace convention names every
// project folder `<Name>-project/` and every read-only clone `<Name>-repository/`, so the
// SHAPE is detectable with no client name in this file and no future anonymization can
// break it. Proven to red by selftest.mjs (bad-kit L3 fixture).
const PROJECT_DIR = /[\w.]+-(project|repository)\//;

// The author-path check runs over EVERYTHING the kit ships, not just its prose. It used to read
// docs only, and two surfaces hid under that (both found 28/07/2026): mega-upload.sh spelled the
// author's credentials path twice in a shipped tool, and .mcp.json.template — the file a teammate
// copies verbatim to bootstrap their MCP setup — pointed at the author's clone location while a
// second example next to it used the /ABSOLUTE/PATH/TO/ placeholder correctly. A config a
// newcomer copies is the most load-bearing text in the kit; it was the least checked.
const BINARY = /\.(png|jpe?g|gif|webp|pdf|zip|ico|mp4|mov|woff2?|ttf)$/i;
for (const f of all) {
  if (/node_modules|\/fixtures\//.test(f) || BINARY.test(f) || !ships(f)) continue;
  // allow.json QUOTES the patterns it excepts — scanning the allowlist for the strings it exists
  // to name is a category error, and "add an allow entry for the allow file" is a worse answer.
  if (f === 'Rules-Guide/kit-lint/allow.json') continue;
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const abs = /\/Users\/[a-z]+\//.exec(line);
    if (abs && !allowed('L3', f, abs[0])) {
      add('L3', f, `${f}:${i + 1} absolute path on the author's machine → ${abs[0]}`);
    }
  });
}

for (const doc of docs) {
  const text = fs.readFileSync(path.join(ROOT, doc), 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\]\(([^)]+)\)/g)) {
      const target = m[1];
      if (/^https?:/.test(target)) continue;
      if (PROJECT_DIR.test(target) && !allowed('L3', doc, target)) {
        add('L3', doc, `${doc}:${i + 1} link into a project folder — dead in a fresh clone → ${target}`);
      }
    }
  });
}


// ── L4 · every module meets the contract of ITS CLASS ────────────────────────────────────
// Until 12/07/2026 this check looked at Testing-Types + Testing-Planning only — 19 modules of
// 26 — and still printed "clean". That is a SILENT CAP: the kit forbids exactly this in the
// systems it tests ("no silent caps — log what was dropped"; "a skipped gate is not a pass").
// Now every group is discovered from modules.json, each class is held to its own contract, and
// the scope is PRINTED so the number can never quietly shrink again.
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'Rules-Guide/kit-lint/modules.json'), 'utf8'));
const modules = [];
for (const [group, cls] of Object.entries(manifest.groups)) {
  const dir = path.join(ROOT, group);
  if (!fs.existsSync(dir)) continue;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const rel = path.join(group, e.name);
    modules.push({ path: rel, cls: manifest.overrides[rel] ?? cls });
  }
}
const kits = modules.filter((m) => m.cls === 'kit').map((m) => m.path);

for (const m of modules) {
  const files = fs.readdirSync(path.join(ROOT, m.path));
  const has = (re) => files.some((f) => re.test(f));
  if (!has(/^README\.md$/)) add('L4', m.path, `[${m.cls}] no README.md`);
  if (m.cls !== 'kit') continue;                     // features owe a README; kits owe the full contract
  if (!has(/^SETUP\.md$|_SETUP\.md$/)) add('L4', m.path, '[kit] no SETUP doc');
  if (!has(/_RULES\.md$/) && !allowed('L4', m.path, 'RULES')) add('L4', m.path, '[kit] no <TYPE>_RULES.md — no discipline travels with it');
  if (!has(/^CLAUDE\.starter\.md$/) && !allowed('L4', m.path, 'starter')) add('L4', m.path, '[kit] no CLAUDE.starter.md — nothing for a teammate to paste');
}

// ── L5 · every kit is wired into the root README and the folder map ──────────────────────
const rootReadme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const folderMap = fs.readFileSync(path.join(ROOT, 'Rules-Guide/Project-Configuration/README.md'), 'utf8');
// A sub-kit may be registered through its GROUP's row — that is the actual convention
// (QA-Documentation has one row covering Checklist/Test-Cases/Bug-Reports, and one folder-map
// row for <Project>/QA-Documentation/). Requiring a separate row for each would be the lint
// inventing a rule the kit never made. What must never happen is a module registered NOWHERE.
for (const kit of kits) {
  const name = path.basename(kit);
  const group = kit.split('/')[0];
  const inReadme = rootReadme.includes(`${kit}/`) || rootReadme.includes(`${name}/`) || rootReadme.includes(`${group}/`);
  const inMap = folderMap.includes(`${name}/`) || folderMap.includes(`${group}/`);
  if (!inReadme && !allowed('L5', 'README.md', name))
    add('L5', 'README.md', `kit is in neither its own row nor its group's row → ${kit}`);
  if (!inMap && !allowed('L5', 'Project-Configuration', name))
    add('L5', 'Rules-Guide/Project-Configuration/README.md', `kit not in the kit→folder map (directly or via its group) → ${kit}`);
}

// ── L6 · every starter points at its own RULES (the mirror rule, mechanically) ───────────
for (const kit of kits) {
  const starter = path.join(ROOT, kit, 'CLAUDE.starter.md');
  if (!fs.existsSync(starter)) continue;
  const files = fs.readdirSync(path.join(ROOT, kit));
  const rules = files.find((f) => /_RULES\.md$/.test(f));
  if (!rules) continue;
  const text = fs.readFileSync(starter, 'utf8');
  if (!text.includes(rules) && !allowed('L6', kit, rules))
    add('L6', `${kit}/CLAUDE.starter.md`, `starter never points at ${rules} — a teammate pasting it gets rules with no source`);
}

// ── L7 · kit docs are written in English (the kit is the unit of sharing) ────────────────
// Two deliberate exceptions, and both are QUOTES rather than prose:
//   · trigger phrases quoted as the user actually says them ("проаналізуй сайт…") — the agent
//     matches on them, so translating them would break the trigger;
//   · literal UI strings inside selectors/examples (`input[aria-label="Ціна"]`) — that is data.
// Owner-facing files (workspace CLAUDE.md, <Project>/CLAUDE.md, the starters' trigger lists)
// may be in the owner's language: they never travel with the kit.
const CYRILLIC = /[Ѐ-ӿ]/;
const stripQuoted = (line) =>
  line.replace(/`[^`]*`/g, '').replace(/"[^"]*"/g, '').replace(/«[^»]*»/g, '').replace(/'[^']*'/g, '');
for (const doc of docs) {
  if (path.basename(doc) === 'CLAUDE.starter.md') continue;      // paste block for the owner
  if (!/README\.md$|SETUP\.md$|_RULES\.md$/.test(doc)) continue;  // the shareable core
  const lines = fs.readFileSync(path.join(ROOT, doc), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const prose = stripQuoted(line);
    if (CYRILLIC.test(prose) && !allowed('L7', doc, line.trim())) {
      add('L7', doc, `${doc}:${i + 1} non-English prose in a shareable kit doc → ${prose.trim().slice(0, 60)}`);
    }
  });
}

// ── L8 · every shipped example validates against its schema ──────────────────────────────
// The kit ships *.example.json files as the canonical shape of each artefact. If an example
// stops validating (a schema tightened, an example drifted), every teammate copying it inherits
// a broken template. This runs validate.mjs over each one — the checker checking its own examples.
import { spawnSync as _spawn } from 'node:child_process';
const VALIDATE = path.join(ROOT, 'Rules-Guide/schemas/validate.mjs');
const SCHEMA_OF = { bug: 'bug', 'test-case': 'test-case', 'run-result': 'run-result', 'checklist-row': 'checklist-row', coverage: 'coverage', strategy: 'strategy', 'pagespeed-round': 'pagespeed-round', 'bug-summary': 'bug-summary', 'test-report': 'test-report', 'link-ledger': 'link-ledger', 'bug-spec': 'bug-spec', 'bug-spec-backend': 'bug-spec' };
if (fs.existsSync(VALIDATE)) {
  for (const f of all.filter((x) => x.endsWith('.example.json'))) {
    const kind = SCHEMA_OF[path.basename(f).replace(/\.example\.json$/, '')];
    if (!kind) {                               // no schema mapping — the SKIP must be loud, not silent
      if (!allowed('L8', f, 'no-schema')) add('L8', f, `shipped example matches NO schema — silently unvalidated. Add a schema + SCHEMA_OF entry, or allow-list it (match: "no-schema") with a reason.`);
      continue;
    }
    const r = _spawn(process.execPath, [VALIDATE, kind, path.join(ROOT, f)], { encoding: 'utf8' });
    if (r.status !== 0 && !allowed('L8', f, kind)) add('L8', f, `example does not validate against the ${kind} schema: ${(r.stdout || r.stderr || '').trim().split('\n')[0]}`);
  }
}

// ── L9 · no dead tools — every shipped executable is named by at least one doc ────────────
// The mirror of L2. L2 catches a DOC that points at a tool the kit doesn't ship; L9 catches a
// TOOL the kit ships that no doc mentions — an orphan nobody is told to run, dead weight that
// silently rots. (A tool referenced only by another tool, or only by itself, still counts as
// undocumented for a human.)
const docText = docs.map((d) => fs.readFileSync(path.join(ROOT, d), 'utf8')).join('\n');
for (const f of all) {
  if (!/\.(mjs|js|py|sh)$/.test(f)) continue;
  if (/node_modules|\/fixtures\//.test(f)) continue;
  const base = path.basename(f);
  // it "is documented" if any .md mentions its basename
  if (!docText.includes(base) && !allowed('L9', f, base)) add('L9', f, `shipped tool ${f} is named by NO doc — a dead tool nobody is told to run`);
}

// ── L10 · no CLIENT DATA in the kit — the kit SHIPS ───────────────────────────────────────
// Added 14/07/2026, after the owner opened a shipped EXAMPLE file and found 309 of his client's real
// bugs in it — the client's name, his staging URLs, 325 evidence links. Committed and pushed. The kit
// had nine checks and not one of them asked whether it was giving away somebody's data.
//
// An example is the easiest place to leave a client behind, because it looks like data ABOUT the format
// rather than somebody's data. It is not. The kit ships: everything in it reaches every teammate who
// clones it.
//
// Two rules, both mechanical:
//   1. a DATA file that ships (an example, a template config) may not point at a real host — if it names
//      one that is not a documentation placeholder, that host belongs to somebody;
//   2. NOTHING in the kit — docs, tools, examples — may name a client, a person, a real tracker, or a real
//      document id. "A real name" cannot be detected generically, so the owner names his own clients ONCE,
//      in no-client-data.json. Teaching material loses nothing: the SHAPE of an example is what calibrates
//      a judgement, never the product's nouns.
// The denylist belongs to the LINT, not to the tree being linted — resolve it next to this script.
// Reading it from ROOT made kit-lint CRASH when pointed at a mini-kit fixture (the selftest's own
// good-kit), which turned a verdict-renderer into a stack trace. A checker that dies on unfamiliar input
// is not a checker.
const NCD_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'no-client-data.json');
const NCD = fs.existsSync(NCD_PATH) ? JSON.parse(fs.readFileSync(NCD_PATH, 'utf8')) : { deny: [], allow: [] };
// An allow entry with `match` exempts ONLY that string (same contract as allowed()); an entry with
// no `match` exempts the whole file — reserved for the denylist itself and this linter's teaching
// comments. (05/08/2026 audit: the old Set() read only `file`, so README.md's clone-URL exception
// silently exempted README from EVERY deny pattern — a client name pasted there would lint clean.)
const ncdAllow = new Map();
for (const a of NCD.allow || []) {
  if (!ncdAllow.has(a.file)) ncdAllow.set(a.file, []);
  ncdAllow.get(a.file).push(a.match || null);
}

// WHAT SHIPS is what git tracks. The first version of this check walked the filesystem instead, and duly
// flagged the owner's gitignored Chrome profile and his MEGA credentials — files that are NOT in the repo
// and never leave his machine through a clone. A check that cries wolf about local secrets teaches people
// to ignore it, which is worse than not having it.
// (The zip/AirDrop path is a REAL risk for those files — but it is covered by the secrets list in the
// workspace rules, not by a lint that has no idea a zip is happening.)
// The shipped set is computed once, at the top of the file (`shippedFiles` / `ships()`) — L3 and
// L10 both need "what actually travels", and two copies of that answer is one too many.
const shipped = shippedFiles;

const PLACEHOLDER = /^https?:\/\/([a-z0-9-]+\.)*(example\.(com|net|org)|[a-z0-9-]+\.invalid|localhost|127\.0\.0\.1)(:\d+)?([/?#]|$)/i;
const GENERIC = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/?$/i;
const URL_RE = /https?:\/\/[^\s"'<>)\\]+/g;
for (const f of all) {
  if (shipped && !shipped.has(f)) continue;                          // untracked = does not ship
  if (/node_modules|package-lock\.json|package\.json/.test(f)) continue;
  const abs = path.join(ROOT, f);
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
  if (/\.(png|jpg|jpeg|gif|ico|pdf|zip)$/i.test(f)) continue;
  const txt = fs.readFileSync(abs, 'utf8');

  // (1) real URLs in shipped DATA
  if (/\.json$/.test(f) && (/(^|\/)template\//.test(f) || /\.example\.json$/.test(f))) {
    for (const u of new Set((txt.match(URL_RE) || []).filter((x) => !PLACEHOLDER.test(x) && !GENERIC.test(x)))) {
      if (!allowed('L10', f, u)) add('L10', f, `ships a REAL URL — ${u.slice(0, 55)} — in a data file that goes to every teammate. Use example.com / *.invalid`);
    }
  }
  // (2) client data ANYWHERE
  const ncdExempt = ncdAllow.get(f) || [];
  if (ncdExempt.includes(null)) continue;                  // whole-file exemption
  for (const d of NCD.deny) {
    for (const hit of new Set(txt.match(new RegExp(d.pattern, 'gi')) || [])) {
      if (ncdExempt.some((s) => hit.toLowerCase().includes(s.toLowerCase()))) continue;
      if (allowed('L10', f, hit)) continue;
      add('L10', f, `names a real ${d.why} — "${hit.slice(0, 40)}". The kit SHIPS: nothing in it may identify a client, a person, a tracker or a document.`);
      break;                                               // one violation per pattern per file
    }
  }
}

// ── L11 · one maturity badge per module, single-sourced in modules.json ───────────────────
// Added 28/07/2026, after an external audit found the root README badging Bug-Summary 🟢 while its
// own group index badged it 🟡 — two indexes disagreeing for weeks about how proven a kit was, with
// nothing able to notice. A badge a reader cannot trust is worse than no badge: it is the one
// signal telling them which kits to over-trust.
// The map in modules.json is the single source; every badge in every README is checked against it.
// `evidence` is mandatory for battle-tested — a 🟢 whose evidence nobody can state is the exact
// over-claim the badge system exists to prevent.
const BADGE = { '🟢': 'battle-tested', '🟡': 'stable', '🔴': 'draft' };
const EMOJI = Object.fromEntries(Object.entries(BADGE).map(([e, b]) => [b, e]));
const maturity = manifest.maturity ?? {};

for (const [mod, m] of Object.entries(maturity)) {
  if (!BADGE[EMOJI[m.badge]]) add('L11', 'Rules-Guide/kit-lint/modules.json', `maturity["${mod}"].badge "${m.badge}" is not one of: ${Object.values(BADGE).join(', ')}`);
  if (m.badge === 'battle-tested' && !String(m.evidence || '').trim())
    add('L11', 'Rules-Guide/kit-lint/modules.json', `maturity["${mod}"] is battle-tested with no evidence — say what the kit was driven through, or badge it stable`);
  if (!fs.existsSync(path.join(ROOT, mod))) add('L11', 'Rules-Guide/kit-lint/modules.json', `maturity["${mod}"] names a folder that does not exist`);
}

// A row that carries a badge AND links to a module folder is a maturity claim about that module.
for (const doc of docs.filter((d) => path.basename(d) === 'README.md')) {
  const lines = fs.readFileSync(path.join(ROOT, doc), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!line.startsWith('|')) return;                       // table rows only — prose mentions are not claims
    const badge = /(🟢|🟡|🔴)/.exec(line);
    if (!badge) return;
    let target = null;
    for (const m of line.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^https?:/.test(m[1])) continue;
      const abs = path.resolve(path.dirname(path.join(ROOT, doc)), m[1]);
      if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) { target = path.relative(ROOT, abs); break; }
    }
    if (!target) return;                                     // the badge legend table links nothing — skip
    const declared = maturity[target];
    if (!declared) {
      add('L11', doc, `${doc}:${i + 1} badges ${badge[1]} on "${target}" but modules.json declares no maturity for it — a badge nobody can check`);
    } else if (EMOJI[declared.badge] !== badge[1]) {
      add('L11', doc, `${doc}:${i + 1} badges ${badge[1]} on "${target}" but modules.json says ${declared.badge} (${EMOJI[declared.badge]}) — badges are single-sourced; change modules.json, and only with the owner`);
    }
  });
}

// ── L12 · generated index blocks — an index is a PROJECTION of its source ─────────────────
// Added 29/07/2026 from the drift-prevention plan. Every defect the 28/07 external audit found
// had one shape: a fact written in two places where only ONE is executable — the executable copy
// moves, the written copy lags, and nothing notices because the text still reads fine. The worst
// case is the INDEX (a doc listing the children of a folder): eight of them were in sync that
// night only because they had just been fixed BY HAND — which is the danger, not the safety.
// This check makes an index a projection, the same move coverage-check.mjs makes for the RTM:
// the doc declares its source in an HTML-comment marker (invisible when rendered), the lint
// recomputes the item set from that source and names exactly what is missing or phantom.
// The block's FIRST table column is the key; the rest of the row is human prose the lint never
// owns. A doc with no markers is simply not L12-checked — adoption is per-doc and incremental.
// `--write` regenerates a stale block in place: rows whose key survives keep their prose, new
// keys get a stub row, phantom rows are dropped — fixing drift is one command, not hand-editing.
const WRITE = process.argv.includes('--write');
const GEN_OPEN = /<!--\s*kit:generated:([\w-]+)\s+source=([^\s>]+)\s*-->/g;
const GEN_CLOSE = '<!-- /kit:generated -->';
const isSepRow = (l) => /^\|[|:-]*\|$/.test(l.trim().replace(/ /g, ''));
const keyOfRow = (l) => {
  const cell = l.split('|')[1] || '';
  const link = /\[([^\]]+)\]/.exec(cell);
  return (link ? link[1] : cell).replace(/`/g, '').trim().replace(/\/$/, '');
};
// The only source type so far: a folder, projected to its subfolder names. Keep resolvers dumb
// and explicit — an unknown source is a loud violation, never a silent skip.
const projectedKeys = (src) => {
  const dir = path.join(ROOT, src);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name) && e.name !== 'node_modules' && !e.name.startsWith('.'))
    .map((e) => e.name).sort();
};
for (const doc of docs) {
  const abs = path.join(ROOT, doc);
  let text = fs.readFileSync(abs, 'utf8');
  const blocks = [];
  GEN_OPEN.lastIndex = 0;
  for (let m; (m = GEN_OPEN.exec(text)); ) {
    const start = m.index + m[0].length;
    const end = text.indexOf(GEN_CLOSE, start);
    if (end === -1) { add('L12', doc, `generated block '${m[1]}' has no closing marker (${GEN_CLOSE})`); break; }
    blocks.push({ name: m[1], src: m[2], start, end });
  }
  let rewrote = false;
  for (const b of blocks.reverse()) {            // reverse order: --write splices keep earlier offsets valid
    const expect = projectedKeys(b.src);
    if (expect === null) { add('L12', doc, `block '${b.name}' declares source '${b.src}', which is not a folder this lint can project`); continue; }
    const rows = text.slice(b.start, b.end).split('\n').filter((l) => l.trim().startsWith('|'));
    const sep = rows.findIndex(isSepRow);
    const data = sep >= 0 ? rows.slice(sep + 1) : rows;
    const actual = data.map(keyOfRow).filter(Boolean);
    const missing = expect.filter((k) => !actual.includes(k));
    const extra = [...new Set(actual.filter((k) => !expect.includes(k)))];
    const dupes = [...new Set(actual.filter((k, i) => actual.indexOf(k) !== i))];
    if (!missing.length && !extra.length && !dupes.length) continue;
    if (WRITE) {
      const header = sep >= 0 ? rows.slice(0, sep + 1) : ['| Item | Notes |', '|---|---|'];
      const cols = header[header.length - 1].split('|').filter((s) => s.trim()).length;
      const kept = data.filter((l, i) => expect.includes(keyOfRow(l)) && data.findIndex((x) => keyOfRow(x) === keyOfRow(l)) === i);
      const stubs = missing.map((k) => {
        const rel = path.relative(path.dirname(doc), path.join(b.src, k));
        return `| [\`${k}/\`](${rel}/)${' | _TODO — describe_'.repeat(Math.max(1, cols - 1))} |`;
      });
      text = text.slice(0, b.start) + '\n' + [...header, ...kept, ...stubs].join('\n') + '\n' + text.slice(b.end);
      rewrote = true;
      say(`  L12 --write · ${doc} block '${b.name}': ${stubs.length} stub row(s) added, ${data.length - kept.length} dropped — fill the stubs in`);
      continue;
    }
    if (allowed('L12', doc, b.name)) continue;
    if (missing.length) add('L12', doc, `block '${b.name}' is missing: ${missing.join(', ')} — the source (${b.src}) has them and the index lagged; run --write or add the rows`);
    if (extra.length) add('L12', doc, `block '${b.name}' lists items the source (${b.src}) does not have: ${extra.join(', ')}`);
    if (dupes.length) add('L12', doc, `block '${b.name}' lists twice: ${dupes.join(', ')}`);
  }
  if (rewrote) fs.writeFileSync(abs, text);
}

// ── report ───────────────────────────────────────────────────────────────────────────────
const byCheck = {};
for (const v of violations) (byCheck[v.check] ??= []).push(v);

const NAMES = {
  L1: 'links resolve', L2: 'tools ship with the kit', L3: 'portable (no author-machine paths)',
  L4: 'kit shape (README/SETUP/RULES/starter)', L5: 'kits are registered', L6: 'starters point at their RULES',
  L7: 'kit docs are in English (quotes/UI strings exempt)',
  L8: 'shipped examples validate against their schema',
  L9: 'no dead tools (every shipped executable is documented)',
  L10: 'no client data in shipped data files (the kit ships)',
  L11: 'maturity badges agree with modules.json (single-sourced)',
  L12: 'generated index blocks match their source (projections, not copies)',
};

// The scope line is COUNTED per class, never derived by subtraction: since 13/07 there is a third
// class (`group` — an index folder that owes only its README), and `modules.length - kits.length`
// would have quietly filed every group under "features". A summary that mislabels its own scope is
// the first step back toward the silent cap this check exists to prevent.
const countOf = (cls) => modules.filter((m) => m.cls === cls).length;
const scope = Object.keys(manifest.classes).map((c) => `${countOf(c)} ${c}s`).join(' + ');
say(`kit-lint · ${docs.length} docs · ${modules.length} modules checked (${scope}) · scope from Rules-Guide/kit-lint/modules.json\n`);
// A FAILING check prints in every mode, --quiet included. `--quiet` means "only failures", and it had
// been suppressing the failures themselves: a red run printed the count and «fix it», never WHICH ones.
// The pre-push gate runs `--committed --quiet` and then says «see above» — with nothing above. The one
// moment the gate mattered was the one moment it gave you nothing to act on (found 31/07/2026).
for (const [id, label] of Object.entries(NAMES)) {
  const v = byCheck[id] ?? [];
  const line = `${v.length ? '✗' : '✓'} ${id} ${label}${v.length ? ` — ${v.length} violation(s)` : ''}`;
  if (v.length) console.log(line); else say(line);
  for (const x of v) console.log(`    ${x.file}: ${x.msg}`);
}

if (violations.length) {
  console.log(`\nkit-lint: ${violations.length} violation(s) — each one is a place a fresh clone breaks.`);
  console.log('Fix it, or add a REASONED exception to Rules-Guide/kit-lint/allow.json.');
  process.exit(1);
}
console.log(`\nkit-lint: clean (${docs.length} docs, ${modules.length} modules: ${scope}).`);
