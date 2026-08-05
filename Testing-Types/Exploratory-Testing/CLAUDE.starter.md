# Exploratory-Testing starter rules — paste into YOUR workspace CLAUDE.md

## Exploratory testing — Exploratory-Testing kit
- **Home:** `QA-SetupKit/Testing-Types/Exploratory-Testing/`. Requests "поексплорь", "потикай
  область X", "exploratory session" → follow the kit's `SETUP.md` (SBTM).
- **No charter, no session:** one-sentence mission ("Explore <area> with <tour> to
  find <risk>") + time-box (agent: stated tool-call budget, ~40 calls) + debrief.
  Tours: interruption · repetition · sequence · data-extremes · state-contamination ·
  resource-starvation · back-button/backgrounding.
- **Oracle every anomaly** (HICCUPPS consistency heuristics); no articulable oracle →
  question for the owner, not a finding. Stay on charter — side-smells become new
  charter candidates, not detours.
- **Findings feed forward:** bug → `BUG-NNN` (dedup first); confirmed surprise →
  invariant and/or regression `TC-NNN`. Debrief states % charter explored + what was
  NOT touched — charter coverage, never area coverage.
- **Artefacts:** `<Project>/Exploratory/sessions/<date>-<slug>.md` (append-only).

Full rules: `QA-SetupKit/Testing-Types/Exploratory-Testing/EXPLORATORY_RULES.md`.
