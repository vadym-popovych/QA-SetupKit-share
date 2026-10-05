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

## House wording — one sentence shape for Summary, Actual and Expected (owner, 17/08/2026)

The owner reads dozens of these; a bug is scanned by its first line, so the first line must carry the
whole finding. Write **Summary, Actual result and Expected result in the SAME shape**:

**What? · Where? · When?** — and drop "when" if the defect is a state rather than a reaction:

- action-triggered → *"Tipping Guide's login page is opened after clicking on the "Set Up Reminders"
  and "Contact Us" buttons"*
- state → *"The "Set Up Reminders" and "Look Up the Moon" buttons aren't shown according to design on
  the Home page"*

Rules that follow from it:
- **Expected is the same sentence with the right outcome**, not a wish or an instruction —
  *"Appropriate own site pages are opened after clicking on the …"*. Never "should be" phrasing.
- **Actual repeats the Summary** and then adds only the measurements that back it (px, ratios,
  counts). No restating the steps.
- **Name the thing the user sees** — button labels, menu items, page names in quotes. Not selectors,
  not class names; those belong in Notes when a dev needs them.
- **Notes are for what the reader cannot see in the report:** a designer decision to confirm, a link
  to the design node, a dependency on another bug. **Not** for node-ids, "measured not eyeballed",
  the evidence file's storage path, or anything about OUR tooling (how the shot was produced, what a
  marker in a recording means) — the owner strikes all of those out. The ticket describes the
  product, never the harness.
- **A design deviation carries a link to the design node** as its own Notes bullet
  (`…/design/<fileKey>/<Name>?node-id=<n-n>`), pointing at a node the REST API resolves — an
  instance's inner child usually does not, so link the frame that contains it.

## Evidence — show the cause, and show the intended state

- **One primary item, chosen by the bug's shape** (canon: EMULATOR_RULES §3.7c): steps or a
  change over time → one video; a static state the design shows correctly → one collage (design
  green | app red); otherwise one annotated screenshot. Raw exploration captures never go into
  a report.

- A click that leads somewhere wrong is **two panels and an arrow**: the control (green) → the page
  that opened (red). Two screenshots without the arrow only say "here are two screens".
- A deviation from a design is **site | design**, cropped to the same region at the same scale, red
  on what is, green on what was meant. Build it with
  `Testing-Types/App-Emulators-configurations/template/tools/collage.py`; get the design side as a
  FILE with `Testing-Types/Web-Testing/template/tools/figma-export.mjs` (the Dev Mode MCP renders
  into the conversation, which a collage cannot consume).
- Frame coordinates come from the DOM (element bounding boxes), never from eyeballing a screenshot.

## The bug-candidates sheet — format and field rules

The funnel is ONE spreadsheet «<Project> — Bug candidates» with two tabs, built and kept by
`template/tools/bug-row.mjs <ssid> <specDir> --candidates` (the rows are a PROJECTION of the
`<id>.candidate.json` specs — never hand-edit A–C, fix the spec and re-run).

| Col | Header | Written by | Rule |
|---|---|---|---|
| A | Summary | tool, from spec | `<id> — <subject>`, bold; the upsert key |
| B | Bug report | tool, from spec | the full ticket text in one cell: Preconditions · Steps · Actual · Expected · evidence labels AS links · Notes. Preconditions name the build it was seen on (`<flavour> @ <commit>`), updated on every re-check |
| C | AI Comments | tool, from `spec.comments` + `spec.recheck` | the agent's column: proposed priority **in the tracker's own scale** (Redmine: `Low · Normal · High · Urgent · Immediately` — owner, 30/09/2026; the same value sits in the spec's `priority`, so it lands on the ticket as proposed), `layer`, open questions, every re-check with its build and date; AMBER with a ⚠ first line when a re-check disagrees with the owner's verdict |
| D | Verdict | **the owner** | dropdown + colour chips. Written by the tool only on a new row (`Proposed`) or an empty cell; the one agent-set value is `Not reproduced/Fixed`, and only over `Proposed` |
| E+ | Owner's Comments (and any column he adds) | **the owner** | never written by any tool |

- **Verdict dictionary:** `Proposed` (new, awaiting the owner) · `Approved` (file it — still only
  on his explicit «post») · `Rejected` (moved to `Rejected Bugs`, see below) ·
  `Not reproduced/Fixed` (a re-check on a newer build no longer shows it — spec
  `"verdict": "Not reproduced/Fixed"` + a C comment naming build and date; owner, 29/09/2026). An
  owner who uses his own words or palette keeps them — the tool extends the dropdown to the union
  and adds a chip only for a value that has none (e.g. one owner's `Pending review` `#FFE599` ·
  `Approved` `#B7E1CD` · `Rejected` `#C27BA0`, 17/08/2026). Validation and chips cover the WHOLE
  column with headroom (`D2:D400`).
- **Why D and E are fenced:** a rerun once reset every owner verdict to `Proposed`; they came back
  only from Drive revision history. `ownerDKept` in the tool's output counts the rows left alone —
  it must equal the number of rows that already had a verdict.
- **A re-check never overrides the owner — it flags him (owner, 29/09/2026).** Re-checks are
  recorded in the spec as `"recheck": { "result": "not-reproduced" | "reproduced", "build":
  "<flavour> @ <commit>", "date": "dd/mm/yyyy" }`. Then:
  1. verdict still `Proposed` (or empty) + not reproduced → the tool sets `Not reproduced/Fixed`;
  2. verdict the owner chose (`Approved`, or any word of his) + not reproduced → his verdict stays;
     **C turns amber and opens with `⚠ NOT REPRODUCED on <build>, <date> — your verdict: <v>,
     needs your decision`**; a `Rejected` verdict raises no flag (nothing is lost);
  3. verdict `Not reproduced/Fixed` + reproduced again → same amber flag, `⚠ REPRODUCED AGAIN…`;
  4. every flagged row is listed in the tool's `needsOwner` output, and **the agent names each one
     in the same message as the sheet link** («C-4: you set Approved, but on <build> it no longer
     reproduces — close or file?»);
  5. **a flagged `Approved` row is NOT filed** even inside a batch «post» — the agent asks about it
     on its own first; filing an already-fixed bug is noise for the team;
  6. the flag clears by itself on the next run once the owner changes the verdict (or the re-check
     result changes) — he never has to edit C;
  7. **a re-check the OWNER asked for** (he could not reproduce it — his Owner's Comments say so):
     the spec's `recheck` gets `"ownerAsked": true` and a one-line `note` on HOW it was reproduced
     (build, account state, exact screen). Reproduced → C turns ROSE and opens with
     `RE-CHECKED ON YOUR REQUEST — REPRODUCED on <build>, <date>: <how>`; not reproduced → the
     ordinary not-reproduced path (1–2). When the re-check narrows the defect (part of it turns out to
     match the design, say), the spec is narrowed in the same pass — subject included; rows are
     matched by candidate ID, so a new subject updates the row rather than duplicating it;
  8. a bug ALREADY on the board has left the funnel: the re-check uses the ORIGINAL repro and the
     agent drafts a ticket comment ("not reproduced on <build>"), posted only on the owner's «post».
- **`Rejected Bugs` tab** (fixed gid 900002): every run MOVES each `Rejected` row there — whole row,
  formatting, links and the owner's comment — and deletes it from the funnel; a spec whose row sits
  there is never re-appended. The funnel tab holds only open items. (Replaces the 12/07 "delete
  rejected rows": the owner's reason is worth keeping.)
- **`Board checklist` tab** (fixed gid 900003, owner format 30/09/2026): the open candidates as
  paste-ready lines for a team that tracks bugs as a numbered checklist inside one tracker task —
  `N. *[<App | BE | App/BE> - <Story x.y or the broken area>]* <summary> *Screenshot:* <url>`
  (`*Screen record:*` when the primary evidence is a video). The summary is English and answers
  What? Where? When?; the platform is `App/BE` whenever the side is not certain. Source: each
  spec's `boardLine` {platform, area, summary}; left out are Rejected, `Not reproduced/Fixed` and
  specs marked `onBoard` (already a point in the tracker — name it, e.g. `"#<task> point 15"`); a
  `boardOverlap` spec (a point covers part of it) stays in the list with its line narrowed to the
  uncovered part. AI Comments open with the board status on every matched row — `ON BOARD — …`,
  `PARTLY ON BOARD — …` or `NOT ON BOARD YET` (matching method: REDMINE_WORKFLOW, checklist format).
  Columns: `ID · Checklist item · AI Comments · Verdict · Owner's Comments` — the same ownership
  as the funnel (C the agent's, with the same amber ⚠ flags; D and E the owner's), and the
  evidence URL in the item is a live link. **Verdict and Owner's Comments are synced by ID between
  the two tabs:** a verdict the owner sets in either tab reaches the other where that one is still
  empty / `Proposed` (at the start of the run, so a `Rejected` set on the list is archived the same
  run); an empty Owner's Comments is filled from the other tab; two DIFFERENT non-default verdicts
  are never resolved by the tool — the list row keeps its own, its C turns amber with
  `⚠ VERDICTS DIFFER BETWEEN TABS…`, and it is reported in `needsOwner`. The tab is rebuilt on every
  run under the same gid; owner values survive because they are carried over by ID. Only column B
  is pasted into the tracker.
- **Approved rows** go to the board only on the owner's explicit «post»; after filing, the row
  leaves the funnel (REDMINE_WORKFLOW).
- **Evidence in B** follows EMULATOR_RULES §3.7c: ONE primary item per bug (a video for steps, a
  design|app collage for a static state the design shows, otherwise one annotated still); raw
  exploration captures never appear.
- **URLs written through the API are inert text.** Sheets auto-links what a human types, not what a
  script writes — emit `textFormatRuns` with a `link` over every URL, or the evidence link looks
  clickable and does nothing.

## A shared link survives every rebuild

Universal invariant (Project-Configuration rule 10, owner's rule 15/07/2026): updating this
kit's artifact must keep the link the owner already shared. For this kit: generated bug tabs are recreated under a FIXED sheetId (gid), so #gid= links in tickets and chats survive; evidence files are re-uploaded onto the SAME Drive fileId (files.update), never as new-file-plus-trash.
Trash-and-recreate looks identical in the UI and silently kills every saved link; if a
carrier genuinely cannot keep its link, say so in the hand-over message.
