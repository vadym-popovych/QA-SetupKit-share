# Compatibility-Testing starter rules — paste into YOUR workspace CLAUDE.md

## Compatibility QA — Compatibility-Testing kit
- **Home:** `QA-SetupKit/Testing-Types/Compatibility-Testing/`. Requests "перевір у різних
  браузерах / на різних девайсах", "compatibility pass" → follow the kit's `SETUP.md`.
- **Usage-driven, owner-signed matrix:** cells (browser×version / OS×device-class)
  weighted by analytics or recorded market defaults; tiers T1 (≥10%/critical — full
  pass) / T2 (1–10% — smoke + risk ≥ 7) / T3 (<1% — renders) / OUT (declared
  behaviour verified once). Untested cells stay visible, never implied-green.
- **Same checks, many cells:** Playwright projects per browser + emulator boot
  targets re-run the SAME specs/flows — per-cell test suites are a smell. Per-cell
  visual baselines only for T1.
- **Differential oracle across T1:** outcomes must match; behaviour diff = bug;
  look diff = platform convention (note once) vs layout break (bug).
- **Findings = `BUG-NNN` tagged `COMPAT`**, cell in `component`. Artefacts →
  `<Project>/Compatibility-Testing/` (MATRIX.md + run notes); re-weights logged.

- **Default range without a matrix (Vadym, 10/07/2026):** mobile — small (iPhone SE
  class) → standard → tablet, min 1 small + 1 standard (+ 1 tablet) per platform;
  web — every breakpoint class: mobile → tablet → desktop → large. The classes and their
  widths belong to Web-Testing, which runs them (`Web-Testing/WEB_TESTING_RULES.md` rule 2);
  the numbers live in that kit's capture `config.json` and are deliberately not copied here,
  because a second copy drifts away from the tool that executes it. Overflow, clipped content
  or broken nav at any class = bug.

Full rules: `QA-SetupKit/Testing-Types/Compatibility-Testing/COMPATIBILITY_RULES.md`.
