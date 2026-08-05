# Web-Testing — starter block (paste into YOUR workspace CLAUDE.md)

## Web/landing testing — Web-Testing kit
- **Home for browser-based web rounds** (design compliance vs Figma + animations +
  responsiveness + cross-browser in one pass): `QA-SetupKit/Testing-Types/Web-Testing/`. Requests like
  "пройдись по лендінгу", "перевір чи відповідає дизайну", "глянь анімації/респонсивність/
  кросбраузерність" → follow the kit's `SETUP.md` + `WEB_TESTING_RULES.md` exactly.
- **Engine:** Playwright headless (Chromium + Firefox + WebKit), installed in the session
  scratchpad; browsers cache in `~/Library/Caches/ms-playwright`. Chromium sweeps all 9
  viewports (360→2560), Firefox/WebKit smoke one per breakpoint class.
- **Key traps:** fixed/sticky-container clipping is invisible to scrollWidth (run the
  dedicated check + eyeball hero at every phone width); **a bare viewport is NOT a phone**
  — sites UA-detect the platform, so phone widths run with device presets (webkit↔iPhone
  UA, chromium/firefox↔Android UA) and mobile-width findings made without a mobile UA
  must be re-verified with one before filing; Figma loads pages lazily (empty canvas via
  MCP → ask to open the page in the app); full-page screenshots stitch sticky headers
  mid-page (artifact, not bug); placeholder links (`#N`, example.com, bare social
  domains, span-"links") are findings even on staging.
- **Artefacts:** `<Project>/Web-Testing/` (config.json with saved Figma node-ids, tools/,
  runs/<date>-<slug>/). Findings → bug-candidates funnel with annotated evidence; every
  verdict names its oracle.
