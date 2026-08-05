# Severity rubric — `<Project>`

Copy to `<Project>/QA-Documentation/bug-summary/severity-rubric.md`, then **edit it with the owner**.

**This file wins.** It overrides the kit's default scale in
[`SEVERITY_PLAYBOOK.md`](../SEVERITY_PLAYBOOK.md), which in turn overrides the generic decision tree in
[Bug-Reports](../../../Bug-Reports/BUG_REPORTS_RULES.md). An agent proposing severities reads **this** first.

**Why a per-project rubric exists at all:** the tree tells you *which branch*; only the owner can tell you
**how sensitive** the scale is. A team shipping a free consumer app and a team shipping a paid product will
disagree by a whole level on the same bug — and both are right. **Calibration is not a detail of severity;
it is severity.**

**Changing this file moves numbers.** When the kit's default tree was swapped for a stricter owner
calibration on a real board, **23 bugs moved a whole level**. Re-rate after any edit — and put the same text
into `SEVERITY_HELP`, so the Sheet teaches what you rated with (see §4 of the playbook).

---

## The scale

*(Below is the kit's default, ready to use. Keep it, tighten it, or replace it — but decide with the owner,
and then make the Sheet say the same thing.)*

### 🔴 Critical — a BLOCKER
The product cannot be used: a core flow is blocked, **or the user cannot get into the app at all** (Sign up /
Login broken), data is lost or corrupted, the app crashes, or a security hole is open — **and there is no
workaround**. **ANY failure involving PAYMENT or SUBSCRIPTION is Critical.** So is **no access to core
functionality**. Ship-blocker.

### 🟠 Major
A core feature is broken or gives the wrong result, **but the user can still get the job done** — through a
workaround, another path, or by retrying. It hits everyone who meets it. Fixed before the release as well.

### 🔵 Minor
Works, but not as specified: wrong behaviour in a **secondary flow** (account settings, notifications), a
layout that breaks at some specific width, a control that is awkward but usable. **A deviation from the
design belongs here when it HIDES, CUTS or OBSCURES something.** **Nobody is blocked.**

### 🟢 Trivial
Cosmetic only — a deviation from the design **with no consequence**: padding, a colour off the mockup, an
icon size, a typo, an animation that is not smooth. **The user sees everything and understands everything.**

## The two lines that carry the whole scale

> **Critical vs Major — is there a workaround?** None, and it is core / access / money → `Critical`. One
> exists → `Major`, however annoying.

> **Minor vs Trivial — does the deviation have a CONSEQUENCE?** It hides, cuts or obscures → `Minor`. The
> user still sees and understands everything → `Trivial`.

---

## Worked examples — the part that actually calibrates

The examples matter more than the definitions. Each is a **real bug**, with the severity the owner assigned
and, where it is not obvious, **why it is not the neighbouring level**.

| Bug | Severity | Why — and why not one level up/down |
|---|---|---|
| *"A paid item is not unlocked after the payment goes through"* | `Critical` | money: paid for, not received. Not `Major` — nothing gives the money back |
| *"Non-Latin input aborts the main creation flow"* | `Major` | core feature broken — **but it works in English**: a workaround exists |
| *"A name is clipped inside its card"* | `Minor` | the design deviation **CUTS** the text |
| *"The backdrop is cut off behind the sign-in form"* | `Trivial` | only the backdrop is cut; **every word is readable** |
| *(add the owner's own)* | `…` | … |

## The calls that are easy to get wrong

Record the ones where the agent's instinct and the owner's judgement **diverged**. These are worth more than
the table above, because they are the ones that will be got wrong again.

- *"The name isn't shown according to design"* was rated `Trivial` **from its sentence**. The
  screenshot showed the name **clipped**. **Never settle a borderline severity from the wording alone** —
  fetch the evidence (`bs-evidence.mjs`) and look.
- *"The animation is not smooth"* **cannot be settled from stills.** Nine frames of a contact sheet can
  neither prove nor disprove jitter. Say so — do not invent a severity from a grid of pictures.
- **…**

---

## Rules that hold whatever the calibration says

- **Severity is objective impact, never fix order.** Fix order is `priority` — the owner's call, for
  different reasons.
- **An agent-proposed severity is a hypothesis** (`severitySource: agent-proposed`, with the branch in
  `severityRationale`). It stays one until a human validates it — and **the agent asks for that validation
  every time**, in the message where it hands over the document, until `severitySource` says `owner`.
- **Never a default severity.** No `--assume-minor`: a default is a lie with a number attached, and every
  count in the document is built out of these values.
