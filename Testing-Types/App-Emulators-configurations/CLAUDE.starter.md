# Paste this block into your CLAUDE.md (or let Claude append it)

> Additive: if you already have a `CLAUDE.md`, append this section — do not overwrite the
> file. It points Claude at the emulator-run kit; the full rules live in `EMULATOR_RULES.md`.

---

## Running QA checklists on an emulator/simulator

When the user asks to "run the build on the emulator and go through the checklist", "auto-fill
the checklist", "test the app and mark Passed/Failed", or anything similar:

- The kit lives in [`QA-SetupKit/Testing-Types/App-Emulators-configurations/`](QA-SetupKit/Testing-Types/App-Emulators-configurations/).
  Follow **[`EMULATOR_RULES.md`](QA-SetupKit/Testing-Types/App-Emulators-configurations/EMULATOR_RULES.md)**
  exactly.
- **First**, run the Auto-detection list in
  [`SETUP.md`](QA-SetupKit/Testing-Types/App-Emulators-configurations/SETUP.md). If a prerequisite
  (Maestro, platform toolchain, `google-sheets` MCP, project `config.json`) is missing, STOP
  and walk the user through `SETUP.md` — do not improvise a script that will fail.
- The flow is **semi-automatic**: build → launch on emulator → drive UI with **Maestro** →
  capture screenshots → evaluate each check → **show a report and wait for the user's
  confirmation** → only then write `Passed`/`Failed` to the checklist and file bugs.
- **Never write `Passed` for a check you could not actually exercise.** Unreached
  screens/states are **not-run** (empty status + comment), never `Passed`.
- **The app-under-test repo is READ-ONLY.** Never commit/push/branch/PR to it — only
  `clone`/`fetch`/`pull`/`checkout`/`diff` to get the code locally and build/run it. Act as
  if you have read access only; if writing seems required, STOP and ask.
- **Bugs go inside the same Google Sheet:** a `Bug Reports` tab (one row per bug, incrementing
  `BUG-NNN`) + a `=HYPERLINK(...)` back-link in the failed check's `Comments` cell. No
  external tracker.
- Architecture is 3-layer; only **Build/Launch** is stack-specific (iOS `xcodebuild` /
  Android Gradle / Flutter `flutter build`). **Maestro** (Layer 2) and evaluation+reporting
  (Layer 3) are identical across iOS, Android, and Flutter.
- **Check-text drift (Vadym, 10/07/2026):** if a check's text describes a flow the app
  doesn't actually have (label/step/navigation drift, not a defect), update the check
  text to reality before evaluating; real defects stay Failed with a bug.
- **Figma BEFORE the run (Vadym, 11/07/2026):** visual round → bring the Figma source up
  first (start it yourself when possible, else ask and WAIT); not-run only after an
  explicit decision to proceed without design.
- **One block per round + date (Vadym, 11/07/2026):** round N fills platform block N
  (never overwrite a filled block; out of blocks → append one replicating the structure);
  write the run date d/m/yyyy into the block's `Checked` header cell (I1/R1/AA1 mobile).
- **Device range (Vadym, 10/07/2026):** a full round covers small screens (iPhone SE
  class / compact Androids) → standard phones → tablets (where supported); minimum
  1 small + 1 standard (+ 1 tablet) per platform. One-device pass = SMOKE, label it so.
  A `<Project>/Compatibility-Testing/MATRIX.md`, if present, overrides this default.
