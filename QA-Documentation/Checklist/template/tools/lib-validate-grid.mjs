// lib-validate-grid.mjs — the gate between a generated checklist grid and the Sheet.
// Zero dependencies beyond the kit's own validator.
//
// WHY (28/07/2026). checklist-row.schema.json described a checklist row for months and NOTHING
// produced or checked one: the grid went from the .gs generator straight into Sheets. A schema
// nothing validates is a wish, and the kit's own rule is "validate in the SAME turn as the write".
// This closes that: the adapter calls `assertGrid()` BEFORE the Sheets write, so a fabricated
// status cannot reach a checklist at all — the sheet is the artefact a human then trusts.
//
// It deliberately checks the two things a raw grid can PROVE, and says so rather than implying
// it validated the whole row:
//   1. the status vocabulary — every status cell is one of the four the schema allows;
//   2. check text length — a check too short to say anything is not a check.
// Page/section structure is positional in the grid and is NOT re-derived here; claiming to check
// it would be the same over-promise this file exists to remove.
//
// The vocabulary is READ FROM THE SCHEMA, never restated. That is the point: `Partial` is rejected
// because the schema says so, so the day the schema changes this gate changes with it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Locate checklist-row.schema.json from a tool that may have been copied into a project. */
function schemaPath(explicit) {
  const candidates = [
    explicit,
    process.env.CHECKLIST_ROW_SCHEMA,
    // kit layout: QA-Documentation/Checklist/template/tools/ -> Rules-Guide/schemas/
    path.resolve(HERE, '../../../../Rules-Guide/schemas/checklist-row.schema.json'),
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

/**
 * Check a 2-D grid of cell values before it is written.
 * @param {any[][]} grid        the values as they will be sent to Sheets
 * @param {object}  opts        { ncols, firstCheckRow = 7, schema }
 * @returns {{violations: string[], checked: object}}
 */
export function checkGrid(grid, opts = {}) {
  const violations = [];
  const sp = schemaPath(opts.schema);
  if (!sp) {
    // Fail closed: the caller decides, but an unfindable schema is never "fine".
    return { violations: ['checklist-row.schema.json not found — set CHECKLIST_ROW_SCHEMA; refusing to claim the grid was checked'], checked: {} };
  }
  const schema = JSON.parse(fs.readFileSync(sp, 'utf8'));
  const allowed = schema?.properties?.statuses?.items?.enum;
  const minCheck = schema?.properties?.check?.minLength ?? 1;
  if (!Array.isArray(allowed)) {
    return { violations: ['checklist-row.schema.json has no statuses[].enum — the vocabulary this gate reads is gone'], checked: {} };
  }

  // Geometry, from the ONE formula the kit documents: NCOLS = 3P + 22, and each of the 3 blocks
  // starts P+7 columns after the previous. Derived, never hardcoded per template — a second copy
  // of the geometry is how the web and mobile generators would drift apart.
  const ncols = Number(opts.ncols);
  if (!Number.isFinite(ncols) || (ncols - 22) % 3 !== 0) {
    return { violations: [`NCOLS=${opts.ncols} does not fit the kit's NCOLS = 3P + 22 geometry — refusing to guess where the status columns are`], checked: {} };
  }
  const P = (ncols - 22) / 3;
  const CHECK_COL = 1;                                   // column B
  const blockStarts = [0, 1, 2].map((b) => 2 + b * (P + 7));   // column C, then +P+7 per block
  const firstCheckRow = (opts.firstCheckRow ?? 7) - 1;   // 0-based

  let statusCells = 0, checkRows = 0;
  for (let r = firstCheckRow; r < grid.length; r++) {
    const row = grid[r] || [];
    const check = typeof row[CHECK_COL] === 'string' ? row[CHECK_COL].trim() : '';
    if (!check) continue;                                // band / spacer / empty row
    checkRows++;
    if (check.length < minCheck)
      violations.push(`row ${r + 1}: check text "${check}" is shorter than the schema's minimum of ${minCheck} — a check that says nothing cannot be decided`);
    for (const start of blockStarts) {
      for (let c = start; c < start + P; c++) {
        const v = row[c];
        if (v === undefined || v === null) continue;
        const s = String(v);
        statusCells++;
        if (!allowed.includes(s))
          violations.push(`row ${r + 1}, column ${c + 1}: status "${s}" is not in the schema's vocabulary [${allowed.map((x) => `"${x}"`).join(', ')}] — the result column COMPUTES Partial, it is never typed into a status cell`);
      }
    }
  }
  return { violations, checked: { checkRows, statusCells, platforms: P, schema: sp } };
}

/** checkGrid + refuse: prints and exits non-zero rather than writing a bad checklist. */
export function assertGrid(grid, opts = {}) {
  const { violations, checked } = checkGrid(grid, opts);
  if (violations.length) {
    console.error(`\nchecklist grid REFUSED — ${violations.length} violation(s) before writing to Sheets:`);
    violations.forEach((v) => console.error(`  ✗ ${v}`));
    console.error('Nothing was written. Fix the generator, not the sheet.\n');
    process.exit(1);
  }
  console.log(`grid checked against checklist-row.schema.json: ${checked.checkRows} check row(s), ${checked.statusCells} status cell(s), ${checked.platforms} platform column(s) per block. (Vocabulary + check length only — page/section structure is positional and not re-derived.)`);
}
