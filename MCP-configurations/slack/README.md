# `slack` — Slack via the official Claude connector

Lets Claude read a Slack workspace — channels, threads, messages, files and users — so a link a
teammate pasted (a design export, a spec, a decision buried in a thread) can be opened directly
instead of being re-sent by hand.

**There is nothing to install and no secret in this folder.** Slack is an official Claude connector:
it is authorised once in the browser, over OAuth, and then appears to every surface — Claude, Claude
Desktop, Claude Code — as `claude.ai Slack`, the same way Google Drive and Figma do. This folder
exists only to say that, and to record why the other route was rejected.

## Setup (once, per person)

| Step | Where |
|---|---|
| 1 | **claude.ai → Customize → Connectors → Slack → Connect** (an org owner enables it first under *Organization settings → Connectors*) |
| 2 | Approve the OAuth prompt in Slack |
| 3 | Back in a terminal: `claude mcp list` → a `claude.ai Slack` row shows **Connected** |

Availability: Team and Enterprise plans with the Claude Slack app installed, and — since 26/01/2026 —
Pro and Max. Nothing is added to `.mcp.json`: connectors are attached to the account, not to a
workspace file, so a teammate authorises their own and sees exactly what their own Slack account can
see, no more.

Docs: <https://claude.com/docs/connectors/slack>

## Why not the community browser-token server

The obvious alternative is a local MCP server driven by the `xoxc`/`xoxd` pair lifted out of a
logged-in browser session. It works, and it needs no admin approval, which is what makes it
tempting on a workspace you do not administer. **We do not use it, and the kit should not teach it**:

- **The token IS a live session, not a credential.** It cannot be scoped, it cannot be rotated, and
  revoking it means logging your own browser out of Slack. That is the same category as the
  usage-scraper's claude.ai cookies — which the sharing rule already singles out as the thing that
  must be stripped by hand before the kit is zipped or AirDropped.
- **It carries the whole account.** OAuth grants the connector a declared set of scopes; a session
  token grants everything the person can do, including posting as them.
- **It has to be re-extracted whenever the session rolls**, so the integration breaks on a schedule
  nobody controls and the fix is a manual dance through DevTools.

Set up 27/08/2026 on the browser-token route, replaced the same day once the official connector was
found. Recorded here so the question is not re-opened from scratch: if the connector is unavailable
on some future workspace, that is a **plan/admin** problem to raise with the owner — not a reason to
reach for the session token.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| No `claude.ai Slack` row in `claude mcp list` | Not connected, or the org has not enabled it | Connect under *Customize → Connectors*; an owner enables it org-wide first |
| Row present, `Needs authentication` | OAuth expired or was revoked | Re-connect in the browser — the connector re-authorises, no token is copied anywhere |
| Connected, but a channel is invisible | The connector sees what **your** Slack account sees | Join the channel in Slack |
