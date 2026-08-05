# Bug summary — reusable rules

The document: **a roll-up of the bugs FOUND during an engagement** — how many, at what severity, broken
down by module. One row per bug, one collapsible band per module, one band per site, counters
everywhere. The thing a client opens at the end to ask *"what did you find?"*

It is a **report, not a tracker**. The bugs it counts are usually already fixed and closed by the time
anyone reads it. It does not track their state, and it must not pretend to.

It is also **not a bug report**. A bug RECORD — repro, expected, actual, evidence, tracker id — is owned
by [Bug-Reports](../../Bug-Reports/BUG_REPORTS_RULES.md). This document **counts** those records. When
the two disagree, the record wins.

---

## 1. Reproduce the owner's document. Do not redesign it.

This is [Custom-Reports rule 3](../README.md), and it outranks every improvement in this file. The
default output of `bs-sheet.mjs` is the owner's format: same columns (`№ · Summary · Severity · Notes`),
same palette, same fonts, same borders, same per-module numbering that restarts at 1, same formulas.

Every kit addition is **opt-in** (`BS_ID_COLUMN`, `BS_STATUS_COLUMN`, `BS_PAGE_TOTALS`, `BS_RECONCILE`),
and none of them is on by default. Offer them; never impose them. A report nobody recognises is a report
nobody opens — and the first version of this kit learned that the hard way, by "improving" the severity
column into a red-to-neutral colour ramp and being told, correctly, that the colours had drifted.

## 2. Every count is a formula. Never a typed number.

Per module, per site, grand total — all `COUNTIF` over the rows they claim to count. A typed number in a
counter cell looks exactly like a real one and stops being true the moment the next row is added.

The headline is `Total count of issues (All modules)` — **bugs found**. That is what this document is for.

## 3. Severity is the client's scale, and it drives the geometry.

`severityScale` is a flat array, most-severe-first, and the Sheet is built from its length: one counter
column per value, and every merge, width, formula and colour recomputes. Change the scale, change nothing
else. (The same design as `PLATFORMS` in the adaptive checklist builder.)

- Reproduce the client's scale (`Critical/Major/Minor/Trivial`); never silently remap it onto the kit's.
- A severity outside the scale is counted by **no column** — it vanishes from every total while sitting
  in plain sight. The builder **refuses to build**, and the Severity column ships as a strict dropdown
  (as the owner's own sheet does) so it cannot be typed in the first place.
- Counts from two engagements on different scales, or different environments, are not comparable.

## 4. Severity provenance: a machine's guess is not a triage decision.

> **The scale itself, the worked examples, and the step-by-step procedure are in
> [`SEVERITY_PLAYBOOK.md`](SEVERITY_PLAYBOOK.md).** Read it before rating anything. It is the kit's default
> calibration — **stricter** than the generic tree in Bug-Reports (a blocked core flow with no workaround is
> `Critical` here, not `Major`) — and it is the same text the Sheet shows on hover, which is a rule, not a
> coincidence. A project may override it with its own `severity-rubric.md`; that one wins.

**The tracker has no severity field.** Someone assigns it — a human, or the agent. So every row records
`severitySource`:

| Value | Means |
|---|---|
| `owner` | a human triaged it |
| `tracker` | the source system recorded it |
| `agent-proposed` | **an agent derived it** from the [severity decision tree](../../Bug-Reports/BUG_REPORTS_RULES.md) |

An `agent-proposed` severity is a **hypothesis**, and *every statistic in the document is built out of
it*. So it can never pass silently as a human's judgement:

- it carries `severityRationale` — the branch of the tree that produced it;
- its **cell** gets a one-line note: `branch: cosmetic — animation polish`;
- the **`A1` document note** carries the count and the warning — *"N of M severities were PROPOSED BY AN
  AGENT, not triaged by a human… review before this goes to anyone outside the team"*;
- the **build** prints the same warning, every run.

**The statement is not optional, only its placement is.** Drop it and nothing on the tab distinguishes a
machine's guess from a human's triage: the per-cell `branch:` line reads like someone's reasoning either
way, and a reader sees "48 Major" and takes it for a QA decision. The JSON and the build log say it — but
the document is read in Sheets, not in JSON.

**It is a release gate.** Machine metadata (the `bs:` id, the source, the counts) belongs in the **1px
footer row**, out of a client's way. The agent-proposed warning does **not**: a tab that still carries it
has not been reviewed, and hiding it would let an unreviewed document go out looking finished. It clears
itself the moment the severities are triaged by a human — **review them, don't hide the fact that nobody
has.**

### When the wording does not settle it, LOOK AT THE EVIDENCE

**A severity is a judgement about CONSEQUENCE** — does the defect hide, cut, block, corrupt? — and the
bug's one-line summary very often does not say. *"The label isn't shown according to design"*
is either a **clipped label** (`Minor`) or a **different font** (`Trivial`), and the sentence cannot tell
you which. **The screenshot can, in a second.**

So: **never settle a borderline severity from the wording alone.** Fetch the evidence
([`bs-evidence.mjs`](template/tools/bs-evidence.mjs)), look at it, then rate — and say in the rationale
that you *saw* it.

It is not theoretical. On the reference board that exact bug was rated `Trivial` from its sentence; the
screenshot showed the name **clipped inside its card**, which cuts content, which is `Minor` under
the owner's scale. One look, one level.

Two things the tool exists to handle, because none of these hosts serve the image at the link you were given:

| Host | What you actually get |
|---|---|
| `prnt.sc` / Lightshot | the page's `og:image` **is** the full screenshot — one fetch, no browser |
| `monosnap.ai` | `og:image` is the **site logo**. Render the page |
| `screencast.com` | `og:image` is a **392×360 thumbnail** — too small to judge. Render the page |
| Dropbox / `.mp4` | a screen **recording**. Sampled into a **contact sheet** (below) |

**Screen recordings are where the ugly bugs live, and they read as nothing in text.** The tool plays the
video in the headless browser (Chromium decodes H.264 fine), seeks to N points, and tiles the frames into
one contact sheet with timestamps. No ffmpeg — the build Playwright bundles is stripped and will not even
demux an `.mp4`; the browser is already the decoder.

**Be precise about what a contact sheet settles:**

| ✓ It settles | ✗ It does NOT settle |
|---|---|
| the **sequence**: navigation, redirects, error states, what disappeared, what was not saved | **smoothness.** *"The animation stutters"*, *"there is a slight jitter"* — nine stills can neither prove nor disprove that |
| how long a broken state **persists** | audio (not analysed at all) |

Both halves earned themselves on the reference board. *"The user is redirected when he tries to leave a
text review"* — frame 2 shows the rating screen with the input open, frame 3 shows the chapter text: the
redirect is right there. *"A black screen after switching the camera"* — the sheet showed the camera black
from 3.5s to the end of the recording, so it does not recover at all; the sentence never said that.

And the other half: for a **jitter** bug, **say the stills cannot settle it** and rate from the text (or ask
a human to watch). Inventing a severity from a grid of stills is exactly the guess this rule exists to stop.

And dismiss the viewer's cookie banner before capturing: it sits **on top of** the screenshot and hides the
part of the defect you came to look at.

**Evidence rots** (`hostRisk: expiring`). If you are opening these links to rate them, that is the moment to
**re-host them** — once they die, the bug is unprovable and the number in the document is uncheckable.

### The definitions in the Sheet MUST be the criteria the agent rated with

The severity labels carry a note defining each level (`SEVERITY_HELP`). **They are not decoration — they
are what a human validating the numbers will read.** If they say something different from the decision tree
the agent rated with, the document *teaches one scale while reporting numbers made with another*, and the
owner and the agent will disagree without ever finding out why.

That happened. The first version of these notes had **`Major` = "broken, but the user CAN still get the job
done — through a workaround"**, while the tree says `Major` = **no workaround** and *with* a workaround is
`Minor`. Opposite, on the single distinction that carries the whole scale. And the note for `Critical` did
not mention **money** at all — although one of the two Criticals on the board was rated on exactly that
branch.

**Change the tree, change the notes, in the same commit.**

### The agent MUST ask for validation — every time, out loud

A warning nobody is pointed at is a warning nobody reads. So whenever a build produces **any**
`agent-proposed` severity, the agent hands the document over **with the ask attached**:

> *"N of M severities on this tab are mine, not yours. Every count is built out of them. **Validate them
> before this goes to anyone outside the team.**"*

Not in a footnote. Not "the build warned about it". In the message where the link is given — and again on
every rebuild, until `severitySource` says `owner`.

**A severity is a judgement about impact, and impact is the owner's call.** The agent proposes the branch
of the tree; the human confirms the sensitivity. When the owner's calibration differs from the tree's
defaults, that calibration is written down (`severity-rubric.md` beside the summary, worked examples and
all) so the next round proposes it the owner's way, not from scratch.

Same discipline as `priorityProposed` in `bug.schema.json`, same rule as Test-Oracles: *a verdict with
no oracle behind it is not a verdict.* Review proposed severities before the report goes to a client.

### The validation happens on the TAB — so the tab must survive a rebuild, and the record must absorb it

Asking the owner to validate 230 severities by hand-editing a JSON is asking him not to do it. He validates
where the work is: **in the Sheet**, on the dropdown, with the branch of the tree in the cell note beside it.

Which puts two obligations on the tools, and both of them were broken:

1. **A rebuild must not wipe him.** `bs-sheet` reads the previous tab back, carries the severities, statuses
   and notes typed on it, and prints every one that disagrees with the JSON. It is matched **by position and
   verified by text** — the owner's format has no id column (its № restarts at 1 in every module, so it cannot
   address a row) and summaries are not unique: on the reference board two pairs of bugs share a summary word
   for word. Position settles those; text catches a shifted layout.
   *This was documented and not implemented.* `carried` was allocated, passed to the builder, and never
   populated — so every rebuild destroyed the team's edits and `drifted` reported nothing, exactly as if
   nothing had been lost. **A carry-over that is only in the comment is worse than none: it is a promise the
   tool makes and does not keep.**
2. **The record must absorb it.** [`bs-severities-from-sheet.mjs`](template/tools/bs-severities-from-sheet.mjs)
   reads the Severity column back into `severities.json`. Otherwise the owner's triage lives only in Sheets,
   and the JSON — which §10 calls the record — is a stale fiction that the next `bs-from-redmine` run rebuilds
   the whole document out of.

**And it must not promote a row nobody looked at.** An unchanged cell is indistinguishable from an unreviewed
one — both hold exactly what the agent wrote. So a changed severity becomes `owner` (he demonstrably touched
it), an unchanged one stays `agent-proposed`, and only the owner's own `--reviewed-all` says *"I went through
every row."* A tool that flipped all 230 to `owner` because someone typed in one cell would manufacture the
very human judgement this whole mechanism exists to prove was made.

## 5. Status is optional — and it is off by default.

A retrospective summary of a closed engagement **has no status column**, because the source has no
status and inventing one would mean inventing data. `unknown` is not a defect in such a document; it is
the truth about it.

Turn `BS_STATUS_COLUMN=1` on only for a summary that is being **worked** — an engagement still running,
where the team needs to see what is outstanding. Then, and only then:

- **`verified` is the only status that means fixed.** `fixed` means a developer said so — still owed
  until QA re-checks it against the original repro.
- The status is a **column**, never prose in Notes: a counter cannot read a sentence.
- The outstanding list is **derived** (a live `FILTER`), never hand-maintained. A hand-kept list beside
  its own source drifts — silently, and always in the flattering direction.

## 6. A row with no evidence is an observation, not a demonstrated defect.

No oracle, no verdict. Such rows stay on the tab (deleting them would be its own dishonesty) but are
flagged in the cell note and counted in the build warnings.

**Evidence rots.** Links on hosts that expire or need an account (`screencast.com`, `prnt.sc`, personal
Dropbox shares) take the bug's provability with them when they die — the same lesson as PageSpeed's
30-day shareable links. Mark them `hostRisk: expiring` and re-host per the workspace's file-hosting rule.
In the reference document this kit came from, **295 of 309 rows** rest on such links.

## 7. Module provenance: a module READ off the board is a fact; one INFERRED from the bug's text is not.

> **The executable version of this rule is [`PLACEMENT_PLAYBOOK.md`](PLACEMENT_PLAYBOOK.md)** — the cascade,
> the inference conditions, what an agent may decide, and what must be left in `General`. Follow it.

Every row records `moduleSource`, for the same reason `severitySource` exists — every per-module count is
built out of it:

| Value | Where the module came from |
|---|---|
| `owner-mapped` | a human said so in `MODULE_MAP` — the strongest |
| `container` | the issue holding the bug names the module (`[BUGS] User profile`) |
| `subject` | the bug's own issue subject IS a place (`The Library screen`) |
| `parent` | the parent task names it |
| `summary-inferred` | **the tool read a place out of the bug's own wording** |
| `agent-placed` | **an agent read the bug and decided** — a judgement, not a fact |
| `unplaced` | nothing said where it lives → `General` |

`agent-placed` is the last resort before `General`, and it is recorded precisely because it is *weaker
than what the board itself says*. An agent reads each unplaced bug and puts it where it belongs
(`PLACEMENT_FILE`); the ones it cannot place **honestly** — genuinely app-wide (a navigation bar, a toast),
naming two or more places, or naming none — are **left in `General`**. Placing those anyway would be
inventing a fact, and the whole cascade exists to avoid exactly that.

**Inference is allowed, under conditions, and it is never disguised as a fact.** *"The Notifications screen
shows hardcoded mock data"* is telling you where it lives, and refusing to read that leaves a perfectly
placeable bug sitting in `General`. So the tool reads it — and:

- **exactly ONE place, or nothing.** *"on the List and Detail screens"* names two, and choosing between
  them is a coin-flip; a bug in the wrong module corrupts the very statistic the document produces. Two or
  more → it stays in `General`.
- **an existing module wins over a new one.** If the text names a place the board already has a module for,
  that module is used — otherwise the inference quietly fragments `Settings screen` into a near-duplicate.
- **the article is stripped, not rejected.** An early version threw away *"**The** Notifications screen"*
  because it started with an article — discarding the clearest signal in the sentence.
- **`MODULE_INFER=0`** turns it off, and every such bug falls back to `General`.

Different spellings of one name (`notification Settings screen` / `Notification Settings screen`) are
collapsed automatically — that is a fact about strings. Two names that merely *look* alike (`Settings
screen` vs `Settings screen (UI/UX)`) are only **flagged**: deciding they are one module is a product
judgement, and it belongs in `MODULE_MAP`.

## 8. A bug that cannot be placed goes to `General` — it is never dropped.

The source does not always say which module a bug belongs to. Refusing to file it *feels* like the honest
move. It is not: the bug then appears **nowhere**, and the grand total — the one number this document
exists to produce — under-reports what was found. Silently. Nobody counts what is not on the page.

The first Redmine import did exactly that: it reported **139** bugs when **216** had been found.

So an unplaceable bug lands in an explicit band, flagged `unplaced: true` in the record:

- **It is COUNTED.** It is in the total, in the severity counters, in the document.
- **It renders LAST within its site** — a debt belongs at the end of the list, not interleaved with the
  real modules.
- **It is scoped to ITS OWN SITE.** A document covering several sites gets **one `General` per site**, never
  a shared bucket. Merging the unplaced bugs of two different products into one band would invent a
  relationship that does not exist — and would leave a reader unable to say which product the bugs are in.
- **The band says what it is:** a note on it states that these bugs were found but nobody can say where
  they live, and how to shrink it (give the bug a parent that names a module, put it in a container, or
  record the call in `MODULE_MAP`).

`General` is a **debt, not a module**. It should shrink between editions. If it does not, the board — not
the document — is the thing to fix.

## 9. Reconciliation: a bug counted by nothing must be impossible.

The grand total counts the **whole** severity column; the module counters count **their own ranges**. A
row outside every module band is counted by nothing at all.

The builder checks this **at build time, always** — it knows the ranges it laid out, and it refuses to
publish an under-report. `BS_RECONCILE=1` additionally puts a live guard cell on the tab for rows a human
adds later.

## 10. The kit ships the METHOD. The project holds the DECISIONS. Neither is optional.

A fair question, and it has a sharp answer: **can a teammate rebuild this document from the kit alone?**

**The mechanical half: yes, exactly.** A fresh clone pointed at the same board re-pulls the same rows, finds
the same containers, makes the same inferences, flags the same ambiguities, and builds the same Sheet, to the
pixel.

**The judgement half: no — and that is not a hole, it is the design.** Which two module names mean one
module, where an unplaceable bug belongs, what each severity is — those are **facts about a product**, not
about a method. The kit **refuses to guess them**, so a fresh run produces *more* modules, *more* bugs in
`General` and **zero severities** than a finished document does. That gap is not the kit failing. **That gap
is the work.**

So the kit ships **everything needed to make those decisions the same way**: the placement cascade, the
severity scale and its calibration, the rule that a borderline call is settled by *looking at the evidence*,
and the refusal to invent a default. Two agents, on two machines, following it, reach the same *kind* of
decision — and escalate the same things to the owner, because some of them are only his to make.

**What the kit must never ship is the answers themselves** — they are a client's data (§11), and they live in
`<Project>/QA-Documentation/bug-summary/`: `module-map.json`, `placements.json`, `severities.json`,
`severity-rubric.md`. **Back that folder up.** The kit can rebuild the document; nothing can rebuild the
decisions but doing them again.

### The tool will not let an agent stop half-way

The easiest way to produce a wrong document is to run the importer, see *"230 bug rows"* and no complaint,
and believe the job is finished. So the tool **ends every run by saying what is still owed** — unresolved
module collisions, bugs still in `General`, modules that were *inferred* rather than read, severities that are
the agent's hypothesis and not the owner's judgement — and it says the quiet part out loud:

> *"The tool did the mechanical half. The half that decides what the numbers MEAN is yours.
> Stopping here produces a document that LOOKS finished and is not."*

It prints this **on the earliest exit too** — the agent who stops soonest is precisely the one who most needs
to read it.

## 11. The tool lives in the KIT. Its output lives in the PROJECT.

The kit ships to a teammate. It must not contain one line of your client's bugs.

| In the kit (ships) | In `<Project>/QA-Documentation/bug-summary/` (never ships) |
|---|---|
| `bs-from-redmine.mjs` · `bs-sheet.mjs` · `bs-severities-from-sheet.mjs` · `bs-evidence.mjs` · `bs-from-bugs.mjs` · `bs-import-sheet.mjs` | `bug-summary.json` · `severities.json` · `module-map.json` · `placements.json` |
| the schema, the rules, this playbook | `severity-rubric.md` — **the owner's calibration** |
| `severity-rubric.example.md` — the **template** | `severity-triage.json` · `placement-triage.json` · `evidence/` |

Two rules follow, and a tool that breaks either one will eventually write somebody's data somewhere it does
not belong:

- **A tool NEVER guesses a destination.** Output goes beside `-o`, or nowhere. `bs-from-redmine.mjs` used to
  default its triage file to the **current working directory** — which, on a `--dry-run` fired from the kit
  root, wrote a client's 230 bug summaries **into the kit**. It was caught because the owner saw the file;
  nothing else would have.
- **`--dry-run` writes nothing.** Not a triage file, not a log, nothing. That is what the word means. A dry
  run that leaves a file behind is a dry run nobody can trust to be safe.

## 12. The reference document is READ-ONLY.

A document someone hands you as "the format we use" is their working record, not your fixture. Import it,
build beside it, never point a generator at it. (`bs-import-sheet.mjs` only reads; the builder refuses to
overwrite any tab it did not write — see `BS_ALLOW_ADOPT`.)

---

## What the generator refuses to do

The kit's validator subset has no conditional keywords, so the invariants a schema cannot state are
enforced in the builder, before anything reaches a Sheet:

| Refusal | Because |
|---|---|
| a severity outside `severityScale` | no counter would count it; the bug disappears from every total |
| a duplicate issue `id` | ids address rows; two rows with one id cannot be traced |
| module bands that do not cover every issue in the record | a row counted by nothing is an under-report |
| rebuilding a tab with no `bs:` note (without `BS_ALLOW_ADOPT=1`) | that tab is somebody's hand-kept document, not a cache |
| rebuilding when the previous tab cannot be read | it would silently overwrite the team's edits |

And it warns, every build: agent-proposed severities · rows with no evidence · rows on expiring evidence
hosts. Those are not errors — they are the document telling the truth about itself.

## A shared link survives every rebuild

Universal invariant (Project-Configuration rule 10, owner's rule 15/07/2026): updating this
kit's artifact must keep the link the owner already shared. For this kit: bs-sheet.mjs rebuilds the SAME tab under the SAME fixed gid (BS_GID) in the SAME spreadsheet — shared #gid= links survive every rebuild (and the carry-over keeps the owner's edits).
Trash-and-recreate looks identical in the UI and silently kills every saved link; if a
carrier genuinely cannot keep its link, say so in the hand-over message.
