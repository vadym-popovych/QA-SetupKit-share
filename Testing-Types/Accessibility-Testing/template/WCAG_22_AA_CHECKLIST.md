<!-- Copy to <Project>/Accessibility-Testing/WCAG-checklist-<date>.md per round.
     Status: Passed / Failed / Skipped / "" — empty = not-run OR needs-human, ALWAYS
     with the reason / what-a-human-must-check in the Evidence column (per the
     Test-Oracles representation rule; the literal "needs-human" string lives only
     in oracle artefacts, never as a status value). Every verdict cites evidence
     (scan JSON, screenshot, manual note). QA-verifiable subset of WCAG 2.2 AA,
     mapped to this kit's checks — not the full spec text. -->

# <Project> — WCAG 2.2 AA checklist — round <date/build>

| SC | Name | How we check | Status | Evidence / bug |
|----|------|--------------|--------|----------------|
| 1.1.1 | Non-text content (alt) | axe scan | | |
| 1.3.1 | Info & relationships (semantics, labels) | axe + spot-check custom widgets | | |
| 1.4.1 | Use of color (not color-only) | manual visual | | |
| 1.4.3 | Contrast (minimum) 4.5:1 / 3:1 | axe + spot-check | | |
| 1.4.4 | Resize text 200% | manual zoom pass | | |
| 1.4.10 | Reflow at 320px/200% | manual zoom pass | | |
| 1.4.11 | Non-text contrast (UI parts 3:1) | axe + spot-check | | |
| 2.1.1 | Keyboard operable | keyboard pass | | |
| 2.1.2 | No keyboard trap | keyboard pass | | |
| 2.4.3 | Focus order | keyboard pass | | |
| 2.4.6 | Headings & labels descriptive | axe + review | | |
| 2.4.7 | Focus visible | keyboard pass | | |
| 2.4.11 | Focus not obscured (2.2) | keyboard pass | | |
| 2.5.8 | Target size ≥ 24px (2.2) / platform 44pt/48dp | screenshot review | | |
| 3.1.1 | Language of page set | axe | | |
| 3.2.1 | On focus — no context change | keyboard pass | | |
| 3.3.1 | Error identification announced | forms pass | | |
| 3.3.2 | Labels or instructions on inputs | axe + forms pass | | |
| 4.1.2 | Name, role, value on controls | axe + spot-check | | |
| 4.1.3 | Status messages (live regions) | forms/dynamic pass | | |
| — | Screen-reader end-to-end feel | VoiceOver/TalkBack walkthrough | | needs-human: <exact instructions for the owner — what to walk through and listen for> |

**Round summary:** <N passed / N failed (bugs: BUG-…) / N needs-human / N not-run+reason>
