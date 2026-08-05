# Test-Oracles kit

Home for **oracle strategies** — the discipline of deciding whether an observed result
is **correct**. Every execution kit can drive the app and capture what happened; the
oracle is what turns "here is what happened" into **Passed / Failed / needs-human**.

> **Why this is the hardest AI-QA problem.** A human tester carries an implicit oracle
> (experience + specs + taste). An AI agent must have it made EXPLICIT, or it will
> confidently mark wrong things Passed — the exact failure the workspace rule
> "never fake a Pass" exists to prevent. This kit encodes the **"Oracle" judgment**
> from [`../../Rules-Guide/Roadmap/AI-QA-ROADMAP.md`](../../Rules-Guide/Roadmap/AI-QA-ROADMAP.md).

## The catalogue — 8 oracle strategies

Ordered by **strength** (prefer the strongest available for each check):

| # | Oracle | How it decides | Best for | Example |
|---|--------|----------------|----------|---------|
| 1 | **Specification-based** | compare to an explicit source of truth | anything with a spec | Figma frame (layout/copy), Postman/OpenAPI schema (response shape), acceptance criteria |
| 2 | **Golden-master** | diff against a captured known-good snapshot | stable outputs, regression | screenshot vs baseline (visual diff), API response snapshot, generated PDF |
| 3 | **Differential (A/B)** | compare two implementations/versions/platforms of the same thing | ports, refactors, parity checks | iOS vs Android same flow; new build vs previous build; staging vs spec env |
| 4 | **Invariant / property-based** | assert properties that must ALWAYS hold | data integrity, business rules | balance ≥ 0; IDs unique; every chapter has a cover URL; response always validates against schema |
| 5 | **Metamorphic** | exact output unknowable → test RELATIONS between runs | non-deterministic systems, search/ML | same input twice → same class of output; narrower filter → subset of results; add item → count+1 |
| 6 | **Consistency heuristics (HICCUPPS)** | consistent with History, Image, Comparable products, Claims, User expectations, Product itself, Purpose, Statutes | exploratory, no formal spec | same value shown on two screens must match; behaviour matches marketing claims |
| 7 | **LLM-as-judge (rubric)** | score generative output against a FIXED rubric, calibrated | LLM-generated content | <Project> book: completeness vs plan, coherence, language, no error-text — see [`template/llm-judge-rubric.template.md`](template/llm-judge-rubric.template.md) |
| 8 | **Human oracle** | escalate — no automated oracle exists | taste, ethics, unclear intent | "does this animation feel right"; contradiction between spec and design |

**The floor rule:** a check with NO identified oracle is **not-run / needs-human** —
never Passed. An oracle-less "Pass" is a guess wearing a status.

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | How to assign oracles to checks/cases for a project + calibrate LLM-judges |
| [`TEST_ORACLES_RULES.md`](TEST_ORACLES_RULES.md) | The reusable rules (oracle discipline) |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Condensed block for a teammate's workspace `CLAUDE.md` |
| [`template/ORACLE_DECISION_TREE.md`](template/ORACLE_DECISION_TREE.md) | Pick-an-oracle procedure (agent-followable) |
| [`template/llm-judge-rubric.template.md`](template/llm-judge-rubric.template.md) | Rubric skeleton for scoring LLM-generated content |
| [`template/invariants.example.md`](template/invariants.example.md) | Project invariant list — example shape |

## Deliverables & where they live

Per [Project-Configuration](../../Rules-Guide/Project-Configuration/README.md), project-specific
oracle artefacts land in:

```
<Project>/Test-Oracles/
├── ORACLES.md                 # per-area oracle assignments (which strategy checks what)
├── invariants.md              # the project's always-true properties
├── rubrics/                   # filled LLM-judge rubrics (+ calibration samples)
└── golden/                    # golden-master baselines (screenshots, response snapshots)
```

## Relationship to other kits

- **Checklist / Emulator runs:** every checklist row's Pass/Fail decision names its
  oracle (usually spec-based = Figma; the existing "flag contradictions with a comment"
  rule is the oracle-conflict rule).
- **API-Testing:** schema validation = spec oracle; response snapshots = golden-master;
  cross-endpoint consistency = invariants.
- **Load-Testing:** thresholds (p95 < SLA) = invariant oracles over metrics; <Project>
  story-content analysis = LLM-judge rubric.
- **Security-Testing:** access-control matrix = invariant oracle ("user B must NEVER
  read user A's object").
- **Test-Strategy:** the strategy's risk matrix decides WHERE strong oracles are worth
  the setup cost (golden masters and calibrated judges are expensive — spend them on
  risk ≥ 7 areas).
