# Localization-Testing starter rules — paste into YOUR workspace CLAUDE.md

## Localization QA — Localization-Testing kit
- **Home:** `QA-SetupKit/Testing-Types/Localization-Testing/`. Requests "перевір локалізацію",
  "check translations / i18n" → follow the kit's `SETUP.md`.
- **Two layers:** i18n mechanics (raw keys, truncation via pseudo-localization or
  longest-locale proxy, CLDR date/number/currency invariants, RTL, mojibake) =
  automatable sweeps per priority locale; translation QUALITY = calibrated LLM-judge
  per locale + native-speaker escalation for borderline/high-visibility strings.
- **Scope = shipped locales from the strategy, top market first.** Format checks are
  per-locale INVARIANTS seeded from Test-Data.
- **Findings = `BUG-NNN` tagged `LOCALIZATION`**, locale in `component`; shared
  string = ONE bug unless the failure is locale-specific. Severity by the tree
  (broken paywall string in top market = Major).
- **Artefacts → `<Project>/Localization-Testing/`** (matrix, sweeps, glossary);
  per-locale visual baselines belong to Visual-Regression.

Full rules: `QA-SetupKit/Testing-Types/Localization-Testing/LOCALIZATION_RULES.md`.
