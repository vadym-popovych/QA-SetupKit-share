#!/bin/bash
# prune-plugin-skills.sh — reclaim always-on context from skills this machine never invokes.
#
# WHY: a skill's frontmatter description is injected into the system prompt of EVERY session,
# invoked or not. An installed plugin that ships 18 skills costs that text in every window,
# forever, even if you only ever use one of them.
#
# BEFORE YOU CONFIGURE THIS: run `node ../tools/skill-usage-audit.mjs` and prune on the number,
# not on a hunch. Then check the plugin does not need the skill at runtime:
#   grep -r 'skills/' <installPath>/scripts <installPath>/hooks
# Some plugins read their own SKILL.md from disk — those skills must stay.
#
# SAFETY: directories are MOVED to an attic, never deleted. `--restore` puts them back.
# SCOPE: only the ACTIVE installPath(s) from installed_plugins.json — stale version folders
# left behind in the cache inject nothing, so they are not touched.
# IDEMPOTENT: safe to re-run. A plugin update reinstalls the full skill set under a NEW
# installPath, which this script resolves fresh on every run — so wire it into whatever
# daily job you already have rather than trying to remember it.
#
# Usage:
#   prune-plugin-skills.sh            # prune
#   prune-plugin-skills.sh --dry-run  # show what would move, change nothing
#   prune-plugin-skills.sh --restore  # move everything back from the attic
#
set -euo pipefail

CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
ATTIC="${SKILL_ATTIC:-$CLAUDE_HOME/plugins/.pruned-skills}"
REGISTRY="$CLAUDE_HOME/plugins/installed_plugins.json"

# ─── CONFIGURE ME ────────────────────────────────────────────────────────────────────────
# One entry per plugin: "<plugin key exactly as in installed_plugins.json>|<skills to KEEP>"
# Everything NOT listed after the pipe is moved to the attic. Empty list = nothing happens,
# which is the deliberate default: this script must never prune a skill you did not name.
PLUGINS=(
  # "some-plugin@some-marketplace|skill-you-actually-use another-one"
)
# ─────────────────────────────────────────────────────────────────────────────────────────

MODE="prune"
[[ "${1:-}" == "--dry-run" ]] && MODE="dry"
[[ "${1:-}" == "--restore" ]] && MODE="restore"

if [[ "$MODE" == "restore" ]]; then
  [[ -d "$ATTIC" ]] || { echo "nothing in the attic: $ATTIC"; exit 0; }
  n=0
  while IFS= read -r skillmd; do
    src="$(dirname "$skillmd")"
    dest="/${src#"$ATTIC"/}"
    mkdir -p "$(dirname "$dest")"
    mv "$src" "$dest"
    echo "restored: $dest"
    n=$((n + 1))
  done < <(find "$ATTIC" -name SKILL.md)
  echo "restored $n skill(s)"
  exit 0
fi

if [[ ${#PLUGINS[@]} -eq 0 ]]; then
  echo "no plugins configured — edit the PLUGINS array in $(basename "$0") first"
  echo "(run skill-usage-audit.mjs to see which skills never fire on this machine)"
  exit 0
fi

moved=0
for entry in "${PLUGINS[@]}"; do
  key="${entry%%|*}"
  keep=" ${entry##*|} "
  while IFS= read -r skills_dir; do
    [[ -d "$skills_dir" ]] || continue
    for d in "$skills_dir"/*/; do
      [[ -f "$d/SKILL.md" ]] || continue
      name="$(basename "$d")"
      [[ "$keep" == *" $name "* ]] && continue
      dest="$ATTIC${d%/}"
      if [[ "$MODE" == "dry" ]]; then
        echo "would move: ${d%/}"
      else
        mkdir -p "$(dirname "$dest")"
        rm -rf "$dest"
        mv "${d%/}" "$dest"
        echo "moved: $name"
      fi
      moved=$((moved + 1))
    done
  done < <(python3 -c "
import json, sys
key = sys.argv[1]
try:
    reg = json.load(open(sys.argv[2]))
except Exception:
    sys.exit(0)
for inst in reg.get('plugins', {}).get(key, []):
    p = inst.get('installPath')
    if p:
        print(p.rstrip('/') + '/skills')
" "$key" "$REGISTRY")
done
echo "$MODE: $moved skill(s)"
