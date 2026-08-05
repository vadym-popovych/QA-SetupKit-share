#!/usr/bin/env bash
#
# autonomy-eval.sh — does the kit actually work for someone who is NOT the author?
#
#   bash Rules-Guide/kit-lint/autonomy-eval.sh        # run from the QA-SetupKit root
#
# kit-lint checks the kit's docs against the kit. This checks the kit against REALITY: it makes
# a git-less copy in a temp dir — no access to the author's workspace, no project folders, no
# credentials — and asks whether a teammate who cloned it could actually get to work.
#
# That is the kit's stated mission ("a colleague with a fresh agent and an empty CLAUDE.md gets a
# working configuration"), and until now it was an assertion. An unverified mission statement is
# just a nice sentence.
#
# Exit 0 = the clone stands on its own · 1 = findings (printed, each one a thing a teammate hits).

set -uo pipefail

ROOT="$(pwd)"
[ -f "$ROOT/README.md" ] && [ -d "$ROOT/Rules-Guide" ] || { echo "run me from the QA-SetupKit root"; exit 2; }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/kit-autonomy-XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
CLONE="$TMP/QA-SetupKit"

echo "==> materialising a fresh clone (no .git, no secrets, no project folders)"
# `git archive` = exactly what a teammate gets: tracked files only. Gitignored secrets
# (credentials.json, token.json, .token, users.json) cannot come along even by accident.
git -C "$ROOT" archive HEAD | (mkdir -p "$CLONE" && tar -x -C "$CLONE")

findings=0
finding() { echo "   ✗ $*"; findings=$((findings + 1)); }

# ── portable timeout ──────────────────────────────────────────────────────────────────────
# macOS ships no GNU `timeout` (it is `gtimeout` from coreutils, if installed at all). The first
# run of this eval blamed 30+ tools for "crashing" when the only thing missing was the timeout
# binary itself. A harness failure is NEVER a product finding — so we detect, and fall back to a
# bash-native watchdog rather than silently dropping the timeout.
TIMEOUT_BIN=""
command -v gtimeout >/dev/null 2>&1 && TIMEOUT_BIN="gtimeout"
[ -z "$TIMEOUT_BIN" ] && command -v timeout >/dev/null 2>&1 && TIMEOUT_BIN="timeout"

run_tool() {                 # run_tool <out-file> <cmd...>  → 124 on timeout
  local out_file="$1"; shift
  if [ -n "$TIMEOUT_BIN" ]; then
    "$TIMEOUT_BIN" 25 "$@" >"$out_file" 2>&1 </dev/null
    return $?
  fi
  "$@" >"$out_file" 2>&1 </dev/null &
  local pid=$!
  ( sleep 25; kill -9 "$pid" 2>/dev/null ) >/dev/null 2>&1 &
  local watcher=$!
  wait "$pid" 2>/dev/null; local rc=$?
  kill -9 "$watcher" 2>/dev/null; wait "$watcher" 2>/dev/null
  [ "$rc" -ge 128 ] && return 124
  return "$rc"
}


echo "==> 1 · no secrets travelled with the clone"
leaked=$(find "$CLONE" \( -name 'credentials.json' -o -name 'token.json' -o -name '.token' \
  -o -name 'users.json' -o -name 'basic-auth.txt' -o -name 'rubric.config.json' \) 2>/dev/null)
if [ -n "$leaked" ]; then
  finding "secrets are IN the clone — the .gitignore is not protecting them:"
  echo "$leaked" | sed 's/^/       /'
else
  echo "   ✓ none"
fi

echo "==> 2 · kit-lint passes inside the clone (not just in the author's checkout)"
if (cd "$CLONE" && node Rules-Guide/kit-lint/kit-lint.mjs --quiet); then
  echo "   ✓ clean"
else
  finding "kit-lint fails in a fresh clone — the docs promise things the clone does not contain"
fi

echo "==> 3 · every shipped tool, invoked with NO arguments: does it refuse cleanly?"
echo "   (scope, stated: this proves the REFUSAL path — that a tool explains itself instead of"
echo "    crashing, hanging, or reaching for the author's machine. It does NOT prove the tool"
echo "    WORKS with real arguments; the smoke step below covers the few that can be run offline.)"
# The bar is deliberately low and deliberately honest: a tool must not explode with a stack trace
# or silently do the wrong thing when its config is absent. It must say what it needs.
# (HOME is redirected so a stray ~/.token or ~/Projects cannot rescue a tool that would fail
# for a teammate.)
#
# SCOPE, STATED OUT LOUD: this used to check 4 of the kit's ~39 executables — and print
# "✓ tools checked: 4" without saying "of 39". That is a silent cap, the exact sin the kit
# forbids elsewhere ("no silent caps — log what was dropped"). Now: every .mjs / .py / .sh the
# kit ships is exercised, and anything deliberately skipped is NAMED below.
ALL_TOOLS=$(find "$CLONE" \( -name '*.mjs' -o -name '*.py' -o -name '*.sh' \) \
  -not -path '*/node_modules/*' | sort)
total=$(echo "$ALL_TOOLS" | grep -c . || true)
checked=0
skipped=0
needsdeps=0

for tool in $ALL_TOOLS; do
  rel="${tool#$CLONE/}"
  # Skipped on purpose, and said out loud: the eval itself (it would recurse), and the mcp-sheets
  # server (a long-running OAuth server, not a CLI — running it here would prove nothing).
  case "$rel" in
    Rules-Guide/kit-lint/autonomy-eval.sh|MCP-configurations/mcp-sheets/*)
      echo "   · skipped (by design): $rel"; skipped=$((skipped + 1)); continue ;;
  esac

  case "$tool" in
    *.mjs) runner=(node "$tool") ;;
    *.py)  runner=(python3 "$tool") ;;
    *.sh)  runner=(bash "$tool") ;;
  esac

  outfile="$TMP/tool.out"
  ( cd "$CLONE" && HOME="$TMP/fakehome" && run_tool "$outfile" "${runner[@]}" )
  code=$?
  out=$(cat "$outfile" 2>/dev/null)
  checked=$((checked + 1))

  # Two failure classes, and only one of them is the kit's fault:
  #   · a missing npm/pip PACKAGE is a documented prerequisite, and the runtime already names it
  #     ("Cannot find package 'playwright'"). Counted, not blamed — narrowing the check to what
  #     is actually broken is not the same as lowering the bar to make it green.
  #   · a crash reading a CONFIG/CREDENTIAL file the author happens to have is the real day-one
  #     gap: the teammate gets a stack trace where they should get "create X from X.example".
  case "$out" in
    *ERR_MODULE_NOT_FOUND*|*"Cannot find module"*|*"Cannot find package"*|*ModuleNotFoundError*)
      needsdeps=$((needsdeps + 1)) ;;
    *"/Users/"*)
      finding "$rel — reaches for a path on the author's machine: $(echo "$out" | grep -o '/Users/[^ \"]*' | head -1)" ;;
    *ENOENT*|*"no such file or directory"*)
      # A tool that CATCHES the missing file and says so ("coverage source unavailable: ENOENT…")
      # is behaving correctly — blaming it would be the lint crying wolf. Only an UNCAUGHT error
      # (one with a stack frame) is a finding.
      case "$out" in
        *"    at "*|*Traceback*)
          finding "$rel — crashes on a missing config/credential file instead of saying what to create" ;;
        *) : ;;
      esac ;;
    *Error*|*Traceback*|*"command not found"*)
      case "$out" in
        *"is not set"*|*"not found — set"*|*"refusing"*|*"usage"*|*"Usage"*|*"run me from"*) : ;;
        *) finding "$rel — crashes instead of explaining what it needs: $(echo "$out" | head -1)" ;;
      esac ;;
  esac
  [ $code -eq 124 ] && finding "$rel — hangs with no config (a teammate would just see it freeze)"
done
echo "   ✓ refusal path exercised: $checked of $total shipped ($skipped skipped by design; $needsdeps need their documented npm/pip prereqs first — not a portability defect)"

echo "==> 3b · smoke: the tools that can do real work offline actually do it"
# The refusal path is not the work path. These are the executables that can be exercised for real
# inside a clone with no network, no credentials and no project — so they are, and the number is
# printed. Everything else stays honestly labelled "refusal path only" above.
smoked=0
smoke_fail=0
smoke_run() {   # smoke_run <label> <cmd...>
  local label="$1"; shift
  if ( cd "$CLONE" && HOME="$TMP/fakehome" "$@" >/dev/null 2>&1 ); then
    smoked=$((smoked + 1))
  else
    smoke_fail=$((smoke_fail + 1))
    finding "$label — fails on its real work path inside a fresh clone"
  fi
}

# validate.mjs against every example the kit ships that has a schema of the same name (its actual
# job). The pairing is DISCOVERED from what ships, never hardcoded — the previous version was
# capped twice, and silently, under a line that printed only a total:
#   · the glob `*/*/template/*.example.json` is exactly two directories deep, so the nested
#     Custom-Reports group never matched — bug-summary and test-report were invisible to it;
#   · a hardcoded list of six kinds then dropped pagespeed-round, which the first glob HAD found.
# 5 of the 9 schemas were exercised and the output said "smoked: 6". That is the same silent cap
# modules.json was written to kill (a nested group unregistered there goes unlinted while the
# linter prints "clean"). Now both sides of the pairing are counted and anything unpaired is
# NAMED: an example with no schema, and — the one that actually matters — a schema with no
# example, whose shape no run ever touches.
examples_total=0
paired_kinds=""
unpaired_examples=""
while IFS= read -r ex; do
  [ -n "$ex" ] || continue
  examples_total=$((examples_total + 1))
  kind=$(basename "$ex" | sed 's/\.example\.json$//')
  if [ -f "$CLONE/Rules-Guide/schemas/$kind.schema.json" ]; then
    paired_kinds="$paired_kinds $kind"
    smoke_run "validate.mjs ($kind example)" node Rules-Guide/schemas/validate.mjs "$kind" "${ex#$CLONE/}"
  else
    unpaired_examples="$unpaired_examples
${ex#$CLONE/}"
  fi
done <<EOF
$(find "$CLONE" -name '*.example.json' -not -path '*/node_modules/*' | sort)
EOF

unpaired_schemas=""
unpaired_schema_count=0
for sch in "$CLONE"/Rules-Guide/schemas/*.schema.json; do
  [ -f "$sch" ] || continue
  kind=$(basename "$sch" .schema.json)
  case " $paired_kinds " in
    *" $kind "*) ;;
    *) unpaired_schemas="$unpaired_schemas $kind"; unpaired_schema_count=$((unpaired_schema_count + 1)) ;;
  esac
done
paired_count=$(echo "$paired_kinds" | wc -w | tr -d ' ')
unpaired_example_count=$((examples_total - paired_count))
echo "   · schema examples: $paired_count of $examples_total shipped *.example.json pair with a schema of the same name — every one of them was run through validate.mjs (a failure is a finding above)"
if [ "$unpaired_example_count" -gt 0 ]; then
  echo "   · not validated ($unpaired_example_count) — no schema of that name ships; these are config/template shapes, not schema'd artefacts:"
  echo "$unpaired_examples" | grep -v '^$' | sed 's/^/       /'
fi
[ "$unpaired_schema_count" -gt 0 ] && \
  echo "   · schemas with NO shipped example ($unpaired_schema_count) — the shape is never exercised, a teammate has nothing to copy:$unpaired_schemas"

# lint-specs.mjs against the kit's own example specs (dogfooding: the templates must pass)
if [ -d "$CLONE/Testing-Types/UI-Automation/template/e2e/tests" ]; then
  smoke_run "lint-specs.mjs (kit's own spec templates)" \
    bash -c 'cd Testing-Types/UI-Automation/template/e2e && node tools/lint-specs.mjs tests'
fi

echo "   ✓ smoked (real work path): $smoked · failed: $smoke_fail"

echo "==> 3c · the checkers can be shown to FAIL on bad input (the test for the testers)"
# Step 3b proved the checkers run. This proves they still DETECT — that none has been neutered
# to a silent green. selftest.mjs greens a good fixture AND reds a bad one for each verdict-
# renderer; if any checker passes its bad fixture, this fails. It matters most inside a fresh
# clone, because that is where a broken checker would otherwise go unnoticed.
# The COUNT is read from selftest's own output, never written here: this line said "all 4" on
# 28/07/2026 while a fifth checker had already shipped — a register drifting behind the code, the
# same defect this script exists to catch elsewhere.
if [ -f "$CLONE/Rules-Guide/kit-lint/selftest.mjs" ]; then
  selftest_out=$( cd "$CLONE" && node Rules-Guide/kit-lint/selftest.mjs 2>&1 )
  if [ $? -eq 0 ]; then
    echo "   ✓ $(echo "$selftest_out" | sed -n 's/^selftest: all \([0-9]*\) checkers.*/\1/p') checkers green good input and red bad input"
  else
    finding "a kit CHECKER fails its own selftest — a verdict-renderer that can't be shown to red bad input is decoration"
    echo "$selftest_out" | sed -n 's/^✗/       ✗/p'
  fi
else
  finding "selftest.mjs is missing from the clone — the checkers ship with no negative test"
fi

echo "==> 4 · every kit's starter block exists and cites rules the clone actually has"
for starter in $(find "$CLONE" -name 'CLAUDE.starter.md' | sort); do
  kit="$(dirname "${starter#$CLONE/}")"
  # every DISTINCT rules doc the starter cites must exist SOMEWHERE in the clone — starters
  # legitimately cite other kits' rules (Compatibility→Web, Load→HTML-Reports), so the old
  # head-1 + same-folder check false-positived on exactly those two (05/08/2026 audit);
  # the starter-cites-its-OWN-rules contract is kit-lint L6's job, not this one's
  for rules in $(grep -o '[A-Z_]*_RULES\.md' "$starter" | sort -u); do
    find "$CLONE" -name "$rules" | grep -q . || finding "$kit/CLAUDE.starter.md cites $rules, which is not in the clone"
  done
done
echo "   ✓ starters checked: $(find "$CLONE" -name 'CLAUDE.starter.md' | wc -l | tr -d ' ')"

echo "==> 5 · the entry points a newcomer is told to read exist"
for doc in README.md Rules-Guide/Project-Configuration/README.md Rules-Guide/Roadmap/AI-QA-ROADMAP.md; do
  [ -f "$CLONE/$doc" ] || finding "the root README sends a newcomer to $doc, which is missing"
done
echo "   ✓ entry points present"

echo
if [ "$findings" -eq 0 ]; then
  echo "autonomy-eval: PASS — a fresh clone stands on its own."
  exit 0
fi
echo "autonomy-eval: $findings finding(s) — each is something a teammate hits on day one."
echo "These are gaps in the KIT, not in the teammate."
exit 1
