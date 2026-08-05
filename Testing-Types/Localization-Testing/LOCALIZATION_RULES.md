# Localization-Testing rules (paste into your workspace CLAUDE.md)

Reusable rules for i18n/l10n QA. Machine-specific paths do NOT belong here. Mirror
new rules of this kind here (+ into `CLAUDE.starter.md` and the workspace
`CLAUDE.md`) so they travel with the kit.

- **Two layers, two oracle classes:** i18n mechanics (missing keys, truncation,
  CLDR formats, RTL, encoding) are spec/invariant oracles — automatable, sweep every
  priority locale; translation QUALITY (meaning, tone, terminology) is LLM-judge
  (calibrated per locale) with native-speaker escalation for borderline and
  high-visibility strings (paywall, legal, onboarding).

- **Locale scope from the strategy:** shipped locales only, top market first.
  Format checks are INVARIANTS per locale (CLDR), seeded with known values from
  Test-Data — assert in API/UI runs like any invariant.

- **Pseudo-localization before real translations:** ~30% longer accented strings
  expose truncation earlier and cheaper than post-translation sweeps; no test locale
  → longest shipped locale as proxy (record the gap).

- **Findings = `BUG-NNN` tagged `LOCALIZATION`**, locale named in `component`;
  severity by the tree honestly (broken paywall string in the top market = Major;
  truncated settings label = Low). One shared string/component = ONE bug (dedup),
  not one per locale it renders in — unless the failure IS locale-specific.

- **Artefacts → `<Project>/Localization-Testing/`** (locale matrix, per-locale sweep
  screenshots, glossary). Per-locale visual baselines live with Visual-Regression —
  reference, don't duplicate.
