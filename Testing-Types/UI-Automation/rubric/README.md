# Self-healing locators rubric (R0–R4)

Machine-checkable success rubric for the **UI-Automation self-healing locators loop**
(Loop Engineering proposal §2, Cowork 2026-07-10). This folder is the **verifier**: the
outer loop runs `run-rubric.mjs` between fixer iterations and reads one verdict JSON.
Plain Node ≥ 18 ESM, zero dependencies — except `verify-locators.mjs`, which needs
Playwright (resolved from the project, the config dir, or the cwd). No hardcoded
machine paths: everything comes from a config file.

## Criteria → scripts

| # | Criterion (Cowork §2) | Script | Needs |
|---|---|---|---|
| **R0** | Allowlist guard, **DEFAULT-DENY**: every file under the project EXCEPT `config.allowlist` (`locators/*.json`, `page-objects/*.ts`, `LOCATORS.md`) and the rubric's own output dirs is SHA-256-manifested at loop start and re-verified every iteration. Changed, deleted or **NEW** file outside the allowlist = **abort + escalate**; `config.offLimits` pins files as guarded even inside the allowlist. | `allowlist-guard.mjs` | manifest snapshot |
| **R1** | Every `locators/*.json` locator resolves to **exactly one** element on the live page. Selectors living ONLY in `page-objects/*.ts` are not live-checked (no TS→URL mapping) — they are ban-checked by R2 and reported by R1 as **unmapped notices**, so the gap is visible in every verdict; keep page objects consuming `locators/*.json` values and the gap stays empty. | `verify-locators.mjs` | test stand reachable + creds + Playwright |
| **R2** | No locator violates the stability order; lint rejects auto-generated ids (`mat-input-N`, GUID ids, `_ngcontent-*`, `ng-tns-*`, absolute `nth-child` chains). | `lint-locators.mjs` | nothing (offline) |
| **R3** | Full Playwright suite green OR every remaining failure classifies as an **assertion failure** (= product bug → `BUG-NNN`, never a loop fix). | `run-rubric.mjs` (spawns `config.testCommand`) | suite configured; `null` ⇒ reported *skipped, not failed* |
| **R4** | `LOCATORS.md` Traps updated for every changed/added locator (old→new + why). | `check-traps.mjs` | locators baseline snapshot |

`run-rubric.mjs` executes them cheap-to-expensive (**R0 → R2 → R4 → R1 → R3**); an R0
violation aborts immediately — the remaining criteria are not run.

## Maker-checker wiring (non-negotiable)

- **The OUTER LOOP (verifier) runs `run-rubric.mjs`. The FIXER never does.** The fixer
  subagent gets no execution/verification permission and never writes statuses or
  verdicts — separation falls out of structure.
- The fixer may edit **only** `locators/*.json`, `page-objects/*.ts`, `LOCATORS.md`.
  It repairs the HARNESS; it must never touch assertions, expected values, or
  checklist statuses to force green. R0 enforces this mechanically.
- Loop SUCCESS = verdict with **`pass: true` AND `complete: true`**. A verdict produced
  with `--skip …` is marked `complete: false` and can never close a loop.
- Stop conditions (from the loop-spec, not this folder): max 5 iterations; the same
  locator failing remap 2 consecutive iterations → stop + escalate; any R0 violation →
  abort immediately. Launching the repair loop is a 🟡 gate (owner confirms the
  loop-spec first).

## Bootstrap on a new project

```bash
# 1. Config: copy next to the project artefacts (recommended) and adjust
cp config.example.json <Project>/UI-Automation/rubric.config.json
#    -> set projectDir: "." , baseUrl, auth, urlOverrides, samples, allowlist/offLimits
#    NB: projectDir is relative to the CONFIG FILE; all other paths are relative to projectDir.
CFG=<Project>/UI-Automation/rubric.config.json

# 2. Baselines — ONCE at loop start, BEFORE the first fixer iteration
node check-traps.mjs      --config $CFG --snapshot   # locators/*.json baseline (R4)
node allowlist-guard.mjs  --config $CFG --snapshot   # off-limits manifest (R0)

# 3. Offline dry-run (no stand needed): R0 + R2 + R4
node run-rubric.mjs --config $CFG --skip R1,R3

# 4. Full verifier run (stand reachable, creds valid)
node run-rubric.mjs --config $CFG
```

The shipped `config.example.json` is shaped after a **CRM-platform pilot**
(`projectDir` is a placeholder — set it for YOUR location;
`Supervisor`/`Supervisor` are the public test-stand creds — fine in the example, real
project creds belong in a gitignored config copy).

## Individual scripts

Every script: `--config <path>` (or `$RUBRIC_CONFIG`, or `./rubric.config.json`),
`--json` for machine output on stdout (human logs always go to stderr).
Exit codes: `0` pass, `1` findings/fail, `2` usage or config error.

```bash
node lint-locators.mjs   --config $CFG [--json] [--strict-dup]
node verify-locators.mjs --config $CFG [--json] [--only products.json] [--headed]
node check-traps.mjs     --config $CFG [--json] [--snapshot] [--baseline <dir>]
node allowlist-guard.mjs --config $CFG --check|--snapshot [--json] [--baseline <dir>]
node run-rubric.mjs      --config $CFG [--skip R1,R3] [--only R0,R2,R4]
```

`--only` runs just the listed criteria (the per-criterion command form used in
loop-specs); like `--skip`, it marks the verdict `complete: false` (non-final).

## What R1 does (and its limits)

For each top-level group of each `locators/*.json` it resolves a page URL — the
group's own `url` field, or `config.urlOverrides["<file>#<group>"]` (explicit `null`
= skip-with-notice, e.g. form pages that need a record GUID) — navigates with generous
Freedom-UI waits (`networkidle` → ready selector from `config.readySelectors`, e.g.
`crt-grid` on `_ListPage` URLs → `settleMs` ≈ 12 s), then asserts
`page.locator(sel).count() === 1`.

- **Template locators** (`<Колонка>`, `<назва запису>` …) are substituted from
  `config.samples`; unresolved placeholders ⇒ skipped-with-notice.
- **Annotated values** (human prose mixed into the selector string — legit in the
  artefact docs) ⇒ skipped-with-notice, never guessed at.
- **Intentionally multi-element locators** (a link per grid row) are listed in
  `config.multiAllowed` (`<file>#<keyPath>`, `*` wildcard) and pass with `count >= 1`.
- Auth `mode: "api"` POSTs the login endpoint through the browser context
  (`context.request`) so cookies land in the page — the Creatio
  `AuthService.svc/Login` → `Code:0` pattern. `preAuthGroups` (login form locators)
  are checked before authenticating.
- R1 **hits the live stand** — authorized test/staging environments only, never
  production. CI-less local runs are fine: all it needs is the stand reachable from
  this machine plus creds in the config.

## Verdict JSON (what the outer loop consumes)

`run-rubric.mjs` prints the verdict to stdout and writes it to
`<projectDir>/rubric-verdicts/<timestamp>.json`:

```jsonc
{
  "rubric": "self-healing-locators v1",
  "pass": false,          // all configured, non-skipped criteria green
  "complete": true,       // false when --skip was used or R0 aborted => non-final
  "aborted": false,       // true = R0 violation, stop the loop NOW
  "criteria": {
    "R0": { "pass": true, "checked": 12, "violations": { "changed": [], "deleted": [], "added": [] } },
    "R2": { "pass": true, "findings": [], "counts": { "errors": 0, "warnings": 1 } },
    "R4": { "pass": false, "findings": [ { "file": "products.json", "keyPath": "formPage.fields.price", "old": "…", "new": "…" } ] },
    "R1": { "pass": false, "stats": { "checked": 40, "fail": 3 }, "findings": [ /* fail+skipped only */ ] },
    "R3": { "skipped": true, "detail": "testCommand is null …" }
  },
  "hints": [ "R4: 1 changed/added locator key(s) missing a LOCATORS.md Traps mention …" ]
}
```

`hints` are the fixer's next-iteration work list (relayed by the outer loop — the
fixer still never runs the verifier itself). R3's classification splits failing output
into `locatorResolution` (harness — keep looping) vs `assertion` (product bug — file
`BUG-NNN`) vs `unclassified` (conservative fail, human look).

## Files

| File | Role |
|---|---|
| `config.example.json` | pilot-shaped config (CRM platform); copy per project |
| `lib.mjs` | shared config loader, locator extraction/classification, glob + hash helpers |
| `lint-locators.mjs` | R2 |
| `verify-locators.mjs` | R1 (Playwright) |
| `check-traps.mjs` | R4 + `--snapshot` baseline |
| `allowlist-guard.mjs` | R0 + `--snapshot` manifest |
| `run-rubric.mjs` | verifier entry point: R0→R2→R4→R1(→R3), verdict JSON |

Loop-run artefacts (baseline, verdicts, iteration logs) live under the **project**
(`<Project>/UI-Automation/rubric-baseline/`, `rubric-verdicts/`,
`<Project>/UI-Automation/loops/<run-id>/`), never inside this kit folder.

Note: the first dry-run on an existing project may legitimately surface pre-existing
debt (e.g. a locator value that mixes selector engines). That is the rubric working —
those findings seed the first fixer iteration; do not tune the rubric to green them.
