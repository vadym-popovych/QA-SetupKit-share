# Oracle decision tree — pick the right oracle per area

Walk this top-down for each AREA of checks (screen, endpoint group, content type).
First "yes" wins — it's the strongest applicable oracle. Record the answer in
`<Project>/Test-Oracles/ORACLES.md`.

```
1. Is there an explicit source of truth for this output?
   (Figma frame, OpenAPI/Postman schema, acceptance criteria, legal/copy doc)
   YES → SPECIFICATION oracle. Note the exact source (node-id, schema ref).
   NO ↓

2. Is the output stable across runs AND do we have a known-good version?
   YES → GOLDEN-MASTER. Capture baseline into golden/ (screenshot, response
         snapshot). Diff on every run; baseline changes only deliberately.
   NO ↓

3. Does another implementation of the same behaviour exist?
   (other platform, previous build, competitor as reference)
   YES → DIFFERENTIAL. Define what MUST match (data, flow outcomes) vs what may
         differ (styling, timing).
   NO ↓

4. Can you state properties that must ALWAYS hold, regardless of exact output?
   (counts, bounds, schema-validity, referential integrity, "every X has Y")
   YES → INVARIANT. One line each into invariants.md; assert in every run.
        (Usually ALSO applies alongside 5–7 — invariants stack with anything.)
   Exact output still undecidable ↓

5. Can you state how a CHANGE in input must change the output?
   (same input twice → same shape; narrower filter → subset; add one → count+1;
    create→read round-trip returns what was written)
   YES → METAMORPHIC. Document the relations per area.
   NO ↓

6. Is there an expectation source, just not a formal one?
   (product's own behaviour elsewhere, comparable products, marketing claims,
    user expectations — HICCUPPS)
   YES → CONSISTENCY heuristic. Weakest automated oracle — pair with a comment
         explaining WHICH consistency was used.
   NO ↓

7. Is the output generative/creative content (LLM text, images)?
   YES → LLM-JUDGE with a fixed, CALIBRATED rubric
         (template/llm-judge-rubric.template.md). Borderline → needs-human.
   NO ↓

8. HUMAN oracle. Mark the check "needs-human" with what exactly to look at.
   Never auto-Pass. If this area is high-risk (risk ≥ 7 in the strategy),
   flag to the owner that it has no automatable oracle — that's a project risk.
   NOTE — checklist Sheets representation: "needs-human" is a verdict CATEGORY,
   not a new Sheet status. In a checklist the dropdown stays Passed/Failed/Skipped;
   a needs-human check is recorded per the existing convention as an EMPTY status
   cell + a Comment saying what a human must look at. The literal "needs-human"
   string appears only in oracle artefacts (ORACLES.md, rubric verdicts).
```

## Quick examples

| Check | Tree lands on |
|---|---|
| "Login screen matches design" | 1 — spec (Figma node) |
| "API response shape correct" | 1 — spec (schema) |
| "Screens look same as last release" | 2 — golden-master (visual diff) |
| "iOS and Android show same totals" | 3 — differential |
| "Every chapter has a cover URL" | 4 — invariant |
| "Search with stricter filter" | 5 — metamorphic (subset) |
| "Price format matches rest of app" | 6 — consistency |
| "Generated book reads coherently" | 7 — LLM-judge rubric |
| "Animation feels polished" | 8 — human |
