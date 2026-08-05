#!/bin/sh
# Memory eval-gate — flags when the always-on rules file changed since the last green eval run.
#
# It FLAGS. It never RUNS, never spawns an agent, never blocks a prompt. Wire it as a
# UserPromptSubmit hook; see SETUP.md and MEMORY_EVAL_RULES.md §8 next to this script.
#
# Dependencies: POSIX sh, awk, find, and `shasum -a 256` OR `sha256sum`. python3 is PREFERRED for
# parsing session_id out of the hook's stdin JSON; without it a sed fallback handles the ordinary
# {"session_id": "..."} payload. If BOTH fail, session_id degrades to a shared "unknown" bucket —
# which is the v1 behaviour the second incident below is about, so keep python3 available.
#
# ── WHY THIS EXISTS ────────────────────────────────────────────────────────────────────────────
# The rule "a structural change to the memory file -> re-run the eval before closing the chat" was
# itself enforced by memory, and memory lost: the suite went unrun for days and only fired when
# someone happened to remember a stale note. A rule ABOUT the always-on rules file cannot be
# enforced BY the always-on rules file — it is read least exactly when it is being edited. Same
# failure class as any rule written under one trigger and needed under another: the fix is a
# mechanical check at the moment of action, not a better intention.
#
# ── INCIDENT THAT SHAPED THE STATE MODEL ───────────────────────────────────────────────────────
# v1 keyed warn-once on the FILE HASH ALONE. This is a project-level hook: it fires in EVERY chat
# open on that workspace. A parallel chat — an unattended runner, at an hour nobody was reading —
# submitted a prompt, the gate fired THERE, ate the single warning for an edit that chat had
# nothing to do with, and stamped the hash. The chat that made the edit, and every later chat, got
# silence. Multi-chat is the NORMAL case, not an edge case.
# A gate that flags into the void is WORSE than no gate: it manufactures the feeling that the rule
# is held. Hence warn-once is keyed on the PAIR (session_id, hash): every chat gets its own
# one-time warning, nobody can eat anyone else's.
#
# ── DESIGN NOTES (deliberate — read before "fixing") ────────────────────────────────────────────
#  * FLAGS, never RUNS. A full run is dozens of agents; a hook that quietly launches that at 90%
#    session budget is a grenade in someone else's session. Show and WAIT (the yellow-gate rule).
#  * Keyed on the file HASH, not on git: a rules edit lives uncommitted for as long as the chat
#    that made it is open. Git cannot see it. The gate has to.
#  * A hash cannot tell a structural change from a cosmetic one — translating whole sections has
#    moved retrieval by nothing, one bullet about a single rule has moved it. So it flags ANY
#    change and leaves the judgment to a human: cheap, and no false confidence.
#  * UserPromptSubmit, not Stop: it survives chat boundaries — the warning reappears in the NEXT
#    chat, which is precisely what memory failed to do. (../Usage/ registers a UserPromptSubmit
#    hook too; both coexist.)
#  * Fail SILENT at run time (unreadable stdin, unwritable state, unchanged file -> exit 0): a gate
#    that breaks the prompt loop is worse than the drift it guards.
#  * Fail LOUD at install time (no target, target missing, no hasher, no baseline). Silence there
#    is the failure class this gate exists to prevent: armed, running on every prompt, costing
#    nothing, guarding nothing, reporting nothing. Loud == prints and exits 0; it still never
#    blocks the prompt.
#
# ── ENV CONTRACT ───────────────────────────────────────────────────────────────────────────────
#   EVAL_GATE_TARGET     REQUIRED, no default. Absolute path to the memory file to watch (the
#                        always-on rules file — it may live anywhere; there is no clever default,
#                        a wrong guess is a hook that guards nothing).
#   EVAL_GATE_STATE_DIR  Optional. Where local state lives. Default: this script's directory.
#                        Set it when the kit checkout is read-only or shared between people.
#
# State (local, per-machine, gitignore BOTH — never shippable, never copied from someone else):
#   <state>/.last-green        one line, written BY HAND after your own first green run:
#                              "<sha256-of-target> <score> <YYYY-MM-DD>"
#   <state>/.warned/<session>  last hash this chat was warned about (ephemeral, pruned at 30 days;
#                              holds live chat session ids -> never commit it)
set -u

DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd || echo .)"
STATE_DIR="${EVAL_GATE_STATE_DIR:-$DIR}"
FILE="${EVAL_GATE_TARGET:-}"
GREEN="$STATE_DIR/.last-green"
WARN_DIR="$STATE_DIR/.warned"

# ── session_id, first: it keys every warning below ──────────────────────────────────────────────
# Absent (manual run, no payload, no parser) -> shared "unknown" bucket. That degrades to v1
# behaviour — one warning shared across chats — rather than to a crash.
PAYLOAD=""
[ -t 0 ] || PAYLOAD="$(cat 2>/dev/null || true)"
SESSION=""
if [ -n "$PAYLOAD" ]; then
	if command -v python3 >/dev/null 2>&1; then
		SESSION="$(printf '%s' "$PAYLOAD" | python3 -c 'import sys, json
try:
    v = json.load(sys.stdin).get("session_id") or ""
except Exception:
    v = ""
print("".join(c for c in str(v) if c.isalnum() or c in "-_")[:64])' 2>/dev/null || true)"
	fi
	if [ -z "$SESSION" ]; then
		SESSION="$(printf '%s' "$PAYLOAD" | tr -d '\n' |
			sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([A-Za-z0-9_-]\{1,64\}\)".*/\1/p')"
	fi
fi
[ -n "$SESSION" ] || SESSION="unknown"

STATE_OK=1
mkdir -p "$WARN_DIR" 2>/dev/null || STATE_OK=0
[ "$STATE_OK" = 1 ] && find "$WARN_DIR" -type f -mtime +30 -delete 2>/dev/null   # prune dead chats
STAMP="$WARN_DIR/$SESSION"

# warn_once <key>: true when THIS chat has not been told <key> yet. No writable state -> speak
# anyway; swallowing a warning is the one failure this gate must not repeat.
warn_once() {
	[ "$STATE_OK" = 1 ] || return 0
	if [ -f "$STAMP" ] && [ "$(cat "$STAMP" 2>/dev/null || true)" = "$1" ]; then
		return 1
	fi
	printf '%s\n' "$1" > "$STAMP" 2>/dev/null || true
	return 0
}

# ── install-time checks: loud, because silence here guards nothing ──────────────────────────────
if [ -z "$FILE" ]; then
	if warn_once "misconfig:no-target"; then
		cat <<EOF
⚠️  Memory eval-gate: EVAL_GATE_TARGET is not set — the gate is armed and guarding nothing.
    Point it at the memory file whose rules this workspace runs on, e.g.
      EVAL_GATE_TARGET=/absolute/path/to/your/CLAUDE.md
    There is deliberately no default: a guessed path that happens not to exist gives you a hook
    that runs on every prompt, costs nothing and reports nothing. See $DIR/SETUP.md
EOF
	fi
	exit 0
fi

if [ ! -f "$FILE" ]; then
	if warn_once "misconfig:missing-target"; then
		cat <<EOF
⚠️  Memory eval-gate: EVAL_GATE_TARGET points at a file that does not exist — guarding nothing.
    target: $FILE
    Fix the path, or unwire the hook. See $DIR/SETUP.md
EOF
	fi
	exit 0
fi

if command -v shasum >/dev/null 2>&1; then
	CUR="$(shasum -a 256 "$FILE" 2>/dev/null | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
	CUR="$(sha256sum "$FILE" 2>/dev/null | awk '{print $1}')"
else
	if warn_once "misconfig:no-hasher"; then
		cat <<EOF
⚠️  Memory eval-gate: neither \`shasum -a 256\` nor \`sha256sum\` is available — cannot hash the
    target, so the gate is armed and guarding nothing. Install either one, or unwire the hook.
EOF
	fi
	exit 0
fi
[ -n "${CUR:-}" ] || exit 0   # hasher present but produced nothing -> transient, stay silent

if [ ! -f "$GREEN" ]; then
	if warn_once "misconfig:no-baseline"; then
		cat <<EOF
ℹ️  Memory eval-gate: no baseline recorded yet — the gate cannot tell drift from steady state.
    After your OWN first green run under pinned conditions, write one line BY HAND:
      <sha256-of-target> <score> <YYYY-MM-DD>   ->   $GREEN
    Never copy someone else's hash: a foreign hash never matches, so the gate cries wolf forever;
    forced to match, it goes silent on your real drift. Current hash of the target:
      $CUR
EOF
	fi
	exit 0
fi

GREEN_HASH="$(awk 'NR==1{print $1}' "$GREEN" 2>/dev/null || true)"
GREEN_INFO="$(awk 'NR==1{print $2, $3}' "$GREEN" 2>/dev/null || true)"
[ -n "$GREEN_HASH" ] || exit 0            # unreadable baseline -> transient, stay silent
[ "$CUR" = "$GREEN_HASH" ] && exit 0      # unchanged -> the quiet, normal case

warn_once "$CUR" || exit 0

cat <<EOF
⚠️  Memory eval-gate: the target changed since the last green eval run ($GREEN_INFO).
    target: $FILE
    green:  $GREEN_HASH ($GREEN_INFO)
    now:    $CUR
If the change is STRUCTURAL (a section rebuilt, a rule moved or merged, detail pushed into a kit),
run the eval net BEFORE closing this chat — see $DIR/README.md
If it is an in-place rule edit or cosmetic, say so OUT LOUD and re-point .last-green at the new
hash: this gate cannot tell the difference, only a human can — do not burn a net on a one-sentence
addition. A red is a QUESTION (is the memory file wrong, or is the oracle?), never a verdict; and
never edit the file just to make the score go green — that is fabricating a Pass at the instrument
level (MEMORY_EVAL_RULES.md §4, §8).
EOF
exit 0
