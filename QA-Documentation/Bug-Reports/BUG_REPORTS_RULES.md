# Bug-Reports rules (paste into your workspace CLAUDE.md)

Reusable rules for defect reporting. Machine-specific paths do NOT belong here.
Mirror new rules of this kind here (+ into `CLAUDE.starter.md` and the workspace
`CLAUDE.md`) so they travel with the kit.

- **Severity by decision tree, not vibes** (tree in the kit README): Critical =
  data loss / security / money / app dead for all; Major = core or PAID feature
  broken, no workaround; Medium = broken with workaround / non-core / degradation at
  scale; Low = cosmetic. Quote which branch fired. Security findings may use
  High/Info per the Security-Testing scale.

- **Severity ≠ priority.** QA sets severity (objective); the owner sets priority
  (business). The agent proposes P0–P3 explicitly AS a proposal.

- **Repro or it didn't happen:** minimal numbered steps from a clean stated state
  (build, env, account); expected vs actual separately; flaky bugs carry a measured
  rate ("3/10"), never "sometimes"; every claim linked to evidence. Unreproducible →
  run-report observation, not a bug.

- **Dedup before filing:** same component + same failure signature already open →
  add an occurrence (run id, rate, link) to the existing bug instead of filing.
  Wrongly filed → `status: duplicate` + `duplicateOf`. One root cause = one bug.

- **Every bug ties to an invariant** (`invariantViolated: INV-N`, or add the missing
  invariant — Test-Oracles rules) and, once fixed, gets a **regression test case**
  tracing to it (Test-Cases rules). Fixed → re-verify with the ORIGINAL repro on the
  fixed build before `verified`.

- **Critical → escalate immediately** in-session, not in the end-of-run report.

- **Canonical home = the team QA Sheet's `Bug Reports` tab** (`BUG-NNN` incrementing);
  the schema (`QA-SetupKit/Rules-Guide/schemas/bug.schema.json`) defines the row shape (canonical
  columns + legacy-tab mapping in the kit's `SETUP.md`); scripts build rows
  from schema-valid objects. Never paste live tokens/creds into the sheet.

## A shared link survives every rebuild

Universal invariant (Project-Configuration rule 10, owner's rule 15/07/2026): updating this
kit's artifact must keep the link the owner already shared. For this kit: generated bug tabs are recreated under a FIXED sheetId (gid), so #gid= links in tickets and chats survive; evidence files are re-uploaded onto the SAME Drive fileId (files.update), never as new-file-plus-trash.
Trash-and-recreate looks identical in the UI and silently kills every saved link; if a
carrier genuinely cannot keep its link, say so in the hand-over message.
