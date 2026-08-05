#!/usr/bin/env node
/**
 * claude-rc-wrapper.mjs — auto-connect Remote Control for IDE (VSCode) sessions.
 *
 * WHY: the IDE host auto-enables Remote Control only when the CLI reports an
 * auto-enable gate, which comes from a server-side feature flag. Where that
 * flag is off, an IDE session never publishes itself and never appears on the
 * phone. `remoteControlAtStartup: true` does not cover it either — it feeds
 * only the CLI-side auto-connect, which is skipped in stream-json (host-driven)
 * mode, i.e. exactly the mode an IDE panel runs in.
 *
 * WHAT: sits between the IDE and the real Claude binary as a transparent stdio
 * proxy. It watches the host's `initialize` control request go by, waits for
 * the CLI to answer it — that answer is the proof the control channel is live —
 * and then injects exactly the control request that `/remote-control` sends,
 * swallowing the matching control_response so the host never sees a reply it
 * did not ask for.
 *
 * NOTE: `system/init` on stdout is NOT a usable trigger — in stream-json mode
 * the CLI emits it only once a turn starts, i.e. after the first user message,
 * which is far too late (measured: no init line in 22s of an idle session).
 *
 * Wired via the IDE setting `claudeCode.claudeProcessWrapper`, which makes the
 * extension spawn:  <wrapper> <real claude binary> <session args...>
 *
 * ⚠️ The setting must point at the EXTENSIONLESS shim `claude-rc-wrapper` that
 * sits next to this file, never at this .mjs — the SDK dispatches on the file
 * extension and a script extension makes it run `node <real binary> <script>`,
 * killing the panel before the session starts. The shim explains it in full.
 *
 * FAIL-OPEN by design: every failure path degrades to a plain pass-through
 * proxy. A broken wrapper must never cost a working session.
 *
 * Kill switch: CLAUDE_RC_WRAPPER_DISABLE=1  → pure pass-through.
 * Dry run:     CLAUDE_RC_WRAPPER_DRYRUN=1   → injects `enabled:false`
 *                                             (exercises the plumbing without
 *                                             opening a remote session).
 */

import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LOG = join(homedir(), '.claude', 'rc-wrapper.log');
const REQUEST_ID = `rcwrap_${process.pid}`;

function log(msg) {
  try {
    appendFileSync(LOG, `${new Date().toISOString()} [${process.pid}] ${msg}\n`);
  } catch {
    /* logging must never break the proxy */
  }
}

const [realBinary, ...args] = process.argv.slice(2);

if (!realBinary) {
  process.stderr.write('claude-rc-wrapper: no binary path passed as first argument\n');
  process.exit(2);
}

// Only host-driven sessions carry a stream-json input channel. Anything else
// (--claude-in-chrome-mcp, --version, health checks) is proxied untouched.
const isHostSession =
  args.includes('--input-format') &&
  args[args.indexOf('--input-format') + 1] === 'stream-json';

const injectionEnabled = isHostSession && process.env.CLAUDE_RC_WRAPPER_DISABLE !== '1';
const dryRun = process.env.CLAUDE_RC_WRAPPER_DRYRUN === '1';

log(`spawn ${realBinary} | hostSession=${isHostSession} inject=${injectionEnabled} dryRun=${dryRun}`);

const child = spawn(realBinary, args, { stdio: ['pipe', 'pipe', 'inherit'] });

child.on('error', (err) => {
  process.stderr.write(`claude-rc-wrapper: failed to spawn ${realBinary}: ${err.message}\n`);
  process.exit(1);
});

// ---- host → CLI : forwarded byte-for-byte, but read for the handshake -------
/** request_id of the host's own `initialize` control request, once seen. */
let initializeRequestId = null;
let stdinPending = Buffer.alloc(0);

child.stdin.on('error', () => {
  /* the CLI closing stdin first is normal on shutdown */
});

function noteHostLine(text) {
  if (initializeRequestId || !text.includes('initialize')) return;
  try {
    const msg = JSON.parse(text);
    if (msg?.type === 'control_request' && msg?.request?.subtype === 'initialize') {
      initializeRequestId = msg.request_id;
      log(`host initialize seen request_id=${initializeRequestId}`);
    }
  } catch {
    /* not JSON we care about */
  }
}

process.stdin.on('data', (chunk) => {
  stdinPending = Buffer.concat([stdinPending, chunk]);

  let newlineAt;
  while ((newlineAt = stdinPending.indexOf(0x0a)) !== -1) {
    const line = stdinPending.subarray(0, newlineAt + 1);
    stdinPending = stdinPending.subarray(newlineAt + 1);
    child.stdin.write(line);
    noteHostLine(line.toString('utf8'));
  }
});

process.stdin.on('end', () => {
  if (stdinPending.length > 0) child.stdin.write(stdinPending);
});

// ---- CLI → host : line-wise pass-through with one injection point -----------
let injected = false;
let pending = Buffer.alloc(0);

function requestInjection() {
  if (injected || !injectionEnabled) return;
  injected = true;
  const payload = {
    type: 'control_request',
    request_id: REQUEST_ID,
    request: { subtype: 'remote_control', enabled: !dryRun },
  };
  try {
    child.stdin.write(`${JSON.stringify(payload)}\n`);
    log(`injected remote_control enabled=${!dryRun} request_id=${REQUEST_ID}`);
  } catch (err) {
    log(`injection failed (session continues normally): ${err.message}`);
  }
}

/** True when this line is the control_response to OUR request — it must not
 *  reach the host, which never issued a matching request_id. */
function isOurControlResponse(text) {
  if (!text.includes(REQUEST_ID)) return false;
  try {
    const msg = JSON.parse(text);
    return msg?.type === 'control_response' && msg?.response?.request_id === REQUEST_ID;
  } catch {
    return false;
  }
}

/** The CLI's answer to the host's `initialize` — the control channel is live. */
function isInitializeAck(text) {
  if (!initializeRequestId || !text.includes(initializeRequestId)) return false;
  try {
    const msg = JSON.parse(text);
    return msg?.type === 'control_response' && msg?.response?.request_id === initializeRequestId;
  } catch {
    return false;
  }
}

// Safety net: if the handshake is never observed (protocol changed, host talks
// some other way), inject anyway a few seconds in rather than silently do
// nothing. Cleared as soon as the real trigger fires.
const FALLBACK_MS = 8000;
const fallbackTimer = setTimeout(() => {
  if (!injected && injectionEnabled) {
    log('initialize handshake not observed — injecting on fallback timer');
    requestInjection();
  }
}, FALLBACK_MS);
fallbackTimer.unref?.();

child.stdout.on('data', (chunk) => {
  pending = Buffer.concat([pending, chunk]);

  let newlineAt;
  while ((newlineAt = pending.indexOf(0x0a)) !== -1) {
    const line = pending.subarray(0, newlineAt + 1);
    pending = pending.subarray(newlineAt + 1);

    const text = line.toString('utf8');

    if (injected && isOurControlResponse(text)) {
      try {
        const msg = JSON.parse(text);
        const outcome = msg.response?.subtype;
        const url = msg.response?.response?.session_url;
        log(`remote_control response: ${outcome}${url ? ` session_url=${url}` : ''}`);
        if (outcome === 'error') log(`remote_control error: ${msg.response?.error}`);
      } catch {
        /* already know it is ours; shape does not matter for logging */
      }
      continue; // swallowed: the host never asked for this
    }

    process.stdout.write(line);

    if (!injected && isInitializeAck(text)) {
      clearTimeout(fallbackTimer);
      requestInjection();
    }
  }
});

child.stdout.on('end', () => {
  if (pending.length > 0) process.stdout.write(pending);
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    try {
      child.kill(signal);
    } catch {
      /* child already gone */
    }
  });
}

child.on('exit', (code, signal) => {
  log(`child exited code=${code} signal=${signal}`);
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
