# Placing bugs into modules — the playbook

**For the agent.** Follow this exactly. Every rule below exists because skipping it produced a document
that lied — quietly, and in a way nobody would have caught by reading it.

The document's whole value is the breakdown: *how many bugs, at what severity, **in which module***. So a
bug in the **wrong** module is worse than a bug in no module at all: it corrupts a number a human will act
on, while looking perfectly healthy. Everything here is built around that one asymmetry.

---

## The two things you must never do

1. **Never drop a bug you cannot place.** It feels like the honest move. It is the opposite: the bug then
   appears *nowhere*, and the grand total under-reports what was found — silently, because nobody counts
   what is not on the page. (The first Redmine import did exactly this: it reported **139** bugs when
   **216** had been found.) Unplaceable bugs go to **`General`**, counted and visible.

2. **Never guess a module to make the document look tidy.** `General` is *supposed* to be visible. It is a
   **debt, not a module**: it says *"these bugs were found, and nobody can say where they live."* A tidy
   document built on invented placements is a broken document that looks finished.

---

## The cascade — try these in order, stop at the first that fires

Each step is *weaker* than the one above it, and the row records which one placed it (`moduleSource`), so a
reader can always tell a **fact** from a **judgement**.

| # | Step | `moduleSource` | Strength |
|---|---|---|---|
| 1 | **The owner said so** — `MODULE_MAP` (merges, renames, defect-named containers → their place) | `owner-mapped` | a human decided |
| 2 | **The container names it** — `[BUGS] User profile`, `[BUG] Home screen`, `[pixel-perfect] Settings` | `container` | the board says it |
| 3 | **The issue's own subject IS a place** — `The Library screen`, `Select Genre screen` | `subject` | the board says it |
| 4 | **The parent task names it** — but *only* if the parent is a module, not a **QA activity** | `parent` | the board says it |
| 5 | **The bug's own wording names it** — *"The Notifications screen shows hardcoded mock data"* | `summary-inferred` | an inference |
| 6 | **You read it and decide** — `PLACEMENT_FILE` | `agent-placed` | your judgement |
| 7 | **Nothing said where it lives** | `unplaced` → `General` | a declared debt |

**Step 4, the trap:** a parent named `Smoke/Regression testing`, `Sprint 12`, `Post-release bugs` is a **QA
activity, not a module**. Using it blindly would have filed **55 of 125** bugs on the reference board under
a module called *"Smoke/Regression testing"* — a place that does not exist in the product.

---

## Step 5 — inferring the module from the bug's own text

A bug that says *"The **Notifications screen** shows hardcoded mock data"* is telling you where it lives.
Refusing to read that leaves a perfectly placeable bug in `General`. So read it — under these conditions,
all of which were learned by getting them wrong:

- **Exactly ONE place, or nothing.** *"on the List **and** Detail screens"* names **two**. Choosing
  between them is a coin-flip, and a coin-flip is how a bug lands in the wrong module. Two or more →
  leave it in `General`. (An early regex swallowed the conjunction and invented a module called
  **"List and Detail screen"** — a place that does not exist, holding a bug that belongs to two that do.)
- **An existing module beats a new one.** If the text names a place the board already has a module for, use
  **that** module — otherwise the inference fragments `Settings screen` into a near-duplicate of itself.
- **Strip the article; do not reject on it.** An early version threw away *"**The** Notifications screen"*
  because it began with *"The"* — discarding the clearest signal in the sentence.
- **A URL is not a place, and a platform is not a place.** `Android Subscription screen` → `Subscription
  screen`.

---

## Step 6 — placing the rest by hand (this is the part a colleague's agent must copy)

Run the importer, then work the leftovers. **Read every unplaced bug's summary.** For each one, ask a single
question:

> **Does this bug's own text name exactly one place in the product?**

**Place it** when the text names a screen, flow or feature area unambiguously:

| Bug summary | → Module | Why |
|---|---|---|
| *"A long display name overflows on the **Home screen** after being updated in Account details"* | `Home screen` | the defect is *on Home*; Account Details is where it came from, not where it breaks |
| *"Chapter count label is not pluralized on **Library** book cards"* | `Library screen` | one place |
| *"The generation pipeline permanently breaks for everything that follows"* | `Content generation` | a feature area, named plainly |
| *"Rapidly tapping the paid action triggers duplicate requests"* | `List of chapters` | that is where the button lives |

**Leave it in `General`** when any of these is true — and this is the discipline, not a failure:

| Leave it | Example from the reference board |
|---|---|
| **Genuinely app-wide** | *"Big padding under the navigation bar"* · *"Enhance Toast message visibility"* · *"No tablet-adapted layouts"* |
| **Names two or more places** | *"on the **List and Detail** screens"* · *"between **Onboarding** and **Edit Profile**"* · *"on the **Detail** and **Report** screens"* |
| **Names none** | *"The Back arrow gets stuck in an infinite glitching state"* — stuck **where**? |

> **When the defect happens on one screen but originates on another, place it where it BREAKS.** That is
> where a reader will go looking for it.

Write your decisions into `PLACEMENT_FILE` (`{ "<row-id>": "<module>" }`) — one line per bug, so every
judgement is visible and any of them can be overruled by a single edit. Whatever is still unplaced is
written to `placement-triage.json` for a human to finish.

**Creating a new module is allowed** when several bugs share an obvious feature area the board never named
(`Content generation` took 7). Creating one to hold a *single* awkward bug is not — that is `General` wearing
a costume.

---

## The loop

```bash
# 1. pull, and see what the board can and cannot place
REDMINE_URL=… REDMINE_PROJECT_ID=… node tools/bs-from-redmine.mjs --dry-run

# 2. record the owner's calls: merges, renames, defect-named containers → their place
#    MODULE_MAP={"Rating stars jump screen":"Rating", "The Settings screen (UI/UX)":"Settings screen"}

# 3. rate the severities (the tracker has none — see BUG_SUMMARY_RULES §4)
#    SEVERITY_FILE=./severities.json

# 4. read the leftovers and place them
MODULE_MAP=… SEVERITY_FILE=… node tools/bs-from-redmine.mjs -o bug-summary.json
#    → writes placement-triage.json — fill in "module" for the ones you can place honestly

# 5. re-run with the placements, then build the Sheet
MODULE_MAP=… SEVERITY_FILE=… PLACEMENT_FILE=./placements.json node tools/bs-from-redmine.mjs -o bug-summary.json
SUMMARY=./bug-summary.json PROJECT_NAME=… node tools/bs-sheet.mjs
```

The build prints, every run: how many rows each step of the cascade placed, how many were **inferred**, how
many are **ambiguous**, and how many sit in **`General`**. Read that block. It is the document telling you
how much of itself it actually knows.

---

## What "good" looks like

On the reference board (230 bugs), after one pass:

```
owner-mapped 66 · container 53 · agent-placed 41 · subject 21 · parent 20 · summary-inferred 19 · unplaced 10
```

**`General` shrinks between editions.** If it does not, the thing to fix is the **board**, not the
document — bugs need a parent that names a module, or a checklist container that does.

## And say it out loud

When you hand this document to anyone, say what is in it:

- how many severities are **`agent-proposed`** (a hypothesis every count is built from);
- how many modules are **`summary-inferred`** or **`agent-placed`** (a judgement, not something the board said);
- how many bugs sit in **`General`** and why.

A number nobody questioned is not the same as a number nobody had to.

**And ask for the severities to be validated — in the same breath, not in a footnote.** *"N of M severities
are mine, not yours. Every count is built out of them. Validate them before this goes outside the team."*
Repeat it on every rebuild until `severitySource` says `owner`. Impact is the owner's call; you propose the
branch, he confirms the sensitivity. Write his calibration into `severity-rubric.md` beside the summary so
the next round starts from his judgement instead of the tree's defaults.
