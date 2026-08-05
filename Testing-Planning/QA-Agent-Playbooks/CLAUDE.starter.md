# Playbooks starter rules — paste into YOUR workspace CLAUDE.md

## QA orchestration — QA-Agent-Playbooks kit
- **Home:** `QA-SetupKit/Testing-Planning/QA-Agent-Playbooks/`. Trigger → playbook: new project →
  `PLAYBOOK_new-project` (strategy → oracles → test data → cases → checklists);
  new build/PR → `PLAYBOOK_new-build` (entry check → RTM impact-select → execute →
  bugs → RTM refresh); release candidate → `PLAYBOOK_release-candidate` (full
  risk-ordered pass → exit criteria → DoD → sign-off). Don't improvise sequences
  when a playbook exists; deviations noted in the plan file.
- **Gates:** 🟢 auto / 🟡 confirm (agent shows summary, WAITS — statuses, strategy
  approval, active/destructive-scan PERMISSION, golden-master updates) / 🔴 owner-only
  (ship-with-risk, EXECUTING irreversible/data-destroying ops, scope change).
  Proceeding through a 🟡 gate unattended = failed run; park as `blocked` and report.
- **Every playbook run is a round:** opens a plan file
  (`<Project>/Test-Strategy/plans/`), closes with Results + RTM/coverage refresh +
  named stop condition + standard report with clickable LINKS.
- **Budget-aware:** check session limit before each expensive phase; pause protocol
  fires at phase boundaries, not mid-phase.

Full rules: `QA-SetupKit/Testing-Planning/QA-Agent-Playbooks/PLAYBOOKS_RULES.md`.
