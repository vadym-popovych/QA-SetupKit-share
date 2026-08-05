# QA-SetupKit doctrine — the always-on core

Five rules that hold in **every** kit, every discipline, every session. If you paste nothing
else from this kit into your `CLAUDE.md`, paste this. Everything else is *how*; this is *when
you are allowed to say it works*.

Each kit's `<TYPE>_RULES.md` restates the doctrine in its own dialect (a checklist status, a CI
gate verdict, a load threshold) — but the five rules underneath are the same, and they are the
point of the kit. A teammate who adopts only one kit still gets these.

---

### 1 · Never fake a Pass
A result is "Passed" only when something objective said so. Not "no error was thrown", not "it
looked fine", not "the tool exited 0". If you cannot show *what* decided the pass, it is not a
pass. This is the rule the other four exist to protect.

### 2 · Name the oracle — no oracle means not-run
Every verdict cites the source of truth that produced it (a spec, a golden master, an invariant,
a consistency check between two sources, a calibrated judge, a human). **No oracle → the result
is `not-run` / `needs-human`, never Passed.** An assertion that cannot fail is not an oracle, and
a check with no oracle is a faked Pass with extra steps. *(And do not fake a Fail either: when a
check goes red, first ask whether the expectation itself is wrong — a false Fail wastes trust
exactly like a false Pass.)*

### 3 · Blocked ≠ green; an empty run is not a passing run
"Could not run" is its own verdict — **`blocked`**, never Passed and never silently skipped.
A missing credential, a crashed scan, a missing baseline, a stale report, a suite where zero
tests executed, a tag-filtered run shrunk to nothing: all `blocked`. Skipped/not-reached screens
are `not-run`, not Passed. Silence is not coverage — say what did not run and why.

### 4 · Someone else's repo: team by default, client code read-only
A repo where you are a normal contributor (the QA/docs repo, a shared project repo) is written the way
any teammate writes it: work on a branch, push, open a merge request the OWNER reviews — never merge
your own MR, never force-push, never rebase pushed history, never rewrite another contributor's area
without proposing it in the MR, and stage selectively (`git add <paths>`, never `-A`: a parallel
session may hold uncommitted work). Until the owner names a repo as client code, treat it as a team
repo.
The app under test / any code you did not create is read-only: no commits, pushes, branches,
tags, PRs, stashes, rebases — nothing that mutates the repo, its history, or its remote.
Artefacts you produce (pipelines, reports, scripts) are *proposed* to the owner, never pushed in.
When a task seems to require writing into a client repo → STOP and ask; the default is hands-off.

### 5 · Escalate, don't decide
Some calls are the owner's, not the agent's: shipping with a known risk, changing agreed scope,
spending money (LLM credits, large model budgets, destructive/active scans), granting permission
for anything irreversible. Show the situation and the options; **wait**. Proceeding through a
human gate because the owner is away is a failed run, not a completed one — park it as `blocked`
and report.

---

**Where this is enforced, not just stated:** `Rules-Guide/kit-lint/` (the checkers) and its
`selftest.mjs` (the checkers proven to red bad input). Doctrine that nothing tests is a wish;
these five are wired into tools that fail loudly when they are broken.
