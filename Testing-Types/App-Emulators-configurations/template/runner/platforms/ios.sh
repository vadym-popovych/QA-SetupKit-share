#!/usr/bin/env bash
# Layer 1 · iOS adapter: build a git-less snapshot for the simulator, then boot/install/launch.
# Reads CFG_* from run.sh. Builds from CFG_buildDir (a snapshot OUTSIDE the repo — §5), never
# inside the project checkout. DerivedData goes to /tmp so nothing lands in the source tree.
set -euo pipefail
: "${CFG_scheme:?ios adapter needs config.scheme}"
: "${CFG_bundleId:?ios adapter needs config.bundleId}"
SIM="${CFG_simulator:-iPhone 16 Pro}"
SRC="${CFG_buildDir:?config.buildDir (git-less snapshot dir) is required — do NOT build in the repo}"
DD="/tmp/$(basename "$SRC")-DerivedData"

echo "  build: $CFG_scheme for '$SIM' (src=$SRC, derivedData=$DD)"
xcodebuild -project "$SRC"/*.xcodeproj -scheme "$CFG_scheme" \
  -destination "platform=iOS Simulator,name=$SIM" \
  -derivedDataPath "$DD" -sdk iphonesimulator build \
  | tail -5                                   # keep output short; full log is xcodebuild's own

APP="$(find "$DD/Build/Products" -maxdepth 2 -name '*.app' -type d | head -1)"
[ -n "$APP" ] || { echo "  ios adapter: no .app produced — build failed"; exit 2; }

xcrun simctl boot "$SIM" 2>/dev/null || true  # already-booted is fine
open -a Simulator
xcrun simctl install "$SIM" "$APP"
xcrun simctl launch "$SIM" "$CFG_bundleId"
echo "  launched $CFG_bundleId on '$SIM'"
