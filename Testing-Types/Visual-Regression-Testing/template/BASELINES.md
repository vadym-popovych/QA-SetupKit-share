# <Project> — visual baseline log

> Copy to `<Project>/Visual-Regression/BASELINES.md`. **The audit trail for every golden master.**
> A baseline changes only on an OWNER-approved change, recorded here in the SAME action that
> re-records it. A silent re-baseline is a fabricated Pass (VISUAL_REGRESSION_RULES) — this log is
> what makes "silent" impossible.

## Why an approval log at all

A red visual diff means one of two things, and they are opposite:
- a **bug** — the UI changed by accident → file it, do NOT touch the golden; or
- an **intended change** — the design moved on → the owner confirms, THEN the golden is
  re-recorded and a row is added below.

Re-recording a golden to make a diff go green *without* deciding which of those it was is the
whole failure this kit exists to prevent. `visual-diff.mjs --baseline` refuses to run under CI
for exactly this reason (no owner is present to approve).

## How to re-baseline (owner-approved)

1. Confirm the diff is an **intended** change, not a bug (look at `diff/<page>.png`).
2. Re-record: `node tools/visual-diff.mjs --baseline` (locally, never in CI).
3. Add a row here in the same commit, naming the build and what changed.

## Log

| Date | Page(s) | Build | Why the golden changed | Approved by |
|------|---------|-------|------------------------|-------------|
| \<dd/mm/yyyy\> | \<slug\> | \<build\> | e.g. "hero CTA restyled per Figma v3 — intended" | \<name\> |

## First baseline

The very first `golden/` capture for a project is not a "change" — record it once here as the
starting point (page list + build + date), so every later row is a diff against a known origin.
