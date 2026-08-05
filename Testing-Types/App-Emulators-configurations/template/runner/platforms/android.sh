#!/usr/bin/env bash
# Layer 1 · Android adapter: boot the AVD, install the APK, launch. Two modes:
#   - config.apkPath set  → install that prebuilt APK (preferred: no Gradle build here).
#   - config.apkPath empty → build from the git-less snapshot (CFG_buildDir) with Gradle.
# Reads CFG_* from run.sh. Builds/artefacts stay OUT of the repo (§5).
set -euo pipefail
: "${CFG_package:?android adapter needs config.package}"
AVD="${CFG_avd:?config.avd is required (name from: emulator -list-avds)}"

# boot emulator if not already online
if ! adb devices | grep -q 'emulator-.*device$'; then
  echo "  booting AVD: $AVD"
  ( "$ANDROID_HOME/emulator/emulator" -avd "$AVD" -no-snapshot-save >/tmp/avd-$AVD.log 2>&1 & )
  adb wait-for-device
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
fi

if [ -n "${CFG_apkPath:-}" ]; then
  APK="$CFG_apkPath"
else
  SRC="${CFG_buildDir:?config.buildDir or config.apkPath is required}"
  echo "  gradle assembleDebug (src=$SRC)"
  ( cd "$SRC" && ./gradlew assembleDebug -q )
  APK="$(find "$SRC" -path '*/outputs/apk/debug/*.apk' | head -1)"
fi
[ -f "$APK" ] || { echo "  android adapter: APK not found — build failed"; exit 2; }

adb install -r "$APK"
adb shell monkey -p "$CFG_package" -c android.intent.category.LAUNCHER 1 >/dev/null
echo "  launched $CFG_package on $AVD"
