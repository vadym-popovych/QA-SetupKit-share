# Visual-Regression-Testing — SETUP (Claude-followable)

## Prerequisites
- Node + a local install next to the script (ESM resolves from the script's folder):
  `npm i playwright pixelmatch pngjs && npx playwright install chromium` in
  `<Project>/Visual-Regression/tools/` (or any ancestor folder of it).
- Mobile: emulator kit (Maestro `takeScreenshot`) — the diff step is identical.
- A strategy (which screens are worth baselining) — else owner's top screens.

## Procedure

### 1. Make capture deterministic (do this FIRST — flaky diffs kill the practice)
- Fixed viewport (e.g. 1440×900) + `deviceScaleFactor: 1`.
- Disable animations/transitions (inject `*,*::before,*::after{animation:none!important;transition:none!important}`).
- Wait for fonts (`document.fonts.ready`) and network idle.
- Freeze dynamic data: seeded test accounts (Test-Data kit), mock the clock if the
  UI shows time, hide genuinely-variable regions with a mask list (selector array in
  the script).
- Same OS/browser for baseline and runs (pin in `BASELINES.md`).

### 2. Capture + diff
Copy [`template/visual-diff.mjs`](template/visual-diff.mjs) →
`<Project>/Visual-Regression/tools/`; fill PAGES (reuse UI-Automation routes), MASKS,
THRESHOLD. Run modes:
- `node visual-diff.mjs --baseline` → (re)writes `golden/` — ONLY on owner approval.
- `node visual-diff.mjs` → captures `current/`, diffs vs `golden/`, writes `diff/`
  PNGs + `report.json` (page, changedPct, verdict).

### 3. Triage each over-threshold diff (a human LOOKS at the image)
- **Intended** (redesign shipped): owner confirms → re-baseline that page; log to
  `BASELINES.md` (page, build, date, approver). Never re-baseline to green a diff
  without that confirmation — that's fabricating a Pass (Test-Oracles rule).
- **Unintended:** `BUG-NNN` tagged `UI`, diff PNG + both screenshots as evidence.
- **Noise** (fonts/animation/data): fix determinism (step 1), re-run — don't raise
  the threshold to hide it.

### 4. Wire into rounds
new-build playbook: run the diff on changed areas + risk ≥ 7 baselines each round;
release-candidate: full baseline set. Results land in the round's plan Results +
run report LINKS (report.json + diff folder).
