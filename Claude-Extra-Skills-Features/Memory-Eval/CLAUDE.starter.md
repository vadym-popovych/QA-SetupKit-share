# Memory-Eval starter rules — paste into YOUR workspace CLAUDE.md

## Measuring an always-on memory file — Memory-Eval kit
- **Home:** `QA-SetupKit/Claude-Extra-Skills-Features/Memory-Eval/` — "did that compression drop a
  rule", "score the memory file after the refactor", "run the eval on the CLAUDE.md" → its
  `SETUP.md` + `MEMORY_EVAL_RULES.md`, exactly. **Trigger:** a **structural** change to an
  always-on memory file (section rebuild, dedup-merge, detail moved one hop into a kit) → run the
  net BEFORE closing the chat; an unchanged file gets no run (a scheduled pass burns budget on
  nothing). Companion of Knowledge-Distillation: distillation compresses, Memory-Eval measures
  that it survived.
- **A red is a QUESTION, never a verdict** — "is the config wrong, or is the oracle?" (on a config
  that never adopted the rule, a third answer). Adjudicate against a source of truth, never by
  re-running until the number moves; suspect the **oracle** first — on the installation this kit
  came from, every real defect the instrument produced was an oracle defect, not a config defect.
  **Editing the memory file to make a score go green is fabricating a Pass at the instrument
  level** — the same sin as re-recording a golden, and it propagates into every later run
  undetectably.
- **Pin model + retrieve effort + judge effort, and record them INTO the result.** Unrecorded
  conditions = a number comparable to nothing, including its own baseline; an unpinned run is
  `not-run` for baseline purposes, however green. The same rule when **reading** a number: a score
  with no model beside it is history, not a property — including the ones this kit's own docs
  quote, which are one installation's measurements on a model nobody wrote down.
- **Never a fabricated cell:** the retriever never grades itself (a separate judge does, and it
  never sees the memory file); a crashed / timed-out / empty cell is `not-run` — never a pass,
  never a fail, never a quietly shrunken denominator; a net that shrank to nothing is **blocked**,
  not green.
- **Launch is a 🟡 gate:** a net is dozens of agents (`--dry-run` prints the exact count and spawns
  nothing) — show count + pinned conditions + your own estimate, then WAIT; ≥25% headroom, never
  at ≥90%. **The gate hook FLAGS, it never RUNS** — a hook that quietly launches a net at 90%
  budget is a grenade in someone else's session.
- **Results are LOCAL, never kit content:** the answers quote your memory file verbatim, so they
  carry every name, id, host and path it carries. Scenarios, baselines and results live next to
  the file they measure.
