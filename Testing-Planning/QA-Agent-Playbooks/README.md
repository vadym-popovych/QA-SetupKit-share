# QA-Agent-Playbooks kit — the orchestration layer

Home for **playbooks**: given a trigger (new project, new build, release candidate),
which kits fire, in what order, with which **human-in-the-loop gates**, and what
"done" produces. Every other kit answers "how do I do X well"; a playbook answers
"what is the WHOLE pass, end to end". This encodes the **"Stop / Escalate" judgment**
from [`../../Rules-Guide/Roadmap/AI-QA-ROADMAP.md`](../../Rules-Guide/Roadmap/AI-QA-ROADMAP.md) — the QA operating
model an agent follows instead of improvising a sequence each session.

> **The prime directive, inherited from every kit:** semi-automatic, never fake a
> Pass. The agent executes; verdicts that gate anything outward-facing (statuses
> written to Sheets, bugs filed, "ready to ship") pass through a human gate first.

## The playbooks

| Trigger | Playbook | One-line flow |
|---|---|---|
| New project enters QA | [`template/PLAYBOOK_new-project.md`](template/PLAYBOOK_new-project.md) | strategy → oracles → test data → cases → checklist scaffolding — the planning stack, in dependency order |
| New build/PR on an active project | [`template/PLAYBOOK_new-build.md`](template/PLAYBOOK_new-build.md) | entry check → impact-select from RTM → execute at mapped depth → bugs → refresh RTM → report |
| Release candidate | [`template/PLAYBOOK_release-candidate.md`](template/PLAYBOOK_release-candidate.md) | full risk-ordered pass across disciplines → exit criteria → DoD → gap escalation → sign-off |

Playbooks COMPOSE kits — they never duplicate kit content. A playbook step says
"run the Checklist kit per its EMULATOR_RULES" and adds only ordering, gates, and
stop conditions.

## Files

| File | Purpose |
|---|---|
| [`SETUP.md`](SETUP.md) | How to pick + instantiate a playbook for a project |
| [`PLAYBOOKS_RULES.md`](PLAYBOOKS_RULES.md) | Cross-playbook rules (gates, budget, reporting) |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Paste block for a teammate's workspace `CLAUDE.md` |
| [`template/PLAYBOOK_*.md`](template/) | The three playbooks (copy + adapt per project) |

## Deliverables & where they live

A playbook run IS a testing round — its record is the round's **plan file**
(`<Project>/Test-Strategy/plans/<date>-<build>.md`, Test-Strategy kit) with its
Results section filled; discipline artefacts land in their own kit folders as always.
No separate playbook-output folder.

## Gate vocabulary (used by all playbooks)

| Gate | Meaning |
|---|---|
| 🟢 auto | agent proceeds, reports after |
| 🟡 confirm | agent shows a summary, WAITS for owner OK before writing/continuing |
| 🔴 owner | decision is the owner's alone (ship-with-risk, EXECUTING irreversible/data-destroying operations, scope change) |

**Destructive split:** GRANTING permission to run an active/destructive scan is 🟡
(agent proposes, owner OKs — the Security-Testing "green light"); EXECUTING an
irreversible / data-destroying operation itself is 🔴.

The 🟡 gates are exactly the existing kit rules (checklist statuses only after report
confirmation; strategy approval; active-scan permission; golden-master updates). A
playbook makes them visible in one place instead of scattered.
