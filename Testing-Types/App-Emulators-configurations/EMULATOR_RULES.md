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
   **Take the box from the CAPTURED HIERARCHY, not from eyeballed pixels** —
   `template/tools/annotate-from-hierarchy.mjs` matches an element by its visible text in the
   `.json` dump that `probe.sh` saved beside the screenshot, converts the node's bounds from
   points to image pixels (the scale comes from the dump's own root node, so it is right on any
   device class), and draws the rect and the arrow through `annotate.py`. A box drawn by hand is
   wrong the next time the layout shifts and cannot be regenerated; this one can. It refuses
   loudly when nothing matched, which is itself useful — a selector that matches nothing is
   usually a sign the screen is not the one you think it is. Fall back to an explicit `rect`
   (in points) only for something the tree does not expose, such as a decorative placeholder.
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
7b. **A bug whose point is a SEQUENCE is recorded, not screenshotted (Vadym, 22/09/2026):**
   "confirm → nothing happens", "set it → go back → it is gone", "retry → fails again" cannot be
   proved by stills — a reader cannot tell a missing step from a missing frame.
   `template/tools/record-repro.sh <flow.yaml> <name> [udid]` starts the screen recording, drives
   the Maestro flow, and stops the recorder with SIGINT (a `kill -9` leaves an unplayable file);
   the clip lands in `runs/<date>/clips/`. **Put the assertions in the flow**, not only in the
   description: a clip whose flow asserted each state on the way is evidence that the sequence
   really happened, while a clip of an unasserted flow is just a video of someone tapping.
   Clips upload as `Screen records` through the same `--evidence` path (§6).
   **Cut the dead air before anyone sees it.** The recorder is rolling while the driver boots, so a
   raw capture opens with ~10 s of a motionless screen and the reviewer reads that as "nothing
   happens" — the owner's first remark on the first batch (22/09/2026) was exactly this.
   `record-repro.sh` therefore ends by calling `template/tools/trim-dead-air.sh`, which keeps ~1 s
   of lead-in before the first movement and 1.5 s of tail (`NO_TRIM=1` keeps the raw capture).
   It trims in up to 3 passes and re-measures each time: one stray flicker early in the capture —
   a status-bar clock tick, the driver's own first screenshot — satisfies the motion test while the
   screen is still idle, so a single measured cut can leave seconds of stillness behind. Measuring
   once and trusting it is exactly what left 2 s in the first attempt.
   **A clip shows its taps (Vadym, 05/10/2026).** The reader must see WHERE each step touched,
   the way Android's "Show taps" (and the web kit's tap dots, WEB_TESTING_RULES r.13) show it.
   The iOS simulator records none: `simctl io recordVideo` captures the device framebuffer, and
   Simulator.app's touch circles live on its window, while Maestro taps through XCTest, not the
   mouse. So both recorders (`record-repro.sh`, `record-with-network.py`) end with
   `template/tools/tap-overlay.py`, which reads every `Tapping x, y` line (wall-clock time + point)
   from Maestro's `xctest_runner_*.log` and draws a dot there on the clip (`NO_TAPS=1` skips it).
   It runs BEFORE the dead-air trim, while the clip still starts at the recorded `t0`, and
   resamples to a constant 30 fps first — simctl writes frames only when the screen changes, so a
   dot on a still screen would otherwise never be drawn. On Android turn on the platform's own
   indicator instead: `adb shell settings put system show_touches 1`. The dot is also a check of
   the flow itself: measured 01/10, a `tapOn: ".*Try again.*"` drew its dot on the error TEXT,
   not the button (the regex matched the parent node) — the retry the flow claimed never
   happened, which a tap-less clip hid.
   **Do not record a destructive repro just for the clip** — if the action is irreversible and the
   defect is that it does nothing, a re-run risks it working this time and taking the round's
   environment with it. Ask the owner first.
7c. **Evidence is CHOSEN, not accumulated — one primary item per bug (Vadym, 29/09/2026):**
   a bug report carries the ONE form that proves it, picked by the bug's shape:
   - **steps / a change over time** (recalculation after an edit, state while loading, appears →
     disappears, confirm → nothing) → **one video** of the whole repro (§7b), optionally plus one
     annotated still of the decisive frame;
   - **a static wrong state that the design shows correctly** → **one collage** (§7): the design
     panel as the reference with GREEN rect + arrows, the app/site panel with RED rect + arrows,
     in ONE image;
   - **a static wrong state with no design reference** → **one annotated screenshot**.
   **Raw exploration captures (`probe/NNN-…png`) never go into a report** — they are working
   material and stay in `runs/`. Five raw stills of different moments tell the reader to do the
   reconstruction the reporter skipped; the owner's remark that triggered this rule was exactly
   "why so many screenshots, why no video". A second item is justified only when it proves
   something the first cannot (e.g. the API response behind a backend bug).
   **How the collage is built (the method the owner approved, 29/09/2026):**
   1. **Re-check on the CURRENT build first.** Redoing evidence is a re-test: capture the app side
      on today's code, and if the defect is gone, do not make evidence — mark the candidate
      `Not reproduced/Fixed` (BUG_REPORTS_RULES, candidates sheet) with the build in the comment.
   2. **Design side — from the DOM:** `template/tools/design-rect.mjs <frameId> <out.png> "<text>"…`
      renders the frame of the HTML design export and prints each element's rect in that PNG's own
      pixels. **Read the design frame before writing the bug text** — it is the oracle, and it can
      contradict the report (measured: a "the banner should say Renew" claim that the design itself
      did not make; the claim was cut, the rest of the defect stood).
   3. **App side — from the captured hierarchy** (`annotate-from-hierarchy.mjs`, §3.5); an explicit
      rect only for an element the tree does not expose, said so in the working notes.
   4. **One image, two panels, left design / right app**, via `collage.py`: chips read
      `DESIGN — <state> (expected)` and `APP <flavour> @ <commit> — <state> (actual)`; GREEN rect +
      arrow + short label on each designed element, RED on each deviating one, labels saying what
      differs ("badge: EXPIRED" | "badge: LAPSED"), not "expected"/"actual" again.
   5. **Look at the rendered collage before uploading** — the chip must not cover the element it
      names, and every box must sit on its element.
   **How the video is made:** `record-repro.sh` over an ASSERTED Maestro flow (§7b), dead air cut,
   one clip per bug covering the whole repro from its first precondition screen; upload as
   `Screen records` (§6). The video is the primary item; one annotated still of the decisive frame
   may follow it.
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

## 5.1 Device builds, proxy builds and request-timeline clips (measured 25–30/09/2026)

All three are QA-local variants built from the git-less snapshot (§5) — never committed, never
proposed to the team without the owner — and each one says in the hand-over which build it is.

- **A build on the owner's own phone when the team's signing team is not on this Mac.** In the
  SNAPSHOT: set `DEVELOPMENT_TEAM` to the owner's Personal Team and give the bundle id a suffix
  (`<id>.<qa>`) so it installs NEXT to the team's distribution build instead of replacing it.
  Build with `xcodebuild … -destination 'id=<device udid>' -allowProvisioningUpdates
  -allowProvisioningDeviceRegistration` — **`flutter build ios` alone may embed a profile for a
  DIFFERENT device** (install error `0xe8008012`). Check `ProvisionedDevices` in
  `embedded.mobileprovision` before installing. Install over Wi-Fi with
  `xcrun devicectl device install app --device <udid> <app>`; "device is locked" / error 4016 =
  the phone is locked or on another network — retry in a loop, tell the owner. A free profile
  lasts **7 days**; first launch needs Settings → VPN & Device Management → Trust. A different
  bundle id can break social sign-in — a failure there is the workaround's, never a candidate.
  When the phone is unreachable, `-destination 'generic/platform=iOS'` still builds against the
  already-registered profile.
- **Seeing the app's own requests in Charles / mitmproxy.** Flutter's `dart:io` HttpClient
  **ignores the iOS system proxy** — only native SDK calls (Firebase, Google Sign-In) show up.
  QA proxy build = in the snapshot, give the app's single HTTP client an adapter that honours a
  `--dart-define`, e.g. for Dio:
  ```dart
  const qaProxy = String.fromEnvironment('QA_PROXY');
  if (qaProxy.isNotEmpty) {
    dio.httpClientAdapter = IOHttpClientAdapter(createHttpClient: () => HttpClient()
      ..findProxy = ((_) => 'PROXY $qaProxy')
      ..badCertificateCallback = ((_, __, ___) => true));   // QA-only: lets the proxy decrypt
  }
  ```
  then `flutter build ios --config-only … --dart-define=QA_PROXY=<host>:<port>` + xcodebuild.
  **Phone: the proxy is the Mac's LAN IP — re-read `ipconfig getifaddr en0` before every build**
  (it changes with the network, and a stale IP silently breaks every API call). **Simulator:
  `127.0.0.1`** (it shares the Mac's network — stable). Give the phone build a distinct
  home-screen name (`CFBundleDisplayName` via PlistBuddy in the snapshot; never `PRODUCT_NAME`,
  build scripts key on it) — the project records the name. Charles also needs SSL Proxying for
  the API host. The same finding seen only through the proxy build is re-checked on a normal
  build before it becomes a candidate.
- **Request-timeline clips — the screen and the requests in one video** (owner, 30/09/2026).
  For timing bugs ("spins, then errors", "slow search"), a clip without the requests cannot show
  WHO gave up. Pipeline, all in `template/tools/`:
  1. `mitmdump -p 8080 -s net-timeline-addon.py --set netlog=<run>/net-timeline.jsonl
     --set nethost=<api host>` — one JSON line per request with wall-clock start/end, status,
     bytes, and `err: "client closed"` when the APP abandoned it (a client-side timeout);
  2. the simulator build routed to `127.0.0.1:8080` (above);
  3. `python3 record-with-network.py <flow.yaml> <clip.mp4> --netlog <jsonl> --udid <sim>` —
     records, drives the Maestro flow, stops with SIGINT, keeps the requests of that window;
     **no dead-air trim here** (a cut breaks the sync); the taps are drawn in (`tap-overlay.py`, §3.7b);
  4. `python3 net-compose.py <clip.mp4> --host <api host> --timeout <client timeout s>` — app
     left, live request panel right (running timer while pending, then status + duration, a
     tick at the client's timeout). Pillow + plain ffmpeg `hstack`; no `drawtext` needed.
  Read the client's timeouts from the code first (e.g. `receiveTimeout`) — "the error appears
  after exactly N s while the request is still running" is usually that number.
  Intermittent failures are caught by looping step 3 with a new query per try and keeping only
  a clip whose timeline holds a failure. **"client closed" is not automatically a failure:** an
  app abandons requests on its own (a debounced search re-fires while the user types) — measured
  30/09: a search cancelled after 0.76 s and re-sent, 200 in 0.26 s. Only an abort at or after
  the client timeout is a timeout; `record-with-network.py --min-timeout` and `net-compose.py
  --timeout` draw exactly that line (grey "cancelled by the app" vs red "client timeout").
  **Full detail (owner, 01/10/2026):** add `--set netbodies=true -w <run>/full-dump.mitm` to
  step 1. Every line then carries the connection phases (server IP, new/reused connection,
  request fully sent, first response byte), correlation headers (`CF-RAY`, request id) and the
  first 400 chars of both bodies, and the panel shows them ("sent +0.00s · NO answer from
  server"). That turns "the app timed out" into WHERE it hung: connection up + request sent +
  no first byte = the backend does not answer (measured 01/10: fresh TLS in 45 ms, request sent,
  0 bytes in 20 s). The `.mitm` dump opens in `mitmweb -r <file>` like a Charles session, but it
  holds the account's bearer token — **it stays on the machine, it is never uploaded as
  evidence**; the clip and the JSON lines never carry Authorization or cookies.

## 5.5 Runner verdicts: never trust "no FAILED in log" alone (Vadym, 11/07/2026)

- A Maestro process can CRASH (Java stack trace, no "FAILED" text) — a log-grep-only
  check then reports a false PASS. A flow result is PASS only if BOTH the exit code
  is 0 AND the log has no FAILED lines; treat crashes as FAIL and re-run.
- Watch for false positives the other way too: a flow can "pass" its asserts while
  the intended screen was never reached (e.g. a coordinate tap missed and the final
  assert matched the previous screen). For coordinate taps, always verify the
  screenshot actually shows the target screen before marking the check Passed.

## 5.6 Driving traps: a step can report COMPLETED and have done nothing (measured 22/09/2026)

Both of these cost a working session before they were named. Both are silent: the runner
says COMPLETED, so a log-only check calls the step done. §5.5's rule generalises here —
**verify the effect, not the report.**

- **A label repeated inside one node.** Flutter/iOS commonly exposes a control's label
  twice in the same node (`"Next\nNext"`), and Maestro's `text:` matcher is a
  **full-string** regex — so `tapOn: "Next"` matches nothing and the step fails, while
  `tapOn: "(?s)Next.*"` hits it. Read the label from `hierarchy` before writing a
  selector, and use the `(?s)…​.*` form for any label the dump shows doubled. When a
  selector still misses, fall back to a point tap and verify per §5.5.
- **`inputText` can land nothing.** With a non-Latin software keyboard active on the
  simulator (the host's input source propagates), `inputText` reports COMPLETED while
  the field stays empty — and a screen whose submit button is disabled-while-empty then
  simply looks unresponsive. **Enter text through the pasteboard instead**:
  `printf '%s' "$VALUE" | xcrun simctl pbcopy <UDID>` then long-press the field →
  *Paste*. **Read the field back before submitting** — against a login form this failure
  burns real authentication attempts and can lock the account out.
- **`eraseText: N` does not reliably clear a field.** A paste after a partial erase
  merges with the remains and submits a value nobody typed. Assert the field reads empty
  first.
- **The simulator syncs the HOST's pasteboard, so the value you copied is not necessarily
  the value that pastes.** Anything the person at the keyboard copies on the Mac — a note,
  a chat line, a password from somewhere else — replaces what `pbcopy` put there, and the
  next *Paste* lands THAT into the field under test. Measured 22/09/2026: an unrelated
  paragraph copied on the host appeared in a live Google sign-in field mid-run. Two rules
  follow: keep `pbcopy` and the paste **in one command** so nothing can slip between them,
  and **reveal what actually landed before submitting** (a password field has a *Show
  password* control for exactly this). It also means a run can leak the operator's own
  clipboard into someone else's form — one more reason the value is read back, not assumed.
- **A rejected credential is a claim about the credential ONLY after the field is read
  back.** "Wrong password" and "the paste missed" look identical from the outside. Reveal
  the field, compare it against the stored value, and only then report the credential as
  wrong — and stop after two or three failures, because a shared test account that locks
  out blocks every future round, not just this one.
- **A tap by PERCENTAGE goes stale, and a missed tap is indistinguishable from a dead
  control.** Coordinates read from one `hierarchy` dump are only valid while the scroll
  offset that produced them holds; a list that settles, reflows or bounces between the
  read and the tap moves the target, and the tap lands on empty space. Nothing fails —
  the runner reports COMPLETED and the screen is unchanged, which reads exactly like
  "this control does nothing", and that is how a working control gets written up as a
  bug. Two defences: put the scroll and the tap **in the same flow** and address the
  target by `tapOn: {text: "<label>", index: N}` rather than by point, counting the index
  over what is actually on screen; and **re-read the render** after any tap that was
  supposed to change a selection. Reserve `tap-at` for controls that expose no usable
  name — some expose their *state* instead of their text (a toggle labelled `"0"`/`"1"`),
  and those cannot be selected any other way.
  **Before writing up any control as dead, run a POSITIVE CONTROL on the same screen** — tap a
  neighbouring control you already know works and check it responds. If it does, the silence you
  are looking at is a miss until re-measuring says otherwise; if it does not, the screen itself is
  not taking taps and nothing on it can be judged. Without that control step a working,
  destructive control reads exactly like a broken one, and the resulting ticket is worse than no
  ticket: it sends a developer looking for a defect that is not there, and it buries the real
  defect sitting next to it.

The scaffold's [`template/tools/probe.sh`](template/tools/probe.sh) exists for exactly this
loop — act, capture, and print the screen's own labels back — so an exploratory pass leaves
the same evidence trail a scripted round does, inside `runs/<date>/probe/` rather than
scattered across the working directory.

More traps measured 29–30/09/2026, all silent in the same way:

- **A tap lands on the bottom tab bar.** `scrollUntilVisible` stops as soon as the element is
  on screen — often UNDER a floating tab bar — and the tap opens another tab (it looked like
  "the row does nothing"). Add `centerElement: true` to the scroll before tapping a list row.
- **iOS system dialogs** ("<App> wants to use google.com to sign in") and the in-app browser are
  outside the app's tree: read them from a full-screen `simctl io screenshot` and tap by point.
- **Maestro reads a flow from a FILE** — a shell process substitution `<(…)` runs nothing and
  the probe captures whatever screen was already up. Write the flow to the scratchpad.
- **The Maestro MCP driver can lose its port** ("Failed to connect to 127.0.0.1:<port>") while
  the CLI still works — fall back to `probe.sh` / `maestro test`.
- **A simulator recording has frames only where the screen changed** — seeking past the last
  change (`ffmpeg -ss` near the end) yields nothing, and a trimmed repro can end at the last
  motion rather than at the flow's last assertion. Judge the end state from the flow's
  assertions or a final `simctl io screenshot`, not from the clip's last frame.

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
