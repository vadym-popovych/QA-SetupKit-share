# Exploratory-Testing kit

Home for **structured exploration** — session-based test management (SBTM):
time-boxed, CHARTERED sessions that hunt for what scripted checks can't anticipate.
Exploratory is not "random clicking": each session has a charter (mission), a
time-box, an oracle set (HICCUPPS consistency heuristics, per
[Test-Oracles](../../Testing-Planning/Test-Oracles/README.md) #6), and produces a debrief with the same
reporting rigor as any run.

> **Where it fits for an AI agent:** the derived suites (Test-Cases) cover what the
> spec anticipates; exploration covers what it doesn't — interrupted flows, weird
> sequences, state contamination, "what if I do it twice". The agent explores WELL
> when the charter constrains it and the tour patterns give it moves; the findings
> feed back into cases and invariants (every confirmed surprise becomes a regression
> case or an invariant).

## Session anatomy (SBTM)

| Element | Rule |
|---|---|
| **Charter** | one mission sentence: "Explore <area> with <resources/tour> to find <kind of risk>" |
| **Time-box** | 30–90 min (agent: a tool-call budget, e.g. ~40 calls); hard stop, then debrief |
| **Oracle set** | HICCUPPS: consistent with History, Image, Comparable products, Claims, User expectations, Product itself, Purpose, Statutes |
| **Debrief** | notes → bugs (dedup rule) / new invariants / new case candidates / % charter covered / next charters |

## Tour patterns (the agent's move set)

- **Interruption tour:** kill/suspend/resume mid-flow (mid-payment, mid-generation) — what survives?
- **Repetition tour:** do everything TWICE (double-submit, re-unlock, re-create) — idempotency.
- **Sequence tour:** legal steps, illegal order (checkout before cart; read before unlock).
- **Data-extremes tour:** longest/emptiest/weirdest inputs on real flows (share fixtures with Test-Data).
- **State-contamination tour:** switch accounts/roles mid-session; stale tabs; expired sessions.
- **Resource-starvation tour:** slow network, offline mid-action, full quota/slots (409/402 paths).
- **Back-button tour (web) / backgrounding tour (mobile):** navigation history vs app state.

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | Running a session: charter → time-box → tour → debrief |
| [`EXPLORATORY_RULES.md`](EXPLORATORY_RULES.md) | Reusable rules |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Paste block for a teammate's workspace `CLAUDE.md` |
| [`template/SESSION.template.md`](template/SESSION.template.md) | Charter + notes + debrief skeleton |

## Where results go

`<Project>/Exploratory/sessions/<date>-<charter-slug>.md` (one file per session,
append-only history). Charters come from the strategy (risk ≥ 7 areas get exploratory
depth) and from bug clusters ("where there was one, there are more"). Confirmed
findings → `BUG-NNN` (dedup first); surprises worth keeping → invariants.md or a new
`TC-NNN` regression case.
