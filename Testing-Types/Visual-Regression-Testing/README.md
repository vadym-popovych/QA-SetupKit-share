# Visual-Regression-Testing kit

Home for **visual regression QA** — catching unintended UI changes by diffing
screenshots against **golden-master baselines** (the golden-master oracle from
[Test-Oracles](../../Testing-Planning/Test-Oracles/README.md), applied to pixels). Complements the
checklist: a checklist row says "matches Figma" at creation time; visual regression
says "hasn't drifted since the build we blessed".

## How it works — 3 steps, all scriptable

1. **Capture:** Playwright screenshots of each page/state (web — reuse the
   UI-Automation routes/locators) or simulator screenshots via the emulator kit
   (mobile — Maestro's `takeScreenshot` in flows). Deterministic capture is the hard
   part: fixed viewport, fonts loaded, animations disabled, dynamic data frozen
   (seeded test data / mocked clock) — otherwise diffs are noise.
2. **Diff:** `pixelmatch` (zero-config, npm) against `golden/` baselines →
   per-page diff PNG + changed-pixel %. Threshold per page (default 0.1%): below →
   pass; above → a human LOOKS at the diff image.
3. **Verdict:** intended change (owner confirms) → update baseline (note build+date —
   Test-Oracles golden-master discipline, NEVER silently re-record); unintended →
   `BUG-NNN` tagged `UI` with the diff PNG as evidence.

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | Capture+diff setup, determinism checklist, baseline lifecycle |
| [`VISUAL_REGRESSION_RULES.md`](VISUAL_REGRESSION_RULES.md) | Reusable rules |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Paste block for a teammate's workspace `CLAUDE.md` |
| [`template/visual-diff.mjs`](template/visual-diff.mjs) | Capture + pixelmatch diff script (parameterized) |

## Where results go

`<Project>/Visual-Regression/`: `golden/` (blessed baselines + `BASELINES.md` log:
what, build, date, who approved), `current/` + `diff/` per run (gitignored),
run summary in the round's report. Baselines are also golden-master artefacts in
Test-Oracles terms — `<Project>/Test-Oracles/golden/` may symlink or point here;
ONE copy, the visual kit's folder is canonical for screenshots.

## Scope discipline

Follows the strategy: baseline the risk ≥ 7 screens/states first; a full-app baseline
set is cheap to capture but expensive to MAINTAIN (every intended redesign touches
it) — don't baseline what nobody would act on.
