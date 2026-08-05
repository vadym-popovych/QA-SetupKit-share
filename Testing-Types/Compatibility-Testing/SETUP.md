# Compatibility-Testing — SETUP (Claude-followable)

Prerequisites: the target matrix inputs (analytics from the owner, or market
defaults + a recorded assumption) + the drivers: Playwright (web, multi-browser via
its bundled chromium/webkit/firefox) and the emulator kit (mobile, per-OS/device
simulators).

## Procedure

### 1. Build the matrix (once per project, re-weight quarterly)
1. Ask the owner ONCE for usage data (browser/OS/device split; store version
   distribution). None available → regional market defaults, assumption RECORDED in
   the matrix header.
2. Fill [`template/MATRIX.template.md`](template/MATRIX.template.md) →
   `<Project>/Compatibility-Testing/MATRIX.md`: cells × usage % × tier
   (T1 ≥10% or business-critical / T2 1–10% / T3 <1% supported / OUT unsupported).
3. OUT cells: verify the DECLARED behaviour (upgrade prompt / graceful error), then
   never test them again until the strategy changes. Owner signs the matrix (🟡).

### 2. Wire execution per tier
- **Web:** Playwright config with one project per T1/T2 browser (+ viewport presets
  for screen classes); the SAME specs/checks run per project — no per-browser tests.
- **Mobile:** emulator kit boots min-supported OS + latest, small + large device per
  T1; the SAME Maestro flows run per boot target.
- **Visual:** per-cell baselines ONLY for T1 (each baseline is maintenance — the
  Visual-Regression rule).
- **Depth per tier:** T1 = full checklist/case pass · T2 = smoke + risk ≥ 7 flows ·
  T3 = boots-and-renders check.

### 3. Triage differences (differential oracle)
T1 cells must MATCH on data and flow OUTCOMES. Behaviour difference (works in
Chrome, 500s in Safari) = bug. Look difference = triage: platform convention
(expected — note once in the matrix) vs layout break (bug). Cell named in the bug's
`component`; tag `COMPAT`.

### 4. Cadence
Full T1 pass at release-candidate; T1 smoke on new-build rounds when the change
touches rendering/platform code (RTM impact-select decides); matrix re-weight on
analytics shift — log changes in the matrix's Revision log (strategy discipline).
