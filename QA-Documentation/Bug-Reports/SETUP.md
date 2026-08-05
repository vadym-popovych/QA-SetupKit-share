# Bug-Reports — SETUP (Claude-followable)

How to file a defect. Prerequisite: the project's QA Google Sheet with a
`Bug Reports` tab (see canonical columns below; if absent, create the tab).

## The tab — canonical columns & field mapping

**New tabs** get this header row (field order of
[`Rules-Guide/schemas/bug.schema.json`](../../Rules-Guide/schemas/bug.schema.json)):

```
Bug ID | Date | Severity | Severity branch | Priority* | Component | Summary |
Steps to reproduce | Expected | Actual | Evidence | Tags | Invariant | Status | Duplicate of
```

- `Priority*` — the `*` reminds everyone it's the agent's PROPOSAL
  (`priorityProposed: true`) until the owner confirms on triage.
- **Array fields serialize into one cell:** `repro[]` → numbered lines
  (`1) …⏎2) …`); `evidence[]` → one link per line; `tags[]` → comma-separated.
- **Status casing:** the Sheet displays `Open / Fixed / Verified / Wontfix /
  Duplicate` (readable); the schema stores lowercase — scripts lowercase on read
  into JSON, capitalize on write to the Sheet.

**Legacy tabs** (created earlier by the emulator kit with
`Bug ID | Date | Screen | Check | Severity | Steps to reproduce | Expected | Actual |
Screenshot | Status`) keep working — DO NOT rebuild them. Mapping: `Screen` + `Check`
→ `component` (join as "Screen — Check"); `Screenshot` → one `evidence[]` entry.
Fields with no legacy column (severityBranch, priority, tags, invariant, duplicateOf)
go into new columns appended to the RIGHT, added lazily on first need.

## Filing procedure

1. **Reproduce before filing.** Re-run the failing action from a clean stated state.
   Flaky → measure a rate over ≥ 5 attempts. Can't reproduce at all → note it in the
   run report as an observation, not a bug.

2. **Minimize the repro.** Drop every step that isn't needed for the failure. State
   build/env/account explicitly (never paste live tokens).

3. **Dedup search.** Read the existing `Bug Reports` tab: same component + same
   failure signature open? → add an occurrence note (run id, rate, evidence link) to
   THAT bug and stop. See the dedup rule in [`README.md`](README.md).

4. **Severity via the decision tree** ([`README.md`](README.md)) — quote which branch
   fired in the report. Propose priority (severity × strategy-risk centrality) marked
   as a proposal.

5. **Build the schema-valid object** (shape: [`template/bug.example.json`](template/bug.example.json)),
   validate: `node QA-SetupKit/Rules-Guide/schemas/validate.mjs QA-SetupKit/Rules-Guide/schemas/bug.schema.json <file>`.
   Then append the row to the `Bug Reports` tab (next `BUG-NNN`).

6. **Link back from the origin:** failed checklist row gets a `=HYPERLINK(...)` to the
   bug (existing checklist convention); run reports list the bug in their LINKS
   section; run-result JSONs carry it in `bugs[]`.

7. **Invariant check** (Test-Oracles): reference the violated `INV-N` or add the
   missing invariant to `<Project>/Test-Oracles/invariants.md`.

8. **Escalation:** severity **Critical** → tell the owner IMMEDIATELY in the session
   (don't wait for the end-of-run report). Security-tagged bugs follow the
   Security-Testing kit's reporting rules (no live tokens in the sheet, ever).

## On fix

Bug marked fixed → verify with the original repro on the fixed build → `status:
verified` + note the build; then create the regression test case tracing to the bug
(Test-Cases rules) so it can't return silently.
