# Localization-Testing — SETUP (Claude-followable)

Prerequisites: app drivable per locale (web: Playwright with `locale`/URL param;
mobile: simulator language via the emulator kit) + the list of SHIPPED locales from
the owner/strategy. Translation-quality rubrics need the Test-Oracles LLM-judge
calibration flow.

## Procedure

### 1. Locale matrix (once, then maintain)
Copy [`template/LOCALE-MATRIX.template.md`](template/LOCALE-MATRIX.template.md) →
`<Project>/Localization-Testing/LOCALE-MATRIX.md`: locale × surface (web / iOS /
Android) × priority (from the strategy — top market first) + per-locale CLDR format
invariants. Ambitions beyond shipped locales are out of scope (record as such).

### 2. i18n sweep per priority locale (automatable)
1. Switch locale (browser `locale` + app language setting / simulator language).
2. Crawl the in-scope screens (reuse UI-Automation routes / Maestro flows),
   screenshot each → `<Project>/Localization-Testing/sweeps/<locale>/`.
3. Mechanical greps over DOM/text dumps: raw key patterns (`\w+\.\w+\.\w+`),
   source-language artifacts on non-source locale (configurable word list),
   mojibake/replacement chars.
4. Format invariants: seed known values (Test-Data) → assert date/number/currency
   render per CLDR for that locale (one invariant per format per locale —
   invariants.md).
5. Screenshot review for truncation/overflow — pairs naturally with per-locale
   Visual-Regression baselines where they exist.

### 3. Pseudo-localization (before real translations exist, or per release)
If the app supports a test locale: strings `~30%` longer + accented
(`[!! Šéťťîñgš !!]`) → any layout that breaks WILL break in German/Ukrainian.
No test-locale support → use the longest shipped locale as proxy (note the gap).

### 4. RTL pass (Arabic / Hebrew — whenever an RTL locale is in the matrix)
An RTL locale runs step 2 like every other locale (keys, formats, encoding); this
step covers what the direction flip itself breaks and step 2 cannot see, because a
mirrored layout is a different layout, not the same one read backwards.

1. **Flip the direction, then VERIFY it flipped — don't assume.** Web: Playwright
   context `locale: 'ar'` / `'he'` plus the app's own language setting or URL param,
   then assert `document.documentElement.dir === 'rtl'` (or
   `getComputedStyle(<main container>).direction === 'rtl'`) before anything else.
   Mobile: simulator/emulator system language, the same per-locale drive the
   emulator kit uses. The app did NOT flip → that is finding #1 and the rest of the
   pass is **blocked**, not Passed — every downstream check would be grading the LTR
   layout.
2. **RTL planned but not shipped yet → forced-RTL proxy**, the same move as
   pseudo-localization in step 3: Playwright `addInitScript` setting
   `document.documentElement.dir = 'rtl'`; on iOS the "Right-to-Left
   Pseudolanguage" scheme option; on Android the "Force RTL layout direction"
   developer option (restart the app after toggling). It exposes hardcoded
   left/right layout only — it exercises no translations, fonts or shaping. Locales
   outside the shipped set are out of scope per step 1: record the gap in the
   matrix and file findings as CANDIDATES, not `BUG-NNN`.
3. **Mirrored screenshot pass.** Same route list, same viewports/devices as the LTR
   run **of the same round** → `<Project>/Localization-Testing/sweeps/<locale>/`.
   The LTR shots are the reference half of each pair; reusing an older LTR set makes
   every unrelated change between the rounds read as an RTL defect.
4. **What to look at, per screen, against the pair:**
   - **Must mirror** (direction-implying): back/forward and next/previous arrows,
     chevrons and disclosure indicators, reply/undo/redo, progress bars and slider
     fill, drawer/menu and sidebar side, breadcrumb and path separators, swipe and
     drag affordances, badge/avatar anchoring.
   - **Must NOT mirror:** logos and brand marks, photos and illustrations, media
     playback controls (play/skip keep their transport convention), clocks and
     other real-world objects, checkmarks. A mirrored logo is as much a defect as
     an unmirrored back arrow — both come from one blanket flip applied without an
     asset list, which is why the list in point 5 is the oracle.
   - **Text alignment:** body, labels and headings align to the trailing (right)
     edge; input caret and placeholder start on the right; a column and its header
     move together — a right-aligned header over a still-left-aligned column is a
     defect, not a style choice.
   - **Numerals:** the locale's digit set (Latin vs Arabic-Indic) renders
     CONSISTENTLY within a screen — two digit sets side by side is a defect; the
     CLDR date/number/currency invariants from step 2.4 still hold in RTL; a field
     that RENDERS a digit set must ACCEPT it back on input.
   - **Mixed LTR content inside an RTL line:** URLs, emails, file paths, code and
     IDs, version strings, phone numbers stay left-to-right as a unit, with their
     punctuation at the end it belongs to — `example.com/path` reordered to
     `/path example.com`, or a trailing `.`/`:`/`)` jumping to the wrong side, is
     the classic bidi defect and it is invisible in the LTR run.
   - **Truncation in the mirrored direction:** the ellipsis must clip the trailing
     end, and overflow now escapes the opposite edge, so the LTR truncation verdict
     does NOT transfer — re-check in RTL every string cleared in step 2.5.
5. **Verdict — name the oracle** (Test-Oracles doctrine: a check with no
   identifiable oracle is not-run/needs-human, NEVER Passed):
   - direction, alignment, digit-set and bidi rules = **invariants**, one line each
     in `<Project>/Test-Oracles/invariants.md`, cited as `INV-N` in the verdict;
   - content parity across the LTR/RTL pair = a **metamorphic relation**: flipping
     direction changes arrangement, never which elements and strings are present —
     an element missing, empty, or clipped only in the RTL shot is a defect;
   - which assets mirror = a **spec** oracle: RTL design frames, or an
     owner-confirmed mirror list in
     `<Project>/Localization-Testing/RTL-ASSETS.md` (agent drafts it from the icon
     inventory, owner confirms ONCE, later rounds are then mechanical). Neither
     exists → those items are needs-human, not Passed, and the mirror list is the
     thing to ask the owner for.

   Statuses are per screen: a screen not reached in RTL is not-run, never Passed —
   "the locale loaded" is a verdict about the switch, not about the layout.

### 5. Translation quality (per locale, risk-scoped)
1. Terminology: project glossary (owner supplies or agent drafts from the source
   locale → owner confirms) → sweep UI strings for violations.
2. Meaning/tone: LLM-judge rubric per locale (copy the Test-Oracles rubric template;
   dimensions: accuracy vs source, register, terminology adherence; CALIBRATE on
   known-good/bad samples). Borderline or high-visibility strings (paywall, legal) →
   needs-human native speaker.

### 6. File findings
`BUG-NNN` tagged `LOCALIZATION`, locale in `component`; severity honestly (a broken
paywall string in the top market is Major — tree #2 paid feature; a truncated label
in a settings submenu is Low). Sweep artefacts + filled matrix →
`<Project>/Localization-Testing/`.
