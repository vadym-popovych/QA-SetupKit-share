# App-Emulators-configurations

Single home for **everything related to running app builds on emulators/simulators and
auto-running QA checklists against them**. Shareable with teammates the same way the
checklist kit is.

> **Companion to the checklist kit.** The checklist kit
> ([`QA-SetupKit/QA-Documentation/Checklist/`](../../QA-Documentation/Checklist/)) *creates*
> the QA checklist in Google Sheets. This kit *executes* it: builds the app, drives it on an
> emulator, captures evidence, fills `Passed`/`Failed`, and files bugs back into the same
> sheet.

---

## What this does (the flow)

```
build app → launch on emulator/simulator → drive UI (Maestro) → capture screenshots
        → evaluate each checklist item → show report in chat → (you confirm)
        → write Passed/Failed to the checklist + file bugs into a "Bug Reports" tab
```

It is **semi-automatic by design**: Claude proposes statuses and bug drafts, **you confirm**,
then it writes. No silent / unverifiable `Passed`. See `EMULATOR_RULES.md` for why.

---

## 3-layer architecture (so it works for any stack)

Only **Layer 1** changes per stack. Layers 2 and 3 are identical for iOS / Android / Flutter.

| Layer | Responsibility | Tooling |
|---|---|---|
| **1. Build / Launch** | compile, boot device, install app | iOS: `xcodebuild` + `simctl` · Android: Gradle + `adb` · Flutter: `flutter build` |
| **2. Drive / Capture** | navigate screens, screenshot each state | **Maestro** (one YAML format for iOS, Android **and** Flutter) |
| **3. Evaluate / Report** | judge checks, write statuses, file bugs | Claude + `google-sheets` MCP |

**Why Maestro:** it is the single cross-platform driver. The same flow YAML runs on a Swift
app, an Android app, and a Flutter app — so moving to a new project only means swapping
Layer 1, never re-learning the driver.

**Which OS you need:** the iOS half of Layer 1 is **macOS-only** — it is `xcodebuild` and
`xcrun simctl`, which Apple ships for nothing else. The Android half and Layers 2–3 run on
macOS, Linux and Windows alike, so a non-Mac machine can do everything here except iOS. Full
table in [`SETUP.md`](SETUP.md).

---

## Folder layout

```
App-Emulators-configurations/
├── README.md            ← this file (humans)
├── EMULATOR_RULES.md    ← the rules Claude MUST follow (the instruction-for-Claude)
├── SETUP.md             ← one-time toolchain setup + auto-detection checklist
├── CLAUDE.starter.md    ← snippet a teammate pastes into THEIR CLAUDE.md
└── template/            ← the runnable scaffold (copy this to <Project>/Emulator-Testing/)
    ├── README.md            ← how the scaffold fits together
    ├── config.example.json  ← platform / appId / scheme|package / device / buildDir
    ├── mapping.example.json ← checklist row ↔ flow ↔ screenshot ↔ oracle
    ├── flows/               ← Maestro flows (Layer 2): smoke, permissions-deny,
    │                          lifecycle, deeplink, offline — text/id based, cross-platform
    ├── runner/
    │   ├── run.sh              ← Layer 2+3 orchestrator (crash-safe verdict, §5.5)
    │   └── platforms/{ios,android}.sh   ← Layer 1 build/install/launch adapters
    └── tools/{annotate,collage}.py      ← bug-evidence annotation
```

**This kit ships rules/templates ONLY — never project data.** Per-project artefacts
(config, flows, screenshots, run logs) live OUTSIDE the kit, in the project's own folder at
the workspace root, per the one-parent-folder-per-project convention:

```
<Project>/Emulator-Testing/    ← a filled copy of template/
    ├── config.json   ← bundle id / scheme / package / target device
    ├── mapping.json  ← checklist row ↔ flow ↔ screenshot ↔ oracle
    ├── flows/        ← Maestro YAML, one per screen/state/resilience scenario
    ├── runner/       ← run.sh + platforms/ (copied, unchanged)
    └── runs/<date>/  ← screenshots + logs (git-ignored)
```

---

## Sharing with a teammate

1. Share the whole `App-Emulators-configurations/` folder (without secrets). Project
   artefacts live outside the kit, so nothing project-specific travels with it.
2. Tell them to follow **`SETUP.md`** (install Xcode/Android SDK/Flutter as needed +
   Maestro, then verify).
3. Tell them to paste **`CLAUDE.starter.md`** into their own `CLAUDE.md` (or let Claude
   append it — see that file).
4. They do **not** need this workspace's root `CLAUDE.md`.

The checklist itself lives in Google Sheets and is reached via the `google-sheets` MCP — see
[`QA-SetupKit/MCP-configurations/`](../../MCP-configurations/) for that setup. A teammate on a
different Google account must run their own OAuth (`node server.mjs --auth`) so statuses/bugs
are written to **their** Drive.

---

## Current status

> **Scaffold ships (13/07/2026).** The runnable skeleton — `template/runner/run.sh` + per-platform
> Layer-1 adapters, five categorized Maestro flows (smoke, permissions-deny, lifecycle, deeplink,
> offline), `config.example.json` and `mapping.example.json` — is in [`template/`](template/README.md),
> ready to copy and fill. Resilience/lifecycle scenarios beyond the visual checklist are specified
> in EMULATOR_RULES §7. **Maestro is still the first setup step** (`SETUP.md`), and the flow
> `TODO`s are placeholders — a project fills them with its real copy/ids. The end-to-end pilot
> (a real report written to a sheet) remains the next milestone.
