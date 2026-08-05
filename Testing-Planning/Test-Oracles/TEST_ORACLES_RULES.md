# Test-Oracles rules (paste into your workspace CLAUDE.md)

Reusable rules for deciding pass/fail objectively. Machine-specific paths/accounts do
NOT belong here. Mirror new rules of this kind here (+ into `CLAUDE.starter.md` and
the workspace `CLAUDE.md`) so they travel with the kit.

- **Every verdict names its oracle.** Before marking anything Passed/Failed, be able to
  answer "correct according to WHAT?" — Figma node, schema, golden baseline, invariant,
  metamorphic relation, calibrated rubric. A check with no identifiable oracle is
  **not-run / needs-human**, NEVER Passed. (This is the generalization of the
  checklist rule "never fake a Pass".) In checklist SHEETS, "needs-human" is a verdict
  category, not a new dropdown status: represent it as an EMPTY status cell + a Comment
  saying what a human must look at (dropdown values stay Passed/Failed/Skipped); the
  literal "needs-human" string lives only in oracle artefacts (ORACLES.md, rubrics).

- **Record the oracle in the run-result — don't just think it.** The "correct according
  to WHAT?" answer is a field, not a private thought: `run-result.schema.json` carries an
  optional `oracle` {`type`, `source`} at the top level and per-case in `results[]`. A
  `pass`/`fail` run-result that leaves it empty is an **incomplete artefact** — the verdict
  is not yet substantiated and a reviewer treats it as not-yet-decided. `aborted`/`blocked`
  runs need no oracle (there is no verdict to justify), which is why the field stays optional
  in the schema. `type` is one of the 8 below; `source` names where it lives (spec section,
  golden path, `INV-N`, rubric path, the WCAG criterion cited). Canonical shape:
  [`CI-Integration/template/run-result.example.json`](../CI-Integration/template/run-result.example.json).

- **Use the strongest oracle available.** Strength order: explicit spec → golden-master
  → differential → invariant → metamorphic → consistency heuristic → LLM-judge → human.
  Don't LLM-judge what a schema can validate; don't eyeball what a pixel-diff can decide.

- **Oracle conflict = flag, don't pick silently.** When two oracles disagree (Figma says
  X, spec doc says Y, app does Z), record the contradiction with a comment and escalate
  — even if the row is ultimately marked Passed. (Same ethos as the existing
  checklist-contradiction rule; it applies to ALL testing types.)

- **Invariants are the cheapest strong oracle — harvest them.** Every business rule and
  every past bug implies one ("every generated chapter has a cover URL" ⇐ BUG-003).
  Keep them one-line and script-checkable in `<Project>/Test-Oracles/invariants.md`;
  assert them in every run of every discipline (k6 checks, API assertions, Playwright).

- **Golden masters change deliberately, never conveniently.** A red diff means either a
  bug (file it) or an intended change (owner confirms → update baseline, note build +
  date). Silently re-recording a baseline to make a test green is fabricating a Pass.

- **Do not fabricate a Fail either — an oracle can be wrong.** When a check goes red,
  before filing a bug, ask whether the *expectation* is correct. If the observed behaviour
  is actually the product's real (and defensible) model and the test encoded a wrong
  assumption, that is a **test defect** — fix the oracle against the confirmed behaviour,
  re-run, and file NO bug. This is the mirror of "never fake a Pass": a false Fail wastes a
  triage cycle, cries wolf, and erodes trust in the suite exactly as a false Pass erodes
  trust in the product. Distinguish them by grounding the expected value in a source
  (spec / confirmed live shape / owner), not in what seemed reasonable when the case was
  written. *(Live example, <Project> 12/07: an "accessible == generated" oracle failed
  until the generation look-ahead was confirmed on Dev — the real invariant is
  one-directional; the app was right, the test was not.)*

- **LLM-judge discipline (for generative content):**
  - fixed written rubric with per-dimension scales and pass thresholds — no freestyle
    "rate this text";
  - **calibrate before trusting:** known-good + known-bad samples must be ranked
    correctly and match the owner's verdicts; record calibration date + samples;
  - the judge must be INDEPENDENT of the generator (different prompt/context at
    minimum; never "the same conversation grades its own output");
  - borderline scores (within 1 point of threshold) → needs-human, not auto-Pass;
  - re-calibrate on generator change, rubric change, or judge-vs-human drift.

- **Ground the LLM-judge in scripted evidence (Vadym, 09/07/2026).** Before the judge
  pass, run cheap mechanical pre-checks over the artefact and hand their output to the
  judge: entity-mention counts, name-span extraction (which chapters/sections a name
  appears in), completeness checks (empty/truncated parts), timeline-marker extraction.
  Every claim in the verdict must be re-verifiable by script (`grep`-able counts, quoted
  chapter+line) — "Halven 13 mentions in ch6–7, Halren 19 in ch18–20, spans don't
  overlap" is a finding; "the names feel inconsistent" is not. A verdict whose evidence
  can't be re-run is opinion, not an oracle.

- **Expert focus-checks (C-checks) in rubrics (Vadym, 09/07/2026).** When a domain
  expert names recurring weak spots of generated content, encode each as a DEDICATED,
  independently-scored check (C1, C2, …) alongside the general dimensions — scored on
  every artefact, with an auto-flag threshold (score ≤2 ⇒ must surface as a finding/bug,
  even if the overall average passes). Focus-checks refine but never replace the general
  dimensions, and they don't enter the overall mean — they exist so a known failure mode
  can't hide behind a good average.

- **Derived-content continuity oracles (Vadym, 09/07/2026).** Any generative feature
  that produces content FROM existing content (sequel/prequel of a book, translation,
  summary, "continue this document") gets two standing invariants:
  - **Direction/position:** the derivative occupies its declared position relative to
    the source — a prequel's events strictly precede the source (and must not
    "pre-discover" the source's late reveals), a sequel starts from the source's final
    state (no resets of resolved arcs), a summary asserts nothing absent from the
    source. Red flag: the derivative re-tells the source's inciting event.
  - **Canon vocabulary preservation:** load-bearing proper nouns of the source (people,
    places, institutions) either appear in the derivative or are absent for a
    plot-plausible reason; nothing is silently renamed; the derivative's own names stay
    stable across its parts (non-overlapping spelling spans = rename defect).
  Both are cheap to assist mechanically (top-N proper-noun overlap, opening-scene
  similarity) before any judge pass.

- **Metamorphic relations for the non-deterministic:** when exact output is unknowable,
  test relations — determinism class (same input → same SHAPE of output), monotonicity
  (narrower filter → subset), conservation (add one → count+1), round-trip
  (create→read returns what was written). Document per area in `ORACLES.md`.

- **Oracles are fallible — track their misses.** False alarm or missed bug → note in
  `ORACLES.md` and adjust. An oracle nobody audits drifts into rubber-stamping.

- **Artefacts land in `<Project>/Test-Oracles/`** (`ORACLES.md`, `invariants.md`,
  `rubrics/`, `golden/`) per the Project-Configuration convention. Exception:
  SCREENSHOT golden masters canonically live in `<Project>/Visual-Regression/golden/`
  (Visual-Regression-Testing kit) — Test-Oracles' `golden/` only references them, one
  copy ever. Kit folder holds templates/rules only — no project data, no baselines.
