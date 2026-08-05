# Accessibility-Testing kit

Home for **accessibility (a11y) QA** — verifying the app is usable with assistive
technologies and degraded abilities: keyboard-only, screen readers, low vision
(contrast/zoom), motor limitations (target sizes). Grey-box, same ethos as the other
kits: automated scans catch the mechanical ~40%, agent-driven checks cover the rest,
and **WCAG 2.2 AA is the oracle** (a SPEC oracle in Test-Oracles terms — every verdict
cites a success criterion, e.g. `WCAG 1.4.3 contrast`).

## Scope — what a QA can verify

1. **Automated scan (web):** axe-core injected via Playwright (reuse the
   UI-Automation kit's capture infra) — missing alt/labels, contrast, ARIA misuse,
   landmark structure, duplicate IDs. Fast, broad, zero false-positive tolerance
   claims — triage like ZAP findings.
2. **Keyboard & focus (web):** tab order matches visual order, no traps, visible
   focus indicator, all interactive elements reachable and operable (Enter/Space),
   modals trap-and-return focus.
3. **Screen-reader semantics:** every control has an accessible name/role; images
   alt-texted or hidden; form errors announced; dynamic updates use live regions.
4. **Visual:** contrast ≥ 4.5:1 text / 3:1 large-text-and-UI, 200% zoom without loss,
   no color-only signaling.
5. **Mobile (emulator kit reuse):** accessibility labels present (Maestro can assert
   them), touch targets ≥ 44×44pt iOS / 48×48dp Android, TalkBack/VoiceOver spot
   checks are needs-human (recorded per the oracle rules).

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | Scan setup (axe via Playwright) + manual-check procedure |
| [`ACCESSIBILITY_TESTING_RULES.md`](ACCESSIBILITY_TESTING_RULES.md) | Reusable rules |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Paste block for a teammate's workspace `CLAUDE.md` |
| [`template/`](template/) | [`a11y-scan.mjs`](template/a11y-scan.mjs) + [`WCAG_22_AA_CHECKLIST.md`](template/WCAG_22_AA_CHECKLIST.md) |

## Where results go

Findings = `BUG-NNN` rows tagged `A11Y` (severity by the Bug-Reports tree — a11y
blockers for whole user groups are Major, not "cosmetic Low"). Artefacts →
`<Project>/Accessibility-Testing/` (scan JSONs, per-page reports, WCAG checklist
copies) per Project-Configuration. Depth follows the strategy: risk ≥ 7 user-facing
flows get the full manual pass; the automated scan is cheap enough to run on
EVERYTHING in scope.
