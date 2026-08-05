# Context-Budget — SETUP

Prerequisites: Node 18+ and Python 3 (both already present if you are running Claude Code with the
rest of this kit). Nothing is installed, no credentials, no network.

## 1. Audit — see what you are paying for

```bash
node QA-SetupKit/Claude-Extra-Skills-Features/Context-Budget/tools/skill-usage-audit.mjs
```

It scans every transcript under `~/.claude/projects/` (override with `CLAUDE_HOME`) and prints one
row per installed skill: invocation count, the chars its listing line costs, and where it comes from.
`--json` gives the same data machine-readable.

Read the bottom line — how many skills have never fired here, and what their listing text is worth.

## 2. Decide — per skill, not in bulk

Zero invocations makes a skill a **candidate**, not a verdict. Before naming one for removal:

- Was it installed recently enough to have no history? Then the zero says nothing.
- Would you want it if you remembered it existed? Keep it.
- Does the plugin need it at runtime? Check before touching it:

```bash
grep -r 'skills/' <installPath>/scripts <installPath>/hooks
```

Any skill referenced there stays, whatever its count. `<installPath>` is in
`~/.claude/plugins/installed_plugins.json`.

## 3. Configure the prune

Edit the `PLUGINS` array at the top of
[`tools/prune-plugin-skills.sh`](tools/prune-plugin-skills.sh). One line per plugin, listing the
skills to **keep** — everything else moves:

```bash
PLUGINS=(
  "some-plugin@some-marketplace|skill-you-actually-use another-one"
)
```

The plugin key must match `installed_plugins.json` exactly. The array is empty by default and the
script exits doing nothing until you fill it in — it will never prune a skill you did not name.

## 4. Dry-run, then prune

```bash
./tools/prune-plugin-skills.sh --dry-run   # lists what would move, changes nothing
./tools/prune-plugin-skills.sh             # moves them to the attic
```

The attic is `~/.claude/plugins/.pruned-skills/` (override with `SKILL_ATTIC`). Nothing is deleted.
To undo everything:

```bash
./tools/prune-plugin-skills.sh --restore
```

## 5. Measure the result

Follow the before/after procedure in [`README.md`](README.md) — two runs before, two after,
identical conditions, sum all three token fields. Report the measured number, not the char estimate.

The session you are in right now will not show the change; its system prompt was built at startup.

## 6. Make it survive plugin updates

An update reinstalls the full skill set under a new `installPath`. The script resolves that fresh on
every run, so the fix is simply to run it regularly. Add the call to whatever daily job you already
have — for example, alongside a backup script:

```bash
PRUNE_SCRIPT="${PRUNE_SCRIPT:-$HOME/.claude/scripts/prune-plugin-skills.sh}"
if [ -x "$PRUNE_SCRIPT" ]; then
  ( "$PRUNE_SCRIPT" 2>&1 || echo "(prune failed — non-fatal)" ) | sed 's/^/   /'
fi
```

Keep it non-fatal. A dirty prompt is a smaller problem than a job that stopped running.
