# Bootstrap CLAUDE.md — workspace root

> **What this file is:** the **template Claude uses to autonomously create `<workspace>/CLAUDE.md`** the first time a user asks anything checklist-related in a fresh workspace. The user does NOT copy this file manually. Claude reads this file + [`CHECKLIST_RULES.md`](CHECKLIST_RULES.md), concatenates them (replacing the `<!-- Append … -->` marker at the bottom of this file with the full rules content), and writes the result to `<workspace>/CLAUDE.md`. From the next session onward, Claude Code auto-loads it.
>
> See the "Autonomous bootstrap" rule in [`CHECKLIST_RULES.md`](CHECKLIST_RULES.md) for the exact trigger + write logic.

## Checklist kit — first thing Claude does in every session (CRITICAL)

This workspace uses the QA-checklist generator kit at [`QA-Documentation/Checklist/`](QA-SetupKit/QA-Documentation/Checklist/).

Claude: BEFORE doing any checklist-related work, run the auto-detection from [`MCP_SETUP.md`](QA-SetupKit/QA-Documentation/Checklist/MCP_SETUP.md) "Before you start" / "Auto-detection". If anything required is missing (`.mcp.json` with `google-sheets` entry, `QA-SetupKit/MCP-configurations/mcp-sheets/node_modules/`, `credentials.json`, `token.json`, or the full rules block from [`CHECKLIST_RULES.md`](QA-SetupKit/QA-Documentation/Checklist/CHECKLIST_RULES.md) inside THIS file) — STOP and walk the user through `QA-SetupKit/QA-Documentation/Checklist/MCP_SETUP.md`. Never silently fall back to asking for a Figma URL or generate code that will fail because MCP isn't configured.

If the user types something checklist-related but the kit isn't fully wired up yet, your first reply should be: "I see that <X> isn't configured yet — without it I can't <Y>. Want me to walk you through setting it up? Most of it I can automate; you'll only need to click through 2 browser screens." Then drive it from `MCP_SETUP.md`.

The Figma Dev Mode MCP and claude.ai connectors (Figma, Google Drive) are non-blocking — mention them ONCE if missing, then proceed with what's available (ask for a Figma URL if Dev Mode isn't on, etc.).

---

<!-- Append the contents of Checklist/CHECKLIST_RULES.md below this line in Step 4 of setup -->

- **Verdict doctrine (never fake a Pass · name the oracle · blocked/not-reached ≠ Passed · contradiction → Comment · escalate):** core in `QA-SetupKit/Rules-Guide/DOCTRINE.md`; checklist dialect in `CHECKLIST_RULES.md`. A row is `Passed` only when verified against the design/app; unreachable or single-platform-only → empty status + reason, never green.
- **`""` vs `Skipped` — keep them apart.** `""` = not run **yet** this round (temporary; the round is unfinished). `Skipped` = **will not** be run on this platform — feature absent from the build, screen unreachable, blocked and won't unblock — a decision, **comment mandatory**. Cannot check something on one platform only? That cell is `Skipped` + a reason; the row then resolves normally. Mobile result column adds `Partial` (some active platform still empty — never a Pass); it is a computed value, not a dropdown status.
