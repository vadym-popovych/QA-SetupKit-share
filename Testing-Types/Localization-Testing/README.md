# Localization-Testing kit

Home for **i18n/l10n QA** — verifying the app works and READS correctly across
locales. Two distinct layers with different oracles:

1. **i18n mechanics (automatable):** nothing hardcoded, layouts survive long
   strings, formats localize. Oracles: spec (CLDR formats) + invariants.
2. **Translation quality (needs-human or LLM-judge):** meaning, tone, terminology
   consistency. Oracle: calibrated LLM-judge rubric per language (Test-Oracles
   discipline) with native-speaker escalation.

## The check catalogue

| Check | Layer | How |
|---|---|---|
| Missing translations (raw keys `some.key.name`, English fallbacks on non-EN locale) | i18n | locale sweep: switch locale → crawl screens (Playwright/Maestro) → grep for key patterns + source-language artifacts |
| Truncation & overflow | i18n | pseudo-localization pass (`~30% longer strings, åçčéñťś`) or German/Ukrainian sweep + screenshot review (pairs with Visual-Regression per-locale baselines) |
| Date / number / currency formats | i18n | invariant per locale (CLDR): `1,234.56` vs `1 234,56`, DD.MM vs MM/DD; assert in API/UI checks |
| RTL (if Arabic/Hebrew in scope) | i18n | mirrored layout screenshots; text direction; icons that imply direction |
| Text in images / non-localizable content | i18n | screenshot review per locale |
| Encoding (`Ð¿Ñ€Ð¸Ð²Ñ–Ñ‚`-style mojibake, `?????`) | i18n | sweep + grep responses/UI for replacement chars |
| Terminology consistency (one term per concept per locale) | quality | glossary check — project term list vs UI strings |
| Meaning/tone of translations | quality | LLM-judge rubric per locale; borderline → native speaker (needs-human) |

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | Locale matrix, sweep procedure, pseudo-localization, quality rubric wiring |
| [`LOCALIZATION_RULES.md`](LOCALIZATION_RULES.md) | Reusable rules |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Paste block for a teammate's workspace `CLAUDE.md` |
| [`template/LOCALE-MATRIX.template.md`](template/LOCALE-MATRIX.template.md) | Locale × surface × priority matrix + per-locale CLDR format invariants |

## Where results go

Findings = `BUG-NNN` tagged `LOCALIZATION` (schema enum), locale named in
`component` (e.g. `uk: books list — date format`). Artefacts (sweep screenshots per
locale, filled locale matrix) → `<Project>/Localization-Testing/`. Locale scope and
priority come from the strategy (which locales ship = scope units of type `role`-like
weight — usually the owner's top market first).
