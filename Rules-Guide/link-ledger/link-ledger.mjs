// link-ledger.mjs — make "the link must stay the same" a machine check instead of a memory.
//
// THE FAILURE IT GUARDS: updating a re-creatable artefact must land under THE SAME link. The
// tempting shortcut — create a new doc/tab and trash the old one — looks IDENTICAL in the UI,
// and silently kills every share, every bookmark and every `#gid=` link anyone was given. A
// human eye cannot see the difference between "updated" and "recreated". A recorded id can.
//
// THE SHAPE: a ledger per project, one entry per CARRIER, keyed by PURPOSE — because a title
// changes legitimately (dates, rounds) while an id must not.
//
//   <Project>/.link-ledger.json
//   { "version": 1, "entries": [ { kind, key, id, gid, title, firstSeen, lastSeen, adoptions } ] }
//
// THE RULE, and it fails CLOSED:
//   • no entry      → record it, print "first sighting" (never fails on a genuinely new artefact)
//   • entry matches → silent
//   • entry differs → THROW, naming the old id/gid and what just died. The write must not proceed.
//   • LINK_LEDGER_ADOPT=1 → re-point deliberately, loudly, and keep the old value in `adoptions`
//
// USE FROM A TOOL (one call at the write boundary, BEFORE the first mutating request):
//
//   import { assertStableLink } from '<…>/Rules-Guide/link-ledger/link-ledger.mjs';
//   assertStableLink({ kind: 'sheet-tab', key: 'bug-summary/Statistic', id: ssId, gid: GID,
//                      title: TAB });
//
// USE FROM A SHELL:
//
//   node link-ledger.mjs check --kind sheet-tab --key bug-summary/Statistic --id <id> --gid 940001
//   node link-ledger.mjs list
//   node link-ledger.mjs selftest        # proves the REFUSAL, not just the happy path
//
// Env: LINK_LEDGER=<path to the ledger file>   (otherwise resolved, see resolveLedgerPath)
//      LINK_LEDGER_ADOPT=1                     deliberate re-point

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEDGER_FILE = '.link-ledger.json';
export const KINDS = ['sheet', 'sheet-tab', 'doc', 'report', 'folder'];

export class LinkLedgerError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'LinkLedgerError';
    Object.assign(this, detail);
  }
}

const nowIso = () => new Date().toISOString();

/**
 * Where the ledger lives, in order:
 *   1. an explicit path (argument, then LINK_LEDGER)
 *   2. the nearest EXISTING ledger walking up from `from` — a tool run deep inside
 *      `<Project>/QA-Documentation/bug-summary/` still writes the project's one ledger
 *   3. the nearest ancestor that looks like a project folder (`*-project`, or one holding a
 *      CLAUDE.md), so the first sighting lands where the next tool will find it
 *   4. `from` itself — never fail to have somewhere to record
 */
export function resolveLedgerPath({ ledgerPath, from = process.cwd() } = {}) {
  const explicit = ledgerPath || process.env.LINK_LEDGER;
  if (explicit) return path.resolve(explicit);

  let dir = path.resolve(from);
  const chain = [];
  for (let i = 0; i < 12; i++) {
    chain.push(dir);
    if (fs.existsSync(path.join(dir, LEDGER_FILE))) return path.join(dir, LEDGER_FILE);
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  const projectish = chain.find((d) => /-project$/.test(path.basename(d)))
    || chain.find((d) => fs.existsSync(path.join(d, 'CLAUDE.md')));
  return path.join(projectish || path.resolve(from), LEDGER_FILE);
}

export function readLedger(file) {
  if (!fs.existsSync(file)) return { version: 1, entries: [] };
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    // A corrupt ledger is NOT "no ledger": silently starting a fresh one would drop every id
    // it held and turn the guard off exactly when it is needed.
    throw new LinkLedgerError(`the link ledger at ${file} is not readable JSON (${e.message}).\n`
      + '  Fix or restore it — an unreadable ledger cannot prove a link is stable, and starting\n'
      + '  a fresh one would silently discard every id recorded so far.', { file });
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
    throw new LinkLedgerError(`the link ledger at ${file} has no "entries" array — refusing to use it.`, { file });
  }
  return parsed;
}

export function writeLedger(file, ledger) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sorted = { ...ledger, entries: [...ledger.entries].sort((a, b) => (a.kind + a.key).localeCompare(b.kind + b.key)) };
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
}

const sameGid = (a, b) => (a === undefined || a === null ? b === undefined || b === null : Number(a) === Number(b));

/**
 * The check. Returns { status: 'first-sighting' | 'stable' | 'adopted', entry, file }.
 * Throws LinkLedgerError when the carrier moved and the move was not authorised.
 *
 * `log` defaults to console.log; pass a tool's own printer, or `() => {}` to stay silent.
 */
export function assertStableLink({ kind, key, id, gid, title, ledgerPath, from, adopt, log = console.log } = {}) {
  if (!kind || !KINDS.includes(kind)) throw new LinkLedgerError(`kind must be one of: ${KINDS.join(', ')} (got ${JSON.stringify(kind)})`);
  if (!key || typeof key !== 'string') throw new LinkLedgerError('key is required — name the PURPOSE of the carrier, e.g. "bug-summary/Statistic"');
  if (!id || typeof id !== 'string') throw new LinkLedgerError('id is required — the carrier id that must not change (fileId / documentId)');

  const file = resolveLedgerPath({ ledgerPath, from });
  const ledger = readLedger(file);
  const adopting = adopt === undefined ? process.env.LINK_LEDGER_ADOPT === '1' : !!adopt;
  const at = nowIso();
  const idx = ledger.entries.findIndex((e) => e.kind === kind && e.key === key);

  if (idx === -1) {
    const entry = { kind, key, id, ...(gid === undefined || gid === null ? {} : { gid: Number(gid) }), ...(title ? { title } : {}), firstSeen: at, lastSeen: at };
    ledger.entries.push(entry);
    writeLedger(file, ledger);
    log(`link-ledger: first sighting — ${kind} "${key}" recorded as ${id}${entry.gid === undefined ? '' : `#gid=${entry.gid}`}`);
    log(`  ${file}  ← every later build must land on this same carrier.`);
    return { status: 'first-sighting', entry, file };
  }

  const prev = ledger.entries[idx];
  const idOk = prev.id === id;
  const gidOk = sameGid(prev.gid, gid);

  if (idOk && gidOk) {
    prev.lastSeen = at;
    if (title && prev.title !== title) prev.title = title;   // a title may drift; an id may not
    writeLedger(file, ledger);
    return { status: 'stable', entry: prev, file };
  }

  const what = [
    !idOk ? `id ${prev.id} → ${id}` : null,
    !gidOk ? `gid ${prev.gid ?? '(none)'} → ${gid ?? '(none)'}` : null,
  ].filter(Boolean).join(' · ');

  if (!adopting) {
    throw new LinkLedgerError(
      `link-ledger: ${kind} "${key}" MOVED — ${what}\n`
      + `  Recorded ${prev.firstSeen.slice(0, 10)} in ${file}\n`
      + '  Writing here would leave the recorded carrier orphaned: every shared link, bookmark and\n'
      + `  #gid= reference to it keeps pointing at the OLD one${!idOk ? ' (which a trash-and-recreate also kills)' : ''}.\n`
      + '  Refusing the write. Point the tool back at the recorded carrier, or — if the move is\n'
      + '  deliberate and you have told whoever holds the old link — re-run with LINK_LEDGER_ADOPT=1.',
      { file, key, kind, previous: { id: prev.id, gid: prev.gid }, attempted: { id, gid } },
    );
  }

  const adoptions = Array.isArray(prev.adoptions) ? prev.adoptions : [];
  adoptions.push({ at, fromId: prev.id, ...(prev.gid === undefined ? {} : { fromGid: prev.gid }) });
  const entry = { ...prev, id, ...(gid === undefined || gid === null ? {} : { gid: Number(gid) }), ...(title ? { title } : {}), lastSeen: at, adoptions };
  ledger.entries[idx] = entry;
  writeLedger(file, ledger);
  log(`link-ledger: ADOPTED a new carrier for ${kind} "${key}" — ${what}`);
  log('  Every link to the previous one is now dead. Re-share it, or fix the references that point at it.');
  return { status: 'adopted', entry, file };
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────
const RUN_AS_CLI = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (RUN_AS_CLI) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const flag = (name) => { const i = argv.indexOf(`--${name}`); return i === -1 ? undefined : argv[i + 1]; };

  if (!cmd || cmd === '--help' || cmd === 'help') {
    console.log('link-ledger — the same artefact must keep the same link.\n'
      + '  node link-ledger.mjs check --kind <sheet|sheet-tab|doc|report|folder> --key <purpose> --id <fileId> [--gid <n>] [--title <t>] [--ledger <path>]\n'
      + '  node link-ledger.mjs list [--ledger <path>]\n'
      + '  node link-ledger.mjs selftest\n'
      + 'Env: LINK_LEDGER=<path>  LINK_LEDGER_ADOPT=1 (deliberate re-point)');
    process.exit(cmd ? 0 : 2);
  }

  if (cmd === 'list') {
    const file = resolveLedgerPath({ ledgerPath: flag('ledger') });
    if (!fs.existsSync(file)) { console.log(`link-ledger: no ledger yet at ${file}`); process.exit(0); }
    const ledger = readLedger(file);
    console.log(`link-ledger: ${ledger.entries.length} carrier(s) in ${file}`);
    for (const e of ledger.entries) {
      console.log(`  ${e.kind.padEnd(9)} ${e.key.padEnd(32)} ${e.id}${e.gid === undefined ? '' : `#gid=${e.gid}`}`
        + `${e.adoptions?.length ? `  (re-pointed ${e.adoptions.length}×)` : ''}`);
    }
    process.exit(0);
  }

  if (cmd === 'check') {
    try {
      const r = assertStableLink({
        kind: flag('kind'), key: flag('key'), id: flag('id'),
        gid: flag('gid') === undefined ? undefined : Number(flag('gid')),
        title: flag('title'), ledgerPath: flag('ledger'),
      });
      if (r.status === 'stable') console.log(`link-ledger: stable — ${r.entry.kind} "${r.entry.key}" is still ${r.entry.id}${r.entry.gid === undefined ? '' : `#gid=${r.entry.gid}`}`);
      process.exit(0);
    } catch (e) {
      console.error(e instanceof LinkLedgerError ? e.message : `link-ledger: ${e.message}`);
      process.exit(1);
    }
  }

  if (cmd === 'selftest') {
    // A guard verified only on its passing case is not verified. This proves the REFUSAL —
    // and that the refusal is what stops a write, not a warning somebody scrolls past.
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'link-ledger-'));
    const file = path.join(tmp, LEDGER_FILE);
    const quiet = () => {};
    const base = { kind: 'sheet-tab', key: 'demo/Statistic', id: 'FILE_AAA', gid: 940001, ledgerPath: file, log: quiet };
    const results = [];
    const check = (what, fn) => { let ok = false; let note = ''; try { ok = fn(); } catch (e) { note = e.message.split('\n')[0]; } results.push([what, ok, note]); };

    check('first sighting records the carrier', () => assertStableLink({ ...base }).status === 'first-sighting');
    check('an unchanged carrier is silent', () => assertStableLink({ ...base }).status === 'stable');
    check('a MOVED id is REFUSED', () => {
      try { assertStableLink({ ...base, id: 'FILE_BBB' }); return false; } catch (e) { return e instanceof LinkLedgerError && /MOVED/.test(e.message); }
    });
    check('a MOVED gid is REFUSED (a new tab id kills #gid= links)', () => {
      try { assertStableLink({ ...base, gid: 940009 }); return false; } catch (e) { return e instanceof LinkLedgerError; }
    });
    check('the refusal did NOT rewrite the ledger', () => {
      const e = readLedger(file).entries[0];
      return e.id === 'FILE_AAA' && e.gid === 940001;
    });
    check('LINK_LEDGER_ADOPT re-points and keeps the old id', () => {
      const r = assertStableLink({ ...base, id: 'FILE_BBB', adopt: true });
      return r.status === 'adopted' && r.entry.adoptions.at(-1).fromId === 'FILE_AAA';
    });
    check('after adopting, the NEW id is the stable one', () => assertStableLink({ ...base, id: 'FILE_BBB' }).status === 'stable');
    check('a corrupt ledger is refused, not silently reset', () => {
      const bad = path.join(tmp, 'corrupt.json');
      fs.writeFileSync(bad, '{ not json');
      try { assertStableLink({ ...base, ledgerPath: bad }); return false; } catch (e) { return e instanceof LinkLedgerError; }
    });

    for (const [what, ok, note] of results) console.log(`${ok ? '✓' : '✗'} ${what}${note && !ok ? ` — ${note}` : ''}`);
    fs.rmSync(tmp, { recursive: true, force: true });
    const failed = results.filter(([, ok]) => !ok);
    if (failed.length) { console.error(`\nlink-ledger selftest: FAILED ${failed.length}/${results.length}`); process.exit(1); }
    console.log(`\nlink-ledger selftest: ${results.length}/${results.length} — the guard refuses, and refuses without damage.`);
    process.exit(0);
  }

  console.error(`link-ledger: unknown command "${cmd}" — try check | list | selftest`);
  process.exit(2);
}
