# kit-lint — the kit's test for itself

```bash
node Rules-Guide/kit-lint/kit-lint.mjs            # from the QA-SetupKit root (the WORKING TREE)
node Rules-Guide/kit-lint/kit-lint.mjs --quiet    # failures in full + one line proving it ran
node Rules-Guide/kit-lint/kit-lint.mjs --committed # lint the COMMITTED tree — what a fresh clone gets
node Rules-Guide/kit-lint/kit-lint.mjs --write     # regenerate stale L12 index blocks in place
```

Exit 0 = clean · exit 1 = violations · exit 2 = run me from the kit root.

## Working tree vs committed — the `--committed` rule

The default run lints your **working tree**. A fresh `git clone` gets only **committed** files, so a
fix that exists only on disk — the classic aftermath of committing a `git mv` **without** its
reference-fixes — passes the default run and breaks for the next person. This actually happened: the
13/07 HTML-Reports move committed the folder rename but left five README links pointing at the old
path uncommitted; working-tree kit-lint was green while a clone had five dead links.

`--committed` closes that blind spot: it lints exactly `git archive HEAD` (untracked and uncommitted
files simply are not there), so **"clean" means clean-in-a-clone**. The rule:

> A structural change — moving, renaming, or registering a module — is **not done** until
> `kit-lint --committed` is green. Working-tree-clean is not clone-clean.

On this machine a **`pre-push` hook** runs it automatically, so a clone-broken state cannot be pushed
(bypass with `--no-verify` only when you mean to). A selective/partial commit (`git add <paths>` of
only some changed files) is the same trap chosen deliberately — the unstaged half may hold the
reference-fixes. Follow any selective commit with `--committed`. The daily backup's `autonomy-eval` is the same check
from the other direction — it materialises a clone and lints it — so the net is caught within a day even
if the hook is skipped.

## Why

QA-SetupKit is built on *never fake a Pass* — and until 12/07/2026 it had **no automated test
of itself**. Every rule lives in three places (workspace `CLAUDE.md`, the kit's RULES, the
starter block) and the sync rested entirely on discipline. Discipline drifts: the folder
migration left stale paths behind, and the kit's own docs pointed at tools that never shipped
with it. A kit that promises a teammate *"clone this and it works"* has to be able to **check**
that claim, not assert it.

The first run found **66 real violations** — including load-bearing docs telling a fresh clone
to run `redmine-bug.mjs` from a folder that only existed on the author's laptop.

## The checks

| ID | Promise it enforces | Why it matters |
|----|---------------------|----------------|
| **L1** | every relative link in a kit doc resolves | a dead link is where a teammate's setup stops. `CLAUDE.starter.md` files are resolved as **paste blocks** (workspace-relative), because that is how they are actually read |
| **L2** | every tool a doc tells you to run **ships with the kit** | the autonomy mission in one line. A tool that lives only in the author's project folder does not travel — the doc is then an instruction the clone cannot follow |
| **L3** | no doc sends you to a path that isn't there: absolute `/Users/<name>/` paths, or **links into a project folder** | naming a project in prose ("Live example: …") breaks nothing and is useful — so it is not flagged. Only things that actually *send* you somewhere dead |
| **L4** | every kit has README + SETUP + `<TYPE>_RULES` + `CLAUDE.starter` | the module recipe. A kit with no RULES has no discipline to travel with it; a kit with no starter has nothing for a teammate to paste |
| **L5** | every kit is registered in the root README **and** the folder map | an unregistered kit is invisible — it exists on disk and nowhere in the shop window |
| **L6** | every starter points at its own RULES file | a starter that cites rules with no source is a rule you cannot look up |
| **L7** | shareable kit docs are in **English** | the kit is the unit of sharing. Quoted trigger phrases (the agent matches on them) and literal UI strings in selectors are data, not prose — exempt. Owner-facing files (workspace/project `CLAUDE.md`, starter trigger lists) never travel and may be any language |
| **L8** | every shipped `*.example.json` validates against its schema | the examples are the canonical shape of each artefact; a drifted example is a broken template every teammate copies. Runs `validate.mjs` over each — the checker checking its own examples |
| **L9** | no dead tools — every shipped executable is named by ≥1 doc | the mirror of L2. L2 catches a doc pointing at a missing tool; L9 catches a tool nobody is told to run — an orphan that silently rots. (Found 3 on its first run.) |
| **L10** | nothing in the kit names a real client, person, tracker, host or document | the kit SHIPS. Enforced against the hand-kept denylist [`no-client-data.json`](no-client-data.json) — a real name cannot be detected generically, so the owner lists his own clients once, **the day the project starts, not the day of the leak**. It happened: a shipped example held 309 of a client's real bugs, his staging URLs and 325 evidence links, past nine other checks |
| **L11** | every maturity badge agrees with `modules.json` (`maturity`) | the badge is the one signal telling a reader which kits to over-trust, so two indexes must never disagree about it — and they did: the root README badged a kit 🟢 while its own group index badged it 🟡, for weeks, with nothing able to notice. Badges are now single-sourced; `evidence` is mandatory for 🟢, because a battle-tested claim nobody can state is the over-claim the badge system exists to prevent. **Promotion is an owner decision, never a lint fix** |
| **L12** | every generated index block matches its declared source — **an index is a projection, not a copy** | a doc that lists a folder's children is a second copy of a fact only the folder actually knows; it is correct the day it is written and rots the next time a folder is added, with nothing able to notice. A block is wrapped in `<!-- kit:generated:<name> source=<folder> -->` … `<!-- /kit:generated -->`; L12 recomputes it from the source and names what is **missing** or **phantom**. `--write` repairs blocks in place (keeps surviving rows' prose, stubs missing keys, drops phantoms) so fixing drift is one command, not hand-editing eight docs. **Adoption is per-doc and incremental** — a doc with no markers is simply not L12-checked, and L12 owns only the region between markers, never the prose around it |

## Scope — who gets checked ([`modules.json`](modules.json))

Module discovery walks **one level under each entry in `groups`**, and each module is held to the
contract of its class: **kit** (README + SETUP + RULES + starter) · **feature** (README) ·
**group** (an index folder — README only; the modules *inside* it owe the full kit contract).
A **nested** group (e.g. `QA-Documentation/Custom-Reports/`) must therefore be declared **twice**:
in `groups` so its children are discovered at all, and in `overrides` as `"group"` so the index
folder itself isn't failed for lacking a SETUP it was never meant to have. Miss the first half and
the kits inside go **unchecked while the lint still prints "clean"** — the silent cap this tool
exists to prevent. The scope line at the top of every run prints the counts per class; if a number
drops, something stopped being checked.

## Exceptions

Real ones exist (a doc quoting a bad path *as evidence*; a kit doc naming a project-side file it
deliberately doesn't ship). They go in [`allow.json`](allow.json) — and **every entry carries a
reason**. An allowlist without reasons rots into a dumping ground for "we'll fix it later", and
then the lint means nothing, exactly like a gate everyone clicks through.

## The test for the testers (`selftest.mjs` + `fixtures/`)

The kit ships **five checkers that render pass/fail verdicts** — `kit-lint`, `validate.mjs`,
`lint-specs.mjs`, `ci-run-result.mjs`, `coverage-check.mjs` (~1100 lines that decide whether something is good). Until
13/07/2026 not one had a negative test. A review proved the cost in three commands: a spec full of
forbidden patterns linted CLEAN, and a bug with a typo'd field name (`invariantViolatd`) validated
VALID. Worse — if someone replaced `validate.mjs` with `process.exit(0)`, every self-test stayed
green. The exact silent-Pass the kit exists to fight, applied to the kit.

```bash
node Rules-Guide/kit-lint/selftest.mjs
```

For each checker there is a **good** fixture (must exit 0) and a **bad** one (must exit nonzero):

| Checker | Bad fixture — the defect it must detect |
|---|---|
| `validate.mjs` | a bug with a typo'd field (`invariantViolatd`) + a garbage field |
| `lint-specs.mjs` | a spec with `getByRole`, `page.fill(sel, password)`, a Promise-wrapped `setTimeout`, a hardcoded token |
| `ci-run-result.mjs` | an E2E report where **zero tests ran** (an empty suite is not a passing suite) |
| `kit-lint.mjs` | a mini-kit with a broken link (L1), a project-folder link (L3), and a **stale generated block** whose source holds `alpha`+`beta` while the block lists `alpha`+phantom `gamma` (L12) |
| `coverage-check.mjs` | a coverage projection whose states contradict the runs it claims to derive from |

A checker that passes its bad fixture is broken or was neutered — and `selftest` fails loudly.
Proven to work: neuter `validate.mjs` to `process.exit(0)` and `selftest` goes red, naming the
defect the checker just greenlit. Fixtures live in [`fixtures/`](fixtures/) and are excluded from
the normal `kit-lint` scan (they are *supposed* to be broken). Wired into `autonomy-eval.sh` step 3c
and the daily backup run.

## doctype-sync — the tracker's mechanical check (`doctype-sync.mjs`)

The owner tracks kit coverage on a "Doc-type validation" Sheet tab: **every document type the
kit ships gets a row there the same day it lands**. That duty ran on memory until 03/08/2026 —
and had already been forgotten once. [`doctype-sync.mjs`](doctype-sync.mjs) checks it
mechanically, READ-ONLY on the Sheet:

```bash
DOCTYPE_SSID=<tracker-sheet-id> node Rules-Guide/kit-lint/doctype-sync.mjs [--strict]
```

It reports (a) a doc type the kit ships that NO tracker row names, and (b) a row citing a file
the kit no longer has (a rename that silently disconnected the tracker). It deliberately does
NOT judge a row's STATUS — "Validated" means the owner validated it, and a script that guessed
would be a fabricated Pass. The tracker's Sheet id never ships with the kit: pass `DOCTYPE_SSID`
via env (on the reference machine the Demo project's wrapper injects it). `--strict` exits 1 on
any finding; auth rides the canonical `mcp-sheets` OAuth.

## When it runs

- **Manually**, before sharing the kit or after any structural change.
- **Automatically**, in the daily `backup-knowledge.sh` run (`--quiet`): the backup is the one
  thing that touches the kit every day, so drift gets caught within a day of being introduced
  rather than by the next teammate who clones it.

## Lesson it encodes

A lint that cries wolf gets ignored *exactly* like a flaky gate. The first pass flagged 87
things; 21 were the lint's own noise (starters are workspace-relative by design; `/users/current`
is a Redmine API endpoint, not a filesystem path). Those were fixed **in the lint** before a
single doc was "corrected" — because fixing a doc to satisfy a wrong check is how a codebase
learns to lie.
