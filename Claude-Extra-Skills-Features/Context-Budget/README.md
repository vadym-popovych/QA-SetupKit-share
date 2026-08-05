# Context-Budget — what your session pays before you type anything

Every session starts with a bill you did not choose: the system prompt. Memory files are the part
everyone looks at, so they get compressed, audited and argued over. The part nobody looks at is the
**skill listing** — one line per installed skill, name plus its full `description`, injected into
**every** session whether or not the skill is ever invoked.

Install a plugin that ships 18 skills and use one of them, and the other 17 still cost you their
description in every window you ever open. That is not a bug in the plugin; skills are supposed to
advertise themselves so the model can find them. It is simply a cost that nothing on the machine
reports, so nobody budgets for it.

This feature makes that cost visible and lets you reclaim the part you are not using.

## The two tools

| Tool | What it does |
|---|---|
| [`tools/skill-usage-audit.mjs`](tools/skill-usage-audit.mjs) | Read-only. Counts real `Skill` invocations across **every local transcript**, lists every installed skill with the chars its listing line costs, and totals what the never-invoked ones are worth. Node, no dependencies. |
| [`tools/prune-plugin-skills.sh`](tools/prune-plugin-skills.sh) | Moves skills you name into an attic (never deletes; `--restore` reverses). Resolves the plugin's **active** `installPath` on every run, so it survives plugin updates. |

Order matters: **audit first, prune second.** The audit produces a number; the prune acts on your
decision about that number. A skill installed last week has no history and a zero next to it means
nothing — the tool says so in its own output, deliberately.

## The rules that keep this honest

1. **Prune on measured usage, never on a hunch.** A skill you have never invoked in hundreds of
   sessions is a candidate; a skill whose name you do not recognise is not the same thing.
2. **Check the plugin's runtime before removing anything.** Some plugins read their own `SKILL.md`
   from disk at runtime. `grep -r 'skills/' <installPath>/scripts <installPath>/hooks` — if a skill
   is referenced there, it stays regardless of invocation count.
3. **Move, never delete.** The attic plus `--restore` is what makes this a zero-risk change; a
   reversible experiment and an irreversible one are not the same decision.
4. **Measure the result, do not estimate it.** See below — estimating from character counts
   over-predicted the real saving by 29% on the run that produced this kit.
5. **Re-run after every plugin update.** An update reinstalls the full skill set. Wire the prune
   into whatever daily job you already have rather than relying on memory.
6. **This is context accounting, not a safeguard mechanism.** Nothing here may be used to justify
   deleting a rule from a memory file. Removing an unused skill costs you nothing; removing a rule
   costs you the rule.

## How to measure the real saving

Character counts are the estimate; token counts are the answer. Take the total prompt size of a
throwaway run before and after, under identical conditions:

```bash
claude -p "Reply with exactly: OK" --output-format json \
  --model haiku --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
| python3 -c "import json,sys; u=json.load(sys.stdin)['usage']; \
print(u['input_tokens'] + u['cache_creation_input_tokens'] + u['cache_read_input_tokens'])"
```

Sum all three token fields — that total is cache-independent, which a single field is not. Run it
**twice before and twice after**: the run-to-run spread is your noise floor, and a saving smaller
than the noise is not a saving. Keep the model, the working directory and the MCP configuration
identical across all four runs; each of them changes the prompt.

The current session will not show the change — its system prompt was assembled at startup. Only new
sessions see it.

## Measured case study (the run this feature came from)

A workspace with `claude-mem` installed (18 skills shipped):

| | |
|---|---|
| Transcripts scanned | 2 438 |
| Skills with a non-zero invocation count | **1** of 18 (`mem-search`, one call) |
| Runtime references to skill dirs | only `skills/mem-search` — the other 17 safe to move |
| Listing text removed | 4 641 chars |
| Prompt tokens before | 39 633 / 39 539 |
| Prompt tokens after | 38 685 / 38 685 |
| **Measured saving** | **−901 tokens (−2.3%)**, against 94 tokens of run-to-run noise |

Two things in that table are worth more than the saving itself.

**The estimate was wrong in the optimistic direction.** 4 641 chars at the usual 4-chars-per-token
rule of thumb predicts ~1 160 tokens. The real number was 901 — prose descriptions run closer to 5.2
chars per token. Anyone reporting the estimate as the result would have over-claimed by 29%. This is
the same discipline the rest of the kit applies to test results: the number you report is the one you
measured, not the one you computed.

**The variance disappeared.** Before the prune the two runs differed by 94 tokens; after, they were
byte-identical twice. Not the point of the exercise, but a useful signal that the change did what it
was supposed to and nothing else.

For scale: on that machine the saving was larger, in characters, than a planned compression pass on
the memory file itself — and it carried none of that pass's risk, because no rule was touched.

## Setup

[`SETUP.md`](SETUP.md) — five minutes, and the first three of them are the audit.
