# PageSpeed report Sheet — the template

The shareable view of web performance: one page × platform × round grid that a stakeholder can
read at a glance. Built by [`template/tools/psi-sheet.mjs`](template/tools/psi-sheet.mjs) from
`pages.json` + `rounds/*.json` — never by hand, and never edited into shape afterwards. The round
JSONs are the source of truth; this tab is a projection of them, and a hand-edit to anything but a
Comments cell is lost on the next rebuild.

```bash
node tools/psi-sheet.mjs --dry-run            # validate every round, build the tab in memory, print it
PROJECT_NAME=Acme node tools/psi-sheet.mjs    # publish
```

## Shape

Column A is the **page** — written once, it is what the page IS. Everything a **round** records is
a 4-column *block*, repeated to the right, one per round. A new round never overwrites the last
one's numbers: it becomes the next block. Column count is therefore `1 + 4 × rounds`.

```
      A                      B          C          D        E   F          G          H        I
   ┌──────────────────────┬──────────────────────────────────┬──────────────────────────────────┐
 1 │                      │                                  │                                  │  rows 1–3:
 2 │        Page          │ Platform   Comments    Points    │ Platform   Comments    Points    │  every header
 3 │                      │                      from 11/03  │                      from 05/06  │  cell merged
   ├──────────────────────┴──────────────────────────────────┴──────────────────────────────────┤  across r1:r3
 4 │ Consumer site Pages  ▓▓▓▓▓▓▓▓▓▓▓▓ #3d85c6 — full-width section band ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
   ├──────────────────────┬──────────┬──────────┬─────────┬──┬──────────┬──────────┬─────────┬──┤
 5 │ Home             ↗   │ Desktop  │┌────────┐│   92    │  │ Desktop  │┌────────┐│   88    │  │
 6 │ ↑ merged, hyperlink  │ Mobile   │└ merged ┘│   61    │  │ Mobile   │└ merged ┘│   47    │  │
   ├──────────────────────┴──────────┴──────────┴─────────┴──┴──────────┴──────────┴─────────┴──┤
 7 │ ░░░░░░░░░░░░░░░░░░░ #d9d9d9 — spacer row, closes every page block ░░░░░░░░░░░░░░░░░░░░░░░░░ │
   ├──────────────────────┬──────────┬──────────┬─────────┬──┬──────────┬──────────┬─────────┬──┤
 8 │ Pricing          ↗   │ Desktop  │┌────────┐│         │  │ Desktop  │┌────────┐│   95    │  │
 9 │                      │ Mobile   │└ merged ┘│  error  │  │ Mobile   │└ merged ┘│   n/a   │  │
   ├──────────────────────┴──────────┴──────────┴─────────┴──┴──────────┴──────────┴─────────┴──┤
10 │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
   └──────────────────────┴──────────┴──────────┴─────────┴──┴──────────┴──────────┴─────────┴──┘
    w299                    w100       w133       w121    w15
    └── frozen col ─┘             └ Platform+Comments fold; Points (score) stays visible when collapsed
    frozen rows 1–3                                        └───── one round = 4 columns ─────┘
```

- **Header — rows 1–3**, every cell merged vertically across them, and frozen together with
  column A: scrolling right into round 5 must never leave you looking at a number with no idea
  which page it belongs to.
  - `Page` / `Platform` / `Comments` cells: `#699ebf`, black, bold, 14px, centred.
  - The `Points …` cell: `#146c8b`, white, bold, 13px, wrapped — its text is the round's `label`,
    verbatim from the round JSON (`"Points from 05/06/2024 (Prod)"`). Its **note carries the round
    id**, the env, the tool + Lighthouse version, the run target and whether a budget was approved.
  - The 15px spacer column: `#cccccc`.
- **Section band** — a full-width row, `#3d85c6`, name in column A in `#f3f3f3` bold 16px. Order and
  membership come from `pages.json`; a round that disagrees about a page's section is a warning, and
  the inventory wins.
- **Page block — exactly 2 rows**, Desktop then Mobile:
  - column A: the page name, merged across both rows, 11px, and a **real hyperlink** (`#1155cc`) to
    the URL the page was measured at. Not a `HYPERLINK()` formula — the reference document's locale
    is `uk_UA`, where a formula's argument separator is `;`, so a formula written with `,` renders as
    `#ERROR!`. The link lives in the cell's *format*, which survives any locale. **The tab contains
    no formulas at all**, and needs none.
  - the URL is per-environment, so it lives in each round. Column A can hold one link, so it holds
    the **newest** one; the A-cell note lists every URL the page was measured at, round by round.
  - `Platform` = `Desktop` / `Mobile`, centred.
  - `Comments`, merged across both rows — the owner's geometry makes it **one comment per page per
    round**. When the two platforms said different things, both are kept and each is labelled.
  - `Points` = the score, bold 10px, centred, always carrying a note (below).
- **Spacer row** after every page block: full width, `#d9d9d9`. The 15px **spacer column** is a
  single continuous `#cccccc` rule the whole height of the tab (header and data), the divider between
  rounds — the band and page-spacer rows repaint over it full-width, so it yields only on those rows.
- **Column group per round** (`Platform`..`Comments`), toggle on the right
  (`columnGroupControlAfter`): folding a round hides its Platform + Comments and **keeps its Points
  (score)** — so collapsing every round leaves a clean score-per-date matrix, which is the whole
  reason to keep old rounds. The 15px spacer column is deliberately **outside** the group — it keeps
  consecutive blocks non-adjacent, and Sheets merges adjacent groups of equal depth into one.
- **Multiple sites** (more than one section): a darker full-width `#073763` rule separates one site
  from the next (never before the first), and each site's page rows form a **collapsible row group**
  under its band — fold away the sites you are not looking at. The band and the `#073763` divider stay
  outside the group, so a collapsed site still shows its heading and the line beneath it. A single-site
  report has neither (nothing to separate or fold).
- **Future blocks** (`PS_FUTURE_ROUNDS=N`): N empty, ready-to-fill blocks appended right, header
  `Points from dd/mm/yyyy` (the format to write when the round is run), every cell blank — the
  reference kept blank dated columns ahead of time, and this reproduces that. They carry no data, so
  the honesty guards never see them; when the round is collected, drop N by one.
- **Fixed gid** (`PS_GID`, default `820001`): a rebuild reuses the same tab id, so every `#gid=`
  link anyone has shared keeps working.

## What is deliberately NOT a column

**Core Web Vitals are not columns.** LCP, TBT, CLS, FCP, SI and the CrUX field metrics would drown
the doc a stakeholder actually reads — so the cell keeps the owner's reference layout (the score,
and only the score) and everything else rides in the **cell note**, plus in full in the round JSON.

Nothing is lost, and that is the point: **the score never explains itself.** `73` alone cannot tell
anyone what regressed. Hover the cell and it must answer:

```
Performance 41 — median of 3 run(s): 38 · 41 · 47
Lab (median run): LCP: 6.1 s · TBT: 940 ms · CLS: 0.240 · FCP: 2.6 s · SI: 7.3 s
Field (CrUX, real users, crux-origin): LCP: 4.4 s · INP: 310 ms · CLS: 0.190
  ↳ origin-level sample: that number describes the SITE, not this page.
vs r5 (same env, same tool): -14
OVER BUDGET — Performance 41 vs min 70
OVER BUDGET — LCP (lab) 6100 vs max 2500
production · psi-api · Lighthouse 11.0.0 · 2026-06-05T09:14:02Z
```

**A score cell without a note is an unfinished cell.**

## The four cell states

| Cell | Means | JSON `status` | Comment |
|---|---|---|---|
| a number | measured: the **median** of exactly `runsPerPage` runs | `measured` | mandatory if < 50, or if it dropped ≥ 10 vs the last comparable round |
| *empty* | not run **this round** — temporary. The page was out of the round's `strategyProfiles`, was never collected, or too few runs succeeded | `not-run` | mandatory when runs fell below target |
| `n/a` | the page **does not exist** on that platform / in that round | `n-a` | **mandatory** — refused without one |
| `error` | the tool **failed** | `error` | **mandatory** — refused without one |

**`0` is never one of them.** 0 is a real score (a page can genuinely score 0); an absent
measurement is empty, `n/a` or `error`. Writing 0 for "we didn't measure it" is the single most
destructive thing this doc type can do, because 0 averages, 0 charts, and 0 looks like data.

## The rules the tab enforces

- **A new round is a new block, appended right.** A rebuild never overwrites a published round.
  Rounds are laid out chronologically by `round.date`, so the tab reads left → right as time moved.
- **Rebuilds carry the human's work over.** Scores come from the JSON every time — but a **comment
  typed straight into the tab exists nowhere else**. Before clearing, the tool reads the old tab back
  and re-attaches those comments, matched by **(round id, page id)** — by the round id in the header
  cell's *note*, never by its label, so renaming a block cannot orphan its comments. The score cells
  themselves are keyed by (page id, platform). A round JSON's comment always wins; a typed one
  survives only until someone writes it back into the JSON, which is where it belongs.
  If the previous tab cannot be read, the tool **refuses to rebuild** rather than silently destroy it.
  ⚠️ Don't edit the tab *while* a rebuild runs — the read-then-write window is real.
- **`rounds/` is append-only.** A round that is published on the tab but whose JSON has vanished is a
  refusal, not a quiet deletion (`PS_ALLOW_DROP=1` to override, deliberately).
- **The colour bands classify; they do not judge.** 90–100 green · 50–89 amber · 0–49 red is
  *Google's* classification of a Lighthouse score, and it is on the tab because the owner's reference
  has it. It is **not a pass/fail line.** A verdict requires `budgets` in the round JSON with
  `approvedBy` + `approvedOn` — and then the verdict is written in the note, in words, not implied by
  a colour. Raising a budget, or re-collecting until the number is green, is **fabrication** — the
  same rule as re-baselining a visual-regression golden to hide a diff.
- **Environment is part of the identity of a number.** Every round records its `env` and `tool`. The
  delta in a note is computed only against an earlier round with the **same env and the same tool** —
  a Lighthouse major version changes the scoring weights, so a jump across versions is a *tool*
  change, not a product change. When there is no comparable round, the note says exactly that instead
  of manufacturing a delta out of two different worlds.
- **A drop ≥ 10 points is a bug CANDIDATE, not a bug.** The note names it; a human reproduces it in a
  second round before it is filed (tag `PERFORMANCE`).
- **Lab is not field.** The number in the cell is a lab metric from a single load on Google's
  machine. CrUX field data, when Google has a sample, is recorded separately in the note and labelled
  `crux-url` or `crux-origin` — an origin fallback describes the *site*, not the page. Absent field
  data is recorded as absent. It is never zero, and it is never good news.

## What the generator refuses to do

The `pagespeed-round` schema deliberately cannot express its own honesty contract — the kit's
validator subset has no conditional keywords. So the checks the schema *cannot* make are made here,
and they are refusals (exit 1), not warnings:

| Refusal | Why |
|---|---|
| a round fails the schema | an invalid round is an error, not a row to skip. A tidy Sheet built from invalid rounds is a well-formatted lie |
| `measured` with no `score`, no `runs`, or `runs.length ≠ runsPerPage` | **the one that matters.** A score standing on fewer loads than the round claimed is noise wearing a number's clothes. Record it as `not-run` — never a partial green number |
| `not-run` / `n-a` / `error` carrying a `score` | only `measured` may carry a score; a number hiding in an "empty" cell is a number the next tool will believe |
| `n-a` or `error` with no comment | both are claims about the world. A claim with no explanation is a blank the reader has to fill in themselves |
| a comment still reading `NEEDS-COMMENT: …` | the collector's placeholder is a *demand* for a human explanation, not an explanation |
| two rounds sharing a round id | the id keys the block's identity and its comment carry-over |
| a page in a round that is not in `pages.json` | a number whose page nobody declared has nowhere honest to go |
| a result on a platform the round's `strategyProfiles` excludes (or that `pages.json` doesn't declare) | a number with no cell is a number nobody will ever see |
| no rounds at all | a report with no round is not an empty report — it is no report |
| the previous tab cannot be read | see above: rebuilding blind destroys every comment the team typed |
| `evidence.runScore` ≠ the cell's `score` | the linked report is of a **different run** than the number beside it. Evidence that contradicts its own claim is worse than none: it makes an unaudited number look audited. Re-run `psi-report.mjs` (it renders the stored median run) or re-collect the round |

## The Platform cell is the way into the evidence

`Desktop` / `Mobile` is not a label — it is a **link to the full Lighthouse report of the run whose
score sits beside it**, rendered by [`psi-report.mjs`](template/tools/psi-report.mjs) from the median
run `psi-run.mjs` stored (`rounds/<round>.lhr/`), then published wherever the team keeps evidence
(Mega / Drive / the [HTML-Reports](../HTML-Reports/) publisher). The hover note says which run it is
and when it was rendered.

It is a **format link, not a `HYPERLINK()` formula** — the same reason the page names are: in a
`uk_UA`-locale document a formula written with `,` renders `#ERROR!`, while a link that lives in the
cell format survives every locale.

Never point that link at a fresh `pagespeed.web.dev` analysis. That re-measures the page, and the
report then shows a load the cell never described (on one page inside an hour: UI **85**, median-of-3
**90**, a second median-of-3 **88**). The tab refuses to publish such a link (`evidence.runScore`,
above) — see [rule 16a](PAGESPEED_REPORT_RULES.md).

Everything else it *reports*: an over-budget metric, a missing mandatory comment, a partial
`not-run`, an `error` with no error text, a page whose round disagrees with the inventory about its
section. These land as `⚠` lines after the run, and the tab still gets written — a warning is a thing
a human must answer, not a reason to withhold the data they already have.

## Palette

| Element | Background | Text |
|---|---|---|
| `Page` · `Platform` · `Comments` headers (14pt bold) | `#699ebf` | `#000000` |
| `Points …` header (13pt bold, wrapped) | `#146c8b` | `#ffffff` |
| Spacer column, header rows (15px) | `#cccccc` | — |
| Section band (16pt bold) | `#3d85c6` | `#f3f3f3` |
| Spacer row after each page block | `#d9d9d9` | — |
| Page name (11pt, hyperlink) | `#ffffff` | `#1155cc` |
| Score 90–100 · 50–89 · 0–49 (conditional) | `#b6d7a8` · `#f6b26b` · `#e06666` | `#000000` |
| `n/a` (conditional) — *kit addition* | `#d9d9d9` | `#666666` |
| `error` (conditional, bold) — *kit addition* | `#e06666` | `#ffffff` |

The first six rows are the owner's reference document, reproduced. The last two are the kit's: `n/a`
and `error` are states the reference never had names for, and they must never look like a result.

House style on top of the reference: `verticalAlignment: MIDDLE` across the **whole** used range,
header row included.

## Env contract

| Env | Meaning |
|---|---|
| `PROJECT_NAME` | **required to publish** — names the doc and its Drive folder. Not needed for `--dry-run` |
| `PAGES` | the inventory (default `./pages.json`). It sets the section bands, the page order, and the platform rows |
| `ROUNDS_DIR` | the rounds (default `./rounds`). One JSON per round; blocks are ordered by `round.date` |
| `PS_TAB` / `PS_GID` | tab title (default `PageSpeed report`) · fixed tab id (default `820001`) so shared `#gid=` links survive a rebuild |
| `TARGET_SSID` | build the tab INTO an existing doc (the demo/validation path) instead of the project's own file |
| `SHEET_NAME` | doc title when the tool creates the file (default `<PROJECT_NAME> — PageSpeed Insights Results`) |
| `DRIVE_ROOT_FOLDER` / `DRIVE_CATEGORY` | Drive placement — `ClaudeProjects` / `Performance` by default; never the Drive root |
| `MCP_SHEETS_DIR` | OAuth dir (auto-resolved by walking up to the nearest `.mcp.json`) |
| `QA_SCHEMAS_VALIDATOR` | path to `Rules-Guide/schemas/validate.mjs` (auto-resolved the same way) |
| `PS_ALLOW_DROP` | `1` permits removing a published round block whose JSON is gone. Deliberate, never routine |
