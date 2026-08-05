# QA Checklist Generator — Web Template (adaptive; default Web → 25 cols)

Source of truth for creating a new web QA-checklist generator. Every new
checklist project MUST start from these two files, not from a previous
project's clone. The mobile sibling lives in `../checklist-mobile/`.

**Adaptive (Vadym, 13/07/2026):** the per-block status columns come from a flat `PLATFORMS`
array; all geometry recomputes from `P = PLATFORMS.length` (`NCOLS = 3*P + 22`). Default
`['Web']` → 1 column, 25 cols. Break web down by browser/device, e.g.
`['Chrome','Firefox','Safari','Edge']`, and the sheet widens itself — a half-filled row then
resolves to `Partial`, never a false `Passed`. Same engine as the mobile template.

> First-time setup of the kit (MCP server, OAuth, `.mcp.json`, rules) is
> covered in the top-level [`../README.md`](../README.md). Below assumes
> you've already finished that.

## What's inside

| File | Purpose |
|------|---------|
| `checklist_generator.template.gs` | Apps-Script generator (v5 template, Web variant, §4.8). Builds the 25-column grid: header, 3 platform blocks, page bands, sections, check rows, formatting, validation, conditional formatting, column/row groups, borders, autoResize. |
| `generate_via_api.template.mjs`   | Node adapter that executes the `.gs` directly via Google Sheets REST API (re-uses OAuth from the `google-sheets` MCP server — no Apps Script project required). |

## Workspace rules baked in

All current rules from [`../CHECKLIST_RULES.md`](../CHECKLIST_RULES.md)
are pre-applied. Highlights:

- Hierarchy: Page → Section → Check (API: `addPage` / `addSection` / `item`)
- Page band 2 rows; section names merged vertically in column A
- Page-name mirror cells (`H{p}:I{p}`, `P{p}:Q{p}`, `X{p}:Y{p}`) = `=A{p}` formula
- Collapsible column groups (`C:G`, `K:O`, `S:W`) with `+/−` on the right
- Per-section row groups
- Section-aware borders on A:B (no inner-horizontal lines inside a section)
- Section name font size 11; page-name mirror font size 12
- Header row font sizes (Platform 13 / Comments 14 / Passed-Failed labels 11)
- Auto-fit row height for check rows + page-band header
- B4 signature font color matches teal background (`#134f5c`)
- Multi-user portability: `MCP_DIR` auto-resolved from `.mcp.json`

## How to create a new checklist

1. **Copy the templates**

   ```sh
   PROJECT=<ProjectName>           # e.g. MyWebsite
   slug=<project_snake>            # e.g. my_website
   mkdir -p "$HOME/Projects/$PROJECT"
   cp Checklist/checklist-web/checklist_generator.template.gs \
      "$HOME/Projects/$PROJECT/${slug}_checklist.gs"
   cp Checklist/checklist-web/generate_via_api.template.mjs \
      "$HOME/Projects/$PROJECT/generate_via_api.mjs"
   ```

2. **Edit the `.gs`**
   - Rename `createChecklist` → `create<Project>HomeChecklist`
   - Update `FOLDER_PATH`, `FILE_NAME`, `AUTHOR`
   - Replace the example `addPage` / `addSection` / `item` block with real
     pages/sections from the Figma design

3. **Edit the `.mjs`**
   - `GS_PATH` → absolute path to your `.gs`
   - `GENERATOR_FN` → name of the function you just renamed
   - `FOLDER_PATH`, `FILE_NAME` → same values as in the `.gs`

4. **Run**

   ```sh
   cd "$HOME/Projects/$PROJECT"
   node generate_via_api.mjs
   ```

   You'll see `Using MCP dir: …` (confirms whose Drive is used), batch
   progress, `STEP 5 test: PASSED`, and the spreadsheet URL.

## Updating this template

If you add a new workspace rule that affects checklists:

1. Update [`../CHECKLIST_RULES.md`](../CHECKLIST_RULES.md) with the rule + date + author.
2. Bake the change into BOTH `checklist/` and `checklist-mobile/` so web
   and mobile stay in sync.
3. (Optional) re-run existing project generators to pull in the change —
   the templates are the source of truth; older project clones may lag.
