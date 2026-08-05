# Accessibility-Testing starter rules — paste into YOUR workspace CLAUDE.md

## Accessibility QA — Accessibility-Testing kit
- **Home:** `QA-SetupKit/Testing-Types/Accessibility-Testing/`. When asked to "перевірити доступність",
  "check accessibility / a11y", "WCAG check" → follow the kit's `SETUP.md`.
- **WCAG 2.2 AA = the oracle:** every verdict cites its success criterion; what
  automation can't decide (real screen-reader UX) → needs-human, never guessed.
- **Two layers:** axe-core scan via Playwright (reuse UI-Automation install) on ALL
  in-scope pages + agent-driven keyboard/focus/semantics/contrast pass on risk ≥ 7
  flows. Mobile: Maestro accessibility-label assertions + touch-target/contrast
  screenshot review via the emulator kit.
- **Triage like ZAP:** axe `incomplete` = needs-review; shared component = ONE bug.
- **Severity by user-group impact:** blocker for an assistive-tech group on a core
  flow = Major (tree #2), not Low. Findings = `BUG-NNN` tagged `A11Y` with the WCAG
  criterion named. Artefacts → `<Project>/Accessibility-Testing/`.

Full rules: `QA-SetupKit/Testing-Types/Accessibility-Testing/ACCESSIBILITY_TESTING_RULES.md`.
