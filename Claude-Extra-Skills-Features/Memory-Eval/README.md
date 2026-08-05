# Memory-Eval kit

Home for **memory evaluation** — measuring whether an agent's always-on memory file (its
`CLAUDE.md`) still surfaces the right rule at the moment that rule applies. For each scenario a
**fresh agent** reads the memory file and names the governing rule plus the action it would take;
a **separate judge** scores that answer against the scenario's oracle. Score = passes / total.

It exists so that restructuring or compressing a memory file is **measured, not guessed** — the
companion of [`../Knowledge-Distillation/`](../Knowledge-Distillation/): distillation compresses
the memory, Memory-Eval checks it survived. The harness gives you subagents; it does not give you
scenarios, oracles, an independent judge, pinned run conditions or a baseline — those are the
**practice this kit defines**.

Three things you can run, and the distinction is load-bearing:

| Kind | Trigger | Cost | Gate |
|---|---|---|---|
| **The net** — fresh retriever + independent judge per scenario | *"run the eval on the memory file"*, *"I compressed `CLAUDE.md` — did a rule get lost?"* | `2 × N` agents — dozens | owner starts it, explicitly |
| **The gate** — hashes the target, warns **once per (session, hash)** when it differs from the last green | *"the file changed and nobody re-ran the eval"* | ~free (a prompt hook) | **it flags, it NEVER runs** |
| **The discrimination selftest** — feeds the judge answers wrong **by construction** (+ a positive control); a judge that passes them grades nothing | *"does the judge actually catch a wrong answer?"* | `4 stubs × efforts × draws` — **36 agents** at the default `low,medium,high` × 3 | 🟢 auto |

## Core principles (non-negotiable)

1. **Maker-checker separation.** The retriever never grades its own answer. The judge is a
   separate agent and — structurally — **never reads the memory file**: it sees only the
   situation, the oracle and the answer. At judging time the oracle *is* the entire source of
   truth (per [`../../Testing-Planning/Test-Oracles/`](../../Testing-Planning/Test-Oracles/)).
2. **The oracle is the weak component.** Every real defect this instrument produced traced to an
   oracle, never to the judge: one scenario's premise was simply **false** (it asked what to do in
   a situation the config does not have), so the net punished the correct answer and reported a
   false red; another was **under-specified**, never saying what would make an answer wrong, so
   contradictory answers both satisfied it. A judge cannot discriminate against an oracle that
   decides nothing. Hence every `oracleCheck` names what makes an answer **WRONG**, not only what
   satisfies it, and carries an `oracleSource` anchor — the shipping kit file whose text makes it
   true, and the thing you adjudicate a red against.
3. **A red is a QUESTION, never a verdict.** *"Is the config wrong, or is the oracle?"* —
   adjudicate against a source of truth (the kit, the owner), never by editing the config until
   the score goes green. **Editing the config to green a score is fabricating a Pass at the
   instrument level** — the same move as re-recording a golden, one layer up.
4. **Run conditions are part of the instrument.** Model and effort are pinned per run and
   **recorded into the result**; a baseline whose conditions are unknown is not a baseline. Left
   unrecorded, runs are silently incomparable and nobody notices.
5. **Audit trail.** Each run writes its result next to the memory file it measured, never into
   the kit (see below).

## ⚠️ What Memory-Eval cannot measure

- **Flow cost — the big one, and the one a green score is most often misread as covering.** Look
  at what the retriever is actually told: the prompt is literally *"Read the workspace rules file
  FIRST … `cat <file>`"*, and the retriever is the only agent spawned with Bash. **Every cell
  therefore measures a fresh, deliberate, complete re-read.** Real work does not do that: it
  carries the file in context and follows a pointer only if something makes it look. So a green
  score says a rule is **findable in the file when an agent goes looking** — it does **not** price
  a rule that now lives one hop away in a kit, and it cannot: nothing in the net ever declines to
  take the hop. Move detail out of the core, score green, and you have proven the rule **was not
  lost**; you have **not** proven the hop is taken in a session that was never told to look.
  **A green score is not "the memory is good."** It is "nothing was dropped from the text a
  motivated reader would find." Those come apart exactly where compression puts things.
- **Whether a red is a regression.** A red means one of three things: the file dropped the rule,
  the oracle is wrong, or your file never adopted that rule at all. Only the first is a
  regression, and the instrument cannot tell you which you have (principle 3).
- **"Nothing regressed" — from the shipped mocks.** [`scenarios.example.json`](scenarios.example.json)
  is authored against this kit's doctrine: it measures **doctrine adoption and scenario shape**,
  not *"did my refactor drop MY rule"*. A regression net for your own file is scenarios you write
  about your own rules.
- **Variance you never measured.** n=1 on each side is not an experiment; a difference is a
  question until it reproduces. (A hypothesis that judge effort inflates the score was stated in
  bold on n=1 vs n=1 and **refuted** by a 30-cell sweep: effort moved enumeration ~1.8× and cost
  ~30%, outcomes not at all. A 36-cell follow-up fed the judge wrong-rule / right-rule-wrong-action
  / keyword-stuffed answers **plus a positive control** — 4 stubs × 3 judge efforts × 3 draws —
  and scored **36/36 correct, zero wrong answers passed**: the judge reads the ACTION, not the
  label. That is what left authoring as the weak component. It is
  [`judge-discrimination.js`](judge-discrimination.js), and it is re-runnable — SETUP step 8.)

## What lives here (scope)

- [`SETUP.md`](SETUP.md) — Claude-followable onboarding: preconditions, pin the run conditions,
  author scenarios, first run, record the baseline, install the gate.
- [`MEMORY_EVAL_RULES.md`](MEMORY_EVAL_RULES.md) — the rules that travel with the kit.
- [`scenarios.example.json`](scenarios.example.json) — the scenario format (`id` · `situation` ·
  `oracleRule` · `oracleCheck`, plus the `oracleSource` anchor the runners carry into every
  result) + kit-anchored mocks. The shape teaches; no config is named.
- [`eval-workflow.js`](eval-workflow.js) — the net: retriever + judge per scenario, fan-out.
  Needs the `Workflow` tool's `agent()`/`pipeline()` globals — **not** runnable with `node`.
- [`sweep-runner.mjs`](sweep-runner.mjs) — the same net from the CLI, for sweeps and for hosts
  where the `Workflow` tool is absent; needs only `node` + the `claude` CLI. Model, efforts and
  paths come from flags **or** env (the flag wins), and it **fails closed** when a condition is
  unpinned. `node sweep-runner.mjs --help` prints the full contract.
- [`judge-discrimination.js`](judge-discrimination.js) — the selftest that proves the judge can
  fail a wrong answer; its four stubs are **inlined in the script**, and it needs the `Workflow`
  tool too.
- [`eval-gate.sh`](eval-gate.sh) — the drift flag (POSIX `sh`; target from `EVAL_GATE_TARGET`,
  fails loud at install time on an unset/missing target, a missing hasher or no baseline);
  [`.last-green.example`](.last-green.example) documents the baseline format — it is comments
  only, never copy it to `.last-green`.
- [`CLAUDE.starter.md`](CLAUDE.starter.md) — block a teammate pastes into THEIR workspace `CLAUDE.md`.

## What does NOT live here

- **No `<Project>/Memory-Eval/` folder — ever**, and **no run results in the kit**. A result
  embeds the agents' answers, which quote the measured file **verbatim**: results carry whatever
  that file carries. They belong beside the file they measured, outside the kit.
- **No baseline, no warn-state.** `.last-green` is a hash of *your* file; the `.warned/` state
  holds live session ids. Both are per-machine, gitignored, written by your own first green run.
  A shipped baseline can never match a teammate's file — the gate would cry wolf on every prompt,
  or (if they paste someone else's hash) go silent on their real drift.
- **No scenario whose oracle asserts one workspace's private config** — false by construction for
  everyone else, and it manufactures false reds (principle 2).

## Relationship to the other kits

- **[`../Knowledge-Distillation/`](../Knowledge-Distillation/)** — the method this eval is the
  regression test for. Its gap audit proves no rule was *dropped from the text*; this proves the
  rules that remain are still *retrieved*. Neither substitutes for the other.
- **[`../../Testing-Planning/Test-Oracles/`](../../Testing-Planning/Test-Oracles/)** — oracle
  discipline + the calibrated-judge rule (independent of the generator, borderline → needs-human).
  This kit is that rule applied to a memory file.
- **[`../Loop-Engineering/`](../Loop-Engineering/)** — the maker-checker sibling: the fixer never
  grades its own result, the retriever never grades its own answer. Its "never fake a Pass in a
  loop" and principle 3 here are one rule, one layer apart.
- **[`../Usage/`](../Usage/)** + [`../Cron-Session/`](../Cron-Session/) — session budget. A full
  run is dozens of agents; **the gate flags, it never launches one** — a hook that quietly starts
  a run at 90% budget is a grenade. And warn-once is keyed on **(session, hash)**, not on the hash
  alone: keyed on the hash, one parallel chat eats the only warning and every other chat gets
  silence. A gate flagging into the void is worse than no gate — it manufactures the feeling that
  the rule is held.
- **[`../../Rules-Guide/DOCTRINE.md`](../../Rules-Guide/DOCTRINE.md)** — §1 and §2, at the
  instrument level (principles 2 and 3).
