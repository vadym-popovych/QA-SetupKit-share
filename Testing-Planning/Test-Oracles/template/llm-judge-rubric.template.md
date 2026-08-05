<!-- Copy to <Project>/Test-Oracles/rubrics/<content-type>.md and fill.
     A rubric is only trustworthy AFTER calibration (§ Calibration below). -->

# LLM-judge rubric — <content type, e.g. "generated book chapter">

| | |
|---|---|
| **Judges** | <model/setup — must be INDEPENDENT of the generator: separate context, never the generating conversation> |
| **Calibrated** | <YYYY-MM-DD> on <N good + N bad samples> (see § Calibration) |
| **Pass threshold** | total ≥ <X>/<max> AND no dimension at 1 AND no auto-fail triggered |
| **Borderline band** | within <1> point of threshold → **needs-human**, not auto-Pass |

## Auto-fail conditions (check BEFORE scoring — any hit = Failed, skip the rubric)
<!-- Mechanical, script-checkable disqualifiers. Cheap to run, catch the worst. -->
- [ ] contains error/placeholder text ("as an AI", "lorem", raw JSON, stack trace)
- [ ] empty or truncated mid-sentence
- [ ] wrong language (expected: <lang>)
- [ ] violates a hard constraint from the generation request (<e.g. protagonist name, chapter count>)

## Dimensions (score each 1–5; anchor every level to observable facts)

### 1. Constraint adherence — does it follow the brief?
<!-- The generation request/plan is the closest thing to a spec — weight it highest. -->
- 5: every element of the request present (genre, characters, setting, plot beats)
- 3: minor omissions, nothing contradicting the request
- 1: ignores or contradicts the request

### 2. Completeness & structure
- 5: full arc for its scope; no dangling scene; length within expected range
- 3: complete but abrupt/thin in places
- 1: fragment, missing sections, repeated blocks

### 3. Coherence & continuity
- 5: no contradictions within the text or vs prior chapters/source book (names, facts, timeline)
- 3: small slips a reader would forgive
- 1: characters/facts mutate mid-text

### 4. Language quality
- 5: clean grammar/spelling; register consistent
- 3: a few errors, doesn't impede reading
- 1: frequent errors, unreadable passages

### 5. <Domain dimension — e.g. "reads as a sequel: continuity with source book">
<!-- Add per content type. Delete if unused. -->

## Verdict mapping
- **Passed**: total ≥ threshold, no dimension = 1, no auto-fail
- **needs-human**: borderline band · judges disagree by ≥ 2 on any dimension · anything the rubric doesn't cover
- **Failed**: below threshold or any auto-fail → file `BUG-NNN` with the scored rubric as evidence
  <!-- Project-specific reporting destinations OVERRIDE the generic BUG-NNN default:
       e.g. <Project> content-quality findings go into the colleague's «Story analysis»
       sheet following ITS structure (Description | Severity | Comment, severity
       Critical/Major/Medium/Low), with the scored rubric linked as evidence. BUG-NNN
       in the QA Sheet applies only where no such destination exists. -->

## Calibration (do this BEFORE trusting the rubric — record results here)
1. Collect 3–5 known-GOOD and 3–5 known-BAD samples (owner-verdicted).
2. Judge all blind. Required: every bad ranks below every good, verdicts match the owner's.
3. Failing that → tighten anchor wording (the usual culprit), re-run.
4. Re-calibrate when: generator model changes · rubric changes · judge starts
   disagreeing with human spot-checks.

| Date | Samples | Result | Notes |
|------|---------|--------|-------|
| <YYYY-MM-DD> | <5 good / 5 bad> | <10/10 ranked correctly> | <> |
