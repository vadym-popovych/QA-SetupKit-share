# Compatibility-Testing rules (paste into your workspace CLAUDE.md)

Reusable rules for compatibility QA. Machine-specific paths do NOT belong here.
Mirror new rules of this kind here (+ into `CLAUDE.starter.md` and the workspace
`CLAUDE.md`) so they travel with the kit.

- **The matrix is usage-driven and owner-signed:** cells weighted by real analytics
  (or recorded market-default assumptions), tiered T1 (≥10%/critical — full pass) /
  T2 (1–10% — smoke + risk ≥ 7) / T3 (<1% — renders) / OUT (unsupported — declared
  behaviour verified once). "Works on my machine/emulator" never ships as "works
  everywhere" — untested cells are visible in the matrix, not implied.

- **Same checks, many cells — never per-cell test suites:** Playwright projects and
  emulator boot targets re-run the SAME specs/flows; writing browser-specific tests
  is a smell (the check belongs to the base suite; the CELL is the parameter).

- **Differential oracle across T1 cells:** data and flow outcomes must match;
  behaviour differences are bugs; look differences triage into platform convention
  (note once) vs layout break (bug).

- **Per-cell visual baselines only for T1** — every baseline is a maintenance
  liability (Visual-Regression rule).

- **Findings = `BUG-NNN` tagged `COMPAT`**, cell in `component`
  (`Safari 17 / iPhone SE: …`). Matrix re-weights logged like strategy revisions.
  Artefacts → `<Project>/Compatibility-Testing/` (MATRIX.md + per-cell run notes).

- **Default device/resolution range when NO matrix exists yet (Vadym, 10/07/2026):**
  mobile apps — small screens (iPhone SE class, 320–375 pt / compact Androids) →
  standard phones → tablets (where supported), minimum 1 small + 1 standard (+ 1 tablet)
  per platform per full round. Web — verify layout at every **viewport class**; the classes
  and their widths belong to Web-Testing, which runs them
  ([`../Web-Testing/WEB_TESTING_RULES.md`](../Web-Testing/WEB_TESTING_RULES.md) rule 2), and
  are deliberately NOT restated here: the numbers live in that kit's capture `config.json`,
  and a second copy drifts away from the tool that executes it. Horizontal overflow, clipped
  content or broken nav at any class = bug. Once a usage-driven MATRIX.md exists, its tiers
  override this default.
