#!/usr/bin/env bash
# Layer 1 · Flutter adapter: build the Flutter app for a simulator/emulator from the git-less
# snapshot (CFG_buildDir — §5, never the repo), then install + launch via the native tools so
# Maestro can drive it unchanged. Pick the device stack with config.flutterTarget ("ios"|"android").
# Reads CFG_* from run.sh.
set -euo pipefail
SRC="${CFG_buildDir:?config.buildDir (git-less snapshot dir) is required — do NOT build in the repo}"
TARGET="${CFG_flutterTarget:?config.flutterTarget is required: \"ios\" or \"android\"}"
: "${CFG_appId:?flutter adapter needs config.appId (iOS bundleId / Android applicationId)}"

cd "$SRC"
case "$TARGET" in
  ios)
    SIM="${CFG_simulator:?config.simulator required for flutterTarget=ios}"
    echo "  flutter build ios --simulator (src=$SRC, sim='$SIM')"
    flutter build ios --simulator --debug | tail -5
    APP="$(find "$SRC/build/ios/iphonesimulator" -maxdepth 1 -name '*.app' -type d 2>/dev/null | head -1)"
    [ -n "$APP" ] || { echo "  flutter adapter: no .app produced — build failed"; exit 2; }
    xcrun simctl boot "$SIM" 2>/dev/null || true
    open -a Simulator
    xcrun simctl install "$SIM" "$APP"
    xcrun simctl launch "$SIM" "$CFG_appId"
    echo "  launched $CFG_appId on '$SIM' (Flutter/iOS)"
    ;;
  android)
    AVD="${CFG_avd:?config.avd required for flutterTarget=android}"
    if ! adb devices | grep -q 'emulator-.*device$'; then
      echo "  booting AVD: $AVD"
      ( "$ANDROID_HOME/emulator/emulator" -avd "$AVD" -no-snapshot-save >/tmp/avd-$AVD.log 2>&1 & )
      adb wait-for-device
      until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
    fi
    echo "  flutter build apk --debug (src=$SRC)"
    flutter build apk --debug | tail -5
    APK="$(find "$SRC/build/app/outputs" -name '*.apk' 2>/dev/null | head -1)"
    [ -f "$APK" ] || { echo "  flutter adapter: APK not found — build failed"; exit 2; }
    adb install -r "$APK"
    adb shell monkey -p "$CFG_appId" -c android.intent.category.LAUNCHER 1 >/dev/null
    echo "  launched $CFG_appId on $AVD (Flutter/Android)"
    ;;
  *) echo "  flutter adapter: config.flutterTarget must be 'ios' or 'android' (got '$TARGET')"; exit 2 ;;
esac
