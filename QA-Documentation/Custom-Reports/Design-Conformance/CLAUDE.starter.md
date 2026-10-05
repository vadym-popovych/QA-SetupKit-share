# Design-Conformance — paste block for a project's `CLAUDE.md`

Copy the block below into `<Project>/CLAUDE.md` and fill the angle brackets. Delete the rows that do
not apply — an unfilled placeholder is worse than an absent line, because it reads as a fact.

---

## Design-conformance rounds (delta over `QA-SetupKit/QA-Documentation/Custom-Reports/Design-Conformance/`)

- **Discipline:** [`QA-Documentation/Custom-Reports/Design-Conformance/DESIGN_CONFORMANCE_RULES.md`](DESIGN_CONFORMANCE_RULES.md) —
  read it before a round. The report states both oracles and **never picks the winner**; impact
  ratings stay `agent-proposed` until <owner> rates them, and that warning is repeated in the message
  carrying the link.
- **Spec side (the requirement):** `<path or repo ref — e.g. epics.md @ branch/commit>`. Quote its
  acceptance criteria verbatim in findings; **never edit the spec to resolve a conflict.**
- **Design side (the deliverable):** `<how it arrives — Slack export, Figma dev-mode, prototype URL>`.
  It is **not** copied into our repo; record filename + `shasum -a 256 | cut -c1-16` in the report meta.
- **Annotations:** this project's bundle `<does / does not>` ship `data-story-id` / `data-screen-id`.
  `<If it does:>` read them with `dc-map.mjs` and treat them as the primary source — they are the
  designer's own claim. `<If it does not:>` coverage is only what was walked; say so in every round.
- **Artefacts:** `<Project>/QA-Documentation/design-review/` — `findings.json` (canon) ·
  `report.html` (a projection; never hand-edited) · `evidence/` · `story-map.json` ·
  the project's own recording script (a thin wrapper over the kit engine, never a fork).
- **Harness on this machine:** `PLAYWRIGHT_DIR=<…>` · `UI_FLOW_CHANNEL=<chrome, if the pinned browser
  revision is missing>` · tap style overridden to `<dark dot / default>` because the UI is `<light / dark>`.
- **Published at:** `<stable URL>` — rebuilds land on the **same** link. Never upload-new-and-delete.
- **Round log:** `<round n — date — scope — outcome>`.
