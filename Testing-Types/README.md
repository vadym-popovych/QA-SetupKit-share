# Testing-Types — the discipline kits

One folder per **testing discipline** (moved here from the QA-SetupKit root,
12/07/2026). The planning/process kits live in
[`Testing-Planning/`](../Testing-Planning/), the reference/convention layer in
[`Rules-Guide/`](../Rules-Guide/); QA-Documentation and infra
(`MCP-configurations/`) stay at the kit root — they are cross-cutting, not
testing types.

This table is a **generated projection** of the folder list (`kit-lint` L12 keeps it
honest; a discipline folder added without a row here fails the lint).

<!-- kit:generated:disciplines source=Testing-Types -->
| Kit | Discipline | Project folder |
|---|---|---|
| [`API-Testing/`](API-Testing/) | functional/integration API testing (correctness) | `<Project>/API-Testing/` |
| [`Accessibility-Testing/`](Accessibility-Testing/) | axe-core + keyboard/focus passes, WCAG 2.2 AA oracle | `<Project>/Accessibility-Testing/` |
| [`App-Emulators-configurations/`](App-Emulators-configurations/) | emulator/simulator rounds: build → Maestro → checklist | `<Project>/Emulator-Testing/` |
| [`Compatibility-Testing/`](Compatibility-Testing/) | usage-driven browser/OS/device matrix, tiered depth | `<Project>/Compatibility-Testing/` |
| [`Exploratory-Testing/`](Exploratory-Testing/) | SBTM chartered sessions, tours, HICCUPPS oracles | `<Project>/Exploratory/` |
| [`Load-Testing/`](Load-Testing/) | k6 smoke → load → stress, p95/p99, Grafana Cloud | `<Project>/Load-Testing/` |
| [`Localization-Testing/`](Localization-Testing/) | i18n sweeps + LLM-judged translation quality | `<Project>/Localization-Testing/` |
| [`Regression-Testing/`](Regression-Testing/) | selection over existing artefacts, fix verification | records in `<Project>/Test-Strategy/plans/` |
| [`Security-Testing/`](Security-Testing/) | grey-box: IDOR/auth/headers/rate-limits, ZAP | `<Project>/Security-Testing/` |
| [`UI-Automation/`](UI-Automation/) | locator artefacts for autotests (Playwright capture) | `<Project>/UI-Automation/` |
| [`Visual-Regression-Testing/`](Visual-Regression-Testing/) | golden-master pixel diffs, baseline discipline | `<Project>/Visual-Regression/` |
| [`Web-Testing/`](Web-Testing/) | web/landing rounds: design vs Figma + animations + responsive + cross-browser | `<Project>/Web-Testing/` |
<!-- /kit:generated -->

Full direction table with SETUP/starter links: [root README](../README.md).
Project-folder convention: [`Project-Configuration/`](../Rules-Guide/Project-Configuration/README.md).
