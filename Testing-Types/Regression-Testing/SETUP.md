# Regression-Testing — SETUP (Claude-followable)

Prerequisite: the artefacts the selection reads — `cases/*.json` (Test-Cases),
`invariants.md` (Test-Oracles), RTM/coverage (Traceability), visual baselines
(Visual-Regression). Missing pieces shrink the selection honestly (report what the
regression pass could NOT include and why).

## Build the regression view (per round — it's a query, not a document)

1. **Core:** all `TC-NNN.json` with `traceability.bug` set (bug-derived — the
   schema field IS the mechanical selector) + all `priority: High` cases + the
   invariant list.
2. **Impact slice:** changed areas for this build (changelog/PR → RTM units, same as
   the new-build playbook step 2) → their cases + visual baselines + checklist
   pages.
3. **Cadence slice:** cases demoted to release-only (see retirement below) join only
   in release-candidate rounds.

Record the selection in the round's plan file: the `Regression` column of the
selection table + the "Regression view for this round" subsection (core / impact /
cadence with TC-ids — both in `TEST_PLAN.template.md`). That's the whole
deliverable; execution proceeds per the ordinary kits.

## Fix verification (the tightest loop)

`verified` is owned by the Bug-Reports kit: bug marked fixed → re-run the ORIGINAL
repro on the fixed build → green = `status: verified` + build noted. In the SAME
round this kit then: (a) ensures the regression case exists (create it now if
missing, per Bug-Reports "On fix"), (b) runs it, and (c) runs sibling cases of the
same component. Any red anywhere → reopen (`status: reopened`), comment with the
diff from the original failure (reopen rate feeds Reporting-and-Metrics).

## Suite hygiene (do this at release close, 15 min)

- **Demote by evidence:** case green ≥ 6 consecutive runs on an unchanged area →
  set `cadence: "release-only"` in the case JSON (schema field, validate on write).
  Evidence = per-case `results[]` in the run-result files (count consecutive `pass`
  across the last runs touching the area); runs that don't record `results[]` can't
  evidence a demotion — then it's a manual owner-confirmed call, noted in the plan.
  Never delete silently.
- **Flaky quarantine:** intermittent case → fix within one round or set `status:
  draft` + file a bug ON THE TEST; quarantined cases are listed in the cycle summary
  (they are coverage holes, not solved problems).
- **Consolidate duplicates:** recurrence of a known bug strengthens the EXISTING
  case (extra assertion/step), no near-twin cases.

## Wiring into playbooks

Both playbooks name this kit explicitly: new-build step 2 uses the regression view
(core + impact slice) to define the re-run subset and step 5 runs the fix-
verification loop; release-candidate step 3 runs the core + this-cycle
re-verification + Medium-priority cases everywhere + the full visual baseline set. No new playbook
needed — this kit is the selection function those steps call.
