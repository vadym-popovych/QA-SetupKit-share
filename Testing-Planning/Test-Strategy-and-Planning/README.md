# Test-Strategy-and-Planning kit

Home for the **planning layer of QA** — deciding *what to test, how deeply, in what
order, and when to stop* BEFORE any test execution starts. This is the **charter**
module: every other kit (Checklist, Load-Testing, API-Testing, Security-Testing, …)
answers "how do I execute X"; this kit answers "should X be executed at all, with what
priority, and what does *done* mean".

> **Why this matters for an AI agent.** An agent with tools but no strategy either
> tests forever or tests at random. The strategy document is the agent's contract:
> scope in/out, risk-ranked priorities, entry/exit criteria, stop criteria, and
> escalation rules. Every testing session starts by reading it and ends by checking
> against it. See [`../../Rules-Guide/Roadmap/AI-QA-ROADMAP.md`](../../Rules-Guide/Roadmap/AI-QA-ROADMAP.md) —
> this kit encodes the **"Scope" judgment**.

## What lives here (scope)

1. **Test strategy per project** — the long-lived master document: product map, quality
   goals, risk assessment, test levels & types selected, environments, test-data needs,
   entry/exit criteria, stop criteria, Definition of Done, escalation rules.
2. **Test plan per release/build** — the short-lived slice: what THIS round covers,
   which strategy risks it addresses, its own exit criteria and time-box.
3. **Risk-based prioritization** — likelihood × impact matrix; risk score drives test
   order and depth. High-risk areas get deep multi-technique coverage; low-risk get
   smoke-level only.
4. **Machine-readable summary** — `strategy.json` beside the human doc, so agents can
   programmatically read scope, priorities, and criteria without parsing prose.

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | How Claude builds a strategy for a project (sources → interview → fill → file) |
| [`TEST_STRATEGY_RULES.md`](TEST_STRATEGY_RULES.md) | The reusable rules (the agent's charter discipline) |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Condensed block to paste into a teammate's workspace `CLAUDE.md` |
| [`template/STRATEGY.template.md`](template/STRATEGY.template.md) | Master strategy skeleton with per-section guidance |
| [`template/TEST_PLAN.template.md`](template/TEST_PLAN.template.md) | Per-release/build plan skeleton |
| [`template/strategy.example.json`](template/strategy.example.json) | Machine-readable summary — example/schema |

## Deliverables & where they live

Per the [Project-Configuration](../../Rules-Guide/Project-Configuration/README.md) convention,
filled-in documents land in the project folder:

```
<Project>/Test-Strategy/
├── STRATEGY.md            # master strategy (living document, versioned log inside)
├── strategy.json          # machine-readable summary (kept in sync with STRATEGY.md)
└── plans/
    └── 2026-07-10-build-1.4.md   # one plan per release/build/testing round
```

The strategy can ALSO be mirrored to a Google Doc for the team (same Drive discipline
as other kits) — but the workspace copy is the source of truth the agent reads.

## Relationship to other kits

- **Consumes:** Figma designs (screens = scope units), Postman collections (endpoints =
  scope units), existing checklists/bug history (known weak areas feed the risk matrix).
- **Feeds:** every execution kit. The strategy's risk ranking decides which checklist
  pages get deep passes, which endpoints get load/security testing first, and what the
  agent may skip. Bug outcomes feed BACK into the risk matrix on each revision.
