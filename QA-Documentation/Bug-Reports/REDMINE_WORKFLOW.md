# REDMINE_WORKFLOW.md — filing bugs into a team Redmine board

How Claude files QA bugs into an external Redmine tracker in the TEAM's format,
while the internal QA Sheet stays the round journal. Established on the the team's board
(tracker.example.com, «<Project>»), 11/07/2026 — generalize per project.

## Access
- **No access configured yet (Redmine/Jira/any tracker)? Walk the owner through the
  integration setup FIRST** — the base rule for every service the agent needs but that
  isn't set up: say what's missing and why it blocks the task, then drive the flow
  yourself (create the gitignored token file + folder README, OPEN the file in the
  owner's editor for him to paste the secret — never through chat, verify with a
  whoami-style call, add the path to the encrypted-secrets backup). Same pattern as
  the checklist kit's MCP auto-detection.
- API key: gitignored `QA-SetupKit/MCP-configurations/redmine/.token` (owner pastes it
  himself — see the token-intake pattern; add the path to `backup-secrets.sh` SECRETS).
  **Prove the ignore before the paste:** `git check-ignore -v <path>` must print the matching rule;
  an unproven `.gitignore` entry is the whole leak.
- Every request: header `X-Redmine-API-Key`. Discovery before first use:
  `GET /users/current.json`, `/projects.json`, `/trackers.json`, `/issue_statuses.json`,
  `/enumerations/issue_priorities.json`, `/projects/<id>/versions.json`, `/memberships.json`,
  plus ONE sample bug of the team (`GET /issues/<id>.json`) to copy the house format.
- **A NEW project (or a subproject) → LOOK FOR IT ON THE BOARD FIRST, before asking the owner
  where its bugs go** (owner's instruction, 15/08/2026). Search `GET /projects.json?limit=100`
  by name AND by the slugified name, and try `GET /projects/<slug>.json` directly; a hit answers
  in one call what the board is, whether it is a **subproject** (`parent`), which trackers exist,
  who the members and their roles are, and **how many issues are already filed** — the last one
  is the dedup baseline, and filing without it is how a duplicate gets created on day one. Only
  when the search genuinely finds nothing is "where do bugs go?" a question worth the owner's time.

## Tool
- Reference implementation: `template/tools/redmine-bug.mjs`
  (`whoami · get <id> · create <spec.json> [--dry-run] · update <id> <spec.json> [--dry-run] ·
  comment <id> "<text>"`). Bug content lives in per-bug JSON specs
  (`<Project>/QA-Documentation/bugs/BUG-NNN.redmine.json`) — the spec is the source of
  truth; `update` rebuilds subject+description from it and PUTs ONLY those fields
  (status/assignee/sprint stay with the team's workflow).
- Redmine PUT answers 204/empty body — don't JSON-parse blindly.
- **Sheet-side twin — `template/tools/bug-row.mjs`:** renders the SAME spec into a Google
  Sheets row in the v2 one-cell format (bold section labels; each evidence LABEL is the link),
  for the `Bug Reports` tab or, with `--candidates`, the `Bug candidates` funnel (Verdict
  column). One spec → both outputs (the board ticket AND the Sheet row) — no second source of
  truth. Rows upsert by the id in column A (re-running updates in place, never duplicates); a
  placeholder evidence url renders as a bold label, never a broken link. Example specs
  (App + BE) ship as `template/bug-spec.example.json` and `template/bug-spec-backend.example.json`.

- **Bug evidence has ONE host — the file-hosting one (`MCP-configurations/mega/mega-upload.sh
  --evidence <Project> <file>`), never the document Drive** (owner's correction, 15/08/2026).
  This holds for **every** surface: the tracker ticket AND the internal review sheet cite the same
  link. The document Drive is for documents — checklists, reports, the candidates sheet itself —
  not for screenshots and screen recordings. Uploading evidence "just for the internal doc" into
  Drive splits one bug's evidence across two hosts, and the ticket then cites a link the reader
  cannot open. `--evidence` also owns the layout and the naming
  (`/Attachments/<Project>/<Screenshots|Screen records>/<dd.mm.yyyy>/`) — do not hand-roll it.
- **A bug's screenshot is an ANNOTATED copy, not a raw capture:** frame the defect
  (`Testing-Types/App-Emulators-configurations/template/tools/annotate.py`, red = actual /
  green = expected). Take the frame coordinates from the DOM — locate the element, read its
  bounding box, then draw — never by eyeballing pixels off a screenshot: a box drawn by hand is
  wrong the next time the layout shifts, and it cannot be re-generated.

## Filing rules (Vadym, 11/07/2026)
- **Status:** bug reports are created as **To do**; **Backlog** only for very minor
  bugs/improvements (explicit in the spec).
- **Sprint:** ALWAYS the currently ACTIVE sprint — resolve LIVE at creation time
  (`"sprint": "active"`), never hardcode names; no active sprint on the board → error
  out and ask, never guess.
- **Assignee by responsibility role — re-ask per project:** app/front bug → the front
  dev responsible; backend bug → the backend dev responsible. Triage heuristic: look at
  the API — response data correct but screen wrong → front; response broken/empty →
  back; app never calls the API (hardcoded mock) → front.
- **Subject prefix by defect layer (Vadym, 11/07/2026):** mobile app → `[BUG-App]`,
  backend → `[BUG-BE]`, website frontend → `[BUG-FE]` (spec field `"layer": "App|BE|FE"`;
  no layer → plain `[BUG]`). Then `<what> <where>`; add the run context when it matters
  (e.g. "… after generation during load testing"); build suffix
  `(Directly on the NN build)` when the team's build numbering applies.
- **Description (Textile), team order:** *Preconditions* → *Steps to reproduce* →
  *Actual result* → *Expected result* → screenshots → *Notes*.
  - Preconditions from the USER perspective: `Install Dev build v. <real version>`
    (from pubspec/build, never invented). Account line: specific state needed → full
    creds `Login to account <email> Password: <password>`; mocked/account-independent →
    `Login to any account or create new account`.
  - First step navigates to the screen where the repro starts (`Navigate to the Home screen`).
  - **Perspective by layer — the biggest wording rule; write for the dev who will fix it:**
    - **FE / App (both frontend):** from the USER's perspective. Preconditions = install the
      build + log in. Steps = the UI journey — "Navigate to `<screen>`, tap `<control>`, swipe
      `<area>`, open `<thing>`". Actual/Expected = what the user SEES on screen. A frontend dev
      reproduces by touching the app.
    - **BE (backend/API):** from the API perspective. Preconditions = environment + auth
      (uid / creds) + the entity ids. Steps = the exact calls — authenticate, then
      `<METHOD> /<endpoint>` (+ the request body for POST/PUT), then inspect the response.
      Actual/Expected = the RESPONSE fields (e.g. `coverUrl = null`), not a screen. A backend
      dev reproduces by calling the API.
    Same defect, two languages: give each dev the steps in the language of their tool.
    Templates: [`template/bug-spec.example.json`](template/bug-spec.example.json) (App) ·
    [`template/bug-spec-backend.example.json`](template/bug-spec-backend.example.json) (BE).
  - Actual/Expected: SHORT and precise — one fact, no "how we know" details; a technical
    tail (`bookCoverUrl … null from the API`) only when the assignee needs it.
  - For backend bugs include debug IDs (user uid, entity ids) in Preconditions/Notes,
    and write the API-perspective variant: steps = the exact GET/POST calls.
  - NO internal cross-references ("Tracked as BUG-NNN in the QA Sheet") in the ticket.
- **Bold the values that let the assignee repro on sight (Vadym, 29/08/2026) — EVERY bug,
  every layer, not just BE:** Textile `*...*` around any important data or id wherever it
  appears in the description — credentials, uids, entity/booking/order ids, error codes,
  build/version numbers, a specific field value, a screen name the dev must navigate to.
  The assignee's eye should land on the exact string to act on, not have to parse it out of
  a sentence. By analogy: every such value gets the same treatment, not just the first one
  in the ticket — App/FE bugs bold their screen names and field values the same way BE bugs
  bold their uids and entity ids.
- **Screenshots:** evidence files live on the file host (Mega
  `Attachments/<Project>/<Screenshots|Screen records>/<dd.mm.yyyy>/`), the ticket gets
  ONLY the links — each as its own bold-label paragraph, blank line between:
  `*Screenshot with response from Api:* <link>` / `*Screenshot from Application:* <link>`.
  No direct file attachments by default (the tool still supports `/uploads.json`).
- **Evidence images:**
  - API bugs: rendered request/response "screenshot" (request line + status + real JSON,
    red boxes on the offending fields, red finding chips, green Expected chip) — reference
    renderer pattern in `<Project>/…/scratchpad` sessions; regenerate from live responses.
  - Collages — ONE image instead of several links (`<Project>/Emulator-Testing/tools/collage.py`):
    backend bugs → app view + API response; frontend bugs → the buggy screen PLUS the
    design reference from Figma (red frame on the bug, green on the reference), side by
    side for app screens, stacked vertically for web pages.
- **Review gate:** after EVERY content edit show the owner the FULL bug text (not
  fragments); nothing is posted or updated on the board without the owner's explicit
  go-ahead (the board is team-visible).
- **Sheet ↔ Redmine link:** the QA Sheet's `Bug Reports` tab gets a `Redmine` column
  with `=HYPERLINK(...)` to `#NNNNN` per filed bug; the board carries no back-links.
- **Sheet `Bug Reports` tab layout — one cell per bug, v2 (Vadym, 11/07/2026):**
  `A` = Summary (`BUG-NNN — <title>`, bold; severity decision-tree branch as a cell
  NOTE) · `B` = the FULL report in ONE cell in the board format — bold section labels,
  and evidence lines where the LABEL ITSELF is the link, same wording as the board:
  `Screenshot with response from Api` / `Screenshot from Application[ (platform)]` /
  `Screen record` for videos · `C` Comments — free info (e.g. the board ticket:
  `=HYPERLINK("…/issues/NNNNN";"Filed to the board: #NNNNN")`, not-a-bug closures) ·
  `D` Status — dropdown `To do / In progress / To test / QA in Progress / Reopen /
  Fixed` with per-status color chips (conditional formatting); the dropdown vocabulary
  = the `boardStatus` enum in `Rules-Guide/schemas/bug.schema.json`, and the subject
  layer prefixes = its `layer` enum (`app`/`backend`/`frontend-web` — schema catch-up
  12/07/2026, "schema first" applies to future values). NO separate
  Severity/Redmine/Date columns. All cells: wrap + **vertical alignment MIDDLE**
  (Vadym, 11/07/2026). Migration tools (read the prior
  layout WITH textFormatRuns so links survive):
  `template/tools/rebuild-bug-tab.mjs` (16-col → one-cell). The one-cell v1 → v2
  reshape was a one-off, project-side transform (its bug→ticket data was project
  data, so it is not shipped with the kit).
- **Report ends with LINKS** to everything touched: created/updated issues, the Sheet
  tab, uploaded evidence.
- **Dedup against the BOARD before filing (learned 11/07/2026 — we filed a duplicate
  of an existing ticket):** before every create, SEARCH the tracker for the same
  component + failure signature (`GET /search.json?q=<keywords>` and/or
  `GET /issues.json?project_id=<id>&status_id=open` filtered by subject keywords).
  Found one → do NOT file; add an occurrence comment with fresh evidence/IDs to the
  existing ticket instead, and link THAT ticket from the QA Sheet. The Sheet-level
  dedup rule extends to the tracker.
- **Before filing the FIRST bug of a project — ASK where bugs go** (Vadym, 11/07/2026):
  Google Sheets or the Redmine board. Don't assume; the destination is the owner's call
  and may differ per project. If the owner picks Google Sheets → build the tab from the
  **beta template** `template/create-bug-reports-tab.mjs` (v2 layout + Status dropdown +
  per-status color chips via conditional formatting: To do blue · In progress amber ·
  To test purple · QA in Progress cyan · Reopen red bold · Fixed green bold).
- **Bug-candidates funnel (Vadym, 11/07/2026):** every bug the agent FINDS goes first
  into a separate **«<Project> — Bug candidates»** spreadsheet (project name IN the
  file name — same pattern for every project) in the project's Drive folder
  (columns: `Summary · Bug report · AI Comments · Verdict · Owner's Comments` — D and E are the owner's, never overwritten by a rerun,
  Verdict dropdown `Proposed/Approved/Rejected`). After each test run the agent
  PROPOSES the new candidates to the owner for validation; on approval the bug is
  filed to the board (team format) and its row is DELETED from the candidates doc;
  **rejected candidates MOVE to a `Rejected Bugs` tab of the same file** (owner decision,
  29/09/2026 — replaces the 12/07 "delete" rule: the owner's reason in `Owner's Comments`
  is worth keeping). `bug-row.mjs --candidates` does the move on every run (whole row,
  formatting and links; fixed gid 900002) and never re-appends a rejected spec. The funnel
  tab holds only pending items. **Before filing an `Approved` row, read the tool's
  `needsOwner`:** a row whose latest re-check no longer reproduces (amber ⚠ in AI Comments) is
  asked about on its own, never filed inside a batch «post» (BUG_REPORTS_RULES, candidates
  sheet). Candidates are drafts — never treated as filed bugs in reports/metrics.
**Two destinations, two hosts:** the team board gets file-host links only; the internal QA Sheet keeps
its Drive links. Do not mix them — a board link must open for someone with no access to our Drive.

## Filing in the checklist format (owner, 30/09/2026)

Often the team does not want one ticket per bug: **one task is opened and the bugs are added to it
as numbered checklist items** (shape 1 below). Rules for filing that way:

- **Line format** — one item per bug, exactly:
  `N. *[<App | BE | App/BE> - <Story x.y or the broken area>]* <summary> *Screenshot:* <url>`
  (`*Screen record:*` when the primary evidence is a video). The summary is English and answers
  What? Where? When?; `App/BE` whenever the side is not certain. The candidates sheet's
  `Board checklist` tab produces these lines ready to paste (BUG_REPORTS_RULES).
- **How the points are split is a TEAM decision, not ours** — one container per side
  (`[BUGS - App]`, `[BUGS - BE]`) or one mixed container (`[BUGS - App + BE] Issues faced during
  <dates>`) both happen, depending on what was agreed. **Ask the owner before the first filing on a
  project, and again whenever a new container is about to be opened**; record the answer in
  `<Project>/CLAUDE.md`, never assume last project's split.
- **Numbering continues** the container's existing points; never renumber what is already there —
  developers, journals and chats refer to points by number.
- **Before proposing a filing, match every open candidate against the points already in the
  container** (`GET /issues/<id>/checklists.json`, read-only) and record the result in the spec:
  `onBoard` = the defect is already a point (name it: `"#<task> point 15"`), `boardOverlap` = a point
  covers part of it (name what is and is not covered). Only candidates with neither go to the
  paste-ready list; the overlap ones are narrowed to the uncovered part first. AI Comments show the
  status on every row, so the owner sees what he already filed and what he has not.
- **The container's journal is the re-check record:** the owner writes which points still reproduce
  on which build, developers tick points done, and a point that reproduces again is unticked. Read it
  (`include=journals`) before any re-check and cite it in a spec's `recheck`.
- Adding items through the API (`POST /issues/<id>/checklists.json` with
  `{"checklist":{"subject":"…","is_done":false}}` → 201) is a board write: only on the owner's
  explicit «post», like any other filing. Re-read the list right before posting and number from its
  real last point, then read it back.
- **A comment (journal) cannot be edited or deleted through the API** (measured: `PUT`/`PATCH`/
  `DELETE /journals/<id>.json` → 404, even for the comment's own author). When the owner's
  running list (e.g. «Left Points») must grow, either he edits it in the browser, or the agent
  posts a NEW comment with the full updated text (`PUT /issues/<id>.json` with `notes`) and asks
  him to delete the old one — never leave two live versions without saying which one counts.

## Where the bugs actually are on this board (measured 14/07/2026, read-only)

A tool that walks `/issues.json` sees a **minority** of them. Three shapes coexist, because different people
file differently:

1. **Checklist containers** — one issue per module (`[BUGS] User profile`, `[BUG] Home screen`,
   `[pixel-perfect] Reader`) with an **empty description**; the individual bugs are **checklist items**
   inside it. They are reachable, but not where anyone looks:
   ```
   GET /issues/<id>/checklists.json          ← works
   GET /checklists.json                      ← 404, there is no collection endpoint
   GET /issues/<id>.json?include=checklists  ← returns NOTHING, silently
   ```
   On the <Project> board: **19 containers holding 110 bugs.**
2. **Description containers** — the subject names a **screen** (`The Library screen`, `Select Genre screen`)
   and the bugs are **numbered points in the description**. Read as one issue, they collapse six bugs into
   one row.
3. **Standalone Bug issues** — one issue = one bug.

**Three traps, all measured on real data:**

- **`parent` usually names a QA ACTIVITY, not a module** (`Smoke/Regression testing`, `Sprint N`,
  `Post-release bugs`). Grouping by `parent.subject` blindly would file **55 of 125** bugs under a module
  that does not exist in the product.
- **`PM Acceptance` is NOT a closed status** — and it is the most common one on the board. Any "still open"
  count that assumes the late workflow states are done will over-report fixed work.
- **There is NO severity field.** Not core, not custom. `priority` sits at its default on nearly every bug,
  so it is noise, not a proxy. Severity is assigned outside the tracker — by a human, or *proposed* by an
  agent and marked as such (see [Bug-Summary](../Custom-Reports/Bug-Summary/BUG_SUMMARY_RULES.md);
  the same severity then flows into the Test-Report — the client-facing layer is its ONLY home).
