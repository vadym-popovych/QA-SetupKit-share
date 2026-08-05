# Compatibility-Testing kit

Home for **compatibility QA** — verifying the app works across the browsers,
devices, OS versions, and screen classes users actually have. The discipline is
90% MATRIX MANAGEMENT (what to cover, prioritized by real usage) and 10% execution
(the same checks other kits define, re-run per matrix cell).

> **The anti-pattern this kit exists to prevent:** "tested on the developer's
> MacBook Chrome + one emulator" shipped as "works everywhere". The matrix makes the
> claim honest: which cells were tested, at what depth, which are declared
> out-of-scope — same skips-are-recorded ethos as everything else.

## Building the matrix (usage-driven, not exhaustive)

1. **Sources for weights:** analytics (owner supplies — browser/OS/device split),
   store dashboards (iOS/Android version distribution), market defaults for the
   target region when no analytics exist (note the assumption).
2. **Cells:** browser×version (web: last-2 Chrome/Safari/Firefox/Edge + the analytics
   tail), OS×device-class (mobile: min-supported OS + latest, small + large screen;
   the emulator kit's simulators/AVDs define what's runnable locally).
3. **Tiers:** T1 (≥10% usage or business-critical — full checklist pass) ·
   T2 (1–10% — smoke + risk ≥ 7 flows) · T3 (<1%, supported — render-check only) ·
   OUT (unsupported — declared in the strategy, error page/upgrade prompt verified).

## Execution per cell (reuse, don't reinvent)

Playwright projects (chromium/webkit/firefox + viewport presets) re-run the SAME
web checks per browser; the emulator kit boots per-OS/device simulators for the SAME
Maestro flows; visual baselines get per-cell variants ONLY for T1 (maintenance cost).
Differential oracle applies: T1 cells must MATCH each other on data/flow outcomes
(differences in look are triaged; differences in behaviour are bugs).

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | Matrix construction + per-tier execution wiring |
| [`COMPATIBILITY_RULES.md`](COMPATIBILITY_RULES.md) | Reusable rules |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Paste block for a teammate's workspace `CLAUDE.md` |
| [`template/MATRIX.template.md`](template/MATRIX.template.md) | The compatibility matrix skeleton |

## Where results go

Findings = `BUG-NNN` tagged `COMPAT`, cell named in `component`
(`Safari 17 / iPhone SE: checkout button unreachable`). Filled matrix + per-cell run
notes → `<Project>/Compatibility-Testing/`. The matrix is re-weighted when analytics
shift (quarterly or on owner signal) — log changes like strategy revisions.
