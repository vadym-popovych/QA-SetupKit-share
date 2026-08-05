# Rating severities — the playbook

**For the agent.** The tracker has **no severity field**. Somebody has to decide, and if that somebody is
you, then every count in the document — *"25 Critical, 31 Major"* — is built out of **your judgement**.
So: rate against the rubric below, mark every rating as yours, and **ask the owner to validate it**.

Never invent a default. `--assume-minor` does not exist and will not be added: **a default severity is a lie
with a number attached.**

---

## 1. The scale — this is the kit's default calibration

It is **stricter** than the generic decision tree in
[Bug-Reports](../../Bug-Reports/BUG_REPORTS_RULES.md): a blocked core flow with no workaround is **Critical**
here, not Major. It is the same text the Sheet shows on hover (`SEVERITY_HELP`), and **that is not a
coincidence — it is a rule** (§4 below).

### 🔴 Critical — a BLOCKER

The product cannot be used: a core flow is blocked, **or the user cannot get into the app at all** (Sign up /
Login broken), data is lost or corrupted, the app crashes, or a security hole is open — **and there is no
workaround**.

**ANY failure involving PAYMENT or SUBSCRIPTION is Critical.** So is **no access to core functionality**.

Ship-blocker: fixed before the release goes out.

### 🟠 Major

A core feature is broken or gives the wrong result, **but the user can still get the job done** — through a
workaround, another path, or by retrying. It hits everyone who meets it. Fixed before the release as well.

### 🔵 Minor

The feature works, but not as specified: wrong behaviour in a **secondary flow** (account settings,
notifications), a layout that breaks at some specific width, a control that is awkward but usable.
**A deviation from the design belongs here when it HIDES, CUTS or OBSCURES something.**
**Nobody is blocked.**

### 🟢 Trivial

Cosmetic only — a deviation from the design **with no consequence**: padding, a colour off the mockup, an
icon size, a typo, an animation that is not smooth. **The user sees everything and understands everything.**

---

## 2. The two lines that carry the whole scale

Everything else is detail. Get these two right and the distribution is right.

> **Critical vs Major — is there a workaround?**
> No workaround, and it is core / access / money → **Critical**. A workaround exists → **Major**, however
> annoying it is.

> **Minor vs Trivial — does the deviation have a CONSEQUENCE?**
> It hides, cuts or obscures something → **Minor**. The user still sees and understands everything →
> **Trivial**.

### Worked examples — these calibrate more than the definitions do

| Bug | Severity | Why — and why not the neighbouring level |
|---|---|---|
| A paid item is not unlocked after the payment goes through | `Critical` | **money**: paid for, not received. Not Major — nothing gives the money back |
| *"Restore Purchases"* is missing | `Critical` | **subscription**: a paying user cannot recover what he bought |
| A sign-in provider fails with *"Authentication failed"* | `Critical` | **no access to the app** for anyone who registered that way — there is no other door for them |
| Sign-out does not end the session | `Critical` | **security** |
| Cached content never reopens offline (infinite spinner) | `Critical` | **core functionality gone** |
| Non-Latin input aborts the main creation flow | `Major` | core feature broken — **but it works in English**. A workaround exists |
| The camera goes black in an optional onboarding step | `Major` | broken — but the step can be **skipped** |
| A name is clipped inside its card | `Minor` | the deviation **CUTS** the text |
| The backdrop is cut off behind the sign-in form | `Trivial` | only the backdrop is cut; **every word is readable** |
| Paddings, icon sizes and colours off the mockup | `Trivial` | pure pixel-perfect. Nothing hidden, nothing broken |

---

## 3. The procedure

```bash
# 1. The importer REFUSES to invent a severity, so it writes a triage file and exits 3.
REDMINE_URL=… REDMINE_PROJECT_ID=… node tools/bs-from-redmine.mjs -o bug-summary.json
#    → severity-triage.json   (one entry per row: module, summary, tracker link)
```

**2. Read the rubric before you rate anything.** If the project has its own
`<Project>/QA-Documentation/bug-summary/severity-rubric.md`, **that one wins** over the scale above —
it is the owner's calibration of *his* product.

**3. When the wording does not settle it, LOOK.** A severity is a judgement about **consequence** — does it
hide, cut, block, corrupt? — and the bug's one line very often does not say. *"The name isn't shown
according to design"* is a clipped label (`Minor`) or a different font (`Trivial`), and **the sentence cannot
tell you which.** [`bs-evidence.mjs`](template/tools/bs-evidence.mjs) fetches the screenshot — and samples
screen recordings into a contact sheet. *(A contact sheet settles the **sequence**; it does **not** settle
**smoothness**. For a jitter bug, say the stills cannot settle it — do not invent a severity from a grid.)*

**4. Fill the triage file. Every row carries three fields, not one:**

```json
"ex-101": {
  "severity": "Critical",
  "severitySource": "agent-proposed",
  "severityRationale": "payment — the user pays and the item does not unlock"
}
```

- `severitySource: "agent-proposed"` — **it is yours, not the owner's.** If a human triaged it, it is `owner`.
- `severityRationale` — **the branch of the scale that fired**, in a few words. It becomes the note on the
  cell (`branch: …`). A rating with no stated reason cannot be reviewed, and an unreviewable hypothesis
  counted as a fact is exactly what this field exists to prevent.

```bash
# 5. Re-run with the ratings, then build the Sheet.
SEVERITY_FILE=./severities.json node tools/bs-from-redmine.mjs -o bug-summary.json
SUMMARY=./bug-summary.json PROJECT_NAME=… node tools/bs-sheet.mjs
```

The build **prints the count of agent-proposed severities every single run**, and the `A1` note on the tab
carries the same warning. That note **disappears by itself** once the severities are `owner`.

---

## 4. Two rules the kit will not bend

**The definitions in the Sheet ARE the criteria you rated with.** They are what a human validating your
numbers will read. If the notes say one thing and you rated by another, the owner and the agent will
disagree **forever, without either finding out why**. It happened: the notes once had `Major` = *"broken, but
there IS a workaround"* while the tree said `Major` = *no workaround*. **Change the calibration → change
`SEVERITY_HELP` → re-rate, in the same pass.**

**And ASK. Out loud, every time.** A warning nobody is pointed at is a warning nobody reads. In the message
where you hand over the link:

> *"N of M severities on this tab are mine, not yours. Every count is built out of them. **Validate them
> before this goes to anyone outside the team.**"*

Repeat it on every rebuild until `severitySource` says `owner`. **Impact is the owner's call** — you propose
the branch, he confirms the sensitivity.

---

## 5. Calibrating for a different client

The scale above is a **default**, not a law. A team shipping a free consumer app and a team shipping a paid
product will disagree by a whole level on the same bug — and both are right.

1. Copy [`template/severity-rubric.example.md`](template/severity-rubric.example.md) to
   `<Project>/QA-Documentation/bug-summary/severity-rubric.md` and write the owner's lines and **worked
   examples** into it (the examples calibrate far more than the definitions do — and the calls where an
   agent's instinct and the owner's judgement *diverged* are worth most of all).
2. Put the same text into `SEVERITY_HELP` (env, JSON) so the Sheet teaches what you rated with.
3. Re-rate. A rubric change is not a formatting change: **it moves numbers.** When the kit's own default tree
   was swapped for a stricter owner calibration, **23 bugs moved a whole level.**
