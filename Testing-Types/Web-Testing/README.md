# Web-Testing kit — landing/site rounds in real browsers

The web counterpart of `App-Emulators-configurations/`: drive a **web page or web app in
real browser engines** (Playwright: Chromium, Firefox, WebKit), capture evidence, and
evaluate it against the Figma design — covering **design compliance, animations,
responsiveness and cross-browser rendering** in one round.

When the user asks to "пройтись по лендінгу/сайту", "перевірити чи відповідає дизайну",
"глянути анімації", "перевірити респонсивність/кросбраузерність" → this kit.

## What a round covers

| Layer | What | How |
|---|---|---|
| 1. Capture | 9 viewports (360→2560) × 3 engines; hero/viewport, full-page, per-section, interaction shots | `template/capture.mjs` (Playwright headless) |
| 2. Checks (machine) | horizontal overflow + offenders, fixed/sticky-child clipping, scroll-reveal completeness, animation inventory (WAAPI + JS-transform sampling), accordion/carousel behavior, console/page errors, failed requests, anchor targets, placeholder-link audit | same script, results in `logs/capture-results.json` |
| 3. Evaluate (agent) | screenshots vs Figma frames (desktop + mobile node-ids from config), copy/layout/state compare, triage machine flags | Figma Dev Mode MCP + eyes |
| 4. Report | `runs/<date>-<slug>/REPORT.md` + findings → bug-candidates funnel with annotated evidence | annotate.py / collage.py, Drive links |

**Not in this round:** page-load performance. Lighthouse/PSI scores and Core Web Vitals are a
document type of their own — [`QA-Documentation/Custom-Reports/PageSpeed-report/`](../../QA-Documentation/Custom-Reports/PageSpeed-report/)
— because one load is noise and the numbers only mean something as a tracked series (median of
≥3 runs, per page × platform × env × round). A web round links to the PageSpeed round; it does
not quote a score.

## Structure

```
Web-Testing/
├── README.md               # this file
├── SETUP.md                # Claude-followable setup + round flow
├── WEB_TESTING_RULES.md    # the rules (mirrored from workspace CLAUDE.md)
├── CLAUDE.starter.md       # paste-block for a teammate's workspace CLAUDE.md
└── template/
    ├── config.template.json  # baseUrl, viewports, browsers, figma nodes, sections
    └── capture.mjs           # parameterized capture & checks script
```

Project artefacts live in `<Project>/Web-Testing/` (config.json, tools/, runs/) — never
inside this kit. First use: copy `template/` per SETUP.md.

Live example: `<Project>/Web-Testing/` (landing round 1, 12/07/2026 — found the
clipped-header-badge class of bug that pure scrollWidth checks miss).
