# Knowledge-Distillation — compressing a knowledge file without losing a rule

A method, not a tool. Use it when an agent's memory file (`CLAUDE.md`, a RULES doc, a runbook)
has grown past the point where the agent reliably *reads all of it* — and the fix has to be
compression, not deletion.

Proven on this workspace 12/07/2026: **104k → 40k characters, zero rules lost.**

## When to fire it

| Trigger | Why it matters |
|---|---|
| The knowledge file crosses ~40–50k characters | past that, rules start being skimmed rather than followed — the file is *technically* complete and *practically* ignored |
| The same rule appears in three places with three wordings | drift has already begun; one of them is now wrong |
| A rule is discovered to have been silently disobeyed for weeks | it was there, and it wasn't read. That is a size problem, not a discipline problem |

## The method

**The one non-negotiable: distillation is compression, never triage.** You are not deciding
which rules still matter — you are re-encoding all of them in fewer characters. The moment you
start dropping rules "that probably don't apply anymore", you are doing something else, and the
next agent will discover the loss the hard way.

### 1 · Inventory before you touch anything
Extract every **atomic rule** from the current file into a flat list — one line each, in the
file's own words. This is the artefact everything else is checked against. Number them.
*A rule is atomic when removing any clause changes agent behaviour.*

### 2 · Draft the compressed file
Rewrite from the inventory, not from the old file (rewriting from the old file reproduces its
padding). Techniques, in order of payoff:
- **Move detail to where it belongs.** A rule that only matters inside one kit belongs in that
  kit's RULES + starter, not in the global memory — the global file keeps a *pointer*. This is
  what took most of the 64k out.
- **Merge duplicates into one canonical statement** and delete the others (checking that no
  clause is unique to a copy).
- **Cut the narration, keep the instruction.** "We decided on 03/07 after some discussion that
  it would probably be best to…" → the rule.
- **Keep the WHY only where it changes behaviour** — a rule whose reason is obvious doesn't
  need one; a rule that looks arbitrary (and will therefore be "optimized away" by a future
  agent) does.

### 3 · Gap audit — the step people skip
Walk the numbered inventory from §1 against the draft and mark each rule **present / moved
(where) / LOST**. Any `LOST` is a bug in the draft, not a decision. Do this mechanically —
this is exactly the moment where an honest-looking "I kept everything important" quietly loses
three rules.

### 4 · Deploy + verify
Replace the file, then verify against the inventory a second time, in the new file's order
(the second pass catches rules that were "moved" to a place that doesn't exist yet). Commit the
inventory alongside — it is the audit trail, and the input to the next distillation.

**The gap this step cannot close on its own:** the inventory proves a rule is still *written down*
somewhere. It cannot prove the agent still *finds* it at the moment it fires — and that is the thing
compression actually endangers. Measuring it is [`Memory-Eval/`](../Memory-Eval/), the companion of this
method: distillation compresses the memory, Memory-Eval checks it survived, so a restructure is measured
rather than guessed. Run its net before and after a distillation and compare, or the "lossless" claim rests
on a reading of your own draft.

## Core + reference layering (the "why" is calibration, not padding)

The number is a **trigger, not the goal.** You are not chasing ~40k characters — you are chasing
**retrieval reliability**: the important rules must reliably surface on the turn they apply. A file
small enough to be read beats a file "technically complete" but skimmed.

Split into two layers instead of deleting:
- **Always-on CORE** (the memory file, loaded every turn) — for each rule: the rule + at most one
  line of "why" + a **pointer**. Machine-specific facts (ids, paths, exact commands, baselines)
  stay here verbatim — they have no other home and a lost id breaks a tool.
- **REFERENCE layer** (loaded on demand) — the full rationale, war-stories, worked examples,
  one-off history. Lives one hop away: the matching kit-RULES for a kit rule, or a companion
  `*-REFERENCE.md` next to the memory file for machine/workspace-only rationale. The core points
  to it; the turn a rule is in play, you read the story.

This is lossless: the CALIBRATION (the reason a rule exists, the incident that created it) is what
makes an agent apply a rule with judgement — so it is preserved, just not paid for every turn.

## Double gap audit — rules AND calibration (15/07/2026)

The §3 gap audit checks every rule is present. Extend it: audit **two** things per inventory item —
1. the **rule** is `present-core / present-reference / present-kit / LOST` (nothing LOST), and
2. its **calibration** (the why/incident) is `present-core / present-reference / present-kit / none / LOST`.

Plus a **machine-fact sweep**: every concrete id / path / email / command / baseline in the OLD
section must appear verbatim in the new CORE (never moved to reference — that is where a lost id hides).
And verify every "moved to kit" claim by **reading the kit file** — a draft that claims coverage it
didn't check is how detail silently evaporates. Run this adversarially (default to LOST if you cannot
positively locate it); a distiller that "corrects" or "modernizes" a token is doing triage, not
compression — surface it, don't let it pass invisibly.

Proven again 15/07/2026 on this workspace's CLAUDE.md (95.7k → 82.7k core + 14.2k on-demand reference,
gap-audited across every section: all machine-facts verbatim, only minor calibration fragments needed
restoring — zero rules lost). Reduction was modest because most of the file is load-bearing machine
fact + pointers; the win was externalizing rationale and *proving* nothing was dropped.

## The failure mode this method exists to prevent

The tempting version — *"read the file and rewrite it more concisely"* — loses rules and cannot
prove it didn't. The inventory is what converts "it feels complete" into "it is complete, and
here is the list I checked it against". Same principle as everywhere else in this kit: **an
assertion with no oracle is not a Pass.**

## Related

- [`../Usage/`](../Usage/) — the session-limit hook (why a bloated file costs you every turn)
- [`../../Rules-Guide/Project-Configuration/README.md`](../../Rules-Guide/Project-Configuration/README.md) —
  the three-layer memory architecture (workspace / kit / project) that distillation moves rules *into*
