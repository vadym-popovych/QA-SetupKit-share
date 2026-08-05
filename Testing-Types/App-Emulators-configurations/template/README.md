# Emulator-Testing scaffold — copy this whole folder to `<Project>/Emulator-Testing/`

This is the runnable skeleton the [`EMULATOR_RULES.md`](../EMULATOR_RULES.md) describe. The kit
ships the *shape*; you fill the per-project bits (the `.example` files and the `TODO`s). Nothing
here contains project data — that lives only under `<Project>/Emulator-Testing/`.

```
config.example.json        → copy to config.json   (platform, appId, scheme/package, device, buildDir)
mapping.example.json       → copy to mapping.json   (checklist row ↔ flow ↔ screenshot ↔ oracle)
flows/                     → Maestro flows (Layer 2) — text/id based, cross-platform
  smoke-launch.yaml            cold launch reaches the first screen
  permissions-deny.yaml        the DENY path degrades gracefully
  lifecycle-background-restore.yaml   background → kill → relaunch keeps state
  deeplink-open.yaml           an external URL cold-routes to the right screen
  offline-behaviour.yaml       real offline state, then recovery (Android; iOS caveat inside)
runner/
  run.sh                   Layer 2+3 orchestrator: build → drive flows → crash-safe verdict
  platforms/ios.sh         Layer 1 (iOS): git-less snapshot build → simctl install/launch
  platforms/android.sh     Layer 1 (Android): AVD boot → APK install → launch
tools/
  annotate.py              red/green bug annotations on a screenshot
  collage.py               combine app + API / app + Figma into one evidence image
```

## The three layers (why it's split this way)

1. **Build & launch** — the ONLY stack-specific code, one adapter per platform under
   `runner/platforms/`. Never leaks into Layer 2/3.
2. **Drive & capture** — Maestro flows written against visible text / accessibility ids so one
   flow runs on iOS, Android and Flutter. `run.sh` applies the crash-safe verdict
   (EMULATOR_RULES §5.5: exit 0 **and** no FAILED/Exception in the log — a crash is a FAIL).
3. **Evaluate** — `mapping.json` links each checklist row to its flow, screenshot and **oracle**;
   functional rows are decided from the flow, visual rows are proposed for human confirm.

## Run it

```bash
cp config.example.json config.json && $EDITOR config.json     # fill in your app
cp mapping.example.json mapping.json                          # map rows as you cover them
./runner/run.sh                       # build (Layer 1) + drive every flow
./runner/run.sh --no-build            # app already installed — just re-drive flows
./runner/run.sh flows/permissions-deny.yaml   # one flow
```

`run.sh` writes screenshots + logs to `runs/<date>/` (git-ignored) and a `summary.txt`. It does
**not** write statuses or file bugs — you build the chat report first and wait for confirmation
(EMULATOR_RULES §0). Resilience flows beyond the visual/functional checklist are catalogued in
EMULATOR_RULES §7.
