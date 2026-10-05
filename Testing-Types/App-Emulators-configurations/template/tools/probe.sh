#!/usr/bin/env bash
# probe.sh — one exploratory step against a running app: act, capture, read the screen back.
#
# `runner/run.sh` drives WRITTEN flows and is the right tool for a round. This one is for the
# other half of the work — walking a screen you have not scripted yet (exploratory sessions,
# reproducing a bug by hand, checking what a control is actually labelled before writing the
# flow). It exists because the loop "tap something → look → read the labels" was otherwise
# retyped ad hoc every time, and an ad-hoc `simctl io screenshot` into the working directory is
# how screenshots end up strewn across a workspace root instead of the round's own folder.
#
# Usage (from <Project>/Emulator-Testing/):
#   tools/probe.sh look                          # capture only, change nothing
#   tools/probe.sh step <flow.yaml>              # run a Maestro flow, then capture
#   tools/probe.sh tap  '(?s)Continue.*'         # tap by selector, then capture
#   tools/probe.sh tap-at 50%,91%                # tap a point (selector didn't match), capture
#
# Every call writes into runs/<date>/probe/ — screenshot + the screen's visible text (.txt) +
# the raw hierarchy (.json), numbered in order, so an exploratory session leaves the same
# evidence trail a scripted round does. Nothing is written outside that folder.
#
# Config: reads ./config.json (appId, simulator/avd, platform) like the rest of the scaffold.
# Overrides: APP_ID, DEVICE_ID, OUT_DIR, LABEL. Android is driven through the same Maestro
# selectors; capture falls back to `adb exec-out screencap`.
set -euo pipefail
cd "$(dirname "$0")/.."                      # → <Project>/Emulator-Testing/

CONFIG="${CONFIG:-config.json}"
if [ -f "$CONFIG" ]; then
  eval "$(node -e '
    const c = require("./" + (process.env.CONFIG || "config.json"));
    const q = s => `"${String(s ?? "").replace(/"/g,"\\\"")}"`;
    for (const k of ["platform","flutterTarget","appId","simulator","avd"])
      process.stdout.write(`CFG_${k}=${q(c[k])}\n`);
  ')"
fi
APP_ID="${APP_ID:-${CFG_appId:-}}"
[ -n "$APP_ID" ] || { echo "probe.sh: appId missing — set it in $CONFIG or pass APP_ID="; exit 2; }
PLATFORM="${CFG_platform:-ios}"
[ "$PLATFORM" = "flutter" ] && PLATFORM="${CFG_flutterTarget:-ios}"

# ── device ───────────────────────────────────────────────────────────────────────────────────
if [ -z "${DEVICE_ID:-}" ]; then
  if [ "$PLATFORM" = "ios" ]; then
    DEVICE_ID="$(xcrun simctl list devices booted -j | node -e '
      let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
        const all=Object.values(JSON.parse(s).devices).flat();
        const want=process.argv[1];
        const hit=(want && all.find(d=>d.name===want)) || all[0];
        if(!hit){console.error("probe.sh: no booted simulator");process.exit(3);}
        process.stdout.write(hit.udid);});' "${CFG_simulator:-}")"
  else
    DEVICE_ID="$(adb devices | awk 'NR>1 && $2=="device"{print $1; exit}')"
    [ -n "$DEVICE_ID" ] || { echo "probe.sh: no attached Android device/emulator"; exit 3; }
  fi
fi

OUT="${OUT_DIR:-runs/$(date +%F)/probe}"; mkdir -p "$OUT"
N="$(printf '%03d' $(( $(ls "$OUT" 2>/dev/null | grep -c '\.png$') + 1 )))"
NAME="$N${LABEL:+-$LABEL}"
export MAESTRO_CLI_NO_ANALYTICS=1

# ── act ──────────────────────────────────────────────────────────────────────────────────────
ACTION="${1:-look}"
run_flow() {   # $1 = yaml path
  maestro --device "$DEVICE_ID" test "$1" 2>&1 | grep -E "COMPLETED|FAILED" | sed 's/^/  /' || true
}
tmp_flow() {   # $1 = yaml body → temp flow with the appId header
  local f; f="$(mktemp -t probe-flow).yaml"
  { echo "appId: $APP_ID"; echo "---"; printf '%s\n' "$1"; } > "$f"; echo "$f"
}
case "$ACTION" in
  look) ;;
  step) [ -n "${2:-}" ] || { echo "probe.sh step <flow.yaml>"; exit 2; }; run_flow "$2" ;;
  tap)  [ -n "${2:-}" ] || { echo "probe.sh tap <selector>"; exit 2; }
        # NOTE the (?s) idiom: see EMULATOR_RULES §"duplicated accessibility labels".
        run_flow "$(tmp_flow "- tapOn: \"$2\"
- waitForAnimationToEnd:
    timeout: 4000")" ;;
  tap-at) [ -n "${2:-}" ] || { echo "probe.sh tap-at <x%,y%>"; exit 2; }
        run_flow "$(tmp_flow "- tapOn:
    point: \"$2\"
- waitForAnimationToEnd:
    timeout: 4000")" ;;
  *) echo "probe.sh: unknown action '$ACTION' (look|step|tap|tap-at)"; exit 2 ;;
esac
sleep "${SETTLE:-2}"

# ── capture ──────────────────────────────────────────────────────────────────────────────────
if [ "$PLATFORM" = "ios" ]; then
  xcrun simctl io "$DEVICE_ID" screenshot "$OUT/$NAME.png" >/dev/null 2>&1
else
  adb -s "$DEVICE_ID" exec-out screencap -p > "$OUT/$NAME.png"
fi
maestro --device "$DEVICE_ID" hierarchy > "$OUT/$NAME.json" 2>/dev/null || true

node -e '
  const fs=require("fs");
  // `node -e` has no script path in argv, so take the two we passed from the end.
  const [jsonPath,txtPath]=process.argv.slice(-2);
  let h; try { h=JSON.parse(fs.readFileSync(jsonPath,"utf8")); }
  catch { console.log("(hierarchy unavailable — screenshot only)"); process.exit(0); }
  const seen=[]; const noise=/Wi-Fi bars|No signal|Not charging|battery power|^\d{1,2}:\d{2}$/;
  (function walk(n){
    const a=n.attributes||{};
    const t=((a.text||a.accessibilityText||"")+"").trim();
    // A label repeated on its own node ("Next\nNext") is the norm on Flutter/iOS — collapse it
    // for reading, but remember the raw form is what a selector must match.
    const flat=t.split("\n").map(s=>s.trim()).filter(Boolean);
    const one=[...new Set(flat)].join(" / ");
    if(one && !noise.test(one) && !seen.includes(one)) seen.push(one);
    (n.children||[]).forEach(walk);
  })(h);
  fs.writeFileSync(txtPath, seen.join("\n")+"\n");
  console.log(seen.join(" | "));
' "$OUT/$NAME.json" "$OUT/$NAME.txt"
echo "  → $OUT/$NAME.png"
