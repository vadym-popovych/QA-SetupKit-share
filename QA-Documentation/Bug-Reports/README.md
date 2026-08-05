# Bug-Reports — defect reporting standard

Home for the **bug-report document type**: what a `BUG-NNN` must contain, how severity
is decided (by rubric, not gut), how duplicates are prevented, and what makes a repro
trustworthy. The **canonical home of bugs stays the team QA Google Sheet** (`Bug
Reports` tab, incrementing `BUG-NNN`) — this kit standardizes WHAT lands in those rows
(row shape: [`Rules-Guide/schemas/bug.schema.json`](../../Rules-Guide/schemas/bug.schema.json)).

> **For an AI agent** the rubric is the point: severity assigned by decision tree is
> consistent and defensible; severity assigned by vibes is noise the team learns to
> ignore. Same for dedup — an agent that files the same backend stall as five bugs
> across five runs poisons the tracker.

## Severity — decision tree (walk top-down, first match wins)

```
1. Data loss/corruption, security breach (auth bypass, IDOR, PII leak),
   money charged wrongly, or app unusable for ALL users (crash on launch,
   core flow dead)?                                          → Critical
2. Core feature broken for a significant user group with NO workaround,
   or a PAID feature not delivering what was paid for?       → Major
3. Feature broken but a workaround exists, or non-core feature broken,
   or noticeable quality degradation at scale?               → Medium
4. Cosmetic, minor UX friction, rare edge case with easy workaround?  → Low
```

- Security findings may additionally use `High`/`Info` per the
  [Security-Testing kit scale](../../Testing-Types/Security-Testing/SECURITY_TESTING_RULES.md).
- Calibration examples from a real project: generation stalls losing a paid book —
  **Major** (tree #2); ~24% of chapters missing cover images — **Medium** (tree #3,
  degradation at scale); one mislabeled button — **Low**.

## Severity ≠ priority

**Severity** = objective impact (QA decides, via the tree). **Priority** (`P0–P3`) =
fix order (owner/team decides — business call). The agent PROPOSES a priority
(severity + how central the area is in the strategy risk matrix) but marks it as a
proposal; never presents its priority as decided.

## Repro discipline

Numbered minimal steps **from a clean, stated state** (account, build, environment);
expected vs actual as separate fields; flaky bugs carry a RATE ("3 of 10 attempts"),
not "sometimes"; every claim has evidence (run log, screenshot, sheet tab, response
body) linked, not pasted secrets. A bug someone else can't reproduce from the report
alone is not finished.

## Dedup rule

BEFORE filing: search existing open `BUG-NNN` for the same **component + failure
signature** (same endpoint/screen + same wrong outcome). Match → do NOT file a new
bug: add an occurrence note/evidence link to the existing one (new run id, new rate).
Genuinely new manifestation of a known root cause → new bug with a "related to
BUG-XXX" note. Wrongly filed duplicate → `status: duplicate` + `duplicateOf`.

## The invariant tie-in (Test-Oracles)

Every bug implies a violated invariant. When filing, ask "which line of
`<Project>/Test-Oracles/invariants.md` did this break?" — reference it
(`invariantViolated: INV-N`) or ADD the missing invariant. Every fixed bug also gets
a regression test case tracing to it (Test-Cases rules).

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | Filing procedure: detect → minimal repro → dedup → severity → file → link back |
| [`BUG_REPORTS_RULES.md`](BUG_REPORTS_RULES.md) | Reusable rules |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Paste block for a teammate's workspace `CLAUDE.md` |
| [`template/bug.example.json`](template/bug.example.json) | Schema-valid example report |
