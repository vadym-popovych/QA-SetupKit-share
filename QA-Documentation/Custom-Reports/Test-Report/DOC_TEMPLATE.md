# Test report — the canonical Google Doc

Reverse-engineered from the owner's real end-of-engagement report (a `.docx`; every colour, merge
and row height below was read out of its `word/document.xml`, not guessed from a screenshot). The
reference covered 2 sites, 38 modules and 309 issues; all identifying content is replaced with the
synthetic example project here.

The document has two halves, and they have different sources of truth:

| Half | Sections | Source | Who writes it |
|---|---|---|---|
| **Narrative** | Purpose · Test Objective · Environment & Tools · Test Design | `report-config.json` — facts about the engagement | the owner / the QA who ran it |
| **Results** | Test results tables | `bug-summary.json` — the Bug-Summary record | **derived, never typed** |

## 1 · Title page

A full page, everything right-aligned, placed with empty paragraphs exactly as the reference
does it (15 above the block, 23 between the date and the signature); the content starts on
page 2 (`pageBreakBefore` on the first heading):

```
(15 empty lines)
<Project>                      ← TITLE style, 20pt bold SMALL CAPS, right
TEST REPORT                    ← TITLE style, 16pt bold, right, bottom border = the rule
<dd/mm/yyyy>                   ← 16pt italic, right (the issue date)
(23 empty lines)
prepared by <QA engineer>      ← 10pt, right, at the foot of the page
```

No header on the title page (`useFirstPageHeaderFooter`); when the config carries `logoUrl`,
every OTHER page gets a header with the logo (110pt wide). Body top margin is 115pt — the
reference's header pushes its text block that far down, and matching the margin keeps every
page's vertical rhythm aligned.

## 2 · Table of Contents

A dedicated page: H2 heading + the section map — top-level entries bold, subsections indented
36pt, 1.5-spaced. **No page numbers**: the API cannot compute them without rendering, and an
invented number is a lie. The native TOC (with real numbers) replaces the list in one click via
**Insert → Table of contents** — the build output reminds you. Footer page numbers are the same
story: the Docs API has no page-number field; **Insert → Page numbers** adds them manually.

## Narrative typography (measured off the reference)

Prose: 12pt, first-line indent 36pt, line spacing 1.5. Scope/tools/device lists: real bullets
(`BULLET_DISC_CIRCLE_SQUARE`); device and process/completion items sit deeper (bullet 72pt,
text 90pt). Per-type blocks: HEADING_3 indented 108pt, `Goal:`/`Process description:`/
`Completion Criteria:` labels bold at 72pt indent. The design intro line is grey `#666666`.
API trap, measured: `indentStart` alone renders flush in the PDF export — always pair it with
`indentFirstLine`.

### Never silently overwrite a document (17/07)

A .docx upload REPLACES the document wholesale — every manual edit in it is gone, with no warning
and no diff. This is not hypothetical: on 17/07 the engine rebuilt a report while the owner had it
open and was editing it. So the builder **remembers the Drive `version` it produced** (a state file
beside the .docx output) and, before the first write of a run, **refuses** if the document has moved
since. `TR_FORCE=1` overrides — deliberately, and it says so in the warnings. The rule generalises:
any tool that regenerates a shared artefact in place owes the same check, because "I made this file"
stops being true the moment someone opens it.

### Nothing broken across a page break (owner's rules, 17/07)

**No orphaned headings.** A section heading must never be left alone at the foot of a page with
its content overleaf — if only the heading fits, carry it to the next page. Set keep-with-next on
every heading (`keepNext` in .docx; `keepWithNext` in the Docs API). Google Docs honours this
between paragraphs, and between a paragraph and a table.

**No split tables.** A table must never be broken across a page — carry the whole table to the
next page. There is no property that says so: Docs **ignores** keep-with-next across table rows
(measured — `documents.get` shows `keepWithNext: true` on the cells' paragraphs and it changes
nothing; `cantSplit` governs a row splitting internally and is irrelevant here). The only fix is
an explicit page break before the table — which means the engine has to KNOW the table split, and
the only honest way to know is to render and look.

**Hence the layout loop.** Build → render → measure → adjust → rebuild, until the render agrees
with the document. Page numbers and page breaks move each other (a break re-paginates, which
changes every baked TOC number), so both converge in ONE loop or neither is trustworthy. Read the
split detection off a `-layout` render, where a table comes out as three lines (band / chips /
counts); plain extraction emits each cell on its own line and re-orders them, so it cannot be used.
Never adjust an expectation to make a check pass — the render is the oracle, and a number that
cannot be located in it is refused, not invented.

## 3 · Purpose of the document — HEADING_2

Two boilerplate paragraphs (shipped in the generator, project name substituted); override with
`purpose: ["…", "…"]` in the config when the owner's wording differs.

> This test report is designed to prescribe the scope, approach, resources, and schedule of all
> testing activities of the project "\<Project\>". · The report identifies the items that were
> tested, the features that were tested, the types of testing that were performed, and the
> resources to complete testing.

## 4 · Test Objective — HEADING_2

Intro sentence (config `objective.intro`, default shipped), then the scope inventory: one 13pt
site line per site, then one plain 12pt line per module, semicolon-terminated (the reference uses
plain paragraphs, not bullets — reproduced as-is):

```
Storefront site          ← 13pt
Sign in;                 ← 12pt, one per module
Checkout;
…
```

Default scope = the pages of the Bug-Summary record, per site, in record order (`General` is a
debt band, not a planned scope item — excluded). Override with `objective.scope` when the planned
scope was wider than where bugs were found — the honest direction (you tested more than you broke);
the tool warns if an override *drops* a page that has counted bugs.

## 5 · Test Environment and Tools — HEADING_2

**Mobile devices/browsers** (HEADING_3): config `environment.groups` — one 13pt group name
(`Android:` / `iOS:` / `Web (Mac OS):`) and one line per device/browser, semicolon-terminated,
exactly as supplied: device, OS version, viewport. Then the optional `environment.note` line.
**Testing Tools** (HEADING_3): one line per entry of `tools`.

There is no default. The environment is a *fact about what was actually used* — the tool
fails closed if `environment.groups` is missing or empty (see RULES §environment).

## 6 · Test Design and Execution — HEADING_2

Intro line: `The following types of testing were performed: <names>` — names joined from
`testDesign[]` plus `alsoPerformed[]` (work someone else did, e.g. "Unit testing (provided by the
developer)" — named in the intro, no section of its own).

Then per performed type, a HEADING_3 section with three fixed labels:

```
Goal: <one sentence>
Process description:
<one line per step>
Completion Criteria:
<one line per criterion>
```

The kit ships library text for `smoke` · `functional` · `ui` · `acceptance` · `regression`
(genericised from the reference); a config entry may override any field of a library type, and a
`custom` type supplies all of them.

## 7 · Test results — HEADING_2

Everything below is **derived from the Bug-Summary record**. Cell FONTS follow the owner's
**Bug-summary Sheet**, not the `.docx` (his call, 15/07/2026 — the two documents share one
visual language): everything bold; severity chips 12pt (**rank-3/Trivial text is white**, where
the `.docx` had black); counts 13pt; module band 13pt; site band 18pt; the total label is
rich text in one cell — line 1 11pt black, line 2 `(All modules)` 10pt white; the grand number
21pt white bold. Fill palette (identical in both sources):

| Element | Fill | Text |
|---|---|---|
| severity header, rank 0 (most severe) | `#e03029` | white |
| severity header, rank 1 | `#eeb700` | black |
| severity header, rank 2 | `#2d6591` | white |
| severity header, rank 3 | `#52a700` | black |
| severity header, rank 4+ (scale longer than the reference) | `#6c8194` | white |
| count cells | `#6c8194` | black |
| module title row | `#119ed2` | black |
| site band | `#3d85c6` | `#f3f3f3` |
| grand-total table header + label + total cell | `#41859a` | white (the .docx hides this in table-style conditional formatting — the RENDER shows white where the run XML says nothing) |
| grand-total bottom spacer | `#d9d9d9` | — |

Severity columns come from the record's `severityScale` in order — the palette is assigned by
**rank**, not by name (the client's scale may not be Critical/Major/Minor/Trivial).

**7.1 Grand total** — one table, S+1 columns × 4 rows (S = scale length), with three merges:

```
┌───────────────────────────────────────────┬──────────────────────┐
│ Total count per Severity     (merge S×1)  │ Total count of       │
├──────────┬─────────┬─────────┬────────────┤ issues: (All modules)│
│ Critical │  Major  │  Minor  │  Trivial   │      (merge 1×2)     │
├──────────┼─────────┼─────────┼────────────┼──────────────────────┤
│    5     │   71    │   116   │    117     │         309          │
├──────────┴─────────┴─────────┴────────────┤    (21pt, merge 1×2) │
│ (spacer row, #d9d9d9, merge S×1)          │                      │
└───────────────────────────────────────────┴──────────────────────┘
```

**7.2 Site band** — only when the record has >1 site: a 1×1 table, `#3d85c6`, site name centred.

**7.3 Module tables** — one 3-row × S-column table per page of the site, in record order with
`General` rendered **last** (it is the placement debt band — Bug-Summary rules):

```
┌────────────────────────────────────────────┐
│ <Page name> [<Site name>]     (merge S×1)  │   ← #119ed2; the [Site] suffix only when >1 site
├──────────┬─────────┬─────────┬─────────────┤
│ Critical │  Major  │  Minor  │  Trivial    │   ← severity palette
├──────────┼─────────┼─────────┼─────────────┤
│    0     │    6    │   11    │     5       │   ← #6c8194, counts = COUNT of record issues
└──────────┴─────────┴─────────┴─────────────┘
```

A page with zero issues still renders (all zeros): the record says it was tested, and omitting it
would hide coverage. Cell text is 10pt; headers vertically centred, counts bottom-aligned (as in
the reference). Column widths are normalised to equal widths across the usable page (the
reference's Word grid is wider than a Docs page); row heights carry the reference's `trHeight`
values as `minRowHeight` (total 23/19/22/18 pt · band 32 pt · module 22/20/21 pt).

## Known departures from the reference

Each one is a Docs-API limitation or a normalisation, not a redesign — listed so a fidelity pass
knows what is deliberate: no native TOC and no page numbers, in the TOC or the footer (§2) ·
heading numbering ("1.1.") dropped — plain headings. Module-table widths are NOT equal and NOT
full-width: the reference grid is 105/105/75/75pt (360pt, left-aligned) — reproduced.
