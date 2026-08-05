# QA-Agent-Playbooks — SETUP (Claude-followable)

How to run an orchestrated QA pass. Prerequisite: the more of the planning stack
exists, the better — but the FIRST playbook (`new-project`) is exactly the one that
builds it, so there is no chicken-and-egg: no strategy → start there.

## Picking the playbook

1. **No `<Project>/Test-Strategy/STRATEGY.md`?** → [`template/PLAYBOOK_new-project.md`](template/PLAYBOOK_new-project.md).
2. **New build / PR / feature drop on an active project?** → [`template/PLAYBOOK_new-build.md`](template/PLAYBOOK_new-build.md).
3. **Owner says "release candidate" / "чи можемо релізити"?** → [`template/PLAYBOOK_release-candidate.md`](template/PLAYBOOK_release-candidate.md).
4. Ad-hoc ask that fits none ("just check X quickly") → NOT a playbook run: do the
   check per the relevant kit, no plan file, say explicitly it was ad-hoc.

**Hotfix builds** are `new-build` runs (same trigger — a build landed). If the hotfix
must SHIP immediately, close with the `release-candidate` playbook under
**owner-approved scope reduction** recorded in the plan file (expedited RC:
regression on the changed area + exit-criteria check + gap waivers; disciplines
already green this cycle are NOT re-run). **Precedence:** when one build matches
both triggers 2 and 3, the owner's "release candidate" declaration wins.

## Running it

1. Copy the playbook table into the round's plan file
   (`<Project>/Test-Strategy/plans/<date>-<build>.md`) as its execution checklist —
   the playbook template itself stays untouched in the kit. For `new-project` runs
   (no folders yet, no build), CREATE `<Project>/Test-Strategy/plans/` as part of this
   step (folder convention per Project-Configuration) and name the file
   `<date>-onboarding.md`.
2. Walk the steps in order. At each 🟡 gate: one SHORT summary message → wait for OK.
   At 🔴: present options, the owner decides, record the decision in the plan.
3. Between phases: session-limit check (Usage kit —
   `../../Claude-Extra-Skills-Features/Usage/SETUP.md`; not installed → treat each
   phase boundary as a report-and-confirm point); if the next phase doesn't fit the
   budget → pause protocol AT the boundary (handoff + scheduled continuation),
   never mid-phase.
4. Close per the playbook's Output block: plan Results, RTM/coverage refresh, stop
   condition named, standard report with a LINKS section.

## Adapting per project

Projects may add steps (e.g. a content-quality LLM-judge pass for generative apps,
store-build smoke for mobile) — add them to the PROJECT's copy in the plan file and,
if they recur, propose a project-specific playbook variant saved next to the plans
(`<Project>/Test-Strategy/playbooks/`). The kit templates stay generic.
