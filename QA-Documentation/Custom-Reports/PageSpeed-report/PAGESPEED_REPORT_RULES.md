# PageSpeed-report rules (paste into your workspace CLAUDE.md)

Reusable rules for the web-performance report. Machine-specific paths do NOT belong here.
Mirror new rules of this kind here (+ into `CLAUDE.starter.md` and the workspace `CLAUDE.md`)
so they travel with the kit.

A performance score is the easiest number in QA to fake without noticing: run it once more and it
moves; run it on a faster laptop and it moves; colour it green and nobody asks. These rules exist so
that every number in the Sheet can answer *how it was produced* and *what it is allowed to claim*.

---

**1 · What this document is — and what it is not.**
It is a **lab page-load performance report**: for each page, on each platform, in each round, the
Lighthouse **Performance score** produced by the PageSpeed Insights API, with the Core Web Vitals
that explain it. It is **not** a load test (that is throughput under concurrency —
Load-Testing kit), **not** a statement about your real users (that is field data — rule 11), and
**not** a pass/fail gate unless someone with authority wrote a budget (rule 6). *Rationale:* the
most common abuse of a PageSpeed number is to make it answer a question it never asked.

**2 · The round is the unit, and it is append-only.**
A round = one collection pass over the page inventory, with an `id`, a `label`, a date, an `env` and
an `engine`. It becomes a **new 4-column block to the right** in the Sheet
([`SHEET_TEMPLATE.md`](SHEET_TEMPLATE.md)); it never overwrites the last one. A rebuild carries
previous rounds over **by (page id, platform)** — the join key — and re-attaches typed comments.
*Rationale:* the value of this doc is the trend. A tool that "refreshes" the numbers in place
destroys the only thing that made them worth collecting.

**3 · The environment is part of the number's identity.**
Every round records `env` (`staging` / `production` / `local`) and `engine` (`psi` / `lighthouse`).
A staging score and a production score are **different measurements of different systems** — CDN,
caching, minification, third-party tags and data volume all differ. Putting them side by side and
calling the delta a regression is a **category error**, not a finding. The same applies to the
engine: a local Lighthouse run on your laptop is not comparable with PSI's hardware and throttling
profile (20–40 points of difference is normal, with nothing wrong anywhere). **A round never mixes
engines.**

**4 · One run is noise — the cell carries a MEDIAN.**
Lighthouse is a single-load lab measurement, and consecutive runs of an unchanged page routinely
differ by several points. Therefore `runsPerPage` defaults to **3** and the number written to the
Sheet is the **median** of the successful runs. **Every individual run is kept** — in the round JSON
and in the cell note — so anyone can see the spread. **If fewer runs succeeded than the configured
target, the result is `not-run`, not a smaller sample dressed up as a score.** Lowering
`runsPerPage` to make a round finish is not an optimisation; it is a quieter way of guessing.
*Rationale:* "the score dropped 4 points" is a sentence you can only say honestly if you know what
the noise floor is.

**5 · Four cell states, and `0` is never one of them.**

| Cell | Means | Comment |
|---|---|---|
| a number (0–100) | the median of ≥ `runsPerPage` successful runs | required by rule 7's triggers |
| **empty** | **not run in this round** — temporary, we still owe it | optional |
| `n/a` | the page **does not exist** on that platform / in that round, or cannot be reached by this tool at all (rule 10) | **mandatory** |
| `error` | the tool **failed** (timeout, `NO_FCP`, non-200, quota exhausted after backoff) | **mandatory** |

**Never write `0`.** A zero is a valid Lighthouse score for a catastrophically slow page, so writing
it for "we didn't measure" makes a failure and an absence indistinguishable — and it lands in the
red band as if it were a finding. Empty ≠ `n/a` ≠ `error` ≠ `0`, and the difference is the whole
audit trail. (Same discipline as the checklist kit's `""` vs `Skipped`, and Test-Cases' `Blocked` vs
`Skipped`.)

**6 · Colour bands REPORT; budgets JUDGE.**
The 90/50 conditional-format bands (green ≥ 90, amber 50–89, red < 50) are **Google's
classification** of a score. They are not a verdict, not a gate, and not a promise anyone made to a
user. **A metric with no owner-approved budget is reported, never judged.** A pass/fail claim
requires a `budgets` block in the round JSON with `approvedBy` + `approvedOn` — a named person and a
date. Without that, the honest sentence is *"Home/mobile is 47 (red band)"*, not *"Home/mobile
fails"*.

**7 · Raising a budget, or re-baselining, to make the doc green is FABRICATION.**
Same rule as the visual-regression golden masters
([`VISUAL_REGRESSION_RULES.md`](../../../Testing-Types/Visual-Regression-Testing/VISUAL_REGRESSION_RULES.md)):
a budget changes **only** on an owner-confirmed decision, recorded with who approved it and when. If
the number went red, the finding is that the number went red. Adjusting the threshold until the cell
turns green is not a fix — it is deleting the evidence and keeping the colour.

**8 · A comment is MANDATORY when** (any one of these):
- the score is **< 50** (red band — someone will ask, and "why" must already be there);
- the score **dropped ≥ 10 points** vs the previous round **in the same env + engine**;
- the page **did not return 200**, or rendered an empty/error/consent-wall state;
- the **run count fell below target** (the cell is `not-run` — say what happened);
- the cell is **`n/a`** or **`error`** (rule 5).

*Rationale:* the Sheet outlives the session. A bare number six weeks later is an artefact nobody can
act on, and the person who could explain it has forgotten.

**9 · A regression is a BUG CANDIDATE (tag `PERFORMANCE`), never an auto-filed bug.**
Definition, and all five clauses must hold: **same page + same platform + same environment + same
engine + same profile**, score down materially (≥ 10 points, or a Core Web Vital crossing its
Google threshold) versus the previous round.

- **Reproduce before filing.** Run the page again — a second round, or at minimum a second set of N
  runs — and confirm the drop is not sampling noise. A single red round is an observation, not a
  bug.
- **Bring the cause, not just the score.** The note carries LCP / TBT / CLS / FCP / SI: say *which*
  of them moved. "Score 73 → 58, TBT 210 ms → 940 ms" is a bug report; "score dropped" is a
  complaint.
- **Dedup** against open `PERFORMANCE` bugs before filing (one root cause = one bug — a new hero image that
  tanks LCP on six pages is **one** bug, not six).
- **Severity by user impact**, per [`BUG_REPORTS_RULES.md`](../../Bug-Reports/BUG_REPORTS_RULES.md):
  a **core page + mobile + score < 50** is **Major**; a marginal page or a desktop-only dip is
  lower. Severity ≠ priority — the owner decides P0–P3.
- Candidates go through the project's normal bug-candidates funnel; the agent proposes, the owner
  approves.

**10 · Pages the tool cannot honestly reach.**
PSI is anonymous: it cannot log in, and it cannot see `localhost` or a VPN-only host.
- **Behind auth** → the score you would get is the score of the **login screen**. Do not record it.
  Mark `n/a` + a comment, and either measure a public equivalent page or run the local engine
  against an authenticated session **and label the round accordingly** (rule 3 — it is then a
  different, non-comparable round).
- **Redirects** → measure the **final** URL; a redirect hop is a real cost, but it must be a
  deliberate measurement, not an accident of a stale `pages.json`.
- **Unreachable / 5xx** → `error` + comment. That is a finding for the web round, not a gap to fill
  with a plausible number.

**11 · Lab is not field. Record both; never present one as the other.**
Lighthouse/PSI = **lab** (one synthetic load, fixed device + throttling). CrUX `loadingExperience` =
**field** (what real Chrome users actually experienced, INP / LCP / CLS over 28 days). When CrUX data
exists for the origin, record it in the round JSON and the note. When it does not (low-traffic
origin), **absent ≠ zero** — say "no field data", and never let a lab number stand in for user
experience. They routinely disagree, and when they do, the field data is the one your users live in.

**12 · The oracle is named, like everywhere else in this kit.**
Per [`TEST_ORACLES_RULES.md`](../../../Testing-Planning/Test-Oracles/TEST_ORACLES_RULES.md), every
verdict cites the oracle that decided it. This doc has exactly two, and no others:
- **threshold** — an owner-approved budget (rule 6), the only source of a pass/fail;
- **differential** — the same page/platform/env/engine's previous round (rule 9), the only source of
  a *regression*.

No budget and no previous round → the number is **reported, not judged**. There is no third oracle
called "it looks slow".

**13 · Quota and cost discipline.**
The PSI API needs a free key (the anonymous quota is exhausted — verified: HTTP 429 for the shared
consumer project); with a key it is 25 000 queries/day and 240/minute, and one page × platform × run
= one query. The collector throttles under the per-minute limit and retries `429`/`5xx` with
backoff. **Failing loudly beats a green zero:** a page that exhausts its retries is `error`. Never
point the collector at production for a casual sweep, never widen the inventory "to see what
happens", and never bypass the throttle. The key is a secret: never printed, never in a Sheet, never
committed.

**14 · A perf gate is owner-approved and never blocks on a single run.**
If this ever becomes a CI check ([`CI_RULES.md`](../../../Testing-Planning/CI-Integration/CI_RULES.md)):
it can only fail against an **approved budget** (rule 6), only on the **median of N runs** (rule 4),
only comparing **like with like** (rule 3), and a collector failure is **`blocked`**, never green and
never a silent pass. Lab performance is noisy by nature — a gate that flips on one run trains the
team to ignore it, which is worse than no gate. **"If" is doing real work in that sentence — today
it cannot: see rule 17.**

**15 · Where the truth lives.**
The round JSON is the **source of truth** — one file per round in `<Project>/Web-Performance/rounds/`,
valid against
[`pagespeed-round.schema.json`](../../../Rules-Guide/schemas/pagespeed-round.schema.json) (validate
on write; an invalid round is not written). The Sheet is a **projection**: rebuildable, idempotent,
fixed gid so shared links survive. `pages.json` is the inventory; page `id`s are stable forever
(they are the join key that carries a page's history across rounds). The kit folder holds templates
and rules only — never a project's pages, URLs or scores.

**16 · A `pagespeed.web.dev` link is NOT evidence.**
The shareable `pagespeed.web.dev/analysis/<id>` URL that PSI hands you is a **convenience, never the
record**. It dies two ways, and both were observed on the owner's own reference document:

- **it expires.** Per Google's PSI FAQ/release notes, a shared analysis link is retained for
  **30 days** and then it is gone. A report whose evidence is a link is a report that quietly
  becomes unfalsifiable one month after anyone could have checked it.
- **it dies with the host.** The link renders an analysis *of a URL*; when the analysed host stops
  responding — a dev/stage box torn down, a domain moved — the link takes the number with it. The
  owner's reference sheet is full of result links that are now dead on **both** counts.

Therefore the evidence of a round is the **round JSON committed next to the report**: every
individual run, the median, the lab metrics of the median run, the Lighthouse version, the
`collectedAt` timestamp, the `env` and the `tool`. That file is self-contained, diffable and
survives the host. Optionally, a **self-contained HTML view** of the round published through the
sibling [HTML-Reports](../HTML-Reports/HTML_REPORTS_RULES.md) kit — self-contained for the same
reason.

**Never cite a PSI link as the proof of a number.** A link may be *recorded* alongside a number (in
the cell comment, as a courtesy to whoever wants to re-run it today) — it may never *be* the number's
justification. Note that the round schema has nowhere to put one: that is deliberate, not an
oversight. If the only thing backing a cell is a URL, that cell is unevidenced.

**16a · The attached report must be the report of THE SAME RUN as the number.**
The Sheet's `Desktop` / `Mobile` cell links to the full Lighthouse report behind that row's score
(`evidence` in the round JSON, written by [`psi-report.mjs`](template/tools/psi-report.mjs)). That
report is **rendered from the median run the collector stored** — never captured by analysing the page
again. Re-analysing produces a *different load*: on one page within a single hour we measured
**85** (a pagespeed.web.dev UI run), **90** (API median of 3) and **88** (a second API median of 3).
A screenshot of a run that is not the run in the cell is evidence of something else, and it is worse
than no evidence at all, because it makes an unaudited number look audited.

Mechanically enforced, not merely asked for: `evidence.runScore` records the score **inside the linked
report**, `psi-report.mjs` refuses to attach a stored run whose score is not the cell's, and
`psi-sheet.mjs` refuses to publish a tab where the two disagree. If the stored run is gone (a round
collected with `--no-lhr`, or an older round), the honest move is to **re-collect the round** — not to
attach a fresh analysis and hope nobody opens it.

**17 · Known gap (deliberate, queued, NOT done): no run-result artefact yet.**
This module writes a round JSON and a Sheet tab. It does **not** emit the `run-result` artefact that
[CI-Integration](../../../Testing-Planning/CI-Integration/CI_RULES.md) consumes, and
`ci-run-result.mjs` has **no adapter and no `--discipline` value** for web performance (its list is
`load · api · emulator · security · ui-automation · checklist · exploratory · accessibility ·
visual-regression · regression · localization · compatibility · web`). Consequence, stated plainly:
**a CI perf gate has nothing machine-readable to consume from here today.** Rule 14 says what such a
gate must look like *when it exists*; it does not exist. Do not describe this module as CI-ready, and
do not hand-roll a green run-result to make a pipeline pass — that is the fabrication rule 7 forbids,
wearing a CI hat.

**18 · Not configured is not a dead end — walk the user through the setup.**
The collector needs a free PSI API key, and the publisher needs the Sheets OAuth. When either is
missing, the agent's job is neither to stop with a raw error nor to improvise around it. It is to
**say what is missing, say exactly what it blocks, and lead the user through
[`SETUP.md`](SETUP.md)** — enable the API, create the key, restrict it, put it in the gitignored
`.token`, then verify with one live call before the first real round. Two failure modes are forbidden:

- **silent improvisation** — quietly switching engines, dropping to one run, hand-typing a number
  from the pagespeed.web.dev UI, or writing a score the tool never returned. A number nobody can
  reproduce is worse than a blank cell, and rule 7 already forbids it;
- **a bare stack trace** — the tools fail closed *with instructions* (`psi-run: no PageSpeed Insights
  API key — REFUSING to run` + the Cloud-Console steps). If a teammate can read the refusal and not
  know what to do next, that is a defect in the refusal.

The same applies to the target: a page behind auth, a host that no longer responds, a redirect chain.
Name the blocker, offer the options (measure a public equivalent, mark `n/a` with a comment, run the
local engine and label the round accordingly) — and let a human choose. *Rationale:* the kit is meant
to be run by someone who has never set up PSI. Every "it didn't work so I guessed" is a number that
will be believed for months.

---

Feeds and neighbours: rounds are usually collected as part of a
[Web-Testing](../../../Testing-Types/Web-Testing/WEB_TESTING_RULES.md) round (same page inventory,
different question); regressions leave as `PERFORMANCE` candidates for
[Bug-Reports](../../Bug-Reports/BUG_REPORTS_RULES.md); an HTML view of a round is published through
the [HTML-Reports](../HTML-Reports/HTML_REPORTS_RULES.md) publisher like every other QA HTML.

## A shared link survives every rebuild

Universal invariant (Project-Configuration rule 10, owner's rule 15/07/2026): updating this
kit's artifact must keep the link the owner already shared. For this kit: psi-sheet.mjs rebuilds the SAME tab under the SAME fixed gid (PS_GID); evidence reports keep their hosting path so the Platform-cell links keep resolving.
Trash-and-recreate looks identical in the UI and silently kills every saved link; if a
carrier genuinely cannot keep its link, say so in the hand-over message.
