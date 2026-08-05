# Test-Strategy rules (paste into your workspace CLAUDE.md)

Reusable rules for the QA planning layer. Machine-specific paths/accounts do NOT
belong here — keep those in your own workspace notes. Mirror new rules of this kind
here (+ into `CLAUDE.starter.md` and the workspace `CLAUDE.md`) so they travel with
the kit.

- **Strategy before deep testing.** Before starting any substantial testing effort for
  a project (first checklist run, first load test, security pass), check whether
  `<Project>/Test-Strategy/STRATEGY.md` exists. If not, offer to build it via
  `QA-SetupKit/Testing-Planning/Test-Strategy-and-Planning/SETUP.md` (inventory → 10-question interview
  → risk matrix → templates → owner approval). A quick one-off smoke check does NOT
  require a strategy — don't bureaucratize trivial asks.

- **The strategy is the agent's charter.** When a strategy exists, READ IT FIRST in any
  testing session and obey its scope: things marked out-of-scope are not tested (note
  them, don't silently expand scope); risk ranking sets execution order; depth mapping
  (risk 7–9 deep / 4–6 standard / 1–3 smoke) sets how much technique to apply.

- **Risk = likelihood (1–3) × impact (1–3).** Likelihood from bug history, complexity,
  novelty of the area; impact from user harm / money / data loss / reputation. Re-score
  after every testing round: what actually broke raises likelihood; what stayed quiet
  over multiple rounds may drop. The matrix lives in STRATEGY.md §4 and is mirrored in
  `strategy.json` for programmatic reads.

- **Entry/exit criteria must be checkable, not vibes.** Every level (round, release)
  gets criteria an agent can verify mechanically: "0 open Critical/Major", "checklist
  High-priority pages all statused", "load p95 < SLA on staging", "100% of in-scope endpoints
  hit at least happy-path". Never "quality is acceptable".

- **Stop criteria are explicit.** A testing round ends when ONE of: (a) exit criteria
  met; (b) time-box exhausted — report what was and wasn't reached; (c) diminishing
  returns — a full session/technique yields no new findings on an already-covered area;
  (d) blocked (environment down, accounts exhausted) — report the blocker, don't grind.
  NEVER stop silently: the plan file records which stop condition fired.

- **Skips are recorded, never silent.** Anything de-scoped by time-box or risk ranking
  is listed in the plan's "Not run" section with the reason — same ethos as the
  checklist rule "unreached screens = not-run, never Passed".

- **Escalate, don't decide, when:** sources of truth contradict (spec vs design vs
  behaviour — same as the checklist contradiction rule); a finding suggests scope
  expansion (new risk area mid-round); anything destructive is needed; exit criteria
  can't be met within the time-box (owner chooses: extend, descope, or ship-with-risk).

- **Owner approval gates the strategy.** Draft → short summary to the owner (scope
  in/out, top-5 risks, exit criteria, planned skips) → explicit approval → only then
  execute against it. Same for material strategy revisions.

- **Keep `strategy.json` in sync with `STRATEGY.md`.** The JSON is what other agents
  and scripts consume (scope units, risk table, criteria, current status). Update both
  in the same edit or not at all.

- **One plan per round.** Each release/build/testing round gets
  `<Project>/Test-Strategy/plans/<date>-<build>.md`: which strategy risks it addresses,
  its own exit criteria + time-box, and (after the round) results + which stop
  condition ended it. Plans are append-only history — never rewrite past plans.

- **Artefacts land in `<Project>/Test-Strategy/`** per the Project-Configuration
  convention. The kit folder holds templates/rules only — no project data.
