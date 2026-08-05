# Web-Testing kit — setup & round flow (Claude-followable)

## 0. Prerequisites (auto-detect, install what's missing)

1. **Node ≥ 18**: `node --version`.
2. **Playwright + 3 engines** — install in the session scratchpad (NOT in the project):
   ```bash
   cd <scratchpad> && npm init -y && npm install playwright
   npx playwright install chromium firefox webkit
   ```
   Browsers cache in `~/Library/Caches/ms-playwright` (persists across sessions; check
   first — install only missing engines).
3. **Figma source** (for design-compliance checks): Figma Dev Mode MCP server
   (`figma-dev-mode-mcp-server`, requires the Figma desktop app running) or the claude.ai
   Figma connector. Per the Figma-first rule: bring it up BEFORE the round; only after an
   explicit decision to proceed without design do visual checks become not-run.
   ⚠️ **Figma loads pages lazily** — a page never opened in the desktop app returns an
   EMPTY canvas via MCP. If `get_metadata` on the page id returns `width="0"` with no
   children, ask the owner to click that page in the Figma app, then retry.
4. Google Sheets MCP (bug candidates / reporting) per `MCP-configurations/README.md`.

## 1. Scaffold the project folder (first round only)

```bash
mkdir -p <Project>/Web-Testing/{tools,runs}
cp QA-SetupKit/Testing-Types/Web-Testing/template/capture.mjs   <Project>/Web-Testing/tools/
cp QA-SetupKit/Testing-Types/Web-Testing/template/config.template.json <Project>/Web-Testing/config.json
```

Fill `config.json`: `baseUrl` (staging!), `figma.pageNodeId` + frame node-ids for the
desktop and mobile design frames (persist them — don't re-ask next round), section
selectors, project-specific interaction hooks (accordion/carousel selectors).

## 2. Run the capture

```bash
cd <Project>/Web-Testing
PLAYWRIGHT_DIR=<scratchpad> node tools/capture.mjs --out=runs/<YYYY-MM-DD>-<slug>
```

Default sweep: Chromium × 9 viewports (360/375/390 · 768/1024 · 1280/1440/1920 · 2560 — the
`viewports` block of `config.json`, RULES rule 2), Firefox + WebKit × the `smokeViewports`
set (390/768/1440/1920). At phone widths (<768) the script
emulates REAL devices — webkit runs as iPhone 14 (iOS UA), chromium/firefox as Pixel 7
(Android UA) — so UA-detected platform UI renders as real users see it. The run prints its own
elapsed time (`captured N combo(s) in Xm YYs`) — the wall-clock is pages × viewports × engines
against YOUR site, so take it from the run rather than from a doc: the figure that used to stand
here was never measured by anything.
Summary lines flag OVERFLOW / FIXED-CLIP / STUCK-REVEALS / CONSOLE-ERR / REQ-FAIL /
PLACEHOLDER-LINKS per combo.

## 3. Evaluate

1. Read `logs/capture-results.json`; triage every flag (see RULES for classification).
2. **Eyeball minimum:** hero shot at EVERY phone width + full-page at 390/768/1440/2560 +
   one full-page per non-Chromium engine. Machine checks don't see "content visually cut
   inside a fixed container" or "badge overlaps text" — eyes do.
3. Fetch the Figma desktop + mobile frames (`get_screenshot` by node-id) and compare
   section-by-section: order, copy, states, spacing class (not pixel-perfect — that's the
   Visual-Regression kit once baselines exist).
4. Animations: verify the inventory (which keyframes ran / which never fired), reveal
   completeness, carousel variant per breakpoint, hover-pause where applicable.

## 4. Report & findings

- `runs/<date>-<slug>/REPORT.md`: coverage table (viewport × engine × check → result),
  findings, notes, artifacts, next round. Every verdict names its oracle (Figma node /
  CSS rule / invariant).
- Findings → the project's **bug-candidates funnel** (draft doc first, owner validates,
  then the board). Annotated evidence (red = actual, green = expected) via
  `Testing-Types/App-Emulators-configurations/template/tools/annotate.py`; upload per the project's evidence channel.
- End the round report with a LINKS section (candidates doc, evidence, REPORT.md path).
