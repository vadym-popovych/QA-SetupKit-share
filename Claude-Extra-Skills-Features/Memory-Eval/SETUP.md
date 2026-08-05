# Memory-Eval — setup

Self-contained steps a teammate's Claude can follow to stand up a retrieval eval for an
always-on memory file (a `CLAUDE.md`, a RULES doc, a runbook — anything the agent is
supposed to have read already).

Nothing to install for the module itself. What you set up is an **instrument**: a scenario
net, its pinned run conditions, and optionally a gate that flags when the file drifts from
the last measured-green state. Every knob comes from a flag/arg — nothing is hardcoded in a
runner — and the persistent ones (the env table in step 3) also read an env var, the flag
winning; the per-invocation flags (`--out`, `--only`, `--dry-run`, `--cache-from`,
`--sweep-retrieve`, `--sweep-judge`) are flag-only.
The steps below are the mechanics; the WHY of each safeguard is one hop away in
[`MEMORY_EVAL_RULES.md`](MEMORY_EVAL_RULES.md), cited by section as it comes up.

> **For Claude:** steps 1–6 are the instrument, 7–8 optional hardening. Stop and tell the
> user if a verification step fails — a broken eval that still prints a score is worse than
> no eval.

---

## Prerequisites (auto-detect first)

| What | Why | Check |
|---|---|---|
| **A memory file worth measuring** | no file, no run | your `EVAL_TARGET` exists |
| **`node` 18+** | the runners are plain Node, no deps | `node --version` |
| **`claude` CLI on `PATH`** | `sweep-runner.mjs` spawns one `claude -p` per agent, with `--model`, `--effort`, `--output-format json`, `--json-schema`, and `--allowedTools Bash` for the retriever only | `claude --version` |
| **The `Workflow` tool** (optional) | `eval-workflow.js` and `judge-discrimination.js` use `agent()`/`pipeline()` harness globals — **not** runnable with `node` | absent → `sweep-runner.mjs` does the net (step 4b); the selftest has no CLI equivalent |
| **A SHA-256 CLI** (gate only) | hashes the target file | `shasum -a 256` (macOS/BSD) **or** `sha256sum` (Linux) — the gate prefers `shasum`, falls back to `sha256sum`, and says so loudly if neither exists |
| **`python3`** (gate only, *preferred* not required) | parses `session_id` out of the hook's stdin JSON | `python3 --version` — without it a `sed` fallback handles the ordinary `{"session_id": "…"}` payload; if **both** fail, `session_id` collapses to a shared `unknown` bucket, i.e. one warning shared across all chats (the v1 bug — step 7) |
| **Session-limit monitoring** (recommended) | a net is dozens of agents; step 5's budget guard needs it | [`../Usage/`](../Usage/) ships `session-limit.py` |

**A missing `Workflow` tool announces nothing** — the script simply never runs. Not
hypothetical: it was absent in a live headless run. Route to `sweep-runner.mjs`.

## Step 1 — point at the target

```bash
export EVAL_TARGET="/absolute/path/to/your/CLAUDE.md"
```

One file, absolute path. This is what a fresh agent is told to read before answering — the
eval measures **that file's** retrieval, not your project.

## Step 2 — author your scenarios

Copy [`scenarios.example.json`](scenarios.example.json) and write your own **next to the file
they measure**, not into this kit (run state never ships — RULES §10).

The file is either a bare JSON array, or an object `{"id": "my-set", "scenarios": [ … ]}` — the
set id falls back to the filename stem. Per scenario:

| Key | Required | Read by the runners as |
|---|---|---|
| `id` | **yes** | the cell's name; it also **keys the retrieval cache**, so ids must be unique |
| `situation` | **yes** | the facts handed to the retriever and the judge |
| `oracleRule` | **yes** | the rule that must surface |
| `oracleCheck` | **yes** | the behaviour it must produce, **including the `WRONG if…` clause** |
| `oracleSource` | no — **warned** | the §1.5 anchor. **Not** ignored: both runners carry it into every result row, so a red can be adjudicated against the text that makes the oracle true. Absent → `sweep-runner.mjs` warns (`[sweep] WARNING: no oracleSource anchor …`); `eval-workflow.js` records it but does not warn |
| anything else (e.g. `_teaches`) | no | ignored |

**Malformed sets fail closed, they do not grade against nothing.** A missing or empty required
key, or a duplicate `id`, exits `sweep-runner.mjs` with code `2` before a single agent spawns;
`eval-workflow.js` keeps the scenario **in the denominator as a not-run cell** and warns. Neither
runner lets the judge grade against an absent oracle (RULES §6).

**This step is the instrument** — the model and the judge were both tested and held; every
real defect this eval ever produced traced to a scenario (RULES §1). Author against the
full rules, but at minimum:

- **The situation states facts and asks a decision question** — it never names or paraphrases
  its own rule, or retrieval is trivial and the score is permanent green (§1.4).
- **`oracleCheck` must carry an explicit `WRONG if…` clause** (§1.2). The judge reads only the
  situation, the oracle and the answer — never your memory file — so at grading time the
  oracle **is** the whole source of truth. An oracle stating only what satisfies it is not a
  weak test but an **unfalsifiable** one: an answer and its negation both pass. The clause is
  greppable, and **both runners grep it**: no `WRONG if` in an `oracleCheck` → a warning naming
  the scenario. A warning, never a block — the runner is not the authority on your set, but an
  unfalsifiable cell scores green forever while measuring nothing.
- **The premise must be true of the flow as it is** (§1.3) — the worst defect on record was a
  scenario whose situation could not arise in that config at all, so the net punished the
  correct answer and reported a false red.
- **Anchor every oracle** to shipping doctrine or kit RULES via `oracleSource` (§1.5), and
  make **at least one correct answer "proceed"** (§1.6) — a net where every right answer is
  refuse/stop teaches over-refusal.

The shipped example is a shape-teaching net anchored to kit doctrine
([`../../Rules-Guide/DOCTRINE.md`](../../Rules-Guide/DOCTRINE.md)): it measures whether a
config carries that doctrine — not the same claim as "this refactor dropped no rule." Do not
quote its score as a no-regression result for your file.

## Step 3 — pin the run conditions

**Run conditions are part of the instrument** (RULES §2) — pin them in env so they land in
the result, never in a runner:

```bash
export EVAL_MODEL="<model-id>"
export EVAL_RETRIEVE_EFFORT="medium"   # breadth of retrieval
export EVAL_JUDGE_EFFORT="medium"      # judge leniency — pinned SEPARATELY, they confound
```

**The two runners treat "unpinned" differently, and it matters:**

- `sweep-runner.mjs` **fails closed** — no model, or an effort neither pinned nor swept, exits
  `2` before anything spawns. You cannot accidentally buy an uninterpretable sweep.
- `eval-workflow.js` **runs unpinned and brands the result**: the agents inherit the launching
  chat's model/effort, and the result comes back with `conditionsPinned: false`,
  `baselineEligible: false`, a `⚠ UNPINNED RUN` warning, and the literal string
  `inherited-from-session (UNKNOWN — not comparable to a pinned run)` in each condition field.
  Legal for a smoke test; **never** a baseline, however green it looks.

Full env contract — **the flag/arg always wins over the env var**:

| Var | Read by | Effect |
|---|---|---|
| `EVAL_TARGET` | `eval-workflow.js`, `sweep-runner.mjs` | the memory file. No default — both fail without it |
| `EVAL_SCENARIOS` | `eval-workflow.js`, `sweep-runner.mjs` | scenario-set path. No default |
| `EVAL_MODEL` | all three runners | model. No default |
| `EVAL_RETRIEVE_EFFORT` | `eval-workflow.js`, `sweep-runner.mjs` | retriever effort |
| `EVAL_JUDGE_EFFORT` | all three runners | judge effort |
| `EVAL_EFFORT` | **`eval-workflow.js` only** | shorthand setting both efforts; the split vars override it. `sweep-runner.mjs` does **not** read it |
| `EVAL_JUDGE_EFFORTS` | **`judge-discrimination.js` only** | CSV effort ladder for the selftest (step 8) |
| `EVAL_DRAWS` | **`judge-discrimination.js` only** | draws per cell. Default `3` |
| `EVAL_LABEL` | **`sweep-runner.mjs` only** | run label. Default `unlabeled` (`eval-workflow.js` defaults to `baseline` and takes a label only via args) |
| `EVAL_CONCURRENCY` | **`sweep-runner.mjs` only** | parallel cells. Default `3` |
| `EVAL_TIMEOUT_SEC` | **`sweep-runner.mjs` only** | per-agent wall limit. Default `600`; a timeout is not-run, never a fail |
| `EVAL_CLAUDE_BIN` | **`sweep-runner.mjs` only** | the CLI to spawn. Default `claude` |
| `EVAL_GATE_TARGET` | **`eval-gate.sh` only** | the watched file (step 7). **Required, no default** |
| `EVAL_GATE_STATE_DIR` | **`eval-gate.sh` only** | where `.last-green` / `.warned/` live. Default: the script's own directory — set it when the kit checkout is read-only or shared |

## Step 4 — smoke two scenarios first

Never let the first execution be the expensive one. Run a 2-scenario subset and check both
directions: it **executes end-to-end**, and it **can go red** — feed one deliberately wrong
answer and confirm the judge fails it. A net that has never produced a red has not been
shown to produce a true one.

> Two different things, one word: **`--dry-run` is the free plan** — it prints the cells and the
> agent count and spawns nothing, so it can never show you a red. The 2-scenario **smoke run**
> below actually spends agents. Do the plan first, then the smoke, then step 5.

### 4a — with the `Workflow` tool

Run `eval-workflow.js` with an args object. Every arg overrides its env var; it has no `--only`
equivalent, so a subset means passing the entries inline:

```json
{
  "file": "<EVAL_TARGET>",
  "label": "dry-run",
  "scenarios": [ /* 2 entries from your scenario file */ ],
  "model": "<model-id>",
  "retrieveEffort": "medium",
  "judgeEffort": "medium"
}
```

`scenarios` takes an **array** (inline) or a **path string**; `scenariosFile` is the explicit
spelling of the path, and `scenarioSet` names an inline set for the result. `effort` is a
shorthand setting both efforts. Omit `model`/efforts and the run still executes — branded
unpinned (step 3), never a baseline.

### 4b — without it (headless-safe)

First the plan, free — `--dry-run` prints the cells, the agent count and the pinned conditions,
and spawns nothing. That is the number you take to the 🟡 gate in step 5:

```bash
cd /path/to/your/scenarios          # NOT the module dir — see the --out rule below
node <path-to-kit>/Claude-Extra-Skills-Features/Memory-Eval/sweep-runner.mjs \
  --file "$EVAL_TARGET" \
  --scenarios ./my-scenarios.json \
  --only s1,s2 \
  --out ./runs/2026-01-01-dry-run/result.json \
  --label dry-run \
  --dry-run
```

Drop `--dry-run` to actually execute those two cells. `--only` takes scenario ids and **rejects
an unknown one with exit `2`** — a typo cannot silently shrink your net to the ids that happened
to match. (An *empty* net — an empty scenario set — is exit `3`, blocked, and writes no result
file at all: an empty result is exactly the artifact a later reader mistakes for a clean run.)

> **`--out` may not resolve inside the module directory** — the runner refuses with exit `2`.
> Results embed the agents' answers, which quote your memory file **verbatim** (RULES §10), so
> they must never land in a shared kit. Write them beside your scenario set. Note this bites the
> obvious invocation: running `node sweep-runner.mjs --out ./runs/…` **from the module dir** is
> refused. Parent dirs of `--out` are created for you.

`sweep-runner.mjs` spawns the `claude` CLI, which **inherits the caller's environment and
permissions** — worth knowing before launching a sweep from an unattended run. The retriever is
spawned with `--allowedTools Bash` so it can `cat` the memory file; the judge never gets it.

## Step 5 — run the net, then read the result correctly

Same invocation without `--only` and `--dry-run`, and a real `--label`. Point `--out` at
`runs/<run-id>/result.json` (run-id = `YYYY-MM-DD-slug`) **beside your scenario set** — a
convention the runner does not impose, only the "not inside the module" rule is enforced. Results
are **local, never kit content**: the answers quote your memory file verbatim, so they inherit
every name, id and host in it (RULES §10).

**Budget first** (RULES §9): a cell is 2 agents (retrieve + judge) → a net is about
`2 × N scenarios`; a sweep multiplies by its cells (`scenarios × retrieve levels × judge
levels`). Do not estimate by hand — **`--dry-run` prints the exact agent count** for your set and
your conditions, cache reuse already subtracted. It deliberately quotes **no dollar figure**: the
cost is that count at *your* model's rate, and any number printed here would be someone else's
plan wearing your label. Launching is a 🟡 gate needing **≥25% headroom**
([`../Usage/`](../Usage/)): show the count, the pinned conditions and the estimate, then WAIT. If
the forecast does not fit, park it and arm the continuation via
[`../Cron-Session/`](../Cron-Session/) rather than dying mid-net.

**The run is checkpointed** after every cell, with `inProgress: true` until it finishes — a
crash or a session limit mid-net leaves the completed cells on disk rather than losing a paid
run. `SIGINT`/`SIGTERM` flush the same way.

**Exit codes** — script against these, they are the contract:

| Code | Means |
|---|---|
| `0` | every planned cell produced a verdict. **A red is not an error** (RULES §3) — reds live in the file, never in the exit code |
| `1` | finished with ≥1 **not-run** cell (crash / timeout / session limit / no structured output), also the interrupt code. A partial measurement, not a score |
| `2` | usage or config error (unknown flag, missing `--file`/`--scenarios`/`--out`/`--model`, unpinned effort, invalid scenario set, unknown `--only` id, a cache from another file or model, `--out` inside the module) — nothing ran, no file written |
| `3` | blocked: the scenario set was empty. No result file, never green |

The result's `summary.score` is `passed/totalCells` — **the denominator is the planned cells**,
never the survivors, so a broken run can never wear a clean-looking score (RULES §6). Not-run
cells are named in `notRun[]`. `summary.costIncomplete: true` means reused retrievals are not in
`totalCostUsd`.

### Sweeping an effort axis (RULES §7 — n=1 per side is not an experiment)

`--sweep-retrieve` / `--sweep-judge` take a CSV ladder and replace the matching pinned flag
(passing both the sweep and its pin is exit `2`). Both together = the full cross product; cells =
`scenarios × retrieve levels × judge levels`. Known levels are `low, medium, high, xhigh, max`; an
unknown one passes through **with a warning**, never blocked — your host's vocabulary is not this
file's to police.

```bash
# sweep the retriever, judge pinned
node <…>/sweep-runner.mjs --scenarios ./my-scenarios.json --sweep-retrieve low,medium,high,xhigh \
     --judge-effort medium --out ./runs/2026-01-01-sweep/retrieve.json --label sweep-retrieve

# then sweep the judge, reusing those retrievals instead of paying twice
node <…>/sweep-runner.mjs --scenarios ./my-scenarios.json --sweep-judge low,high \
     --retrieve-effort medium --cache-from ./runs/2026-01-01-sweep/retrieve.json \
     --out ./runs/2026-01-01-sweep/judge.json --label sweep-judge
```

`--cache-from` reuses retrievals keyed `(scenario id, retrieve effort)` — which is why ids must
be unique. It is **refused with exit `2` unless the prior result records the same target
`sha256` and the same model**: a retrieval read out of a previous version of the memory file
would score this run against text it never saw, and that result would look perfectly clean.

**A red is a QUESTION, never a verdict** (RULES §3): *is the config wrong, or is the oracle?*
Adjudicate against a source of truth — the kit, the doctrine, the owner — and record which.
On a new net a third answer is common: the rule was never in that config, so the red is
correct and means "this config does not carry that rule."

> **Editing the config until the score goes green is fabricating a Pass at the instrument
> level** (RULES §4) — the same move as re-recording a golden, forbidden for the same reason.
> If the oracle is what is wrong, fix the oracle and say so out loud: the scores before and
> after are then two different measurements.

## Step 6 — record a baseline

After a green run with pinned conditions, write `.last-green` **by hand** — one line, three
whitespace-separated fields, in `EVAL_GATE_STATE_DIR` (default: this module's directory):

```
<sha256-of-target> <score> <YYYY-MM-DD>
```

Get field 1 the same way the gate does — `shasum -a 256 "$EVAL_TARGET" | awk '{print $1}'`
(macOS/BSD) or `sha256sum "$EVAL_TARGET" | awk '{print $1}'` (Linux).

- ⚠️ **[`.last-green.example`](.last-green.example) documents the format and is comments only —
  do not copy it to `.last-green`.** The gate does not strip comments: it reads **line 1** and
  `awk`s field 1, which would be `#`, matching no hash and warning on every prompt forever.
  The real file is one line, no comments, no blank first line.
- **The score must be ONE token with no spaces** — fields are whitespace-split, so a space
  inside it truncates the score and pushes the date into field 4 where nothing reads it. Glue
  the conditions on instead: `6/6@medium/medium(run:2026-01-14-post-rebuild)`.
- **Never copy someone else's** (RULES §8): a foreign hash never matches, so the gate cries
  wolf forever — and if you make it match, it goes silent on *your* drift.
- **Never record an unpinned run** — it launders an unknown condition into a target. Such a run
  is `not-run` for baseline purposes (RULES §2); `eval-workflow.js` marks it
  `baselineEligible: false` for exactly this reason.
- `.last-green` and `.warned/` are **local state, never shippable** — `.warned/` filenames are
  live chat session ids. Both are **already gitignored by the kit** (`QA-SetupKit/.gitignore`),
  so the default state dir is safe; verify with `git check-ignore`. If you point
  `EVAL_GATE_STATE_DIR` somewhere else, ignore it there yourself.

## Step 7 — arm the gate (optional)

`eval-gate.sh` is a `UserPromptSubmit` hook that flags when the target changed since the last
green run. Two properties are deliberate and load-bearing (RULES §8): **it FLAGS, it never
RUNS** — a hook that quietly launches dozens of agents at 90% budget is a grenade — and
**warn-once is keyed on `(session_id, hash)`**, never the hash alone, or the first chat to
prompt eats the only warning and every other chat gets silence.

The target is **required, with no default** — a guessed path is a hook that runs on every
prompt, costs nothing and guards nothing:

```bash
export EVAL_GATE_TARGET="/absolute/path/to/your/CLAUDE.md"
```

The script splits the two cases rather than failing silent everywhere:

- **Fails SILENT at run time** — unreadable stdin, unwritable state, unchanged file → exit 0,
  no output. A gate that breaks the prompt loop is worse than the drift it guards.
- **Fails LOUD at install time** — unset target, target missing, no SHA-256 CLI, or no
  baseline each print a specific warning (once per chat) and still exit 0. Silence there is the
  exact failure this gate exists to prevent. Loud never means blocking: it always exits 0.

Verify before wiring — the no-baseline warning even prints the current hash for step 6:

```bash
EVAL_GATE_TARGET="$EVAL_TARGET" ./eval-gate.sh   # silence if unchanged, a warning if drifted
```

Then register the hook, merging into any existing `hooks` object — do not clobber others
([`../Usage/`](../Usage/) registers a `UserPromptSubmit` hook too; both coexist):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "EVAL_GATE_TARGET=<your-memory-file> <path-to-kit>/Claude-Extra-Skills-Features/Memory-Eval/eval-gate.sh 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

`2>/dev/null || true`: the gate must never block a prompt. **Project-level** settings, not
user-level — it guards *this* workspace's file, unlike the per-account session monitor.

**Portability:** POSIX `sh` — no bashisms. It prefers `shasum -a 256` and falls back to
`sha256sum`; **neither present is a loud install-time warning, not silence.** The `session_id`
parse prefers `python3` and falls back to `sed` for the ordinary payload; only if *both* fail
does `session_id` degrade to a shared `unknown` bucket — which is precisely the v1 behaviour
above, one warning shared across every chat. Run the verification above on the machine that will
host it: install-time faults are loud, but only where someone is reading.

**When it fires**, judge the change yourself: a hash cannot tell a rebuild from a typo.
Translating whole sections has moved retrieval by nothing; one bullet about a single rule has
moved it. For a cosmetic edit, re-point `.last-green` at the new hash — out loud, in the
chat — and do not burn a net on a one-sentence addition.

## Step 8 — verify the judge discriminates (optional, periodic)

`judge-discrimination.js` feeds the judge answers wrong **by construction** and checks that it
fails them. It needs the `Workflow` tool (`agent()`/`pipeline()`); there is no CLI equivalent.

**Four stubs, inlined in the script** — three wrong plus a positive control:

| Stub | Expected | Tests |
|---|---|---|
| `A-correct` | **pass** | the positive control. Without it, "0 wrong answers passed" is equally consistent with a judge that fails *everything* |
| `B-wrong-rule` | fail | the floor: an unrelated rule, an unrelated action |
| `C-right-rule-wrong-action` | fail | whether the judge reads the **action** or stops at the label |
| `D-keyword-stuffed-wrong-decision` | fail | the real shape of a near-miss: every oracle keyword recited, fluent reasoning, wrong decision dressed up as diligence |

Its scenario is a **fictional artifact store**, deliberately: the judge sees only situation +
oracle + stub, so it cannot recall the answer from pretraining or a real convention — it has to
read. That isolates reading comprehension, the only property under test, and nothing about your
installation can leak through a stub.

Cells = `4 stubs × efforts × draws`; the default `low,medium,high` × 3 draws = **36 agents** —
the source of the 36/36 figure quoted in RULES §5.2. Run it with args or env (args win):

```bash
export EVAL_MODEL="<model-id>"
export EVAL_JUDGE_EFFORTS="low,medium,high"   # CSV ladder; default low,medium,high
export EVAL_DRAWS=3                           # draws per cell; default 3
```

Then run `judge-discrimination.js` via the `Workflow` tool (args: `judgeEfforts`, `draws`,
`model`, `label`).

- **It grades stubs against an oracle, never against your file** — it prints a clean score on
  any machine, including one whose config is broken. It says the judge discriminates **when the
  oracle is well-specified**; it says nothing about your config, and nothing about a loose
  oracle (RULES §5.2).
- **Verdicts are four, not two:** `JUDGE IS LENIENT` (a known-wrong answer passed) ·
  `BLOCKED` (any not-run cell — no clean-sweep claim from a shrunken net, RULES §6) ·
  `JUDGE IS OVER-STRICT` (it failed the positive control, so failing the wrong ones proves
  nothing) · `JUDGE DISCRIMINATES`.
- ⚠️ **Its judge prompt is a verbatim COPY of the net's, not a shared import** — RULES §5.1
  wants one prompt in one module every runner imports, and **the module does not ship that
  yet**. As of now the prompt and schema exist in three places: `eval-workflow.js` (which
  cannot export them — its body runs the net on import), `sweep-runner.mjs` (which **does**
  export `buildRetrievePrompt`, `buildJudgePrompt`, `RETRIEVE_SCHEMA`, `JUDGE_SCHEMA` behind a
  `main()` guard), and this selftest. The invariant is currently held **by hand**: change one,
  change all three in the same commit and re-run this selftest. Drifted, it certifies a judge
  nobody runs — and nothing announces it.

Re-run it when you change the judge prompt or the schema, not on a schedule.

---

## Related

- [`../Knowledge-Distillation/`](../Knowledge-Distillation/) — the companion method:
  distillation compresses the memory file, Memory-Eval checks a rule survived. Compressing
  without measuring is guessing.
- [`../../Testing-Planning/Test-Oracles/`](../../Testing-Planning/Test-Oracles/) — the oracle
  discipline this module instantiates: no oracle, no Pass.
- [`MEMORY_EVAL_RULES.md`](MEMORY_EVAL_RULES.md) — the rules that travel with the module.
- [`README.md`](README.md) — what Memory-Eval is and when to reach for it.
