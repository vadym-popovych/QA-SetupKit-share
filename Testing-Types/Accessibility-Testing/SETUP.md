# Accessibility-Testing — SETUP (Claude-followable)

## Prerequisites (auto-detect)

- **Web scans:** Node + a local install NEXT TO the scan script (ESM resolves from
  the script's folder, so a scratchpad install won't be found):
  `npm i playwright axe-core && npx playwright install chromium` in
  `<Project>/Accessibility-Testing/tools/` (or any ancestor folder of it).
- **Mobile:** the App-Emulators-configurations kit (Maestro drives the app and can
  assert accessibility labels). Missing → mobile checks go needs-human.
- Strategy exists → a11y depth follows it; no strategy → scan everything reachable,
  manual pass on the owner's top-3 flows.

## Procedure

### 1. Automated scan (web) — cheap, run on ALL in-scope pages
1. Copy [`template/a11y-scan.mjs`](template/a11y-scan.mjs) →
   `<Project>/Accessibility-Testing/tools/`; fill the URL list (reuse UI-Automation's
   captured routes if the project has them) + auth mode.
2. Run: `node a11y-scan.mjs` → one JSON per page in `scans/` + a summary table
   (violations by WCAG criterion × impact).
3. **Triage before filing** (like ZAP): axe "incomplete" results are needs-review,
   not violations; duplicates across pages with a shared layout = ONE bug on the
   component, not N bugs per page (Bug-Reports dedup rule).

### 2. Keyboard & focus pass (web, agent-driven via Playwright)
Tab through each key flow: order matches visual order; no traps; visible focus ring
(`:focus-visible` styles present); Enter/Space activate; Escape closes modals and
focus RETURNS to the trigger. Script-assisted but judgment-heavy — verdicts cite the
criterion (2.1.1, 2.4.3, 2.4.7).

### 3. Semantics & visual checks
Accessible names/roles on all controls (axe catches most; spot-check custom
widgets); contrast (axe: 1.4.3); 200% zoom reflow (1.4.10); color-only signaling
(1.4.1). Screen-reader behaviour beyond names/roles → **needs-human** (empty status
+ comment, per Test-Oracles).

### 4. Mobile pass (via the emulator kit)
Maestro asserts accessibility labels on interactive elements of key flows; screenshot
review for touch-target size (≥ 44pt / 48dp) and contrast. VoiceOver/TalkBack
walkthrough → needs-human with exact instructions for the owner.

### 5. File findings
`BUG-NNN` tagged `A11Y`; severity via the Bug-Reports tree — judge by the USER GROUP
impact: keyboard trap on a core flow = whole user group blocked = **Major** (tree #2),
not Low. Every bug cites its WCAG criterion in `component` or `summary`. Copy the
filled [`template/WCAG_22_AA_CHECKLIST.md`](template/WCAG_22_AA_CHECKLIST.md) →
`<Project>/Accessibility-Testing/` as the per-round record (statuses + oracle refs).
