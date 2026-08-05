# Bug summary — CLAUDE.md starter block

Paste into your `CLAUDE.md`. Full rules:
[`QA-Documentation/Custom-Reports/Bug-Summary/BUG_SUMMARY_RULES.md`](BUG_SUMMARY_RULES.md) ·
canonical Sheet: [`SHEET_TEMPLATE.md`](SHEET_TEMPLATE.md).

---

## Bug summary (bugs FOUND, per module) — QA-SetupKit

- **Home:** `QA-SetupKit/QA-Documentation/Custom-Reports/Bug-Summary/`. Triggers — *"roll up all the bugs
  we found"*, *"bug summary across the sites"*, *"how many bugs and what severity, by module"*,
  *"import this bug sheet and rebuild it"* → [`SETUP.md`](SETUP.md) + [`BUG_SUMMARY_RULES.md`](BUG_SUMMARY_RULES.md).
- **What it is:** a **retrospective roll-up of the bugs FOUND** during an engagement — how many, at what
  severity, broken down by module. **A report, not a tracker:** the bugs are usually fixed and closed by
  the time anyone reads it. The headline is `Total count of issues (All modules)`. It does **not** replace
  a bug RECORD (repro/expected/actual/evidence) — that is owned by Bug-Reports; this document *counts*
  those records, and when the two disagree **the record wins**.
- **The flow:** `bug-summary.json` (schema `Rules-Guide/schemas/bug-summary.schema.json`) →
  `tools/bs-sheet.mjs` → the `Statistic` tab. Get the JSON from kit bug records (`bs-from-bugs.mjs`), from
  an existing sheet (`bs-import-sheet.mjs` — **read-only on the source**), or from a tracker export.
  Artefacts → `<Project>/QA-Documentation/bug-summary/`.
- **REPRODUCE, DON'T REDESIGN.** The default output is the owner's document — columns, palette, fonts,
  borders, per-module numbering that restarts at 1, formulas. Every kit addition is an **opt-in flag**, off
  by default: `BS_STATUS_COLUMN` (a Status column + derived Left-issues list — only for a summary being
  WORKED, never a closed engagement) · `BS_ID_COLUMN` · `BS_PAGE_TOTALS` · `BS_RECONCILE` · `BS_CELL_NOTES`.
- **Every count is a formula**, never a typed number: `COUNTIF` per module, per site, and the grand total.
  A typed number looks identical and stops being true the moment the next row is added.
- **`severityScale` is the CLIENT's scale and it drives the geometry** — one counter column per value, the
  same trick as `PLATFORMS` in the checklist. Reproduce it, never silently remap it. A severity outside it
  is counted by no column, so the builder **refuses to build**.
- **Rating severity has a PLAYBOOK — read it before rating anything:** [`SEVERITY_PLAYBOOK.md`](SEVERITY_PLAYBOOK.md).
  The tracker has NO severity field, so if the agent rates, then every count in the document is built out of
  the agent's judgement. The kit's default scale is **stricter** than the generic tree (a blocked core flow
  with no workaround is `Critical`, not `Major`; **any** payment/subscription failure is `Critical`), and a
  project may override it with its own `severity-rubric.md` — that one wins. **The definitions the Sheet
  shows on hover ARE the criteria you rated with**: if they disagree, the owner and the agent will disagree
  forever without finding out why.
- **IN DOUBT → LOOK AT THE EVIDENCE, then rate.** A severity is a judgement about CONSEQUENCE (does it hide,
  cut, block, corrupt?) and the bug's one line very often does not say. *"The name isn't shown
  according to design"* — clipped text (`Minor`) or a different font (`Trivial`)? The sentence cannot tell
  you; the screenshot can. Use [`bs-evidence.mjs`](template/tools/bs-evidence.mjs) — none of these hosts serve
  the image at the link you were given (prnt.sc → `og:image`; monosnap/screencast → render the page; Dropbox
  → a **recording**: the tool tiles it into a contact sheet, the browser decoding it). **Never settle a
  borderline severity from the wording alone.** A contact sheet settles the SEQUENCE (redirects, error
  states, what was lost, how long a broken state lasts) — it does **not** settle SMOOTHNESS: for a jitter
  bug, say the stills cannot settle it rather than inventing a severity from a grid.
- **ASK FOR VALIDATION, EVERY TIME.** If any severity is `agent-proposed`, say so **in the message where you
  hand over the link** — *"N of M severities are mine, not yours; every count is built out of them; validate
  them before this goes outside the team"* — and repeat it on every rebuild until `severitySource` says
  `owner`. A warning nobody is pointed at is a warning nobody reads. Impact is the owner's call: the agent
  proposes the branch, the human confirms the sensitivity. Owner calibration that differs from the tree's
  defaults gets written into `severity-rubric.md` beside the summary, so the next round proposes it his way.
- **SEVERITY PROVENANCE — the tracker has no severity field.** A human assigns it, or an agent proposes it,
  so every row records `severitySource` (`owner` / `tracker` / `agent-proposed`) + `severityRationale` (the
  branch of the severity decision tree). An agent-proposed severity is a **hypothesis, and every statistic
  in the document is built out of it** — it is noted on its own cell, counted on the Severity header, and
  warned about on every build. A machine's guess must never pass as triage.
- **Colours are configuration, not data.** One conditional-format rule per severity value (`SEVERITY_COLORS`
  in the tool / env). An **empty** severity cell goes grey — a row with no severity is counted by *no*
  column, so grey is what stands between it and a silent under-report. Do not try to colour it by hand:
  Sheets' **dropdown-chip colours are not exposed by the API**, a conditional format **overrides a manual
  fill**, and **a rebuild rewrites every format on the tab**.
- **Row heights are computed from the text** so a bug summary is readable in full. `autoResizeDimensions`
  does *not* fit wrapped text through the API, and a row with no height collapses to a sliver — both dead ends.
- **Placing bugs into modules has a PLAYBOOK — follow it, do not improvise:**
  [`PLACEMENT_PLAYBOOK.md`](PLACEMENT_PLAYBOOK.md). The cascade, weakest step last, and every row records
  which one placed it (`moduleSource`): owner's `MODULE_MAP` → the container's subject → the issue's own
  subject → the parent (**never** a QA activity like *"Smoke/Regression testing"*) → **the bug's own wording**
  (only when it names EXACTLY ONE place; *"on the List and Detail screens"* names two → ambiguous) → **an
  agent reading it and deciding** (`agent-placed` — a judgement, not a fact) → `General`.
  **Place it where the defect BREAKS, not where it came from.** A bug in the WRONG module is worse than a bug
  in no module: it corrupts a number a human will act on, while looking perfectly healthy.
- **A bug the source cannot place goes to `General` — never dropped.** Dropping it under-reports the grand
  total, which is the one number the document exists to produce (the first Redmine import said 139 when 216
  had been found). `General` is flagged `unplaced: true`, renders **LAST within its site**, and is **scoped
  to its own site** — a multi-site document gets one `General` per site, never a shared bucket. It is a
  **debt, not a module**: it should shrink between editions.
- **A row with no evidence is an observation, not a demonstrated defect.** **Evidence rots:**
  `screencast.com` / `prnt.sc` / personal Dropbox links are flagged `expiring` — when the link dies the bug
  is unprovable and the row becomes a number nobody can check.
- **A reference document someone hands you is READ-ONLY.** Import it, build beside it, never point a
  generator at it.
