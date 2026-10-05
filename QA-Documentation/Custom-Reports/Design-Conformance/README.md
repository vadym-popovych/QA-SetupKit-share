# Design-Conformance report

**Does the design deliverable actually do what the written requirement says?** This report type
walks a clickable design — a Claude-Design HTML export, a prototype bundle, a dev-mode Figma file —
against the stories or PRD it was built from, and records every place the two disagree, with a
replayable clip per finding.

The gap it covers is the expensive one: a prototype signed off while quietly contradicting a
decision the client already paid to make. Nobody catches it by reading, because both documents look
fine on their own; it only shows up when someone drives the prototype with the acceptance criteria
open beside them.

**Flow:** point the tools at the bundle → read the design's own story annotations → walk the flows
and record the disagreements → write `findings.json` → build the page → hand over the link.

Discipline (what this report may and may not claim): **[`DESIGN_CONFORMANCE_RULES.md`](DESIGN_CONFORMANCE_RULES.md)**.
One-time setup and the runnable commands: **[`SETUP.md`](SETUP.md)**.

## What makes it different from a design critique

| It is | It is not |
|---|---|
| A conflict record between **two written sources** | An opinion about whether a screen looks good |
| Evidence that a **flow** does or does not behave as specified | A bug report against a shipped build (usually there is no build yet) |
| A statement of **coverage**: which requirements have a design surface at all | An accessibility audit — that is [Accessibility-Testing](../../../Testing-Types/Accessibility-Testing/) |

Both sides are authored by people with the authority to be right, so the report **never picks the
winner** — it states what the spec requires, what the design does, and hands the decision back
(RULES §1).

## Files

| File | What it is |
|---|---|
| [`DESIGN_CONFORMANCE_RULES.md`](DESIGN_CONFORMANCE_RULES.md) | The discipline — oracle conflicts, render-not-markup, annotations as primary source, never-fake-a-Pass in this shape, link stability |
| [`SETUP.md`](SETUP.md) | One-time setup, then the three commands of a round |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Paste block for a project's `CLAUDE.md` |
| [`template/findings.example.json`](template/findings.example.json) | A complete two-finding report, anonymised — copy and replace |
| [`template/tools/dc-map.mjs`](template/tools/dc-map.mjs) | Reads the design bundle's own `data-story-id` / `data-screen-id` annotations into a map |
| [`template/tools/dc-report.mjs`](template/tools/dc-report.mjs) | Builds the self-contained HTML page from `findings.json` + evidence; fails closed |
| [`template/tools/dc-report.css`](template/tools/dc-report.css) | The page's stylesheet, inlined at build time; themed for light, dark and the un-stamped default |
| [`template/tools/lib-ui-flow.mjs`](template/tools/lib-ui-flow.mjs) | Resolves the shared flow engine (see below) — never a fork of it |

## It borrows the browser harness, it does not own one

The walk/tap/record engine is **one implementation**, owned by Web-Testing:
[`record-ui-flow.mjs`](../../../Testing-Types/Web-Testing/template/tools/record-ui-flow.mjs), with the
tap indicators beside it. This report type drives that engine for two jobs — reading annotations and
recording findings — and must never fork it: two copies of a browser harness drift, and the copy the
report used stops being the copy anyone maintains.

Recording flows for a bug rather than a conformance round? Use the engine directly from Web-Testing;
you do not need this report type at all.
