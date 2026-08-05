# Fixture mini-kit (bad)
This README links to a file that does not exist:
[missing doc](this-file-does-not-exist.md).
kit-lint MUST go red on this (L1 broken link).

It also links into a project folder — dead in any fresh clone:
[project artefact](../../../TestApp-project/Load-Testing/REPORT.md).
kit-lint MUST go red on this too (L3 link into a project folder).

And a STALE generated index block: the source has `beta/` (unlisted here) and does NOT
have `gamma` (a phantom row). kit-lint MUST go red on both (L12):

<!-- kit:generated:integrations source=Integrations -->
| Folder | Role |
|---|---|
| [`alpha/`](Integrations/alpha/) | present in the source — the one correct row |
| `gamma/` | phantom — the source no longer has this folder |
<!-- /kit:generated -->
