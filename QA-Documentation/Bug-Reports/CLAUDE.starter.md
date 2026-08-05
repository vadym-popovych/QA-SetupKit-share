# Bug-Reports starter rules — paste into YOUR workspace CLAUDE.md

## Bug reports — QA-Documentation/Bug-Reports kit
- **Home:** `QA-SetupKit/QA-Documentation/Bug-Reports/`. Bugs live as `BUG-NNN` rows in
  the team QA Sheet's `Bug Reports` tab; row shape = `QA-SetupKit/Rules-Guide/schemas/bug.schema.json`
  (canonical columns + legacy-tab mapping in the kit's `SETUP.md`).
- **Severity by the kit's decision tree** (Critical = data loss/security/money/dead
  app; Major = core or paid feature, no workaround; Medium = workaround exists /
  degradation at scale; Low = cosmetic) — quote the branch. **Severity ≠ priority:**
  agent proposes P0–P3 as a proposal; owner decides.
- **Repro discipline:** minimal numbered steps from a clean stated state; flaky =
  measured rate ("3/10"); evidence linked; unreproducible → observation, not a bug.
- **Dedup before filing:** same component + failure signature open → add occurrence
  to the existing bug, don't file. One root cause = one bug.
- **Ties:** every bug references/creates an invariant (`INV-N`, Test-Oracles); every
  fixed bug gets a regression case (Test-Cases) and re-verification with the original
  repro. **Critical → escalate to the owner immediately.**

- **Destination is the owner's call:** before filing the FIRST bug of a project, ASK
  where bugs go — the QA Sheet or the team's tracker (Redmine). **Bug-candidates
  funnel:** agent-found bugs go first into a «Bug candidates» spreadsheet in the
  project's Drive folder (Summary · Bug report · Comments · Verdict); after each run
  propose them to the owner; on approval file to the board and delete the candidate
  row; owner-rejected candidates are deleted immediately too — the doc holds only
  pending items.
- **External tracker (Redmine):** when the team runs a Redmine board, file bugs there
  in the TEAM's format via the REST API (`X-Redmine-API-Key`; tool pattern
  `redmine-bug.mjs`: create/update/comment from per-bug JSON specs). Key rules: status
  To do (Backlog only for very minor), sprint = the ACTIVE one resolved live, assignee
  by front/back responsibility (ask per project), user-perspective preconditions with
  real build version, short Actual/Expected, evidence = file-host links only (labeled,
  one per paragraph), full-text preview to the owner before every post/update, QA Sheet
  gets a `Redmine` link column. Full spec:
  `QA-SetupKit/QA-Documentation/Bug-Reports/REDMINE_WORKFLOW.md`.

Full rules: `QA-SetupKit/QA-Documentation/Bug-Reports/BUG_REPORTS_RULES.md`.
