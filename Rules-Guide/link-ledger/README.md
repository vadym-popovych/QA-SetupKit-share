# link-ledger — the same artefact must keep the same link

A tiny helper (one file, zero dependencies) that turns one handover rule into a machine check:

> **Updating an artefact must land under THE SAME link.** Never "upload a new one and trash the old".

## Why this one rule gets a script

Most handover mistakes are visible: a wrong number, a missing section, a doc in the wrong folder.
This one is not. A trashed-and-recreated Sheet, tab or Doc looks **identical** in the UI to an
updated one — same title, same content, same place. What changed is the id, and with it every
shared link, every bookmark, every `#gid=` reference someone was given. Nobody notices until a
teammate opens a dead link, usually long after the round is over.

A human eye cannot check this. A recorded id can. So the duty stops being a memory and becomes a
file the tools read before they write.

## The ledger

`<Project>/.link-ledger.json` — one entry per carrier, keyed by **purpose**, not by title (a title
changes legitimately with dates and rounds; an id must not):

```json
{ "version": 1, "entries": [
  { "kind": "sheet-tab", "key": "bug-summary/tab", "id": "<fileId>", "gid": 940001,
    "title": "Statistic", "firstSeen": "…", "lastSeen": "…" } ] }
```

Contract: [`../schemas/link-ledger.schema.json`](../schemas/link-ledger.schema.json)
(`node ../schemas/validate.mjs link-ledger <Project>/.link-ledger.json`).

**The ledger holds a real project's file ids, so it is a project artefact — it never lives in the
kit.** Only this helper does.

## The check, and how it fails

| Situation | What happens |
|---|---|
| no entry for that purpose | recorded, "first sighting" printed — a genuinely new artefact never fails |
| id **and** gid match | silent; `lastSeen` refreshed |
| id or gid differs | **throws — the write does not proceed**, naming the old id/gid and what it kills |
| `LINK_LEDGER_ADOPT=1` | re-points deliberately and **loudly**, keeping the old id in `adoptions[]` |
| ledger unreadable | throws — a corrupt ledger is not "no ledger"; resetting it would silently drop every recorded id |

A gid moving counts as a break even when the spreadsheet id is unchanged: shared links carry the
gid, so a rebuilt tab with a fresh gid is a dead link with a live document behind it.

## Use it

From a tool, one call at the write boundary — **before** the first mutating request:

```js
import { assertStableLink, LinkLedgerError } from '<…>/Rules-Guide/link-ledger/link-ledger.mjs';
try {
  assertStableLink({ kind: 'sheet-tab', key: 'bug-summary/tab', id: ssId, gid: GID, title: TAB });
} catch (e) {
  if (e instanceof LinkLedgerError) die(`${e.message}\n  Nothing was written.`, 1);
  throw e;
}
```

From a shell:

```bash
node link-ledger.mjs check --kind sheet-tab --key bug-summary/tab --id <fileId> --gid 940001
node link-ledger.mjs list
node link-ledger.mjs selftest     # proves the REFUSAL, not just the happy path
```

`selftest` runs the guard against a throwaway ledger and asserts all eight behaviours above,
including that a refusal **leaves the ledger untouched** — a guard verified only on its passing
case is not verified.

Env: `LINK_LEDGER=<path>` (otherwise: the nearest existing ledger walking up from the cwd, else the
nearest `*-project` folder) · `LINK_LEDGER_ADOPT=1`.

## Wired into

| Tool | Carrier it guards | Ledger key |
|---|---|---|
| [`bs-sheet.mjs`](../../QA-Documentation/Custom-Reports/Bug-Summary/template/tools/bs-sheet.mjs) | the Bug-summary tab (`BS_GID`) + the derived Left-issues tab (`BS_STATUS_COLUMN=1`) | `bug-summary/tab`, `bug-summary/left-tab` |
| [`psi-sheet.mjs`](../../QA-Documentation/Custom-Reports/PageSpeed-report/template/tools/psi-sheet.mjs) | the PageSpeed report tab (`PS_GID`) | `pagespeed/tab` |
| [`tc.mjs sheet`](../../QA-Documentation/Test-Cases/template/tools/tc.mjs) | the executable Test-cases tab (`TC_GID`) | `test-cases/tab` |
| [`tr-doc.mjs`](../../QA-Documentation/Custom-Reports/Test-Report/template/tools/tr-doc.mjs) | the Test-report Google Doc, per edition (a new title is a new document by design) | `test-report/<title>` |
| [`generate_via_api.mjs`](../../QA-Documentation/Checklist/template/tools/generate_via_api.mjs) | the checklist tab it wipes and rebuilds (located by title, which is not an identity) | `checklist/<tab>` |
| [`lib-report-tab.mjs`](../../Testing-Types/Load-Testing/template/tools/lib-report-tab.mjs) | any house-style report tab built with `fixedGid` (it deletes and re-adds the tab) | `ledgerKey`, else `report-tab/<tab>` |
| [`write-run-doc.mjs`](../../Testing-Types/Load-Testing/template/tools/write-run-doc.mjs) | the per-run Load-test report Google Doc (update-in-place located by title — which is not an identity; the key is the run) | `load-testing/run-doc/<runId>` |
| [`rebuild-bug-tab.mjs`](../../QA-Documentation/Bug-Reports/template/tools/rebuild-bug-tab.mjs) | the Bug Reports v2 tab it wipes and rebuilds (fixed gid 777001; identity known up front, so the check runs before ANY api call) | `bug-reports/tab` |

A tool without the check still works — it prints that link stability was **not** checked. That
degradation is deliberate (the helper may be absent in a partial clone) and it is the ONLY soft
edge here: once the helper is present, a moved carrier is a refusal, never a warning.

## What was actually proven (05/08/2026)

Every wiring above was exercised, not reasoned about:

- **bs-sheet** — end to end: a fresh carrier recorded a first sighting and built; the second run was
  silent and landed on the same `…/edit#gid=` link; a seeded mismatch refused a rebuild of a real
  tab before any request went out.
- **psi-sheet · tc.mjs sheet · generate_via_api** — refused live against a real document with a
  seeded mismatch, each before its own wipe/rebuild.
- **tr-doc** — created a probe edition (first sighting), then refused the rebuild after the ledger
  was pointed at another documentId — before the stray-trash and body-wipe it does on re-runs.
- **lib-report-tab** — driven with a recording fake client: **zero API calls** were made before the
  refusal, and the recorded carrier still builds normally.
- **the helper itself** — `selftest`, 8/8, including that a refusal leaves the ledger untouched.

The last two builders were wired the same evening (unattended follow-up), proven with a recording
`googleapis` stub — no live document was touched:

- **write-run-doc** — a seeded mismatch refused the re-run at the guard: only folder/title
  lookups had run (6 reads), **zero mutating calls**, and the ledger kept the recorded id.
- **rebuild-bug-tab** — the carrier's identity is env + a constant gid, so the refusal came
  before **any** API call at all (the stub's call log stayed empty); a moved gid alone — the
  spreadsheet unchanged — also refused.
