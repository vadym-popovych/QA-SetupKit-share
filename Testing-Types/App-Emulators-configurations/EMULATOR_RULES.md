# EMULATOR_RULES.md — rules Claude MUST follow when running checklists on an emulator

These rules govern the "build → run on emulator → fill checklist → file bugs" workflow.
They are the instruction-for-Claude. Paste the pointer from `CLAUDE.starter.md` into your
`CLAUDE.md`; this file is the full spec it refers to.

---

## 0. Golden rule — semi-automatic, never fake a Pass

- **Visual / UX checks** ("matches design", spacing, colors, copy) are **not** deterministic.
  Claude evaluates them from screenshots vs Figma and proposes a verdict — it does **not**
  assert `Passed` as if it were measured.
- **Functional / navigational checks** ("screen opens", "field accepts input", "button
  reacts", "error shows on wrong password") **can** be decided deterministically from the
  Maestro run result.
- **Always show the full report in chat and wait for the user's confirmation BEFORE writing
  any status or filing any bug.** The user may override individual verdicts. This is
  non-negotiable: the value of the checklist is that its `Passed` marks are trustworthy.
- Never write `Passed` for a check Claude could not actually exercise. If a screen/state was
  not reached, mark it **blocked / not-run** (leave status empty + a comment), not `Passed`.
- **Flag contradictory checks with a comment (Vadym, 23/06/2026):** when a check is
  contradictory or ambiguous — app vs Figma design vs checklist text disagree, or behaviour is
  "intended but mismatched" — ALWAYS leave an explanatory Comment (column E) stating what each
  source says, EVEN IF the row is ultimately marked `Passed`. Never leave a contradictory check
  without a comment.

---

## 0.2 Update check texts to the app's ACTUAL flow (Vadym, 10/07/2026)

- If a check's text describes a flow that differs from how the app really works
  (button label, step order, navigation path — drift, not a defect), update the
  check text in the Sheet to match reality and evaluate against the updated text.
  Real defects are never rewritten away; page-band names follow the app's naming.

## 0.3 Figma up BEFORE the run (Vadym, 11/07/2026)
- The not-run entry carries the STANDARD COMMENT, so a later reader cannot mistake it for an
  untested miss: `Visual checks not run — design source unavailable; proceeding agreed with the
  owner on <dd/mm/yyyy>.`

- If the round includes design-comparison (visual) checks, bring the Figma source up
  BEFORE building/launching anything: start it yourself when possible (`open -a Figma`
  for the Dev Mode MCP server), otherwise ask the user to enable it and WAIT. Visual
  checks become not-run only after an explicit decision to proceed without design.

## 0.4 One platform-block per round + run date (Vadym, 11/07/2026)

- Statuses of a run go into ONE platform block: round 1 → block 1 (`C:K` mobile),
  round 2 → block 2 (`L:T`), round 3 → block 3 (`U:AC`). Never overwrite a filled block.
- Write the actual run date into that block's `Checked` header cell, **d/m/yyyy**
  (mobile: `I1` / `R1` / `AA1`; web: `H1` / `P1` / `X1`), keeping the `Checked` line.
- All blocks used → append a new block on the right, replicating the existing block
  structure 1:1 (headers, merges, counters, validation, CF ranges, column group with
  right-side toggle, page-band mirror formulas).

## 0.5 Device range — small phones to tablets (Vadym, 10/07/2026)

- A full checklist round must NOT be verified on a single mid-size device. Cover the
  supported range: small screens (iPhone SE class, 320–375 pt / compact Androids) →
  current standard phones → tablets (iPad / Android tablet) where the app supports them.
- Practical minimum per full round: 1 small phone + 1 standard phone (+ 1 tablet where
  supported) per platform. A one-device pass is a SMOKE run — say so explicitly in the
  report; never present it as full coverage.
- If the project has a `<Project>/Compatibility-Testing/MATRIX.md`, its tiers decide
  per-cell depth and override this default.

## 1. Before you start — auto-detection (run FIRST)

On the first emulator-run request in a workspace, BEFORE building anything, verify the
toolchain and config. If anything required is missing, STOP and walk the user through
`SETUP.md` — do not improvise a script that will fail. Required:

- **Maestro** on PATH (`which maestro`). If missing → `SETUP.md` § Maestro.
- Platform toolchain for the target app:
  - iOS → `xcodebuild -version` + at least one available simulator (`xcrun simctl list`).
  - Android → `adb` + an AVD.
  - Flutter → `flutter doctor`.
- `google-sheets` MCP reachable (for writing statuses/bugs) — same detection as the checklist
  kit's `MCP_SETUP.md`.
- A `<Project>/Emulator-Testing/config.json` for the target app (bundle id / scheme / package / device).
  If absent, offer to create it (derive bundle id/scheme from the project; confirm in one
  line).
- The target checklist spreadsheet. If its id isn't in `config.json`, FIRST search the user's
  Google Drive by project name; only ask the user for the link if you can't find it there.

Phrase a missing prerequisite clearly: "I see `<X>` isn't set up yet — without it I can't
`<Y>`. Want me to walk you through it?" then drive from `SETUP.md`.

---

## 2. The run, step by step

1. **Build & launch (Layer 1).** Use the per-platform adapter in `runner/platforms/` (the kit
   ships a runnable skeleton — copy the whole [`template/`](template/README.md) to
   `<Project>/Emulator-Testing/` on first setup, then fill `config.json`). iOS: `xcodebuild` for
   the simulator destination → `xcrun simctl boot` → `install` → `launch`. `runner/run.sh` drives
   all of Layer 2+3; confirm the app actually reaches its first screen before proceeding.
2. **Drive & capture (Layer 2).** Run the Maestro flows in `<Project>/Emulator-Testing/flows/`. Each
   flow navigates to a screen/state and takes a screenshot into `<Project>/Emulator-Testing/runs/<date>/`.
3. **Evaluate (Layer 3).** For each checklist row, find its evidence via
   `<Project>/Emulator-Testing/mapping.json` (row ↔ flow ↔ screenshot). Decide:
   - functional → `Passed`/`Failed` from the flow result;
   - visual → compare screenshot to Figma / the design spec and propose a verdict.
4. **Report in chat.** Summarize `✅ Passed N · ❌ Failed M · ⚪ not-run K`, with the
   screenshot and a one-line reason per non-Pass. Ask the user to confirm or adjust.
5. **Write (only after confirmation).** Statuses to the checklist; bugs to the `Bug Reports`
   tab; back-links into `Comments`. See §3.

---

## 3. Bug reporting — inside the same Google Sheet (no external tracker)

When a check is confirmed `Failed`:

1. Ensure a sheet/tab named **`Bug Reports`** exists in the checklist spreadsheet (create it
   if missing). The column set's single source of truth is
   `QA-SetupKit/Rules-Guide/schemas/bug.schema.json` — canonical header row + field→column mapping
   (incl. array-cell serialization and legacy-tab migration) live in
   `QA-SetupKit/QA-Documentation/Bug-Reports/SETUP.md`. Existing tabs with the older
   layout (`Bug ID | Date | Screen | Check | Severity | Steps to reproduce | Expected |
   Actual | Screenshot | Status`) keep working: `Screen`+`Check` map to `Component`,
   `Screenshot` to `Evidence`; missing columns are appended to the right lazily.
2. Append one row per bug with an incrementing ID (`BUG-001`, `BUG-002`, …). `Status`
   defaults to `Open`. `Screenshot` = link/reference to the captured evidence.
3. In the failed check's **`Comments`** cell in the checklist, write a hyperlink back to the
   bug row, e.g.:
   ```
   =HYPERLINK("#gid=<bugReportsSheetGid>&range=A<bugRow>"; "BUG-001")
   ```
   so clicking the comment jumps to the bug. Single source of truth, all in one file.
4. Prefer the `google-sheets` MCP for all writes. Do not build ad-hoc API scripts when the
   MCP can do it.
5. **Evidence = clickable Drive links (Vadym, 11/07/2026):** upload screenshots (and screen
   recordings when useful — `simctl io recordVideo` / `adb shell screenrecord` / Maestro
   `startRecording`) to Drive `ClaudeProjects/<Project>/QA Documentation/Bug Evidence/`, name them
   `BUG-NNN_<platform>_<screen>.<ext>`, and put rich-text links (one per line) into the
   bug row's `Evidence` cell — never bare local paths. Share the folder along with the Sheet.
   **How to upload (fresh clone):** use the Google Drive MCP `create_file` with `parents` set to
   the `Bug Evidence` folder id (create the `ClaudeProjects/<Project>/QA Documentation/Bug Evidence/`
   path if absent), or `MCP-configurations/mega/mega-upload.sh --evidence` for a generic host (§6).
   **Annotate UI bugs:** each screenshot also gets an ANNOTATED copy — red rounded
   rect + arrow on the problem zone, green rect on the expected/reference zone, chip
   labels ("Actual…" / "Expected…"); annotated link goes FIRST (bold) in `Evidence`.
   Reference tool: `<Project>/Emulator-Testing/tools/annotate.py` (Pillow, JSON spec).
6. **Extra file-hosting channels (Mega etc., Vadym, 11/07/2026):** when evidence
   is also shared via a generic file host, use the fixed structure
   `Attachments/<Project name>/<Screenshots | Screen records>/<dd.mm.yyyy>/` with file
   names `dd.mm.yyyy - screenshotN.ext` / `dd.mm.yyyy - videoN.ext` (N auto-increments
   within the date folder; dots in dates — `/` is the path separator on these hosts).
   Reference tool: `QA-SetupKit/MCP-configurations/mega/mega-upload.sh --evidence`.
   **Bug reports in an external tracker (e.g. Redmine) carry ONLY the file-host link**
   in their Screenshot/Evidence section — no direct file attachments in the ticket
   (Vadym, 11/07/2026). The internal QA Sheet keeps its Drive-link convention (§3.5).
7. **Evidence collages — ONE image instead of several links (Vadym, 11/07/2026):**
   combine related evidence into a single labeled image via
   `<Project>/Emulator-Testing/tools/collage.py` (N panels side by side, label chip
   above each, red/green annotations inside panels, coords in source px).
   Standard combos: backend bug → app view + API response render; frontend bug → the
   buggy screen PLUS the design reference from Figma (red frame on the bug, green on
   the reference) — side by side for app screens, stacked vertically for web pages.
   **The design panel is included ONLY when the design shows the CORRECT target
   variant** (same platform/state we expect); if the design itself carries the other
   variant (e.g. iOS copy while the bug is Android), use a single annotated app
   screenshot instead (Vadym, 11/07/2026).
8. **Text/copy bugs — UNDERLINE the problematic word (Vadym, 11/07/2026):** in addition
   to the red frame around the text zone, always underline the specific wrong
   word/phrase (annotate.py `underline` type) so the accent lands exactly on the
   problem text (e.g. "Apple" in the wrong-store disclaimer).

---

## 4. Reusability across stacks

- Keep Layer 1 (build/launch) the ONLY stack-specific code — one adapter per platform under
  `runner/platforms/`. Never leak platform specifics into Layer 2/3.
- Maestro flows are written against accessibility ids / visible text so the same flow can run
  on iOS, Android, and Flutter wherever the UI matches.
- One `<Project>/Emulator-Testing/` folder per app at the workspace root (this kit ships
  rules/templates only — never project data). Adding a new app = new `config.json` + `flows/` +
  `mapping.json` there; the runner and reporter are untouched.
- Never hardcode machine-specific absolute paths (`/Users/<name>/...`) in committed scripts —
  resolve relative to the repo / via env vars, same rule as the checklist generators.

---

## 5. The project repo is READ-ONLY

- **Preferred (strongest guarantee): build from a git-less snapshot copy.** Instead of
  building inside the repo, export the code to a scratch dir with NO `.git`, and build there —
  then writing back is physically impossible (no remote, no history):
  - committed state (default): `git -C <repo> archive HEAD | tar -x -C /tmp/<app>-src`
    (`git archive` is read-only; gives exactly the committed tree, no `.git`).
  - with uncommitted local changes: `rsync -a --exclude='.git' <repo>/ /tmp/<app>-src/`.
  Build from `/tmp/<app>-src`; DerivedData + SPM clones still go to `/tmp` (see §2/build).
- If you DO build in-place inside the repo (fallback), it is treated as **read-only**: **never**
  commit, push, branch, tag, open PRs, stash, or rebase — nothing that mutates the repo, its
  history, or its remote.
- Allowed git ops only: `clone`, `fetch`, `pull`, `checkout` an existing ref, `status`,
  `log`, `diff`, `archive`. Just enough to get the code locally and read/build it.
- Build and run **locally only**. Build outputs, generated files, screenshots, and logs stay
  out of the repo (git-ignored or outside the working tree). Act as if your credentials grant
  read access only.
- If a task seems to need writing to the project repo, STOP and ask the user — default is
  hands-off.

## 5.5 Runner verdicts: never trust "no FAILED in log" alone (Vadym, 11/07/2026)

- A Maestro process can CRASH (Java stack trace, no "FAILED" text) — a log-grep-only
  check then reports a false PASS. A flow result is PASS only if BOTH the exit code
  is 0 AND the log has no FAILED lines; treat crashes as FAIL and re-run.
- Watch for false positives the other way too: a flow can "pass" its asserts while
  the intended screen was never reached (e.g. a coordinate tap missed and the final
  assert matched the previous screen). For coordinate taps, always verify the
  screenshot actually shows the target screen before marking the check Passed.

## 6. Hygiene

- Per-run artifacts go to `<Project>/Emulator-Testing/runs/<date>/` and are git-ignored — do not commit
  screenshots/logs.
- Never commit secrets (signing certs, API keys, OAuth tokens). The OAuth token for Sheets
  lives in the MCP folder, not here.
- If a run is partial (some flows failed to launch, a screen was unreachable), say so
  explicitly in the report and mark those checks not-run — never paper over a partial run as
  a full pass.

---

## 7. Resilience & lifecycle scenarios (beyond the visual/functional checklist)

A screen-by-screen checklist covers the happy path *on each screen* and is blind to the
transitions **between** app states — which is exactly where mobile apps break. The kit ships an
exemplar Maestro flow for each dimension below in the scaffold's [`template/flows/`](template/flows/)
(copied to `<Project>/Emulator-Testing/flows/`); the whole runnable skeleton — runner, config,
row↔flow↔oracle mapping — is documented in [`template/README.md`](template/README.md). Add the
dimensions that apply as their **own checklist rows** (or a `Resilience` tab) so they get statused
like any other check. Each names an **oracle** so its verdict is real, never vibes:

- **Permissions — the DENY path** (`permissions-deny.yaml`). Launch with permissions denied
  (Maestro `permissions: { all: deny }`); the app must degrade gracefully — no crash, a clear
  "enable in Settings" affordance — not a white screen or a hang on the prompt. Also test
  grant-then-revoke for a permission-gated feature. *Oracle: invariant — "a denied permission
  never blocks a core flow."*
- **Process lifecycle — background → kill → relaunch** (`lifecycle-background-restore.yaml`).
  `pressKey: Home` → `stopApp` → `launchApp { clearState: false }`. State the user cared about
  (cart, draft, auth) must survive process death. *Oracle: invariant — "state persists across
  process death."* Run this EVERY full round — it catches the highest-impact data-loss bugs.
- **Deep / universal links — cold + warm** (`deeplink-open.yaml`). `openLink` after `stopApp`
  (cold routing is the harder case); the link must land on the target screen, not the home tab.
  *Oracle: spec — the app's route table.*
- **Network profiles — offline & recovery** (`offline-behaviour.yaml`). The app shows a real
  offline state (banner / cached content / retry), then recovers when back online. Android:
  Maestro `setAirplaneMode`. **iOS caveat:** Maestro can't toggle the simulator's radios — drive
  iOS offline from the runner (Network Link Conditioner profile or a proxy); if no real offline
  condition was set, mark the iOS offline row **not-run**, never a Pass. *Oracle: spec/invariant.*
- **Install-over-upgrade (data migration)** — NOT a single flow, a runner two-step: install the
  PREVIOUS build, seed state, then install the NEW build **over it** (no uninstall) and assert the
  data migrated. iOS: `simctl install` old `.app` then new; Android: `adb install -r`. A version
  that wipes or corrupts user data on upgrade is a **Major** bug. *Oracle: invariant — "user data
  survives an in-place upgrade."*
- **Interruptions (call / alarm / low-memory).** Lower-fidelity on emulators. Where reproducible
  (Android `telnet` `gsm call`, `simctl` for some), assert the app resumes cleanly. Where the
  emulator can't reproduce it faithfully, mark **not-run** — do not assert a Pass you could not
  actually exercise (§0).

These are slower and more fragile than screen checks — rotate them into rounds rather than running
all every time; at minimum run **permissions-deny + lifecycle** each full round.

## 8. Unattended / overnight runs (owner-authorized only)

The interactive default (§0) is semi-automatic: run → propose → **wait for confirmation** before
writing statuses/bugs. Running a large checklist to completion **unattended** (e.g. overnight)
is possible but is an **explicit, owner-authorized override** of that confirm-gate — never a
silent one.

- Use the kit's recurring driver:
  [`Claude-Extra-Skills-Features/Cron-Session/recurring-driver.sh`](../../Claude-Extra-Skills-Features/Cron-Session/recurring-driver.sh)
  + its templates (`STATE.md`, `recurring-prompt.txt`, `recurring.plist`). It fires every N hours,
  makes a bounded slice of progress each fire, and self-stops (deleting its own launchd plist) at
  `STATUS: COMPLETE`. It is NOT the same as one-shot `durable-resume.sh`.
- The authorization lives in `STATE.md` (who authorized it, on what date, and the **staging/dev**
  target it may write to — never production). The per-fire prompt template re-states that **every
  never-fake-a-Pass invariant of §0 still holds verbatim**: unreached = blank not Pass, a crash =
  FAIL, a contradictory check = Comment.
- Prereqs: the [`Usage/`](../../Claude-Extra-Skills-Features/Usage/) kit (budget gate) and a Mac
  that stays awake + logged in. Full setup and the recurring-vs-one-shot distinction are in the
  [Cron-Session README](../../Claude-Extra-Skills-Features/Cron-Session/README.md).
