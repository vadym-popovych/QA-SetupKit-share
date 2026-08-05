# SETUP.md — one-time toolchain setup for emulator runs

Follow this once per machine. Claude runs the **Auto-detection** list below before any run;
if something is missing it points you here.

---

## Platform (which OS this kit needs)

| Track | Runs on | Why |
|---|---|---|
| **iOS** — `platform: "ios"`, or `"flutter"` with `flutterTarget: "ios"` | **macOS only** | Layer 1 is `xcodebuild` + `xcrun simctl` + `open -a Simulator`. Apple ships no Xcode toolchain and no iOS simulator for Linux or Windows, and there is no substitute to fall back to: an iOS round needs a Mac. |
| **Android** — `platform: "android"`, or `"flutter"` with `flutterTarget: "android"` | macOS · Linux · Windows | Layer 1 is the Android SDK (`adb`, `emulator`) plus Gradle — all three ship for every desktop OS, and `platforms/android.sh` uses nothing else. |
| **Layers 2–3** (Maestro, screenshots, the Sheets MCP) | macOS · Linux · Windows | Maestro is the cross-platform driver by design; the rest is Node and HTTP. |

So on Linux or Windows this kit works for Android and Flutter-on-Android, and not at all for
iOS. The install commands below are written for macOS (`brew`, `~/Library/…`); Maestro, a JDK,
Node and Pillow all ship for the other platforms — install them your own way and the rest of
the flow is unchanged.

---

## Auto-detection (Claude runs this first)

```bash
which claude           # the harness itself (Claude Code CLI)
which maestro          # Layer 2 driver — required for every platform
java -version          # Maestro (JVM) AND Android Gradle need a JDK 11+
which node             # runner parses config.json via node (18+)
python3 -c 'import PIL' # bug-evidence tools (annotate.py / collage.py) need Pillow
xcodebuild -version    # iOS builds
xcrun simctl list devices available | grep -i iphone   # iOS simulators
which adb              # Android builds
echo "ANDROID_HOME=${ANDROID_HOME:-UNSET}"   # Android adapter needs this exported
flutter doctor         # Flutter builds (set config.flutterTarget: ios|android)
```

If `maestro`, `java`, `node`, or `Pillow` is missing → install it (next sections). These are
run-time hard dependencies: a missing one does NOT fail at setup, it fails mid-run (a Maestro
JVM error, a `node: command not found`, or an `ImportError: No module named PIL` when the
mandated evidence step runs). Install a platform toolchain only for the stacks you actually test.

---

## Maestro (required — the cross-platform UI driver)

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
# then restart the shell or:  export PATH="$PATH":"$HOME/.maestro/bin"
maestro --version      # verify
```

Maestro drives iOS, Android, and Flutter with the same YAML flow format.

---

## Java (JDK) — required by Maestro and Android Gradle

macOS ships no JDK. Maestro runs on the JVM and the Android `./gradlew` build needs one too:

```bash
brew install --cask temurin@17
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 17)' >> ~/.zshrc   # then restart the shell
java -version      # verify (11+)
```

## Node.js — required by the runner

`runner/run.sh` reads `config.json` through node. Install Node 18+ (`brew install node`) and
confirm `node --version`.

## Bug-evidence tooling (Pillow) — required by the mandated evidence step

`tools/annotate.py` and `tools/collage.py` build the annotated bug evidence EMULATOR_RULES §3
requires. They need Python Pillow (python3 itself comes with Xcode CLT, Pillow does not):

```bash
python3 -m pip install --user Pillow
python3 -c 'import PIL'   # verify
```

Both tools look for their label font at three macOS paths (`/System/Library/Fonts/…`,
`/Library/Fonts/Arial.ttf`) and silently fall back to Pillow's built-in bitmap font when none
of them exists. On Linux that fallback is what you get, and it does not scale: the labels
render at a fixed tiny size, illegible on a phone-resolution screenshot. Add a local TrueType
path (e.g. `DejaVuSans.ttf`) to the `font()` candidate list in `tools/annotate.py` and
`tools/collage.py` before filing evidence from a non-Mac.

---

## iOS (Layer 1)

- **Xcode** from the App Store, then `xcodebuild -version` to confirm it's installed.
- Command-line tools: `xcode-select --install` (if not already).
- Simulator runtimes: `xcrun simctl list runtimes`; if none, download one via
  Xcode → Settings → Platforms and create a device. `config.json`'s `simulator` must name a
  device that appears in `xcrun simctl list devices available` (the examples' "iPhone 16 Pro"
  is just one option — pick a device you actually have).
- Build for a simulator destination with `xcodebuild`, then `simctl boot/install/launch`.

## Android (Layer 1) — when you start testing Android

- **Android Studio** + SDK; ensure `adb` and `emulator` are on PATH
  (`~/Library/Android/sdk/platform-tools`, `.../emulator`).
- **Export `ANDROID_HOME`** (the Android adapter requires it, not just PATH):
  `echo 'export ANDROID_HOME="$HOME/Library/Android/sdk"' >> ~/.zshrc`.
- Create at least one AVD (Pixel + recent API level).

## Flutter (Layer 1) — when you start testing Flutter apps

- Install Flutter SDK; `flutter doctor` should be all-green for your target platform(s).
- Set `config.platform` to `"flutter"` and `config.flutterTarget` to `"ios"` or `"android"`
  (plus that target's fields — `simulator` for iOS, `avd` for Android). The runner's
  `platforms/flutter.sh` builds from the git-less snapshot and installs/launches via
  `simctl`/`adb`; Maestro then drives the app on the same simulator/emulator unchanged.

---

## Google Sheets MCP (Layer 3 — writing statuses & bugs)

The checklist and `Bug Reports` tab live in Google Sheets, written via the `google-sheets`
MCP. See [`QA-SetupKit/MCP-configurations/`](../../MCP-configurations/) and the checklist kit's
`MCP_SETUP.md`.

- **Workspace owner (Vadym):** already configured — detection passes silently.
- **New teammate / different Google account:** run OAuth so writes go to *your* Drive:
  ```bash
  cd <path-to>/mcp-sheets && node server.mjs --auth   # opens browser consent
  ```

---

## Per-project config

First copy the scaffold once, then fill it (don't hand-build the folder):

```bash
cp -R QA-SetupKit/Testing-Types/App-Emulators-configurations/template/ <Project>/Emulator-Testing/
cd <Project>/Emulator-Testing
cp config.example.json config.json && cp mapping.example.json mapping.json
```

`config.json`, e.g. (iOS) — mirror the full field set in `config.example.json`; `appId` and
`buildDir` are **hard-required by the runner** in addition to the obvious fields:

```json
{
  "platform": "ios",
  "scheme": "<xcode-scheme>",
  "appId": "com.example.app",
  "bundleId": "com.example.app",
  "simulator": "<a device from `xcrun simctl list devices available`>",
  "buildDir": "/tmp/<app>-src",
  "checklistSpreadsheetId": "<google-sheet-id>",
  "checklistTab": "<tab name>"
}
```

Claude can derive `scheme`/`bundleId`/`appId` from the Xcode project and confirm in one line if
you don't know them. Prefer editing the copied `config.example.json` (it carries `$comment`
field notes) over hand-writing this.

Then **snapshot the app source into `buildDir` before the first run** — never build inside the
project repo (EMULATOR_RULES §5, repos are read-only):

```bash
git -C <app-repo> archive HEAD | tar -x -C <buildDir>   # git-less copy; set config.buildDir to <buildDir>
```

**Before your first run**, replace the placeholder anchors in at least `flows/smoke-launch.yaml`
(e.g. `assertVisible`) with your app's real first-screen text/id — the shipped flow anchors are
TODO placeholders and will FAIL out of the box until filled.
