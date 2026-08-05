# Remote-Control — make every IDE chat reachable from the phone

**What it gives you:** a session started in the IDE (VSCode-family) panel publishes itself to
Remote Control automatically, so it shows up in the mobile/desktop app and on the web — you can
read what the agent is doing and reply to it from a phone, without touching the machine.

**What it is:** a small stdio proxy the IDE spawns instead of the Claude binary. It forwards
everything byte-for-byte and injects exactly ONE extra control request — the same one the
`/remote-control` command sends. Nothing else about the session changes.

## Why it is needed (it is not a setting you missed)

Two mechanisms decide whether a session goes remote, and in an IDE panel neither fires:

- **The IDE host** auto-enables Remote Control only when the CLI reports an auto-enable gate,
  which comes from a server-side feature flag. On an account where that flag is off, the host
  never asks — nothing local changes it, and flag-override env vars are dead code in the
  shipped builds (verified by running them).
- **The CLI's own** `remoteControlAtStartup` auto-connect is skipped in stream-json mode, which
  is exactly the mode an IDE panel runs in. So the setting is on and correct, and still nothing
  happens.

The result is silent: the session works perfectly and simply never appears on the phone.

## How it works

```
IDE  ──stdin──▶  claude-rc-wrapper (proxy)  ──▶  real claude binary
     ◀─stdout──                             ◀──
```

1. The proxy watches the host's `initialize` control request go past on stdin.
2. It waits for the CLI's answer to that request on stdout — that answer is the proof the
   control channel is live. (`system/init` is **not** usable as the trigger: in stream-json mode
   it is emitted only once a turn starts, i.e. after the first user message — measured: no init
   line in 22 s of an idle session.)
3. It then writes one `control_request` with `subtype: "remote_control", enabled: true`, and
   **swallows the matching `control_response`** so the host never sees a reply to a request it
   did not make.
4. If the handshake is never observed (the protocol changed), an 8-second fallback timer injects
   anyway rather than doing nothing silently.

**Fail-open by design:** every failure path degrades to a plain pass-through proxy. A broken
wrapper must never cost a working session.

## Files

| File | What it is |
|---|---|
| [`tools/claude-rc-wrapper`](tools/claude-rc-wrapper) | the **extensionless** shim — this is the path the IDE setting points at (see the trap below) |
| [`tools/claude-rc-wrapper.mjs`](tools/claude-rc-wrapper.mjs) | the proxy itself (ESM); expects `argv[2]` = the real claude binary |
| [`tools/rc-dryrun.mjs`](tools/rc-dryrun.mjs) | harness that proves the plumbing with `enabled:false` — no session is published |

Install steps, verification and troubleshooting: [`SETUP.md`](SETUP.md).

## ⚠️ The trap that costs you a working panel

**The wrapper path must NOT end in `.js/.mjs/.ts/.jsx/.tsx`.** The Agent SDK picks the spawn
shape from the file extension alone: a script extension makes it run
`node <executableArgs…> <script>`, and with a process wrapper configured `executableArgs` is
`[the real claude binary]` — so node is handed a compiled binary as its entry point and the panel
dies before the session starts:

```
SyntaxError: Invalid or unexpected token
    at …/native-binary/claude:1
```

An extensionless path is classified as a native binary and spawned as
`<wrapper> <real binary> <args…>` — the contract the proxy expects. That is the only reason this
ships as two files.

## Know what you are turning on

- **A published session is reachable from every surface that account is signed into.** That is the
  point, and it is also the risk: transcripts of work on a client's code become readable from a
  phone. Decide that deliberately — per machine, not per session.
- **It rides a private protocol.** An IDE update can change the control-request shape at any time.
  The failure is silent and harmless (no injection, session still fine), so the log is the only
  place it shows: no `injected` line = the trigger broke; `error` = the envelope broke.
- **Kill switch:** `CLAUDE_RC_WRAPPER_DISABLE=1` → pure pass-through. Removing the IDE setting and
  restarting the panel is the other way out; nothing else depends on the wrapper.
