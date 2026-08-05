# QA Checklist Generator — Mobile Template (adaptive; default iOS + Android → 28 cols)

Mobile sibling of [`../checklist-web/`](../checklist-web/). Same Page → Section → Check
hierarchy, same workspace rules, and now the **same adaptive engine** — the two files differ
only in their default `PLATFORMS` and the page-band wording.

- **ADAPTIVE geometry (Vadym, 13/07/2026).** The per-block status columns come from a flat
  `PLATFORMS` array and ALL geometry recomputes from `P = PLATFORMS.length`: `NCOLS = 3*P + 22`;
  column positions, widths, merges, counters, the Partial-aware result formula, CF and collapsible
  groups. Two-char column labels (AA, AB…) are handled. **To change how many columns you check
  against, edit `PLATFORMS` — nothing else.**
- **Default `PLATFORMS = ['iOS', 'Android']`** → P=2, **28 cols** (A..AB) — byte-identical to the
  previous fixed 28-col mobile layout. All 3 blocks carry the same platforms (the 3 blocks = 3
  rounds / builds / regression passes).
- **Add platforms to widen a round**, e.g. `['iOS','Android','Windows','HarmonyOS']` → P=4, 34
  cols. A half-filled row resolves to `Partial`, never a false `Passed`.
- **Block layout (P=2 default):** `A B | s1 s2 c1 c2 c3 spacer rA rB | between | …`
  Block 1 = `C D | E F G | H | I J`; Block 2 = `L M | N O P | Q | R S`; Block 3 = `U V | W X Y | Z | AA AB`.
  Column groups (status+comments per block) are computed → `C:H`, `L:Q`, `U:Z` at P=2.
- **Page band terminology:** call screens "Home screen", "Login screen", … (instead of "Home
  page"). The API is still `addPage(name)` — only the label changes.
- **Per-row result formula** is Partial-aware and scans the block's status range
  (`COUNTIF(s1:sEnd; "…")`), so it is correct for any P.

Everything else (color palette, conditional formatting, +/- toggle right,
B4 hidden, group cleanup, page-name mirror, per-section row groups,
section-aware borders, autoResize) is identical to the web template.

> First-time setup of the kit (MCP server, OAuth, `.mcp.json`, rules) is
> covered in the top-level [`../README.md`](../README.md). Below assumes
> you've already finished that.

## How to create a new mobile checklist

```sh
PROJECT=<ProjectName>      # e.g. MyApp
slug=<project_snake>       # e.g. my_app
mkdir -p "$HOME/Projects/$PROJECT"
cp Checklist/checklist-mobile/checklist_generator.template.gs \
   "$HOME/Projects/$PROJECT/${slug}_checklist.gs"
cp Checklist/checklist-mobile/generate_via_api.template.mjs \
   "$HOME/Projects/$PROJECT/generate_via_api.mjs"
```

Then in the `.gs`:
1. Rename `createChecklist` → `create<Project>Checklist`
2. Set `FOLDER_PATH`, `FILE_NAME`, `AUTHOR`, `PLATFORMS`
3. Replace the example with real `addPage`/`addSection`/`item` calls
   (one `addPage` per screen — e.g. "Login screen", "Home screen")

In the `.mjs`:
1. Set `GS_PATH`, `GENERATOR_FN`, `FOLDER_PATH`, `FILE_NAME`

Then `node generate_via_api.mjs`. You'll see `Using MCP dir: …` and
`STEP 5 test: PASSED` if everything wires up correctly.

## When to use web vs mobile template

| Design under test | Template                       | Page band term |
|-------------------|--------------------------------|----------------|
| Website / web app | `Checklist/checklist-web/`        | "<X> page"     |
| Mobile / app      | `Checklist/checklist-mobile/` | "<X> screen"   |

Mix-and-match (e.g. a flow that includes both web and app screens) is not
supported by a single template; create two separate checklists.

## Updating this template

If you add a new workspace rule that affects checklists:
1. Update [`../CHECKLIST_RULES.md`](../CHECKLIST_RULES.md) with the rule + date + author.
2. Bake the change into BOTH `checklist/` and `checklist-mobile/` so web
   and mobile stay in sync.
