# Accessibility-Testing rules (paste into your workspace CLAUDE.md)

Reusable rules for a11y QA. Machine-specific paths do NOT belong here. Mirror new
rules of this kind here (+ into `CLAUDE.starter.md` and the workspace `CLAUDE.md`)
so they travel with the kit.

- **WCAG 2.2 AA is the oracle.** Every a11y verdict cites its success criterion
  (`WCAG 1.4.3`, `2.1.1`, …) — a spec oracle per the Test-Oracles discipline. A check
  with no criterion behind it is an opinion, not a finding. What automation can't
  decide (real screen-reader UX) → needs-human, never guessed.

- **Scan everything, hand-check by risk:** the axe-core scan is cheap — run it on
  every in-scope page each round; the manual keyboard/focus/semantics pass follows
  the strategy's depth mapping (risk ≥ 7 flows first).

- **Triage like ZAP:** axe `incomplete` = needs-review, not a violation; one shared
  component with a violation = ONE bug (dedup), not one per page it appears on.

- **Severity by user-group impact, not cosmetics:** an issue that BLOCKS an
  assistive-tech user group on a core flow (keyboard trap, unlabeled primary action)
  is **Major** via tree #2 (core feature, no workaround for that group) — resist the
  reflex to file a11y as Low. Contrast/format issues with workarounds → Medium/Low
  per the tree honestly.

- **Findings are `BUG-NNN` tagged `A11Y`** (tag is in the bug schema enum), WCAG
  criterion named in the row. Artefacts (scan JSONs, filled WCAG checklist, reports)
  → `<Project>/Accessibility-Testing/` per Project-Configuration.

- **Reuse, don't duplicate infra:** Playwright comes from the UI-Automation kit's
  install; mobile driving comes from the emulator kit (Maestro label assertions) +
  touch-target size (≥ 44pt iOS / 48dp Android) and contrast review.
  This kit adds only axe + the checklists + the discipline.
