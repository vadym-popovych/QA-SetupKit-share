# Memory-Eval rules — measuring whether a memory file still surfaces the right rule

Rules Claude follows when asked to "run the eval on the memory file", "check the config still
works after the refactor", "did the compression drop a rule", "score the CLAUDE.md" or similar.
Mirrored from the workspace `CLAUDE.md` of the kit author so they travel with the kit.

## 0. What Memory-Eval is here

**A memory file is not verified by reading it. It is verified by measuring what an agent
retrieves from it at the moment of action.** Reading proves a rule is *present*; only a
retrieval measurement proves it *fires*. A file can be complete, correct, and silently ignored
— that gap is invisible to review, and it is what this instrument measures.

**The shape.** Per scenario: a fresh agent gets the memory file plus a `situation` (facts + a
decision question, nothing else) and must name the governing rule and the action it takes. A
**separate** judge scores that answer against the scenario's oracle. Score = `passes / total`.
Nothing else is a Memory-Eval result.

**What the harness gives vs what this kit adds.** The harness gives you subagents and a model
— no notion of a memory file, no oracle, no separate grader. Those are the practice defined
here: a **scenario set** with falsifiable, anchored oracles (§1) · **pinned, recorded run
conditions** (§2) · a **judge independent of the retriever** (§5) · an adjudication procedure
for a red (§3) + a hard ban on greening by edit (§4).

**Its companion is [`../Knowledge-Distillation/`](../Knowledge-Distillation/):** distillation
compresses the memory file, Memory-Eval checks it survived. A gap audit proves no rule is
*missing from the text*; this proves none is *unreachable in practice*. Run it before and after
any structural rewrite — the before-run is what makes the after-run mean anything.

**The parts, by role** (which file plays each role — and how to run them — is the README's job;
these rules bind whatever runs them): the **scenario set** you author · the **net** that pairs a
retriever agent with a judge agent per scenario — it ships as **two runners**, a `Workflow`-tool
one and a headless CLI one, and they are **not quite the same instrument** (§5.1) · a **judge
self-test** that feeds known-wrong answers (§5.2) · the **gate** that flags drift without running
anything (§8).

## 1. The scenario set is the instrument — everything else is plumbing

**On the installation this module came from**, every real defect the instrument produced traced
to an **oracle** — not to the model, not to the effort, not to the runner; the experiments on
record (§7, §5.2) went looking elsewhere and found nothing. That is one workspace's history on
one model, not a law of nature — but it is the only evidence there is, and all of it points at
authoring. Author scenarios as if they were the only component that can be wrong, because so far,
where anyone has looked, they are.

### 1.1 At grading time the oracle IS the source of truth
The judge is handed the `situation`, the oracle, and the answer. **It never reads the memory
file and never reads the kit.** An oracle is therefore not documentation *about* the truth —
while judging it *is* the truth, in full. Everything below follows from that one mechanic.

### 1.2 An oracle must be falsifiable — say what makes an answer WRONG
Each oracle states what satisfies it **and** an explicit `WRONG if …` clause naming what
falsifies it — in both directions where both exist (over-reaction and under-reaction). An
oracle that only describes the right answer is not a weak test but an **unfalsifiable** one: an
answer and its negation both satisfy it, and the cell scores green forever measuring nothing.

> **Cautionary tale — the under-specified oracle.** One oracle never said what would make an
> answer wrong. Two contradictory answers both passed it. Nothing failed, nothing announced it,
> and the cell counted toward the score for weeks. *A judge cannot discriminate against an
> oracle that decides nothing.*

A `WRONG if` clause is greppable, and both runners do grep for it (`/WRONG if/i`) — but they
**warn, they do not reject**. A set whose oracles decide nothing still runs, still prints a score,
and the warning scrolls past on stderr. The lint is real; the enforcement is you. What the runners
*do* refuse is a scenario missing `id` / `situation` / `oracleRule` / `oracleCheck` — and they
refuse it differently, which is worth knowing before you read a number: `sweep-runner.mjs` fails
the whole set closed (exit 2, nothing runs, no result written), while `eval-workflow.js` runs the
rest and books the malformed one as a **not-run cell that stays in the denominator** (§6).

### 1.3 An oracle describes the flow as it IS, not as the config claims
Write the oracle from the **verified flow**, then anchor it (§1.5). An oracle asserting a
premise the flow does not have punishes the correct answer and reports a red that no amount of
re-running can resolve.

> **Cautionary tale — the false premise.** A scenario asked what to do when "you must set a
> severity while filing a bug". In that workspace severity was **not a tracker field at all** —
> the premise was simply false. The net punished the only correct answer and reported a false
> red against a config that was right. The bug was in the instrument, and it took an
> adjudication (§3), not a re-run, to find it.

Corollaries, all learned from that one scenario:
- **Over-strict is a defect symmetrical to over-loose.** An oracle demanding more than the flow
  demands manufactures false reds. Every `WRONG if` clause traces to doctrine or to shipping
  kit text — never to the author's taste.
- **Never encode one installation's configuration as ground truth.** An oracle asserting a
  particular tracker's workflow, a machine's repo layout, or a rule marked "not for the kit" is
  auto-red for everyone else, on a *correct* config.
- **A red on a teammate's config may be a third thing:** not "the config is wrong", not "the
  oracle is wrong", but **the rule was never adopted there**. Shipping a set without saying so
  manufactures false regressions.

### 1.4 The situation may never name or paraphrase its own rule
State facts and a decision question. A situation that quotes its own governing rule makes
retrieval trivial, scores permanent green, and measures the paraphrase instead of the memory
file.

### 1.5 Every oracle carries an anchor
Each scenario names the source that makes its oracle true (`oracleSource`: a doctrine section
or a shipping kit RULES file). **An oracle with no anchor cannot be adjudicated when it goes
red** — and a red that cannot be adjudicated silently becomes a verdict (§3). This is precisely
how the false-premise scenario rotted.

Enforcement, honestly: `sweep-runner.mjs` warns when the anchor is missing and runs anyway;
`eval-workflow.js` records `oracleSource` into each result row and says nothing about its absence.
An unanchored set scores like any other — the anchor is for the human doing §3, not for the tool.
The one deliberate exception is the judge self-test (§5.2): its scenario is fictional, there is no
config behind it and no retriever, so the oracle *is* the whole truth and there is nothing to
anchor to. That exemption is written into the file so it cannot be misread as a forgotten anchor;
it does not extend to any scenario that measures a real file.

### 1.5.1 An anchor must be able to FAIL — present is not enough, it must also be unique
The same law governs the other place anchors are used: a **resident-safeguard register**, where each
rule that must stay in the memory file records a short verbatim phrase a linter greps for. Such a
register is only as good as the phrases in it, and there are two ways it quietly stops working —
both invisible from the linter's own `clean` line, because a linter reports what it checked, never
what it walked past:

- **No anchor.** The entry is iterated, nothing is compared, and the atom audits as checked.
- **An anchor that cannot fail.** Worse, because it looks like coverage. If the phrase also occurs
  elsewhere in the file, deleting the rule leaves the phrase behind and the check passes forever.

Measured on a real register (31/07/2026): 46 of 196 entries had no anchor, and 22 more were anchored
on single common words — one on the bare word `CLAUDE` (52 occurrences in the file), two on `SETUP`
(19), and the flagship never-fake-a-Pass entry on `Passed` (4). The register had been reporting green
throughout.

**So: an anchor is a span unique to the rule it guards, and both cases — missing and non-unique — are
hard violations, not warnings.** A warning that runs anyway (as §1.5's own enforcement admits) is how
this rots. Two entries MAY share one span when a single sentence genuinely carries both rules; the
span itself must still occur exactly once. When re-anchoring, keep the old value in an `anchorWas`
field rather than overwriting it — a weak anchor is evidence of how the register drifts.

Prove it the same way any other gate is proven: a fixture with one entry per failure mode **plus at
least one entry that must pass silently**, so the check is shown to discriminate rather than merely
to fire.

### 1.6 At least one scenario's correct answer must be "proceed"
A set where every right answer is *refuse / stop / wait* teaches and rewards over-refusal, and
reproduces the false-premise failure — a net punishing correct behaviour. Include scenarios
where an authorized override genuinely applies and a blanket refusal is the **failing** answer.

## 2. Run conditions are part of the instrument

**Pin the model and the effort, and record them INTO the result file** — not into the chat, not
into a commit message, into the artifact that carries the score. A score without its conditions
is not comparable to any other score, including its own baseline.

- Model and effort come from config/env (`EVAL_MODEL`, `EVAL_RETRIEVE_EFFORT`,
  `EVAL_JUDGE_EFFORT`; flags win over env where a runner takes flags) — **never hardcoded in a
  runner**. A nailed-shut model in a shipped tool is this rule contradicting itself in the same
  repo. ⚠️ `EVAL_EFFORT`, the shorthand that pins both, is read by `eval-workflow.js` **only**:
  export it, run the CLI runner, and you get exit 2 for an unpinned effort while your env looks
  set. Pin the two axes explicitly and the ambiguity never arises.
- Agents inheriting the launching chat's effort produce numbers comparable to nothing: an
  unpinned run is `not-run` for baseline purposes, however green it looks.
- **The two runners disagree about what to do when you don't pin, and the difference IS the
  contract.** `sweep-runner.mjs` **fails closed**: no model, or an effort neither pinned nor
  swept, exits 2 and nothing runs. `eval-workflow.js` **runs anyway** and makes the gap
  structural rather than prose — `conditionsPinned: false`, `baselineEligible: false`, a
  `⚠ UNPINNED RUN` warning, and the literal string `inherited-from-session (UNKNOWN — not
  comparable to a pinned run)` standing in every condition field it could not pin. Both are
  legal readings of this rule, because neither lets an unpinned number pass itself off as a
  baseline. An unpinned run is a smoke test; it is never a target.
- The result records at minimum: memory-file hash, scenario-set id + count, model, retrieve
  effort, judge effort, date, per-scenario verdict. The hash is what makes a result *about a
  revision* rather than about a path — `eval-workflow.js` takes it best-effort and, where it
  cannot, says in a warning that the result cannot back a `.last-green` baseline (§8).

> **Cautionary tale — the unrecoverable baselines.** Effort was recorded **nowhere** for weeks.
> The runs were not comparable to each other and nobody noticed, because each one looked like a
> clean number. Those baselines are now permanently uninterpretable — a score annotated
> "inherited" admits its conditions are unknown, and such a number is never a target.

## 3. A red is a QUESTION, never a verdict

A failing cell asks exactly one thing: **"is the config wrong, or is the oracle?"** (on a
foreign config, a third: was the rule ever there — §1.3). Answer it by **adjudicating against a
source of truth** — the anchor from §1.5, the kit, the owner — never by re-running until the
number moves, and never by assuming the instrument is right because it is the instrument.

Adjudication outcomes, all legitimate, all recorded:
1. **The config is wrong** → fix the memory file; the eval did its job.
2. **The oracle is wrong** (false premise, over-strict, drifted) → fix the scenario and treat
   every past run against it as suspect.
3. **The rule was never adopted here** → not a regression; record it and move on.

Escalate when adjudication needs a decision only the owner can make
([`../../Rules-Guide/DOCTRINE.md`](../../Rules-Guide/DOCTRINE.md) §5). An unadjudicated red
left in the log is worse than a red nobody ran: it trains the next reader to discount reds.

## 4. Never edit the config to go green

**Editing the memory file to make a scenario pass — without first adjudicating that the config
is what is wrong — is fabricating a Pass at the instrument level.** It is re-recording a golden
to green a test ([`../../Testing-Planning/Test-Oracles/`](../../Testing-Planning/Test-Oracles/))
one layer up: what gets tuned is the *measuring device*, so the fabrication propagates into
every future run and is undetectable afterwards.

The ban also covers: loosening an oracle because a correct-looking answer failed it; deleting a
scenario that keeps going red; adopting a rule *only* to satisfy the net. Doctrine §1 in this
kit's dialect: **a score you adjusted the instrument to obtain is not a score.** A defect found
this way is reported, not tuned away
([`../../QA-Documentation/Bug-Reports/`](../../QA-Documentation/Bug-Reports/)).

## 5. Maker-checker — the judge is independent of the retriever

### 5.1 Structural separation
The retriever never grades its own answer. Retriever and judge are **separate agents with
separate prompts**, and the judge gets no access to the memory file — the separation falls out
of STRUCTURE, not of promises. A single agent asked to "answer, then score yourself" is not a
Memory-Eval run and its number is not a score.

**The rule: one judge prompt, one copy**, in a shared module every runner imports. Forked copies
drift; when they do, the calibration test (§5.2) grades a different judge than the net does, and
both results become worthless with nothing to announce it.

**As shipped, this module does not meet its own rule — know that before you quote a calibration
at anyone.** The prompt lives in three copies: `sweep-runner.mjs` exports the pair of builders and
its schemas behind a `main()` guard (import-safe — the closest thing to the shared module);
`eval-workflow.js` keeps a private copy, because its body *runs the net* at import, so importing
from it would launch dozens of agents as a side effect; `judge-discrimination.js` carries a
verbatim copy at the call site. The prompt **text** is currently identical in all three — verified
by diff, not assumed.

**The schemas have already drifted, and that is the drift this rule is about.** `eval-workflow.js`
and `judge-discrimination.js` describe their schema fields (`pass`: *"true ONLY if the retrieved
answer surfaced the oracle rule AND the action matches the oracle behavior"*, and the retriever's
two fields likewise); `sweep-runner.mjs`'s `RETRIEVE_SCHEMA` / `JUDGE_SCHEMA` carry the same
fields with **no descriptions at all**. A JSON-schema description is prompt text the model reads
— so the two runners do not put an identical instrument in front of the model, and **a §5.2
result is evidence about the runner whose wording it matches**, not about the other one. Until one
passive shared module exists: changing a prompt or a schema means changing all three in the same
commit and re-running §5.2, and a score carries which runner produced it.

### 5.2 Calibrating the judge — and the limit of that calibration
Before trusting the judge, feed it answers **wrong by construction** (wrong rule / right rule +
wrong action / keyword-stuffed wrong decision) across several draws and efforts, plus a positive
control — a judge that fails *everything* discriminates nothing either, and without the control
"zero wrong answers passed" is equally consistent with one that says false to every input.

**One installation measured 36/36 — zero wrong answers passed; that judge read the ACTION, not
the label.** It is the finding this whole module leans on, so carry it with its scope attached:

- **The model is unknown.** It was never recorded. The run predates the rule in §2 that would
  have caught that — which is §2's own best argument, and the reason this bullet exists instead
  of a number you could act on. On a different model you have **no evidence at all** about your
  judge until you run your own.
- **What the n covers:** 36 cells = 4 stubs (one of them the positive control) × 3 judge efforts
  × 3 draws — matching today's shipped defaults (`low, medium, high`; `EVAL_DRAWS=3`). The
  efforts are *inferred* from that default ladder, not read off a record.
- **One scenario, one oracle** — deliberately fictional and mechanical (§1.5). It shows the judge
  discriminates **when the oracle is well-specified**, and says nothing about a loose one:
  against a loose oracle a correct judge still passes an answer and its negation (§1.2).
- **It describes the `Workflow` runner's judge** — that prompt *and* its described schema. The
  CLI runner shares the prompt and drops the descriptions (§5.1), so the number was never
  strictly about it.
- **It is not evidence about your config.** Stub calibration is judged against the *oracle*,
  never against the memory file: it prints a perfect score on any machine, including one whose
  config is broken. **It calibrates a judge; it says nothing about your file.**

**Your own number is cheap, and it is the only one that binds.** Re-run the self-test pinned
(`EVAL_MODEL`; `EVAL_JUDGE_EFFORTS` / `EVAL_DRAWS` for a different ladder) — it records the model
and the ladder into its result, so unlike 36/36 it will still mean something in six months.
Expect your numbers to differ from the one above; that is the point of running it, not a fault.
Read its verdict literally: `JUDGE IS LENIENT` invalidates every score your net has ever
produced · `JUDGE IS OVER-STRICT` (the control failed) means failing the wrong answers proved
nothing · `BLOCKED` (any not-run cell) means no clean-sweep claim is available from a net that
shrank (§6) — it is not a pass with an asterisk.

That authoring, not judging, is where the defects were (§1) is a conclusion **from these
measurements** — one installation, one model, one oracle. It has never been checked anywhere
else. Treat it as the best available prior and the first thing to re-test if your reds smell
wrong, not as a settled property of the instrument.

## 6. An empty or failed cell is NOT-RUN, never a result

A cell that crashed, timed out, hit a session limit or returned nothing is **`not-run`** —
never a pass, never a fail, and never a silent shrink of the denominator. Report
`passes / total` with the not-run cells named. An agent that died on the limit returns an empty
result: a FAILED cell to re-run, not a clean one
([`../../Rules-Guide/DOCTRINE.md`](../../Rules-Guide/DOCTRINE.md) §3). A run whose net shrank
to nothing — bad filter, missing scenario file, tool absent — is **blocked**, not green.

## 7. A one-variable comparison with n=1 per side is not an experiment

**Measure variance before believing a delta.** Two single runs differing is a question, not a
finding: nothing separates the variable from run-to-run noise. Before a difference is reported
as a property of the instrument, it must reproduce across repeated draws under pinned
conditions (§2).

> **Cautionary tale — the bold hypothesis that wasn't.** "High effort inflates the score" was
> raised on **n=1 against n=1**, written down in bold, and treated as knowledge. A 30-cell sweep
> **refuted** it: effort moved the *enumeration* the agent produced and the cost, but not the
> outcomes. Variance had never been measured — which is exactly what left it free to masquerade
> as a finding.
>
> **The scope of that refutation, stated as §2 and this section demand it:** 30 cells, one
> installation, one scenario set (that workspace's own — not the one that ships), one model
> **that was never recorded**. The magnitudes it produced — enumeration ≈1.8×, cost ≈30% — are
> that run's numbers on that set. They are **not constants of the instrument**, they have never
> been reproduced anywhere else, and a teammate quoting them is quoting a stranger's model.
> What transfers is the **method and the direction**: a one-variable claim at n=1 per side is
> not an experiment, and on the only set where it was measured properly, effort bought breadth
> and cost rather than different verdicts. Whether it does on YOUR set and YOUR model is
> unmeasured — `--sweep-retrieve` / `--sweep-judge` measure it, and `--cache-from` stops the
> second axis paying for the same retrievals twice (it is refused unless the prior result
> carries the same target hash and the same model — §2).

Consequences: a score delta after a refactor is a **candidate**, confirmed by re-measuring; a
sweep cell is a data point, not a verdict; and **any claim about the instrument states its n AND
the conditions it was measured at**. A claim that can state only its n — like the two this file
carries (§5.2 and the tale above) — is one installation's history. It travels as history, never
as a property, and it is never a target to reproduce.

## 8. The gate flags, never runs

A full run is dozens of agents. **A hook that quietly launches that is a grenade** — at 90%
session budget it detonates in the owner's session, unasked. The gate does exactly one thing:
it notices the memory file changed since the last green and **prints a line telling a human to
run the eval**. It never spawns an agent, never runs the net, never blocks a prompt.

- **Warn once per `(session, hash)` — never per hash alone.** Keyed on the hash only, the first
  chat to see the drift eats the only warning and every other chat gets silence.

  > **Cautionary tale — flagging into the void.** This happened. Multi-chat is the normal case,
  > and a parallel chat consumed the warning at an hour nobody was reading. **A gate that flags
  > into the void is worse than no gate**: it manufactures the feeling that the rule is held.

  The shipped gate keys on `<state>/.warned/<session_id>`, parsed from the hook's stdin payload
  (python3 preferred, a sed fallback for the ordinary payload). **Where it can parse no session
  id at all it degrades to a shared `unknown` bucket — which is precisely the v1 behaviour
  above.** That is a deliberate degrade-rather-than-crash, and it is the one path where this
  bullet does not hold: keep a parser on the machine that hosts the hook.
- **Fail LOUD at install, not silent at run.** The target is explicit configuration
  (`EVAL_GATE_TARGET`), no clever default. A default resolving to a path that happens not to
  exist gives you a hook that installs, runs on every prompt, costs nothing, guards nothing and
  reports nothing — the failure class the gate exists to prevent. Loud means it **prints and
  still exits 0**: no target, no such file, no hasher, no baseline all say so once per chat and
  none of them ever blocks a prompt.
- **A green baseline is per-machine, hand-written after your own first green run.** Never ship
  one, never copy someone else's: a foreign hash can never match, so the gate cries wolf
  forever; forced to match, it goes silent on *your* drift. One line, three whitespace-split
  fields, the score a single space-free token — the shape is in `.last-green.example`, whose own
  comments are the trap: copy that file verbatim and field 1 becomes `#`, matching nothing,
  crying wolf on every prompt forever.
- **State is local and never ships.** `.last-green` and `.warned/` sit beside the script by
  default, or wherever `EVAL_GATE_STATE_DIR` points when the checkout is read-only or shared.
  `.warned/` holds **live chat session ids** — gitignore both before the first run (§10).

## 9. Budgets, gates and stop conditions

- **Cost:** a cell = 2 agents (retrieve + judge), so an un-swept net of N scenarios is `2 × N`.
  Under a sweep the arithmetic is **not** `2 × cells`: cells = `scenarios × retrieve-levels ×
  judge-levels`, but retrievals are keyed `(scenario, retrieve-effort)` and shared, so
  **agents = unique retrievals + cells** — sweeping only the judge re-uses every retrieval.
  **Do not do this by hand: `--dry-run` prints the exact cell and agent count and the pinned
  conditions, spawns nothing and costs nothing.** It quotes no dollar figure, deliberately — the
  money is your model's rate times your scenarios' size, and any figure printed here would be
  someone else's plan wearing your label. Compute yours; never quote someone else's.
- **Launching a run requires ≥ 25% session headroom** and is a **🟡 gate**
  ([`../../Testing-Planning/QA-Agent-Playbooks/`](../../Testing-Planning/QA-Agent-Playbooks/)):
  show the `--dry-run` output plus your own estimate, then WAIT. Check the session limit before
  each batch ([`../Usage/`](../Usage/)); at ≥ 90% do not launch — park it and arm the
  continuation per [`../Cron-Session/`](../Cron-Session/). A net interrupted mid-flight is not a
  loss: the CLI runner checkpoints after every cell and flushes on SIGINT/SIGTERM, leaving the
  completed cells on disk and the rest not-run (§6).
- **When to run:** after any structural change to the memory file (section rebuild, dedup-merge,
  detail moved into a kit) and before closing that work. **Never on a timer** — an unchanged
  file gets no run; a scheduled pass burns budget to re-measure nothing.

## 10. Artifacts

- A run's artifacts (per-scenario answers, judgements, the result file) land next to the
  scenario set in `runs/<run-id>/` (run-id = `YYYY-MM-DD-slug`). That naming is **convention**;
  what is **enforced** is the refusal — `sweep-runner.mjs` exits 2 if `--out` resolves inside the
  module, because writing a result into the kit is the one mistake that turns local state into
  shipped content. It creates the parent dirs itself, and checkpoints after every cell with
  `inProgress: true`: a file still carrying that flag is a partial net, never a score (§6).
- **Run results are LOCAL, never kit content.** The answers quote the memory file verbatim, so
  they inherit every name, id, host and path it contains — a result file is the likeliest way
  to leak a client through this module. Keep the eval-home state (results, the green baseline,
  the warn-once directory) out of any shared repo; ship only `*.example` shapes. Anonymity is
  enforced by [`../../Rules-Guide/kit-lint/`](../../Rules-Guide/kit-lint/) **L10**, which greps
  only what is hand-listed and only what is tracked — it will not catch this for you.
- Scenario sets that ship carry kit-anchored oracles only (§1.5) and the placeholder vocabulary
  (`<Project>`, roles not names, `example.com` / `*.invalid` hosts). Do not invent product names.

## 11. Mirror rule

When a new reusable Memory-Eval rule emerges during project work, add it BOTH to the workspace
`CLAUDE.md` AND here (+ `CLAUDE.starter.md` if it changes agent behavior), so it travels when
`QA-SetupKit/` is shared. A rule learned by an adjudication (§3) is the highest-value kind this
module produces — it came from the instrument catching itself.

## External rewriters of the memory file
Any automated "improver" of a memory file — generic linters, official plugins included — runs ONE-SHOT, its
diff is reviewed by the owner, and the net gates the result. Never unattended, never recurring. Measured on
one installation (18/07/2026, model+efforts pinned): a generic conciseness rubric was retrieval-neutral on
its first pass (it consumed incident-history) and deleted three load-bearing rules on its second — the net
caught the deletion deterministically — while the tool's own quality score ROSE, so it has no built-in
stopping point. A conciseness rubric and a memory file whose scars are load-bearing are opposed by design:
pointer-architecture reads as "duplication", incident-anchored rules read as "one-off fixes". The failure
mode is not a visible break — the rewritten text still reads fine; only the constraint is gone.
