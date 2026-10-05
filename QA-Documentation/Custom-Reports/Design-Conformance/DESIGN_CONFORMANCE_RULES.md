# Design-Conformance report — the rules

A **design-conformance review** answers one question: *does the design deliverable do what the
written requirement says?* The two sides are the **spec** (stories with acceptance criteria, a PRD,
a checklist of behaviours) and the **design** (a clickable prototype, an HTML export, a Figma
dev-mode file). The report is the record of where they disagree, with evidence a reader can replay.

It is deliberately narrow. It is **not** a design critique (nothing here says a screen is ugly),
**not** a bug report against a build (there is usually no build yet), and **not** an accessibility
audit — those have their own kits. It exists because the gap it covers is the expensive one: a
prototype that is signed off while quietly contradicting a decision the client already paid to make.

---

## 1. Two oracles, and the report never picks the winner

A conformance finding is an **oracle conflict**: the spec says one thing, the design does another,
and both are authored by people with the authority to be right. The Test-Oracles rule applies in
full — *flag and escalate, never decide silently*
([TEST_ORACLES_RULES](../../../Testing-Planning/Test-Oracles/TEST_ORACLES_RULES.md)).

So every finding states **both sides and stops**:

- **What the spec requires** — quoted, not paraphrased. Paraphrase is where the reviewer's opinion
  leaks in, and the quote is what the owner will argue about.
- **What the design does** — observed, with evidence.
- **Who decides, and what the options are** — usually "the design catches up" vs "the spec is
  amended". The report proposes; it does not rule.

`dc-report.mjs` refuses to build a finding missing either side, because a one-sided finding reads as
a verdict.

**Never resolve a conflict by editing the spec.** If the AC turns out to be wrong, that is the
owner's edit in the owner's document, on the owner's say-so — a QA report that quietly rewrites the
requirement it failed against has destroyed the only record that they ever differed.

---

## 2. Judge by RENDER, and drive the thing

Reading a prototype's markup tells you what its author typed. It cannot tell you that a control
**skips** a required step, that a guard refuses the last item, or that a screen is one tap away when
the spec says it must be gated. **Drive the prototype and watch what happens** — the workspace's
render-verification rule, applied to somebody else's artefact
(see [Custom-Reports README](../README.md) convention 8).

A screenshot proves a screen exists. It cannot prove a *transition*. Any finding whose claim is
about a flow — skipped, blocked, reachable, refused — **ships a clip**, recorded by
[`record-ui-flow.mjs`](../../../Testing-Types/Web-Testing/template/tools/record-ui-flow.mjs) with the
tap indicator on, so the reader sees which control was pressed.

**The indicator is the harness, not the product.** Say so in the report — the same rule
`touch-indicator.js` carries. A reader who thinks the dot is a UI element will report it as a bug.

---

## 3. Read the design's own annotations before inferring anything

Design exports increasingly ship a machine-readable cross-reference — `data-story-id`,
`data-screen-id`, `data-epic-id`, `data-state`, plus a hidden index of every screen the design
claims to cover. Where one exists, **it is the primary source**: it is the designer's own claim
about what a screen implements, so a disagreement found against it is a real disagreement rather
than the reviewer's reading of a picture. [`dc-map.mjs`](template/tools/dc-map.mjs) extracts it.

Two things this changes, both of which have flipped a finding in practice:

- **A merged surface stops being an inference.** One node annotated with two story ids is the
  design telling you it serves both. Whether that is a defect depends on *what* was merged — see §4.
- **"The design is just older than the decision" becomes checkable.** Compare the annotated ids
  against the spec's current numbering. If the bundle uses ids that only exist after the latest
  renumber, it was indexed against the current spec and the staleness excuse is gone. If it uses
  older ids, say so — that is a different, much cheaper problem.

**No annotations? Then coverage is not a claim you can make.** Say what you walked and what you did
not. `dc-map.mjs` prints that warning itself when run without a walk.

---

## 4. Component reuse is not a conflict; behavioural merge is

The most common false finding. A share sheet, a snackbar, a paywall card reused across five stories
is **what a design system is for** — flag it and you have reported the design working correctly.

The test is whether the merge changes **behaviour that an acceptance criterion names**. A shared
share sheet that still shares the right thing: fine. A "report this app" entry point that merges
into a general contact form and thereby acquires a category picker the AC explicitly forbids: a
finding. State the distinction in the report where it comes up — the reader will ask.

---

## 5. Never-fake-a-Pass, in this discipline's shape

- **"Declared" is not "verified".** A screen listed in the design's manifest but unreachable in the
  build you have is reported as **not verified** — never as covered. It is the single easiest way to
  hand someone false confidence, because the manifest looks like coverage.
- **An entry point is not a flow.** A button that opens a screen you could not reach covers the
  story's *doorway*, not its acceptance criteria. Say which.
- **What you did not measure, you did not measure.** A rendered walk settles nothing about contrast
  ratios, focus order, target sizes or Dynamic Type. If accessibility was not audited, the report
  says so in its own limits section rather than letting "Story 1.1 — present" imply otherwise.
- **The bundle is dated.** Every finding is against *that* export. Record its identity — filename
  and a content hash — so a later reader can tell whether they are looking at the same artefact.
- **Report the good news too.** Where the design has satisfied something the spec still tracks as an
  open gap, say it. A conformance report that only ever lists failures is read as adversarial, and
  the stale open item stays open for another month.

---

## 6. Impact is a hypothesis until the owner rates it

Severity is not a fact about the product. A finding may carry a proposed impact, and then
`severitySource` **must** say `agent-proposed` — `dc-report.mjs` refuses to build without it, and
warns on every build listing which findings are unreviewed.

**Repeat that warning in the message that carries the link.** Same rule as Bug-Summary: an
unreviewed rating that travels alone starts reading like the owner's own call by the second meeting.

---

## 7. A shared link survives every rebuild

The report is a **projection** of `findings.json`. Fix a wrong claim in the JSON and rebuild; never
hand-edit the generated HTML, or the next rebuild silently reverts it.

Rebuilding **writes the same output path**, which is what keeps a shared link alive
([Project-Configuration rule 10](../../../Rules-Guide/Project-Configuration/README.md)). Publish
through [HTML-Reports](../HTML-Reports/HTML_REPORTS_RULES.md) and the URL is stable too. **Never
"upload a new one and delete the old"** — trash-and-recreate looks identical in the UI and silently
kills every link anyone saved.

The page is self-contained by construction: clips and posters are inlined as data URIs, nothing is
fetched at view time. That is what lets it be mailed, hosted anywhere, or opened from disk in a year
and still play its own evidence.

---

## 8. Where the artefacts live

| Artefact | Path |
|---|---|
| Findings + report + evidence | `<Project>/QA-Documentation/design-review/` |
| Clips and posters | `<Project>/QA-Documentation/design-review/evidence/` |
| The design's annotation map | `<Project>/QA-Documentation/design-review/story-map.json` |
| The flows that produce the clips | a project-owned script in the same folder |

The **design bundle itself is not copied into the repo** — it is somebody else's deliverable with its
own home. Record its filename and hash in the report's meta block instead.

Evidence clips hold real product screens: they follow the workspace's evidence-hosting rule, and
**never** land inside the kit — `record-ui-flow.mjs` refuses an output path inside the kit tree.
