# Remote-Control — SETUP

Wires the stdio proxy so every IDE chat publishes itself to Remote Control. Five minutes, one
IDE restart. What it is and why it is needed: [`README.md`](README.md).

**Prerequisites:** the Claude Code extension in a VSCode-family IDE (VSCode, Insiders, Cursor),
Node ≥ 22 on the machine, and an account that can use Remote Control at all (open a terminal
session and run `/remote-control` once — if that connects, the account side is fine).

## 1 · Put the two files where they will live

They belong together in the same folder — the shim resolves the `.mjs` next to itself. The
conventional home is the agent's own scripts folder:

```bash
mkdir -p ~/.claude/scripts
cp tools/claude-rc-wrapper tools/claude-rc-wrapper.mjs ~/.claude/scripts/
chmod +x ~/.claude/scripts/claude-rc-wrapper
```

If `node` is not on the IDE's PATH (or the machine has several), pin it — the shim honours
`CLAUDE_RC_NODE=/path/to/node`.

## 2 · Point the IDE at the **extensionless** shim

`Cmd/Ctrl+Shift+P` → *Preferences: Open User Settings (JSON)* → add:

```json
"claudeCode.claudeProcessWrapper": "<home>/.claude/scripts/claude-rc-wrapper"
```

Use an absolute path (the setting is not `~`-expanded).

> **Do not point it at `claude-rc-wrapper.mjs`.** A path ending in `.mjs` makes the SDK spawn
> `node <real claude binary> <wrapper.mjs>` and the panel dies with
> `SyntaxError: Invalid or unexpected token at …/native-binary/claude:1`. README → "The trap".

## 3 · Optional — dry-run before you restart anything

Proves the proxy, the handshake trigger and the injection without publishing a session
(`enabled:false`), and prints a per-check PASS/FAIL:

```bash
node tools/rc-dryrun.mjs
```

It auto-discovers the IDE's own claude binary; override with `RC_REAL_BINARY=<path>` and
`RC_WRAPPER=<path>` if you installed the files elsewhere.

## 4 · Restart the panel and verify — on both sides

Restarting the Claude panel terminates the session running in it; finish or hand off first.

```bash
tail -f ~/.claude/rc-wrapper.log
```

A wired session logs four lines, in this order:

```
spawn <…>/native-binary/claude | hostSession=true inject=true dryRun=false
host initialize seen request_id=<id>
injected remote_control enabled=true request_id=rcwrap_<pid>
remote_control response: success session_url=https://claude.ai/code/session_<id>
```

**The `session_url` line is the verification, and the phone is the confirmation.** Open the app:
the session must be listed and answer a message. A log with an `injected` line but no `success`
means the bridge itself refused — that is an account/auth question, not a wrapper one.

## Controls

| Env | Effect |
|---|---|
| `CLAUDE_RC_WRAPPER_DISABLE=1` | pure pass-through — the proxy injects nothing |
| `CLAUDE_RC_WRAPPER_DRYRUN=1` | inject with `enabled:false` — plumbing runs, no session published |
| `CLAUDE_RC_NODE=<path>` | interpreter the shim execs (default: `node` from PATH) |

Log: `~/.claude/rc-wrapper.log` (append-only, one block per spawned session).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Panel dies at startup, `SyntaxError … native-binary/claude:1` | the setting points at the `.mjs` | point it at the extensionless shim (step 2) |
| Panel starts, log file never appears | the setting path is wrong, or the shim is not executable | check the path is absolute; `chmod +x` |
| `spawn … hostSession=false inject=false` only | that spawn is not a chat session (version check, MCP helper) — normal | look for the `hostSession=true` block |
| `host initialize seen` missing, injection came from the fallback timer | the host's handshake changed shape | still works; the trigger needs re-reading against the new protocol |
| `remote_control response: error` | the CLI refused the request | read the error in the log — auth or account settings, not the proxy |
| Everything logs `success`, phone shows nothing | you are looking at a different account in the app | match the account the IDE is signed into |

## When you update the IDE extension

Nothing to reinstall — the wrapper is version-independent (the extension passes its own binary
path as the first argument). But an update **can** change the private control protocol, and the
failure is silent. After a major extension update, check the log once for the `injected` +
`success` pair.
