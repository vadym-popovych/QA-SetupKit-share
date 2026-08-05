# Roadmap — where the kit is heading

One document lives here: [`AI-QA-ROADMAP.md`](AI-QA-ROADMAP.md) — the plan for turning the kit
from *AI-operated tools* into an *AI QA engineer*, with the agreed build order.

**What it is for.** Every kit answers "how do I run this discipline". The roadmap answers the
question none of them can: *what is still missing, and in which order does it get built*. It is
the place a capability gap is recorded before it becomes a kit — so a gap is a decision with a
queue position, not something rediscovered on the next project.

**How to use it.**

- Starting something new → read the build order first; the next thing to build is usually already
  named, with the reason it comes before the others.
- Finding a gap mid-project → add it here rather than working around it silently. A gap that is
  only in someone's head is indistinguishable from a gap nobody knows about.
- Judging whether the kit covers something → the roadmap says what is *planned*, the root
  [`README.md`](../../README.md) says what is deliberately **out of scope**, and the maturity
  badge says what is *proven*. Planned is not covered; 🟡 is not 🟢.

**This folder is reference, not a discipline** — it ships an index README and the document, and
that is its whole contract (`feature` class in
[`kit-lint/modules.json`](../kit-lint/modules.json)). Until 28/07/2026 the folder was outside the
manifest entirely and had no README at all: an external audit found it, which is the roadmap's own
lesson applied to the roadmap — an unrecorded gap is invisible until someone trips over it.
