# PageSpeed report — SETUP (Claude-followable)

One-time setup, then two commands per round. Rules:
[`PAGESPEED_REPORT_RULES.md`](PAGESPEED_REPORT_RULES.md). Sheet layout:
[`SHEET_TEMPLATE.md`](SHEET_TEMPLATE.md).

The two tools are driven **differently, on purpose**, and the difference is worth learning once:

| Tool | Driven by | Why |
|---|---|---|
| [`psi-run.mjs`](template/tools/psi-run.mjs) — the collector | **flags** (`--round`, `--env`, `--label`, …) | a round's identity is typed at the moment it is collected, and a flag is visible in your shell history |
| [`psi-sheet.mjs`](template/tools/psi-sheet.mjs) — the Sheet builder | **environment variables** (`PROJECT_NAME`, `PS_TAB`, …) | it is the same publish contract every other Sheets builder in this kit uses |

Both self-document: `node tools/psi-run.mjs --help` prints its own header. When this file and the
tool ever disagree, **the tool is right** — fix this file.

## 0 · Prerequisites

1. **Node ≥ 18** (`node --version`) — the collector uses the built-in `fetch`, no dependencies.
2. **Google Sheets OAuth** — the same `mcp-sheets` credentials every other Sheet generator in this
   kit uses (checklists, test-cases, report tabs). Needed **only to publish** (§5); collection and
   `--dry-run` do not touch Google. Not set up yet → follow
   [`../../Checklist/MCP_SETUP.md`](../../Checklist/MCP_SETUP.md) first; there is nothing
   PageSpeed-specific about it, and you do it once per machine.
3. **A PSI API key** — free, and **not optional** for the `psi` engine: see §1.

## 1 · The PSI API key (required — the tool fails closed without it)

**Verified:** calling the PageSpeed Insights API *without* a key currently returns

```
HTTP 429 — Quota exceeded for quota metric 'Queries' and limit 'Queries per day'
           ... for consumer 'project_number:583797351490'
```

That consumer is Google's **shared anonymous project**, and its daily quota is exhausted. So "it
works without a key" is false, and a collector that silently produced zeros here would be
fabricating results. `psi-run.mjs` refuses to start without a key and prints these steps.

Get one (2 minutes, no billing):

1. [Google Cloud Console](https://console.cloud.google.com/) → pick or create any project.
2. **APIs & Services → Library** → search **"PageSpeed Insights API"** → **Enable**.
3. **APIs & Services → Credentials** → **Create credentials → API key** → copy it.
4. (Recommended) **Restrict key** → *API restrictions* → allow only the PageSpeed Insights API.

**How the collector finds the key** — first hit wins (read from `resolveApiKey()` in the source):

| Order | Source |
|---|---|
| 1 | `$PSI_API_KEY` — the key itself |
| 2 | `$PSI_API_KEY_FILE` — a file containing only the key |
| 3 | **the default file**, searched upwards from the tool and from the cwd: `MCP-configurations/pagespeed/.token` (gitignored) |

Because of (3), the normal setup on a configured machine is **no env var at all** — drop the key in
`MCP-configurations/pagespeed/.token` and the tool finds it. An **empty** `.token` counts as an
absent key and gets the same full instruction, not a shrug.

The key is a secret: never printed by the tools (it is redacted even out of failing URLs and error
bodies), never pasted into a Sheet, never committed. The owner creates the `.token` file — an agent
asks for it, it does not invent one.

**Quotas with a key:** 25 000 queries/day and 240 queries/minute. One page × one platform × one run
= one query, so a 20-page site × 2 platforms × 3 runs = 120 queries — comfortably inside both. The
collector throttles itself (`--throttle-ms`, default 1500) and retries a `429`/`5xx` with
exponential backoff (3s → 6s → 12s, 4 attempts); a page that still fails is recorded as `error`,
never as a score. An **invalid or rejected** key is different: it aborts the whole run *before
anything is written*, because a round full of `error` cells caused by a bad key is not evidence
about the product.

## 2 · Configure the pages

```bash
mkdir -p <Project>/Web-Performance/{rounds,tools}
cp <kit>/QA-Documentation/Custom-Reports/PageSpeed-report/template/pages.example.json \
   <Project>/Web-Performance/pages.json
ln -s <kit>/QA-Documentation/Custom-Reports/PageSpeed-report/template/tools/psi-run.mjs    <Project>/Web-Performance/tools/
ln -s <kit>/QA-Documentation/Custom-Reports/PageSpeed-report/template/tools/psi-sheet.mjs  <Project>/Web-Performance/tools/
ln -s <kit>/QA-Documentation/Custom-Reports/PageSpeed-report/template/tools/psi-report.mjs <Project>/Web-Performance/tools/
```

(Symlinks, not copies — the tools carry no project config, so a pointer is correct and drift-free,
per Project-Configuration convention #9.)

Fill `pages.json` ([`template/pages.example.json`](template/pages.example.json) is the contract):

| Key | Required | What it is |
|---|---|---|
| `baseUrl` | **yes** | must start with `http(s)://`. **This is what makes a round a staging round or a production round** — it must agree with the `--env` you pass. |
| `sections[].name` | **yes** | the section bands of the Sheet, in this order |
| `sections[].pages[]` | **yes** | each page is `{ id, name, path }` |
| `platforms` | no | `["desktop","mobile"]` by default; only those two values are accepted |
| `runsPerPage` | no | default **3** — read the rules before lowering it; 1 run is noise, not a measurement |

> **A page has a `path`, not a `url`.** `path` is joined to `baseUrl` (`new URL(path, baseUrl)`), and
> that is deliberate: one inventory serves every environment, and the host you measured travels in
> the round JSON. A page entry without `id`, `name` and a string `path` is rejected —
> *"every page needs { id, name, path }"*.

The `id` is the join key: the Sheet carries rounds over **by (page id, platform)**, and it must
match `^[a-z0-9][a-z0-9-]*$`. Rename a page freely; **never re-use or change an `id`** without
deciding what happens to its history.

## 3 · Prove it before you spend anything (zero quota, and it proves the most)

Two switches cost **no API quota, no network and no Google**, and they are the ones to reach for
first — in a review, in CI, and every time you touch the tools:

```bash
node tools/psi-run.mjs --self-check      # offline: the parse / median / status logic, PASS-FAIL per case
node tools/psi-sheet.mjs --dry-run       # validates every round + builds the whole tab in memory, prints it
```

- **`--self-check`** runs the parser over a recorded PSI response fixture and the median/status logic
  over synthetic run sets: a real `0` is a score, `1 of 3` runs is `not-run` and never a partial
  green number, an absent CrUX block is absent and not zero. It exits **1** on any failure. It is
  honest about its own limits and says so: *"self-check is offline; the LIVE PSI path is NOT covered
  by it."*
- **`--dry-run`** does everything except Google: it schema-validates every round in `rounds/`,
  enforces the honesty checks the schema cannot express (§5), lays out the tab and prints it, then
  says *"--dry-run: rounds validated, tab built in memory. Nothing was written to Google."* It needs
  no `PROJECT_NAME` and no OAuth.

Run `--self-check` now; run `--dry-run` after §4, once at least one round exists (with an empty
`rounds/` it correctly refuses: *"no rounds in …"*). A live PSI call is the *only* step that costs quota.

## 4 · Collect a round (`psi-run.mjs` — FLAG-driven)

```bash
cd <Project>/Web-Performance
node tools/psi-run.mjs --round r7 --env staging --label "Points from 13/07/2026 (Stage)"
# → rounds/r7.json   (schema-valid, or it is DELETED and not shipped)
```

| Flag | Meaning |
|---|---|
| `--round <id>` | **required** — matches `^[a-z0-9][a-z0-9-]*$`. Names the file (`<out-dir>/<id>.json`) **and** the Sheet block. |
| `--env <e>` | **required** — `staging` \| `production` \| `local` \| `other`. Part of the identity of every number in the round. |
| `--label "<text>"` | **required** — the Sheet block header, verbatim (the owner's format: `Points from DD/MM/YYYY (Stage)`). |
| `--date <YYYY-MM-DD>` | defaults to today |
| `--pages <path>` | the inventory. Default: `$PSI_PAGES`, else `./pages.json` |
| `--out-dir <dir>` | Default: `$ROUNDS_DIR`, else `./rounds` |
| `--runs <n>` | override `runsPerPage` from the inventory. **3 is the floor** — below it the tool warns loudly and records the thin `runsPerPage` in the round so every reader can see how thin the evidence is |
| `--engine psi\|lighthouse` | default `psi` (the API). `lighthouse` shells out to the local CLI — see §6 |
| `--throttle-ms <n>` | pause between requests, default `1500` |
| `--schemas <path>` | path to `Rules-Guide/schemas/validate.mjs`. Also `$QA_SCHEMAS_VALIDATOR`. Not found → the round is **not shipped** (exit 3) |
| `--self-check` | offline logic check (§3) |
| `--help` | prints the tool's own header — the authoritative contract |

**The only env vars `psi-run.mjs` reads** are `PSI_API_KEY`, `PSI_API_KEY_FILE`, `PSI_PAGES`,
`ROUNDS_DIR` and `QA_SCHEMAS_VALIDATOR`. Everything else is a flag. (There is no `ROUND_ID`, no
`ROUND_LABEL`, no `ROUND_ENV`, no `RUNS_PER_PAGE` and no `PSI_ENGINE` — if you set those, **nothing
reads them**, and a `PSI_ENGINE=lighthouse` that is silently ignored would hand you a PSI round
wearing a local-Lighthouse label, which is exactly the engine-mixing the rules forbid.)

**Exit codes:** `0` = collected and validated (errors *inside* it are reported honestly) · `2` =
usage/config/missing key, nothing written · `3` = the round could not be validated or written, so it
was **deleted** · `1` = `--self-check` found a defect.

The round is validated on write. To check it again by hand:

```bash
node <kit>/Rules-Guide/schemas/validate.mjs pagespeed-round rounds/r7.json
```

**Re-running the same `--round` id** preserves owner-set `n-a` results (the tool has no standing to
overrule "this page does not exist here") and **refuses to change engine** mid-round: *"One round =
ONE engine … Use a NEW `--round` id."*

## 5 · Build / refresh the Sheet tab (`psi-sheet.mjs` — ENV-driven)

```bash
node tools/psi-sheet.mjs --dry-run              # always do this first — no Google, no writes
PROJECT_NAME=<Project> node tools/psi-sheet.mjs # publish
```

| Env | Default | Meaning |
|---|---|---|
| `PROJECT_NAME` | — | **required to publish** — names the doc and its Drive folder |
| `PAGES` | `pages.json` | the inventory; it sets the ORDER of the tab |
| `ROUNDS_DIR` | `rounds` | one JSON per round; blocks are laid out by `round.date` |
| `PS_TAB` | **`PageSpeed report`** | tab title |
| `PS_GID` | `820001` | fixed `sheetId`, so shared `#gid=` links survive a rebuild |
| `PS_FUTURE_ROUNDS` | `0` | append N **empty, ready-to-fill** blocks to the right, header `Points from dd/mm/yyyy` — like the reference kept blank dated columns ahead of time. They hold no data (every cell blank, not a zero); when a round is collected, drop N by one and the real block takes its place. Collapse hides Platform + Comments and keeps the score, so many rounds read as one score-per-date matrix. |
| `TARGET_SSID` | — | write the tab INTO an existing document (the demo/validation path) |
| `SHEET_NAME` | `<Project> — PageSpeed Insights Results` | doc title when the tool creates the file |
| `DRIVE_ROOT_FOLDER` / `DRIVE_CATEGORY` | `ClaudeProjects` / `Performance` | Drive placement — never the Drive root |
| `MCP_SHEETS_DIR` | auto (walks up to the nearest `mcp-sheets`) | OAuth dir |
| `QA_SCHEMAS_VALIDATOR` | auto (walks up) | `validate.mjs` override |
| `PS_ALLOW_DROP=1` | off | permit removing a round block that is on the tab but has no JSON |
| `PS_ALLOW_ADOPT=1` | off | permit taking over a tab this tool did not build (one with no `round:` header notes) — it will be rewritten from `rounds/`, so anything typed into it by hand and not present in a round file is lost |

> **Note the tab name.** The default is **`PageSpeed report`**, not `Results`. A hand-maintained
> document may well have its tab called *Results* — that is what `PS_TAB` is for. But pointing the
> builder at a tab **it did not build** is a takeover, not a refresh: the tool refuses (exit 1, nothing
> written) unless you also pass `PS_ALLOW_ADOPT=1`, because it can only reproduce what the round JSONs
> contain, and a hand-kept tab holds history that lives nowhere else. The safe path for an existing
> document: import its history into `rounds/` first, `--dry-run`, compare, and only then adopt.
>
> **Note the two inventory variables are spelled differently** (`--pages`/`$PSI_PAGES` for the
> collector, `$PAGES` for the builder). Non-obvious, and taken from the source.

Rebuilding is **idempotent and additive**: rounds are matched by (page id, platform), a new round
becomes the next block to the right, and no previous round's scores are touched. Comments typed
straight into the tab exist **nowhere else**, so they are read back and re-attached (matched by the
round id in the header note, not by the label — renaming a block never orphans its comments). If the
old tab cannot be read, the tool **refuses to rebuild** rather than silently overwrite them.

It refuses to publish rather than publish something misleading — these are checks the schema itself
cannot express (the kit's validator subset has no conditional keywords), so the builder makes them:
a round that fails the schema (*"an invalid round is an error, not a row to skip"*), a `measured`
status with no score/runs or with fewer runs than the round's target, a non-`measured` status
carrying a score, an `n-a`/`error` with no comment, a comment still holding the collector's
`NEEDS-COMMENT:` placeholder, or a published round whose JSON has vanished (append-only — that one
needs `PS_ALLOW_DROP=1`).

## 6 · Local-Lighthouse fallback (`--engine lighthouse`) — ⚠️ untested

If the PSI API is unreachable (corporate egress blocked, or the page is only reachable from your
machine — `localhost`, a VPN-only staging host), the collector can drive a locally installed
Lighthouse instead (`npx lighthouse`, headless Chrome; no API key needed). **This path has not yet
been exercised end-to-end — expect to fix something on first use, and fix it in the kit.**

> ⚠️ **A local Lighthouse number is NOT comparable with a PSI number.** PSI runs on Google's
> hardware with a fixed throttling profile; your laptop does not. The same page can differ by
> 20–40 points between the two, with nothing wrong anywhere. Therefore:
>
> - **a round never mixes engines** — the engine is recorded in the round JSON (`source.tool`:
>   `psi-api` vs `lighthouse-cli`) and is part of the number's identity, exactly like the
>   environment. The tool enforces this: re-running an existing round id with the other engine is
>   refused;
> - **never compare a `lighthouse` round with a `psi` round** and call the difference a regression;
> - a fallback round says so in the Sheet (in the round label and in the note);
> - a local run has **no CrUX field data** — absent, not zero.

Same rule, one sentence: *a regression is the same page, same platform, same environment, same
engine, same profile.* Anything else is a different experiment.

## 7 · The evidence is the round JSON — never a PSI link

Do not record a `pagespeed.web.dev/analysis/<id>` link as the proof of a number. Those links are
retained for **30 days** and then expire, and they die immediately if the analysed host goes away —
both have already happened to the document this module was reverse-engineered from. The evidence is
`rounds/<id>.json`, committed next to the report: every run, the median, the metrics, the Lighthouse
version, the timestamp, the env. Optionally publish a self-contained HTML view through the sibling
[HTML-Reports](../HTML-Reports/) kit. Full statement:
[rule 16](PAGESPEED_REPORT_RULES.md).

### 7.1 · Attach the report the number came from (`psi-report.mjs`)

The Sheet's **Platform cell** (`Desktop` / `Mobile`) can be a link to the full Lighthouse report behind
that row's score. It is built — never re-measured:

```bash
# psi-report.mjs is a SYMLINK, so its `import 'lighthouse'` resolves from its realpath — the kit's
# template/tools/. Install the deps THERE (once); the project's tools/ folder has no package.json.
cd <kit>/QA-Documentation/Custom-Reports/PageSpeed-report/template/tools && npm install   # `lighthouse` (renderer) + `playwright` (PNG)
cd <Project>/Web-Performance && node tools/psi-report.mjs --round r7 \
  --upload 'bash <kit>/MCP-configurations/mega/mega-upload.sh --evidence <Project> {file}'
```

- `psi-run.mjs` keeps the **median run's** raw Lighthouse Result in `rounds/<round>.lhr/` (pass
  `--no-lhr` to skip; they are ~0.5–1 MB each, so gitignore them).
- `psi-report.mjs` renders **that stored run** with Lighthouse's own report generator → the same long
  report PageSpeed shows → a full-page PNG → your publisher → the link goes back into the round JSON
  as `evidence`, and `psi-sheet.mjs` turns the Platform cell into that link.
- **Why not just screenshot pagespeed.web.dev?** Because that re-analyses the page: a different load,
  a different number. Measured on one page within an hour: PSI-UI **85**, API median-of-3 **90**, a
  second median-of-3 **88**. A screenshot of a run that is not the run in the cell is evidence of
  something else — and it makes the wrong number look audited.
- The guard: `evidence.runScore` is the score **inside the linked report**. `psi-sheet.mjs` **refuses
  to publish** when it disagrees with the cell, and `psi-report.mjs` refuses to attach a stored run
  whose score is not the cell's. Neither tool can be talked into linking the wrong report.
- `--upload` takes any command with a `{file}` placeholder and reads the **last https:// URL it prints**
  (`$PSI_EVIDENCE_UPLOADER` sets it once). Mega, Drive, the [HTML-Reports](../HTML-Reports/) publisher —
  the tool does not care, as long as the link outlives the 30-day PSI one. Without `--upload` it renders
  everything locally and writes **no** links (a local path is not evidence anyone else can open).

## 8 · Trigger phrases (copy into your CLAUDE.md — see [`CLAUDE.starter.md`](CLAUDE.starter.md))

- "measure PageSpeed for the site", "run a PageSpeed round on staging"
- "update the PageSpeed Insights sheet", "add a new round to the PageSpeed doc"
- "заміряй швидкість сторінок", "прожени PageSpeed по лендінгу"

## 9 · Troubleshooting

The strings below are the tools' **real** output.

| Symptom | Cause | Do this |
|---|---|---|
| `psi-run: no PageSpeed Insights API key — REFUSING to run.` | fail-closed by design | put the key in `MCP-configurations/pagespeed/.token`, or export `PSI_API_KEY`/`PSI_API_KEY_FILE` (§1). A collector that "works" without a key would be reporting fiction |
| `psi-run: the API-key file <path> is EMPTY — REFUSING to run.` | the placeholder `.token` of a fresh clone | same as above — an empty key is an absent key |
| `psi-run: the API key was REJECTED (…) — REFUSING to run.` | invalid key / PSI API not enabled on that Cloud project | fix the key (§1). Nothing was written: a round full of `error` cells caused by a bad key is not evidence about the product |
| `429 Quota exceeded … consumer 'project_number:583797351490'` | you are calling **without** a key — the shared anonymous quota is spent | get a key (§1). This is the documented, verified default state — not a transient blip |
| `429` **with** a key | you crossed 240 queries/minute (or the daily 25 000) | the collector already backs off and retries (3s/6s/12s); if it still fails, raise `--throttle-ms` or split the round. Never "fix" it by cutting `--runs` below target — that yields a `not-run`, not a faster round |
| `psi-run: page inventory not found: <path>` | no `pages.json` | copy `pages.example.json` → `pages.json`, or pass `--pages` / set `$PSI_PAGES`. The tool will not invent pages |
| `every page needs { id, name, path }` | you gave a page a `url` | pages carry **`path`**, joined to `baseUrl` (§2) |
| `psi-run: cannot find Rules-Guide/schemas/validate.mjs — pass --schemas <path> or set $QA_SCHEMAS_VALIDATOR.` | the tool cannot reach the kit's validator | pass `--schemas`. The round was **deleted**: an unvalidated artefact must never be mistaken for data |
| `psi-run: the round FAILED schema validation — deleted, not shipped. Fix the tool, never the contract.` | the collector produced something the contract forbids | fix the tool or the inventory — never the schema |
| `… was collected with "psi-api" and you are running "lighthouse-cli". One round = ONE engine` | re-running an existing round id with the other engine | use a **new** `--round` id. The two engines are not the same measurement (§6) |
| `psi-sheet: PROJECT_NAME is required (it names the doc and its Drive folder).` | publishing without a project | `PROJECT_NAME=<Project> node tools/psi-sheet.mjs` — or use `--dry-run`, which needs neither |
| `psi-sheet: no rounds in <dir>. A report with no round is not an empty report — it is no report.` | nothing collected yet | run `psi-run.mjs` first (§4), or point `ROUNDS_DIR` at the right folder |
| `… of … round(s) fail the pagespeed-round schema — an invalid round is an error, not a row to skip.` | a hand-edited round JSON | fix the JSON. A bad round is never quietly skipped |
| `the comment is still the collector's placeholder — "NEEDS-COMMENT: …"` | a human never answered a mandatory comment | write the real explanation. The placeholder is a **demand**, not an answer — a round carrying one is not publishable |
| `round(s) … are published on the tab but have no JSON` | a round file was deleted or renamed | `rounds/` is append-only: restore the file. Only if it really was published in error → `PS_ALLOW_DROP=1` |
| `psi-sheet: could not read the previous tab, so no comments could be carried over` | access/permission problem on an existing tab | fix access and re-run. The tool refuses rather than overwrite every comment the team typed |
| `psi-sheet: mcp-sheets not found — set MCP_SHEETS_DIR` | OAuth dir not resolvable from here | `MCP_SHEETS_DIR=<path>` (see `MCP-configurations/README.md`); OAuth setup is `../../Checklist/MCP_SETUP.md` |
| `psi-sheet: Drive folder "ClaudeProjects" not found at the top level of the account.` | the Drive root folder does not exist | create it once, or set `DRIVE_ROOT_FOLDER`. QA docs are never written to the Drive root |
| The tab is called `PageSpeed report`, but ours is `Results` | that is the tool's default | `PS_TAB=Results` (§5) — and if that tab was maintained by hand, see the next row |
| `psi-sheet: the tab exists but was not built by this tool (no round: notes)` | you pointed the builder at a hand-maintained tab; rebuilding it would reproduce only what `rounds/` contains and lose the rest | import that tab's history into `rounds/` first, `--dry-run`, compare — then take it over deliberately with `PS_ALLOW_ADOPT=1`. Nothing was written by the refusal |
| Score is suspiciously low, page looks like a login screen | the page is **behind auth** — PSI is anonymous and cannot log in | do **not** record the number. Mark the cell `n/a` with a comment ("requires auth — PSI cannot reach it"), or measure a public equivalent page, or run the local engine against an authenticated session and label the round accordingly |
| The URL redirects (http→https, `/` → `/en/`) | you measured the redirect chain, not the page | put the **final** path in `pages.json`; a redirect hop is a real cost, but it must be a deliberate measurement, not an accident |
| `lighthouseResult.runtimeError: …` / `NO_FCP` / timeout | the page never painted within the run budget (heavy JS, blocked third party, slow origin) | it is recorded as `error` + a comment. Retry in the next round. An `error` is a finding, not a gap to be filled with a guess |
| Field (CrUX) block is missing | the origin has too little real-user traffic | that is normal — **absent ≠ zero**. Record lab metrics only; never present a lab number as user experience |
| `runs spread N points … this page is UNSTABLE` in a comment | the three runs disagreed by ≥ 10 points | the median is a summary of noise. Say so in the comment; do not treat the delta vs last round as a regression until it reproduces |
