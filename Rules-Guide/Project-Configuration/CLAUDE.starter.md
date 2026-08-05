# Project-Configuration — starter rules (paste into YOUR workspace CLAUDE.md)

## Project folder structure — one parent folder per project
- Per-project QA artefacts live under ONE parent folder per project at the workspace
  root, named **`<Name>-project/`** (e.g. `<Project>/`; the `<Project>/`
  shorthand in rules = this folder), with **one subfolder per testing type,
  mirroring the QA-SetupKit kits**: `QA-Documentation/`, `Load-Testing/`,
  `API-Testing/`, `UI-Automation/`, `Emulator-Testing/`, `Security-Testing/`, … Full convention + mapping
  table: `QA-SetupKit/Rules-Guide/Project-Configuration/README.md`.
- When starting a NEW type of testing for a project, create `<Project>/<Testing-Type>/`
  (scaffolding from the matching `QA-SetupKit/` kit template if one exists) — never a
  root-level `<Project>-<type>` folder and never inside `QA-SetupKit/`.
- **Every artefact produced during development & further testing** (run results, reports,
  logs, screenshots, generated scripts, analysis notes) is filed into its
  `<Project>/<Testing-Type>/` folder AT CREATION TIME — not at the project/workspace
  root, not left in scratch locations.
- `QA-SetupKit/` holds only shareable templates/rules; filled-in project-specific
  harnesses, results, and configs go under `<Project>/`. Per-project secrets (test
  users, tokens) are gitignored there, with `*.example.*` files shipped instead.
- **Pulled project repos:** a cloned project repository (app under test, client code)
  lives at `<Project>/<Name>-repository/` (several repos →
  `<Name>-<role>-repository/`). The `-repository` suffix marks a READ-ONLY clone —
  never commit into it, never file QA artefacts inside it; no clones at the workspace root.
- **Project memory:** each `<Project>/` carries its own `CLAUDE.md` (scaffold:
  `QA-SetupKit/Rules-Guide/Project-Configuration/PROJECT_CLAUDE.starter.md`) holding
  project-specific facts — staging URLs, doc/board IDs, Figma node-ids, account pools,
  invariant baselines, bug state. Claude Code auto-loads it when working inside the
  project folder. Put project deltas THERE, not in this workspace file; before working
  on a project, read its `CLAUDE.md` if not already in context. Client repos are
  read-only → the file lives in your QA folder, never inside the client's repository.
