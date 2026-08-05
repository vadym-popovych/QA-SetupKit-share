# Rules-Guide — reference & convention layer

Cross-cutting reference docs and machine contracts that every kit leans on (grouped
here from the QA-SetupKit root, 12/07/2026; former `_`-prefixed names dropped the
prefix). Execution disciplines: [`Testing-Types/`](../Testing-Types/) · planning/process
kits: [`Testing-Planning/`](../Testing-Planning/).

| Folder | What it holds | Used by |
|---|---|---|
| [`DOCTRINE.md`](DOCTRINE.md) | the five always-on rules every kit is a dialect of (never fake a Pass · name the oracle · blocked ≠ green · client repos read-only · escalate don't decide) — paste-first, ~2k chars | EVERY session; each `<TYPE>_RULES.md` restates it in its own terms |
| [`schemas/`](schemas/) | machine contracts: 11 JSON Schemas (`bug`, `bug-spec`, `test-case`, `run-result`, `checklist-row`, `coverage`, `strategy`, `pagespeed-round`, `bug-summary`, `test-report`, `link-ledger`) + zero-dep `validate.mjs` (`node validate.mjs <schema> <instance>`); enums = the controlled vocabulary, changelog in its README | every kit that writes/reads machine artefacts (validate on write AND read) |
| [`link-ledger/`](link-ledger/) | `link-ledger.mjs` — the handover rule *"an update must land under the SAME link"* as a machine check: a per-project `.link-ledger.json` records each carrier's id (+ tab gid) by PURPOSE, and a build that would land somewhere else is REFUSED before it writes. A trash-and-recreate is invisible in the UI; a recorded id is not | every tool that rebuilds a re-creatable carrier (Sheet tab, Doc, published report) |
| [`glossary/`](glossary/) | `GLOSSARY.md` — every load-bearing QA term, its owner kit and schema home; meaning conflicts → owner wins | all kits; new term used by ≥ 2 kits without an entry = defect |
| [`Roadmap/`](Roadmap/) | `AI-QA-ROADMAP.md` — the build plan from *AI-operated tools* to *AI QA engineer*, module order + status table | planning which kit gets built next |
| [`kit-lint/`](kit-lint/) | `kit-lint.mjs` — the kit's test for ITSELF: links resolve · every tool a doc tells you to run actually ships · no author-machine paths · every kit has README/SETUP/RULES/starter · every kit is registered. Exceptions in `allow.json`, each with a reason | before sharing the kit, after any structural change, and automatically in the daily backup run |
| [`Project-Configuration/`](Project-Configuration/) | the `<Project>/<Testing-Type>/` workspace convention + kit→subfolder mapping table + per-project `CLAUDE.md` memory ([`PROJECT_CLAUDE.starter.md`](Project-Configuration/PROJECT_CLAUDE.starter.md)) | every session that files project artefacts |

Full direction table with SETUP/starter links: [root README](../README.md).
