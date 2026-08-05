#!/usr/bin/env bash
#
# durable-resume.sh — OS-level fallback for session resumes that MUST fire even if
# the Claude chat that scheduled them is closed (in-session CronCreate jobs are
# PER-CHAT and in-memory: they die with their chat tab / IDE reload).
#
# Creates a ONE-SHOT launchd agent that at the given local time runs headless
#   claude -p "<continuation prompt pointing at the handoff file>"
# from the workspace directory, then removes itself.
#
# Double-fire protection: the agent claims <handoff>.lock (mkdir = atomic) before
# running. The in-session cron's continuation should claim the SAME lock as its
# first step (instruction belongs in the cron prompt): whoever fires first wins,
# the other exits quietly.
#
# Usage: durable-resume.sh HH:MM /abs/path/to/handoff.md [label] [--unattended]
#   HH:MM         local time today (or tomorrow if already past)
#   label         optional slug for the agent name (default: basename of handoff)
#   --unattended  owner-authorized unattended mode (same contract as
#                 recurring-driver.sh): the headless claude runs with
#                 --dangerously-skip-permissions PLUS a deny-fence settings
#                 profile (no writes into */*-repository/* clones, no `git push`).
#                 Without it the run is read-mostly: permission prompts can't be
#                 answered headlessly, so ALL writes are silently blocked.
#
# Failure handling built into the runner:
#   - Limit bounce: if the headless run hits the usage limit ("hit your limit"),
#     the runner RELEASES the lock and re-arms itself at the reset time parsed
#     from the limit message +5 min (fallback: +65 min), up to 5 retries.
#   - Visibility: the full headless output is appended to <handoff>-RESULT.md
#     next to the handoff (plus the shared log), and a desktop notification is
#     posted on every terminal outcome.
#
# Caveats (documented, deliberate):
# - Headless `claude -p` starts a FRESH session: all context must be in the handoff
#   file (that is already the Cron-Session evacuation contract).
# - Mac must be awake at fire time (same constraint as any local scheduler).
# - The deny fences are accident-fences for an agent following its rules, not a
#   sandbox: unattended mode is an explicit owner-level trust decision.
#
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

UNATTENDED=0
ARGS=()
for a in "$@"; do
  case "$a" in
    --unattended) UNATTENDED=1 ;;
    *) ARGS+=("$a") ;;
  esac
done
set -- ${ARGS[@]+"${ARGS[@]}"}

TIME="${1:?usage: durable-resume.sh HH:MM /path/to/handoff.md [label] [--unattended]}"
HANDOFF="${2:?usage: durable-resume.sh HH:MM /path/to/handoff.md [label] [--unattended]}"
LABEL_SLUG="${3:-$(basename "$HANDOFF" .md)}"
HOUR="${TIME%%:*}"; MIN="${TIME##*:}"
[ -f "$HANDOFF" ] || { echo "handoff file not found: $HANDOFF" >&2; exit 2; }

WORKDIR="${CLAUDE_WORKDIR:-$HOME/Projects}"
LABEL="com.claude.durable-resume.${LABEL_SLUG}"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
RUNNER="$HOME/.claude/scripts/durable-resume-runner.sh"
PROFILE="$HOME/.claude/scripts/headless-unattended.settings.json"
LOG="$HOME/.claude/durable-resume.log"

mkdir -p "$HOME/.claude/scripts" "$HOME/Library/LaunchAgents"

# A stale lock from a previous cycle would make this resume exit as "already
# claimed" — arming a NEW resume for the same handoff implies the old cycle is over.
if [ -d "${HANDOFF}.lock" ]; then
  rmdir "${HANDOFF}.lock" 2>/dev/null && echo "note: cleared stale ${HANDOFF}.lock from a previous cycle"
fi

# Deny-fence profile for unattended mode (regenerated on every arm; referenced by
# the runner only when unattended=1). Fences: never write into read-only client
# repo clones (*-repository convention), never `git push` from a headless run.
if [ "$UNATTENDED" = "1" ]; then
  cat > "$PROFILE" << EOF
{
  "permissions": {
    "deny": [
      "Edit(/${WORKDIR}/**/*-repository/**)",
      "Write(/${WORKDIR}/**/*-repository/**)",
      "Bash(git push:*)"
    ]
  }
}
EOF
fi

cat > "$RUNNER" << 'EOS'
#!/usr/bin/env bash
# runner v2: claim the lock, run headless claude with the handoff, self-remove.
# Unattended mode: --dangerously-skip-permissions + deny-fence settings profile.
# Limit bounce: release the lock and re-arm a retry at the reset time (+5 min).
set -u
# launchd gives a bare PATH — include ~/.local/bin, where the claude CLI lives
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
HANDOFF="$1"; LABEL="$2"; WORKDIR="$3"; LOG="$4"; UNATTENDED="${5:-0}"; RETRY="${6:-0}"
PROFILE="$HOME/.claude/scripts/headless-unattended.settings.json"
RESULT="${HANDOFF%.md}-RESULT.md"
MAX_RETRIES=5

notify() { osascript -e "display notification \"$1\" with title \"durable-resume\"" >/dev/null 2>&1 || true; }

{
  echo "$(date '+%F %T') fire: $LABEL (unattended=$UNATTENDED retry=$RETRY)"
  if ! mkdir "${HANDOFF}.lock" 2>/dev/null; then
    echo "  already claimed (in-session cron resumed first) — exiting"
  else
    cd "$WORKDIR"
    OUT="$(mktemp)"
    FLAGS=()
    if [ "$UNATTENDED" = "1" ] && [ -f "$PROFILE" ]; then
      FLAGS=(--dangerously-skip-permissions --settings "$PROFILE")
    fi
    claude -p ${FLAGS[@]+"${FLAGS[@]}"} "Scheduled DURABLE continuation (the original chat may be closed). Read ${HANDOFF} and execute its NEXT list in order; follow the workspace CLAUDE.md rules; finish with the report the handoff asks for — your final text is delivered to the owner via ${RESULT}." \
      > "$OUT" 2>&1 || echo "  claude -p exited non-zero"
    cat "$OUT"
    { echo; echo "## $(date '+%F %T') — ${LABEL} (unattended=${UNATTENDED} retry=${RETRY})"; echo; cat "$OUT"; } >> "$RESULT" \
      || echo "  (could not write ${RESULT})"
    if grep -qiE 'hit your .*limit|usage limit reached' "$OUT"; then
      # nothing ran — free the lock so the retry (or an in-session cron) can claim it
      rmdir "${HANDOFF}.lock" 2>/dev/null || true
      if [ "$RETRY" -lt "$MAX_RETRIES" ]; then
        RH=""; RM=""
        RES="$(grep -oiE 'resets [0-9]{1,2}(:[0-9]{2})?[ap]m' "$OUT" | head -1)"
        if [ -n "$RES" ]; then
          T="$(printf '%s' "${RES#* }" | tr 'A-Z' 'a-z')"   # e.g. 9:40pm
          AP="${T: -2}"; T="${T%??}"
          RH="${T%%:*}"; RM="${T#*:}"; [ "$RM" = "$T" ] && RM=0
          RH=$((10#$RH % 12)); [ "$AP" = "pm" ] && RH=$((RH + 12))
          RM=$((10#$RM + 5)); [ "$RM" -ge 60 ] && { RM=$((RM - 60)); RH=$(((RH + 1) % 24)); }
        else
          RH="$(date -v+65M '+%H')"; RM="$(date -v+65M '+%M')"
        fi
        BASE="$(printf '%s' "$LABEL" | sed 's/\.r[0-9]*$//')"
        NEXT_LABEL="${BASE}.r$((RETRY + 1))"
        NEXT_PLIST="$HOME/Library/LaunchAgents/${NEXT_LABEL}.plist"
        cat > "$NEXT_PLIST" << EOP2
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${NEXT_LABEL}</string>
  <key>ProgramArguments</key><array>
    <string>$HOME/.claude/scripts/durable-resume-runner.sh</string>
    <string>${HANDOFF}</string>
    <string>${NEXT_LABEL}</string>
    <string>${WORKDIR}</string>
    <string>${LOG}</string>
    <string>${UNATTENDED}</string>
    <string>$((RETRY + 1))</string>
  </array>
  <key>StartCalendarInterval</key><dict>
    <key>Hour</key><integer>$((10#$RH))</integer>
    <key>Minute</key><integer>$((10#$RM))</integer>
  </dict>
</dict></plist>
EOP2
        launchctl bootstrap "gui/$(id -u)" "$NEXT_PLIST" 2>/dev/null || true
        printf '  limit hit — lock released, re-armed %s at %02d:%02d\n' "$NEXT_LABEL" "$((10#$RH))" "$((10#$RM))"
        notify "limit hit — retry armed at $(printf '%02d:%02d' "$((10#$RH))" "$((10#$RM))")"
      else
        echo "  limit hit — retry cap (${MAX_RETRIES}) reached, giving up"
        notify "limit hit — retry cap reached, task NOT resumed: $(basename "$HANDOFF")"
      fi
    else
      notify "continuation finished: ${LABEL} — see $(basename "$RESULT")"
    fi
    rm -f "$OUT"
  fi
  # Self-removal: rm the plist FIRST — bootout of our own job kills this very
  # process, so it must be the LAST statement (nothing after it ever runs).
  rm -f "$HOME/Library/LaunchAgents/${LABEL}.plist"
  echo "  done, self-removing agent"
  launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
} >> "$LOG" 2>&1
EOS
chmod +x "$RUNNER"

cat > "$PLIST" << EOP
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array>
    <string>${RUNNER}</string>
    <string>${HANDOFF}</string>
    <string>${LABEL}</string>
    <string>${WORKDIR}</string>
    <string>${LOG}</string>
    <string>${UNATTENDED}</string>
    <string>0</string>
  </array>
  <key>StartCalendarInterval</key><dict>
    <key>Hour</key><integer>${HOUR#0}</integer>
    <key>Minute</key><integer>${MIN#0}</integer>
  </dict>
</dict></plist>
EOP

launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
MODE="unattended (skip-permissions + deny fences)"
[ "$UNATTENDED" = "1" ] || MODE="ATTENDED — headless writes will be permission-blocked; pass --unattended for real work"
echo "durable resume armed: ${LABEL} at ${TIME} -> ${HANDOFF}"
echo "  mode:   ${MODE}"
echo "  result: ${HANDOFF%.md}-RESULT.md (+ log: ${LOG})"
