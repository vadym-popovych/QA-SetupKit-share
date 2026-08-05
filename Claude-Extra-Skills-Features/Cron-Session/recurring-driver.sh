#!/usr/bin/env zsh
# Generalized RECURRING autonomous driver (distinct from one-shot durable-resume.sh).
# launchd fires this every StartInterval. Each fire: stop if done / stopped / over budget /
# cap hit, else run headless `claude` against PROMPT_FILE to make a bounded slice of progress,
# then exit WITHOUT unloading so the next window continues. It self-unloads AND DELETES ITS OWN
# PLIST (teardown hygiene — see README "Teardown hygiene") only when the state file reads
# `STATUS: COMPLETE`, a STOP file appears, or the max-fire cap is hit.
#
# This is the pattern for "run the QA flow autonomously overnight until the checklist is done"
# (e.g. an emulator pilot). It is NOT the same as durable-resume.sh, which is a ONE-SHOT resume
# of a Claude session around the 5-hour limit.
#
# Config via env (only DRIVER_LABEL is required):
#   DRIVER_LABEL   launchd label of THIS agent — required, so the loop can delete its own plist
#   DRIVER_DIR     dir holding state/prompt/logs      (default: this script's own dir)
#   WORKDIR        dir `claude` runs in               (default: DRIVER_DIR)
#   STATE_FILE     progress handoff; loop halts on a line `STATUS: COMPLETE`  (default: DRIVER_DIR/STATE.md)
#   PROMPT_FILE    the per-fire prompt                (default: DRIVER_DIR/recurring-prompt.txt)
#   STOP_FILE      touch to halt                      (default: DRIVER_DIR/recurring.stop)
#   BUDGET_STOP    skip a fire once session usage >= this %   (default: 90)
#   MAX_FIRES      hard cap on total fires            (default: 60)
#   MAX_ATTEMPTS   retries within one fire on non-zero exit   (default: 3)
#   RETRY_SLEEP    seconds between retries            (default: 240)
#   SESSION_LIMIT_SCRIPT  path to the Usage kit's session-limit.py  (default: $HOME/.claude/scripts/session-limit.py)
#   DRYRUN=1       environment check only; never invokes claude
#
# Budget signal = the Usage kit's session-limit.py (install it first:
# Claude-Extra-Skills-Features/Usage/). Without it the gate is skipped (runs every fire).
set -u

DRIVER_DIR="${DRIVER_DIR:-${0:A:h}}"
WORKDIR="${WORKDIR:-$DRIVER_DIR}"
STATE_FILE="${STATE_FILE:-$DRIVER_DIR/STATE.md}"
PROMPT_FILE="${PROMPT_FILE:-$DRIVER_DIR/recurring-prompt.txt}"
STOP_FILE="${STOP_FILE:-$DRIVER_DIR/recurring.stop}"
LABEL="${DRIVER_LABEL:-}"
BUDGET_STOP="${BUDGET_STOP:-90}"
MAX_FIRES="${MAX_FIRES:-60}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-3}"
RETRY_SLEEP="${RETRY_SLEEP:-240}"
COUNTFILE="$DRIVER_DIR/.recurring-count"
LOGDIR="$DRIVER_DIR/recurring-logs"
USAGE="${SESSION_LIMIT_SCRIPT:-$HOME/.claude/scripts/session-limit.py}"

[ -n "$LABEL" ] || { echo "recurring-driver: DRIVER_LABEL is required (the launchd label, so the loop can delete its own plist on completion)"; exit 2; }
[ -f "$PROMPT_FILE" ] || { echo "recurring-driver: PROMPT_FILE not found: $PROMPT_FILE"; exit 2; }
mkdir -p "$LOGDIR"
LOG="$LOGDIR/run-$(date +%Y%m%d-%H%M%S).log"

# launchd does NOT inherit your login shell PATH — set a portable one for the headless context.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$HOME/.maestro/bin:/usr/bin:/bin:/usr/sbin:/sbin"
[ -x /usr/libexec/java_home ] && export JAVA_HOME="$(/usr/libexec/java_home 2>/dev/null)"

# Teardown hygiene: DELETE the plist FIRST, then bootout. Booting out our own job kills this
# process, so the rm must precede it. A bare bootout leaves an orphan that reloads at next login.
unload() {
  echo "--- teardown $LABEL ($1): rm plist, then bootout ---"
  rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
}
budget_used() {
  [ -f "$USAGE" ] || { echo ""; return; }
  python3 "$USAGE" --fresh 2>/dev/null | grep -oE '[0-9]+% used' | grep -oE '^[0-9]+' | head -1
}

{
  echo "=== recurring-driver FIRE $(date) · label=$LABEL ==="

  # --- stop conditions first (cheap) ---
  if [ -f "$STOP_FILE" ]; then echo "STOP file present -> halting."; unload "stop-file"; exit 0; fi
  if grep -qE "^STATUS: COMPLETE" "$STATE_FILE" 2>/dev/null; then echo "STATE COMPLETE -> halting."; unload "complete"; exit 0; fi
  N=$(( $(cat "$COUNTFILE" 2>/dev/null || echo 0) + 1 )); echo "$N" > "$COUNTFILE"
  echo "fire #$N (cap $MAX_FIRES)"
  if [ "$N" -gt "$MAX_FIRES" ]; then echo "max-fire cap hit -> halting (review manually)."; unload "max-fires"; exit 0; fi

  echo "claude:  $(command -v claude || echo MISSING)"
  USED="$(budget_used)"; echo "budget:  ${USED:-?}% used (pre-run; gate ${BUDGET_STOP}%)"
  if [ -n "$USED" ] && [ "$USED" -ge "$BUDGET_STOP" ]; then
    echo "budget ${USED}% >= ${BUDGET_STOP}% -> skip this fire, wait for next (NO unload)."
    echo "=== recurring-driver END (skipped) $(date) ==="; exit 0
  fi

  if [ "${DRYRUN:-0}" = "1" ]; then echo "DRYRUN=1 -> NOT invoking claude."; echo "=== recurring-driver END (dryrun) $(date) ==="; exit 0; fi

  cd "$WORKDIR" || { echo "cd $WORKDIR failed"; exit 1; }
  PROMPT="$(cat "$PROMPT_FILE")"
  attempt=1
  while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
    U="$(budget_used)"
    if [ -n "$U" ] && [ "$U" -ge "$BUDGET_STOP" ]; then echo "--- budget ${U}% during run -> stop retrying ---"; break; fi
    echo "--- claude headless attempt $attempt/$MAX_ATTEMPTS @ $(date) ---"
    claude --dangerously-skip-permissions -p "$PROMPT" 2>&1
    rc=$?; echo "--- claude exited ($rc) attempt $attempt @ $(date) ---"
    [ "$rc" -eq 0 ] && { echo "--- clean exit ---"; break; }
    attempt=$((attempt + 1))
    [ "$attempt" -le "$MAX_ATTEMPTS" ] && { echo "--- non-zero exit; sleep ${RETRY_SLEEP}s then resume (idempotent) ---"; sleep "$RETRY_SLEEP"; }
  done

  echo "budget:  $(budget_used)% used (post-run)"
  # if the agent just marked the whole task complete, stop the loop (and delete the plist)
  if grep -qE "^STATUS: COMPLETE" "$STATE_FILE" 2>/dev/null; then echo "STATE COMPLETE after run -> halting."; unload "complete"; fi
  echo "=== recurring-driver END $(date) ==="
} >> "$LOG" 2>&1
