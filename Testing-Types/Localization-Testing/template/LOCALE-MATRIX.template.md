<!-- Copy to <Project>/Localization-Testing/LOCALE-MATRIX.md. Shipped locales only
     (from the strategy); ambitions beyond them are out of scope — record as such.
     Re-weight when the shipped-locale set or market priorities change; log below. -->

# <Project> — Locale matrix

| | |
|---|---|
| **Shipped locales source** | <strategy §2 / owner, date> |
| **Top market** | <locale — gets the full pass first> |

## The matrix

| Locale | Surface (web / iOS / Android) | Priority | i18n sweep (last round, verdict) | Quality pass (rubric / native-speaker, date) |
|--------|-------------------------------|----------|----------------------------------|---------------------------------------------|
| uk | web + iOS + Android | High (top market) | | |
| en | web + iOS + Android | High (source locale) | | |
| <…> | | | | |

## Out of scope (not shipped — recorded, not tested)
| Locale | Why out |
|--------|---------|

## Format invariants per locale (CLDR — assert in runs, mirror into invariants.md)
| Locale | Date | Number | Currency |
|--------|------|--------|----------|
| uk | DD.MM.YYYY | 1 234,56 | 1 234,56 ₴ |

## Revision log
| Date | Change | Why | By |
|------|--------|-----|-----|
