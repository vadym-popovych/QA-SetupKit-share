# Bug summary — the canonical Sheet

What [`bs-sheet.mjs`](template/tools/bs-sheet.mjs) builds, and why each part is the way it is.

**The default output reproduces the owner's document.** Geometry, palette, fonts, borders, per-module
numbering, formulas — his. "Reproduce, don't redesign" ([Custom-Reports rule 3](../README.md)) outranks
every improvement in this file. The departures listed below are *owner-approved*, one by one; everything
else the kit can offer is an opt-in flag, off by default.

Verified against the owner's reference by a cell-level diff: column widths, row heights, row groups (40),
frozen rows, borders, fonts, colours, formulas and the severity dropdown all match.

## Geometry

**Adaptive on one flat array.** `severityScale` (most severe first) sets the counter columns; every merge,
width, formula and colour recomputes from its length `N`. Change the scale, change nothing else. (The same
design as `PLATFORMS` in the adaptive checklist builder.)

```
columns = 4 + N + 1                        (N = severityScale.length; N=4 → 9 columns, A…I)

A  №          50px   per-module ordinal — restarts at 1 on every module (the owner's)
B  Summary   507px   the bug, in one line. WRAP, and the row has NO fixed height (see below)
C  Severity  104px   dropdown from severityScale · coloured by conditional-format rule
D  Notes     207px   free text
E…H          140/140/100/100   one counter column per severity
I  Total     170px   the headline: bugs FOUND. Merged down each site's span
```

Rows 1–4 frozen. Fonts: Arial throughout. Borders: `SOLID #000000` on every cell of the table —
`updateBorders` draws only the *outline* of a range, so `innerHorizontal` + `innerVertical` are not
optional; without them the grid comes back as one big box.

| Row | Content |
|---|---|
| 1 | header `#134f5c`, size 19, text `#f3f3f3` · counter block `#41859a` size 12 · `Total count of issues:\n(All modules)` — **rich text in one cell** (owner's hand-tuning, read back 15/07/2026): line 1 `Total count of issues:` **11pt black bold**, line 2 `(All modules)` **10pt white bold**, base Arial — `textFormatRuns` in the builder, applied after the value write or the runs die |
| 2 | severity labels `#b6d7a8`, size 12 · dropdown · **a note on each label defining that severity** |
| 3 | `=COUNTIF(C:C;"<severity>")` per column (`#6c8194`, size 13) · Total `=E3+F3+G3+H3` — **size 21, white**, the headline number |
| 4 | grey strip `#d9d9d9` · `Count per Severity (Per Page)` |

Then, repeating: **site band** (one bar across `A:H`, colour per site from a cycling palette, height 43,
dark `#073763` spacer between sites) → **module band** (3 rows: name merged `A:D` on `#04688c`, mirrored
into the counter block by `=A<row>` on `#119ed2`, severity labels, then `=COUNTIF(C<first>:C<last>;"<sev>")`
over that module's rows only) → **issue rows**, collapsed into a row group per module (depth 2) and per
site (depth 1).

**Groups open COLLAPSED** — as the reference does (40/40). You open the tab and see the modules, not 309 rows.

## Formulas

**Every count is a `COUNTIF`.** A typed number in a counter cell looks exactly like a real one and stops
being true the moment the next row is added. `valueInputOption: USER_ENTERED`, always.

**The formula separator is read from the document, never assumed.** Google parses an API-sent formula in the
*spreadsheet's* locale: `uk_UA` wants `;`, `en_US` wants `,`. The owner's reference is `uk_UA` and the kit's
demo doc is `en_US` — send the wrong one and every counter on the tab becomes `#ERROR!`.

## Owner-approved departures from the reference

Each one was asked for on the live tab and generalised back into the generator.

| Departure | Why |
|---|---|
| **Row heights are COMPUTED from the text** — every bug summary is readable in full | In the reference every issue row is pinned to 21px, so the bug text is **clipped**. Sheets will not fix this for you, and both obvious routes fail: `autoResizeDimensions` **ignores wrapped text** through the API (it pins the row back to 21px), and a row left with **no** height collapses to a sliver. So `bs-sheet.mjs` measures it: Arial advance widths + the same greedy word-wrap Sheets does, including **breaking a token wider than the column** — which is exactly what a 120-character evidence URL is. `height = 6 + lines × 16`, over the max of the Summary and Notes columns. Calibrated against the one row the owner auto-fitted by hand: 261 chars → 4 lines → **70px, exact**. |
| **Severity colours, ON by default** (owner's palette) — `Critical #e03029` · `Major #eeb700` · `Minor #2d6591` · `Trivial #52a700` · **empty `#cccccc`** | The reference paints all four severities the same green, so the one column a reader scans for danger tells them nothing. `BS_SEVERITY_COLORS=0` restores the flat green. |
| **A note on each severity label**, defining that severity (English, from the [severity decision tree](../../Bug-Reports/BUG_REPORTS_RULES.md)) | Whoever fills the sheet decides severity from a dropdown; the definition belongs where the decision is made. Override with `SEVERITY_HELP`. |
| **Total column merged down each site's span** (the owner's `I5:I290`, generalised per site) | It reads as one figure per site instead of a ladder of empty cells. It is also why per-module totals are an *option*: the two cannot share that column. |

### The colours: a rule per value, and why not the obvious thing

The cell takes its colour **from its value** — one conditional-format rule per severity, on the Severity
column *and* on every severity label. Text colour is **derived from the background** (Rec. 709 luminance),
so any palette stays readable instead of going black-on-black the first time someone picks a dark colour.

**An empty severity cell goes grey (`#cccccc`), and that is not decoration.** A row with no severity is
counted by *no* column: it sits in the document, invisible to every total. Grey is what stands between it
and a silent under-report. (The builder also refuses to publish such a row — this catches the ones a human
types in afterwards.)

The obvious way to do this by hand is a **coloured dropdown chip**, and it is a dead end for a generator:

- **Sheets' dropdown-chip colours are not exposed by the API at all** — they cannot be written, and cannot
  even be read back. Through the API that cell simply has a plain `ONE_OF_LIST` rule and *no colour*.
- **A conditional format overrides a manual fill.** So a colour painted onto a cell that sits under a rule
  is invisible — you pick a colour, see nothing change, and conclude the paint did not take.
- **Reading the palette back off the tab resurrects the previous build's colours** and silently overrides
  the new ones. (It did exactly that, once.)

So the palette lives in **one place**: the `SEVERITY_COLORS` map in `bs-sheet.mjs`, overridable with the
`SEVERITY_COLORS` env var (and `SEVERITY_EMPTY_COLOR`). To change the colours, change them there — the
Sheet is a projection, and a rebuild will always win over anything typed onto it.

Corollary, and the reason this section is long: **a rebuild rewrites every format on the tab.** Anything a
human paints is destroyed by the next run. Colours are configuration, not data.

## Opt-in — all OFF by default

| Flag | Adds |
|---|---|
| `BS_STATUS_COLUMN=1` | a Status column, an "Unresolved" counter, and a derived **Left issues** tab (a live `FILTER`). **Only for a summary being worked**, never for a closed engagement. Unresolved = Total − (`verified` + `reassigned` + `duplicate`): `wontfix` stays owed, because nobody is going to act on it but it is still broken. |
| `BS_ID_COLUMN=1` | a stable ID. The owner's `№` restarts on every module, so it addresses nothing. |
| `BS_PAGE_TOTALS=1` | a total per module (the owner's document totals only globally). |
| `BS_RECONCILE=1` | a visible guard cell. **The check runs at build time regardless** — the tool knows the ranges it laid out and refuses to publish a summary whose module bands do not cover every row. |
| `BS_CELL_NOTES=1` | row-level notes (evidence links, ids). OFF by default: the reference has **zero** notes, and 309 note triangles change how the tab reads. |

The notes that carry an **honesty obligation** are always written: what the document is (cell A1), and
which severities a **machine proposed** rather than a human triaged.

## The 1px footer, and the one thing that is NOT in it

The tab ends with a **1-pixel row**. Its cell note carries everything the *tool* needs and no reader wants:
the `bs:` id, the source and its caveats, the generation timestamp, the severity scale, the `moduleSource`
breakdown, and the reminder that every count is a formula. It is also where the **adopt guard** finds its
marker. Invisible to a human, one hover away for an agent — so a document shared with a client is not
covered in machine metadata.

**`A1` keeps exactly one thing, and it is not moving down there:** the warning that *N of M severities were
PROPOSED BY AN AGENT, not triaged by a human.*

That line is a **release gate, not clutter.** A tab that still carries it has not been reviewed, and burying
it in a 1px row at the bottom would let an unreviewed document go to a client looking finished — a reader
sees "48 Major" and takes it for a QA verdict. It is not permanent either: **it disappears by itself** the
moment the severities are triaged by a human (`severitySource: owner`), because then it is no longer true.

If you want a clean `A1` before sharing, the way to get it is to review the severities — not to hide the
fact that nobody has.

## Severity provenance

The tracker has **no severity field** — a human assigns it, or the agent proposes it. So every row records
`severitySource` (`owner` / `tracker` / `agent-proposed`). An `agent-proposed` severity is a **hypothesis**,
and *every statistic in the document is built out of it*, so it can never pass silently as triage.

Three places carry it, and each says a different amount (owner's call, 14/07 — a note on every severity
cell repeating the full disclaimer 230 times is noise, and a note on the column header is clutter):

| Where | What it says |
|---|---|
| the **severity cell** | one line: `branch: cosmetic — animation polish` — *which* branch of the tree produced this rating |
| the **`A1` document note** | the count: *"N of M severities were PROPOSED BY AN AGENT, not triaged by a human… review before this goes to anyone outside the team"* |
| the **build output** | the same warning, every run |

**The statement itself is not optional.** Drop it and nothing on the tab distinguishes a machine's guess
from a human's triage: the per-cell `branch:` line reads like someone's reasoning either way, and a reader
who opens the Sheet sees "48 Major" and takes it for a QA decision. The JSON and the build log say it — but
the document is read in Sheets, not in JSON.

## Rebuild behaviour

- **Fixed gid** (`940001`) — shared `#gid=` links survive a rebuild.
- **Adopt guard**: a tab with no `bs:` note in A1 was not written by this tool. The builder refuses to
  rebuild it without `BS_ALLOW_ADOPT=1` — a hand-maintained tab is a document, not a cache.
- With `BS_STATUS_COLUMN`, Status edits typed on the tab are read back **by stable id** and preserved, and
  every one that disagrees with the JSON is printed: the JSON is the record, and it now needs updating.
