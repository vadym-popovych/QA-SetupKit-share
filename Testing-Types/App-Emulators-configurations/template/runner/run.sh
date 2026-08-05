#!/usr/bin/env bash
# Layer 2+3 orchestrator. Copy the whole template/ to <Project>/Emulator-Testing/ and run:
#   ./runner/run.sh                 # build+launch (Layer 1) then drive every flow
#   ./runner/run.sh --no-build      # skip Layer 1 (app already installed & running)
#   ./runner/run.sh flows/smoke-launch.yaml   # a single flow
#
# What it does NOT do: decide visual checks (those go to human confirm — EMULATOR_RULES §0),
# write statuses/bugs to the Sheet (that happens ONLY after you confirm the report), or build
# inside the project repo (Layer 1 builds from config.buildDir, a git-less snapshot — §5).
set -euo pipefail
cd "$(dirname "$0")/.."                      # → <Project>/Emulator-Testing/
CONFIG="${CONFIG:-config.json}"
[ -f "$CONFIG" ] || { echo "run.sh: $CONFIG missing — copy config.example.json and fill it"; exit 2; }

# config → shell vars (node, not jq: node is already a kit dependency, jq may not be installed)
eval "$(node -e '
  const c = require("./" + (process.env.CONFIG || "config.json"));
  const q = s => `"${String(s ?? "").replace(/"/g,"\\\"")}"`;
  for (const k of ["platform","appId","bundleId","package","scheme","simulator","avd","apkPath","buildDir"])
    process.stdout.write(`CFG_${k}=${q(c[k])}\n`);
')"
[ -n "${CFG_appId:-}" ] || { echo "run.sh: config.appId is required (== bundleId on iOS, package on Android)"; exit 2; }
export APP_ID="$CFG_appId"                    # Maestro flows read ${APP_ID}

DATE="$(date +%F)"
OUT="runs/$DATE"; mkdir -p "$OUT"
export MAESTRO_CLI_NO_ANALYTICS=1

# ── Layer 1: build + install + launch (stack-specific adapter — the ONLY platform code) ──
if [ "${1:-}" != "--no-build" ]; then
  ADAPTER="runner/platforms/${CFG_platform}.sh"
  [ -x "$ADAPTER" ] || { echo "run.sh: no adapter for platform '${CFG_platform}' at $ADAPTER"; exit 2; }
  echo "▶ Layer 1: $ADAPTER"
  CFG_platform="$CFG_platform" CFG_appId="$CFG_appId" CFG_bundleId="${CFG_bundleId:-}" \
    CFG_package="${CFG_package:-}" CFG_scheme="${CFG_scheme:-}" CFG_simulator="${CFG_simulator:-}" \
    CFG_avd="${CFG_avd:-}" CFG_apkPath="${CFG_apkPath:-}" CFG_buildDir="${CFG_buildDir:-}" \
    "$ADAPTER"
fi
[ "${1:-}" = "--no-build" ] && shift || true

# ── Layer 2: drive flows, capture screenshots, apply the crash-safe verdict (§5.5) ──
FLOWS=( "$@" ); [ ${#FLOWS[@]} -gt 0 ] || FLOWS=( flows/*.yaml )
pass=0; fail=0; declare -a rows=()
STAMP="$OUT/.mstamp"
for flow in "${FLOWS[@]}"; do
  name="$(basename "$flow" .yaml)"; log="$OUT/$name.log"
  echo "▶ flow: $name"
  : > "$STAMP"                                 # mtime marker: PNGs created after this line are this flow's
  set +e
  maestro test "$flow" --format junit --output "$OUT/$name.xml" >"$log" 2>&1
  code=$?                                      # §5.5: exit code AND log, never grep alone
  set -e
  # Maestro writes `takeScreenshot` PNGs (bare names) into the CWD; relocate any this flow
  # created into $OUT so mapping.json / the report (runs/<date>/<name>.png) actually resolve.
  find . -maxdepth 1 -type f -name '*.png' -newer "$STAMP" -exec mv -f {} "$OUT/" \;
  # A crash (Java stack trace, no "FAILED" text) must count as FAIL, not a false pass.
  if [ $code -eq 0 ] && ! grep -qiE '(^|\s)FAILED|Exception|Error:' "$log"; then
    verdict=PASS; pass=$((pass+1))
  else
    verdict=FAIL; fail=$((fail+1))
  fi
  rows+=( "$verdict  $name  (exit=$code, log=$log)" )
  echo "   → $verdict"
done
rm -f "$STAMP"

# ── Layer 3 handoff: an evidence index for the human report; NOT a written status ──
printf '%s\n' "${rows[@]}" | tee "$OUT/summary.txt"
echo ""
echo "Functional flows: ✅ $pass  ❌ $fail   (visual checks are NOT decided here — see mapping.json)"
echo "Screenshots + logs: $OUT/   ·   Now build the chat report and WAIT for confirmation before writing to the Sheet (EMULATOR_RULES §0, §2.4)."
[ $fail -eq 0 ]                                # non-zero exit if any functional flow failed
