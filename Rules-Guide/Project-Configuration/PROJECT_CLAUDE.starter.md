# PROJECT_CLAUDE.starter.md — per-project memory file template

Copy the template below to `<workspace>/<Name>-project/CLAUDE.md` when a new project starts.
Fill in what already exists; delete sections that don't apply yet and re-add them lazily
when that kind of work begins.

**Why a separate file:** Claude Code loads `<Project>/CLAUDE.md` automatically whenever
it works with files inside the project folder — and does NOT load it otherwise. Keeping
project facts here (instead of the workspace CLAUDE.md) means sessions on other projects
don't pay tokens for them, and the workspace file stays small and stable.

**Rule of thumb — what goes where:**
- general QA methodology → the matching `QA-SetupKit/…` kit-RULES;
- machine/owner-specific setup (MCP paths, secrets, backups) → workspace `CLAUDE.md`;
- project-specific facts (URLs, IDs, pools, baselines, contacts) → THIS file.

⚠️ **Client repos are read-only.** If the project folder contains a clone of the
app-under-test repo, this file lives in your own QA artefacts folder `<Project>/` at the
workspace root — never committed into the client's repository.

---

```markdown
# <Project> — project memory (delta over workspace rules and QA-SetupKit)

Project facts for the agent: environments, doc/board IDs, pools, invariants, bug state.
Discipline rules live in the workspace CLAUDE.md and kit-RULES; this file is ONLY the
<Project> delta. New project facts go HERE, not into the workspace file.

## Critical invariants (POINTERS — full rules in workspace CLAUDE.md / kit-RULES; do NOT copy rules here)
- **Client repo is READ-ONLY** — no commit/push/branch/tag; build from a git-less snapshot outside the repo.
- **Anonymity boundary** — THIS file and this project's artifacts hold REAL project data and do NOT
  travel with the kit. Anything generalized INTO the kit (tool/template/example/doc) must be
  anonymized first (strip client/app/scheme names, ids, hosts, machine paths); a new app/client name
  goes into the kit L10 denylist the same day.
- **Drive layout** — every doc I create lives under `ClaudeProjects/<Project>/<Category>/`, never Drive root.

## Project
- <One line: what the product is; platforms; client/owner.>
- <Repo clones, e.g. `<Project>-repository/` (remote: `<url>`) — READ-ONLY client code.>

## Environments
- Staging: `<url>` · Prod: `<url>` (⚠️ never load-test prod)
- Dev builds: `<source of builds; where the version comes from, e.g. pubspec.yaml>`

## Design (Figma)
- File: `<figma file url or key>`; key screens: `<name>` `<node-id>`, …

## Docs & Sheets
- QA Sheet (checklists): `<spreadsheet id>`
- Load-testing run log: `<spreadsheet id>`, tab `Runs`
- Bug candidates doc: `<doc id>`

## Bug tracker
- Board: `<url>`, project `<name (id)>`, tracker `<id>`; filing tool: `<path>`
- Assignees by role: frontend/app → `<name (id)>`, backend → `<name (id)>`
- Bug state: `<where pending candidates and filed tickets live; historical closures>`

## Test accounts / pools
- Pool: `<accounts + documented state: subscriptions, quotas, slots>`
  (gitignored `<Type>/users.json`, ship `users.example.json`)

## Known issues & invariants
- `INV-N`: `<what to check every run + check tool + current baseline>`

## Per-discipline deltas
- <Testing-Type>: <project-specific exceptions/extensions to the kit rules>
```
