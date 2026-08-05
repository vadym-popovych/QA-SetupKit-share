// rc-dryrun.mjs — prove the wrapper's plumbing WITHOUT opening a remote session.
//
// It spawns the wrapper exactly the way the IDE extension does — `<shim> <real claude
// binary> <session args…>` — and plays the part of the host: it sends the `initialize`
// control request the extension sends first, which is the trigger the wrapper waits for.
// `CLAUDE_RC_WRAPPER_DRYRUN=1` makes the injected request carry `enabled:false`, so the
// whole path is exercised and no session is published anywhere.
//
//   node tools/rc-dryrun.mjs            # auto-discovers the IDE's claude binary
//   RC_REAL_BINARY=/path/to/claude node tools/rc-dryrun.mjs
//   RC_WRAPPER=~/.claude/scripts/claude-rc-wrapper node tools/rc-dryrun.mjs
//
// What a PASS looks like: the host's initialize ack is forwarded, OUR control_response is
// swallowed, every stdout line is still JSON, and the log shows the injection.
//
// What it does NOT prove: the production path. With `enabled:true` the CLI actually opens a
// bridge to the web session — that can fail for reasons a dry run never touches (auth, the
// account's own settings). Verify that on a real panel, per SETUP.md §4.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const untilde = (p) => (p.startsWith('~/') ? path.join(homedir(), p.slice(2)) : p);

const WRAPPER = untilde(process.env.RC_WRAPPER || path.join(HERE, 'claude-rc-wrapper'));

// The IDE ships its own binary; find the newest installed extension rather than naming a
// version that will be stale next week.
function findIdeBinary() {
  const roots = [path.join(homedir(), '.vscode', 'extensions'), path.join(homedir(), '.vscode-insiders', 'extensions'),
    path.join(homedir(), '.cursor', 'extensions')];
  const hits = [];
  for (const root of roots) {
    let names = [];
    try { names = fs.readdirSync(root); } catch { continue; }
    for (const n of names) {
      if (!n.startsWith('anthropic.claude-code')) continue;
      for (const rel of [['resources', 'native-binary', 'claude'],
        ['resources', 'native-binaries', `${process.platform}-${process.arch}`, 'claude']]) {
        const p = path.join(root, n, ...rel);
        if (fs.existsSync(p)) hits.push(p);
      }
    }
  }
  return hits.sort().pop() || null;
}

const REAL = untilde(process.env.RC_REAL_BINARY || findIdeBinary() || '');
if (!REAL || !fs.existsSync(REAL)) {
  console.error('rc-dryrun: no claude binary found — set RC_REAL_BINARY=<path to the IDE\'s claude binary>.');
  process.exit(2);
}
if (!fs.existsSync(WRAPPER)) {
  console.error(`rc-dryrun: wrapper not found at ${WRAPPER} — set RC_WRAPPER=<path to the extensionless shim>.`);
  process.exit(2);
}
const LOG = path.join(homedir(), '.claude', 'rc-wrapper.log');

console.log(`rc-dryrun: ${WRAPPER}\n           → ${REAL}`);

// Spawned as an executable, NOT via `node` — this is how the extension launches it, so the
// run also proves the +x bit, the shebang and the extensionless dispatch.
const child = spawn(WRAPPER, [REAL,
  '--output-format', 'stream-json',
  '--input-format', 'stream-json',
  '--verbose',
], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, CLAUDE_RC_WRAPPER_DRYRUN: '1' } });

let out = '';
let err = '';
child.stdout.on('data', (d) => { out += d; });
child.stderr.on('data', (d) => { err += d; });
child.on('error', (e) => { console.error('rc-dryrun: SPAWN ERROR:', e.message); process.exit(1); });

setTimeout(() => {
  child.stdin.write(`${JSON.stringify({ type: 'control_request', request_id: 'host_init_1', request: { subtype: 'initialize' } })}\n`);
  console.log('>>> sent host initialize');
}, 3000);

setTimeout(() => {
  child.kill();

  const lines = out.split('\n').filter(Boolean);
  const ack = lines.filter((l) => l.includes('host_init_1'));
  const leaked = lines.filter((l) => l.includes('rcwrap_'));
  const badJson = lines.filter((l) => { try { JSON.parse(l); return false; } catch { return true; } });

  let logLines = [];
  try {
    logLines = fs.readFileSync(LOG, 'utf8').split('\n').filter((l) => l.includes(`[${child.pid}]`));
  } catch { /* the log is best-effort; the stream checks below are the verdict */ }
  const injected = logLines.some((l) => /injected remote_control/.test(l));

  const checks = [
    ['initialize ack forwarded to host', ack.length === 1],
    ['our control_response swallowed', leaked.length === 0],
    ['stdout is still line-delimited JSON', badJson.length === 0],
    ['injection happened (see the log)', injected],
  ];
  for (const [what, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${what}`);
  console.log(`--- wrapper log (pid ${child.pid}) ---\n${logLines.join('\n') || '(no lines — the wrapper never logged)'}`);
  if (err.trim()) console.log(`--- stderr (first 500 chars) ---\n${err.slice(0, 500)}`);

  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(`\nrc-dryrun: FAILED — ${failed.map(([w]) => w).join(', ')}`);
    process.exit(1);
  }
  console.log('\nrc-dryrun: PASS (plumbing only — the bridge itself is proven on a real panel, SETUP.md §4)');
  process.exit(0);
}, 20000);
