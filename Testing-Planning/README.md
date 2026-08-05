# Testing-Planning — the planning & process layer

One folder per **planning/process kit** — the layer that decides *what* to test, *how
deep*, *against which oracle*, *with what data*, *how it all connects and reports*, and
*what runs unattended* (grouped here from the QA-SetupKit root, 12/07/2026). Execution disciplines live in
[`Testing-Types/`](../Testing-Types/), the reference/convention layer in
[`Rules-Guide/`](../Rules-Guide/); documentation and infra stay at the root.

This table is a **generated projection** of the folder list (`kit-lint` L12 keeps it
honest; a kit folder added without a row here fails the lint).

<!-- kit:generated:planning-kits source=Testing-Planning -->
| Kit | Role | Project artefacts |
|---|---|---|
| [`Test-Strategy-and-Planning/`](Test-Strategy-and-Planning/) | the agent's charter: scope, risk matrix, entry/exit & stop criteria, per-round plans | `<Project>/Test-Strategy/` |
| [`Test-Oracles/`](Test-Oracles/) | deciding pass/fail objectively: oracle per area, invariants, LLM-judge rubrics, golden baselines | `<Project>/Test-Oracles/` |
| [`Test-Data/`](Test-Data/) | account pools, deterministic seeds, fixtures, teardown discipline | `<Project>/Test-Data/` |
| [`Traceability/`](Traceability/) | RTM: strategy unit → case → run → bug → invariant; coverage gaps = escalation list | `<Project>/Test-Strategy/` (co-located) |
| [`QA-Agent-Playbooks/`](QA-Agent-Playbooks/) | orchestration: trigger → which kits fire in what order, with human gates | records in `<Project>/Test-Strategy/plans/` |
| [`Reporting-and-Metrics/`](Reporting-and-Metrics/) | computed-not-estimated metrics, Trends tab, release cycle summaries | `<Project>/QA-Reports/` |
| [`CI-Integration/`](CI-Integration/) | the kits' checks as standing gates: PR / nightly / release pipelines + the verdict emitter; pipelines are PROPOSED, never pushed | `<Project>/CI-Integration/` |
<!-- /kit:generated -->

Full direction table with SETUP/starter links: [root README](../README.md).
Project-folder convention: [`Project-Configuration/`](../Rules-Guide/Project-Configuration/README.md).
