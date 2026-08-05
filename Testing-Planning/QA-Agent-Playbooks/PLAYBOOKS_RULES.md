# Playbooks rules (paste into your workspace CLAUDE.md)

Cross-playbook rules for orchestrated QA passes. Machine-specific paths do NOT belong
here. Mirror new rules of this kind here (+ into `CLAUDE.starter.md` and the
workspace `CLAUDE.md`) so they travel with the kit.

- **A trigger picks the playbook; the playbook picks the kits.** New project →
  new-project; new build/PR → new-build; release candidate → release-candidate. Don't
  improvise a sequence when a playbook exists; deviations are noted in the plan file
  with a reason.

- **Playbooks compose, never duplicate.** A step delegates to a kit's own
  SETUP/RULES; the playbook adds only ordering, gates, stop conditions. If a step
  needs kit behaviour that doesn't exist, extend THE KIT, then reference it.

- **Gates are non-negotiable:** 🟡 confirm steps WAIT for the owner (checklist
  statuses after report confirmation, strategy approval, active/destructive-scan
  PERMISSION, golden-master updates; EXECUTING an irreversible/data-destroying
  operation and ship decisions are 🔴). An agent that proceeds
  through a 🟡 gate because the owner is away has failed the run — park and report
  instead (blocked is a legitimate stop condition).

- **Every playbook run is a round:** it opens (or creates) a plan file
  (`<Project>/Test-Strategy/plans/`), executes against the strategy, and closes by
  filling the plan's Results + refreshing RTM/coverage + naming the stop condition.
  No plan file = no playbook run — a quick ad-hoc check isn't a round and doesn't
  pretend to be one.

- **Budget-aware by design:** check the session limit BEFORE each expensive phase
  (build, generation series, load run, full review) and at every phase boundary —
  the session-limit discipline comes from the Usage kit
  (`QA-SetupKit/Claude-Extra-Skills-Features/Usage/SETUP.md`); if it's not
  installed, skip the mechanical check and treat every phase boundary as a
  report-and-confirm point instead; if the remaining budget can't
  fit the next atomic phase → execute the pause protocol (handoff + scheduled
  continuation) at the phase boundary, not mid-phase.

- **End-of-run report is standard:** what ran (kits × depth), verdicts with oracles,
  bugs filed (severity + branch quoted), skips with reasons, gaps escalated, stop
  condition fired, and a LINKS section — every artefact clickable (plan file, sheet
  tabs, run docs, reports). Same LINKS ethos as the load-testing rule.

- **Parallelize across disciplines, serialize within one:** independent kits (API
  checks vs checklist run on different surfaces) may run concurrently; steps sharing
  state (same account pool, same environment writes) run in sequence — respect the
  Test-Data isolation rules (1 account per concurrent actor).

- **Every release candidate gets a pre-mortem BEFORE the sign-off gate** (RC playbook step 5.5):
  assume the release failed, write the incident report, and ask of each scenario *"why didn't we
  catch it?"* — the answer is a hole in the strategy/oracles/coverage, and it becomes a case, an
  invariant, an extension of the round, or a named waiver the owner signs. Run it with an
  INDEPENDENT agent where possible (the one who ran the round is the worst-placed to see what it
  missed), and always before the gate — a pre-mortem written afterwards is a diary entry. A
  checklist only finds what someone already thought of; this is how the round finds the rest.
