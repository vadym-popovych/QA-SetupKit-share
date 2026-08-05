# Web-Testing rules (Vadym, 12/07/2026)

Rules for browser-based web/landing rounds. Mirrored from the workspace `CLAUDE.md`;
update BOTH when a rule changes.

1. **Scope of a round = 4 dimensions at once:** design compliance vs Figma · animations ·
   responsiveness · cross-browser. One capture sweep feeds all four — don't run four
   separate ad-hoc passes.

2. **Viewport class — defined HERE, by the tool (this kit owns the term; other kits cite
   this rule instead of restating the numbers):** the four bands are the keys of `viewports`
   in `config.json`, and the shipped `config.template.json` sets them to mobile 360/375/390 ·
   tablet 768/1024 · desktop 1280/1440/1920 · large 2560 — 9 widths. Chromium runs all of
   them; Firefox + WebKit run `smokeViewports` (390/768/1440/1920). The list is
   configuration, not code: `capture.mjs` builds the sweep from `cfg.viewports.*` with no
   fallback (only `smokeViewports` has a built-in default), so a project that needs another
   width (834, 3840) adds it to its own `config.json` — and a doc that names a width the
   config does not is a coverage claim nothing ran. A `Compatibility-Testing/MATRIX.md`,
   when it exists, overrides this default.

3. **scrollWidth == viewport does NOT mean "no clipping".** Children of
   `position:fixed/sticky` containers clip against the screen edge without growing
   scrollWidth (<Project> landing: header badge cut at 0 px reported overflow). Always
   run the fixed/sticky-children clip check AND eyeball the hero/header shot at every
   phone width.

3a. **Emulate real devices at phone widths — a bare viewport is NOT a phone.** Sites
   UA-detect the platform (<Project> landing: Android UA → Google Play badge only,
   iOS UA → App Store only; desktop UA at 390 px → both badges, one clipped — a state no
   real phone user ever sees). The capture template pairs webkit↔iPhone UA and
   chromium/firefox↔Android UA at widths < 768. Any mobile-width finding made WITHOUT
   mobile-UA emulation must be re-verified with it before filing; conversely a
   desktop-UA-only state can still matter (devtools demos, resized windows) — classify
   honestly, don't file it as a phone bug.

4. **Identify the reveal mechanism from CSS before judging animations** (e.g.
   `[data-reveal]{opacity:0} → .is-visible`). After a slow-scroll pass, every reveal
   element must reach its visible state; elements that are `display:none`/zero-size at
   that breakpoint are **hidden-ok, not stuck** — but cross-check the design: is that
   content SUPPOSED to be absent at this width?

5. **Animation inventory two ways:** `document.getAnimations()` for CSS/WAAPI (name,
   playState per viewport) + transform sampling at t0/t+2s for JS-driven movement
   (carousels). Record which declared `@keyframes` never fired — dead animation code is a
   finding-lite (note, not bug). `prefers-reduced-motion` support: check CSS blocks
   exist; runtime-verify when the round has budget.

6. **Placeholder-link audit every round:** `href="#N"`, `example.com` domains, bare
   social roots (instagram.com/x.com/tiktok.com without a path), and styled-as-link
   `<span>`s (`footer-link` without `<a>`) are findings even on staging — they ride to
   production silently.

7. **Full-page screenshots stitch sticky headers mid-page** — that's a capture artifact,
   not a bug. Verify suspicions on viewport-sized shots before flagging.

8. **Design compare discipline:** persist the Figma page + frame node-ids (desktop,
   mobile, key components) in `<Project>/Web-Testing/config.json` at first discovery.
   Figma desktop lazy-loads pages — an empty canvas via MCP means "page not loaded in the
   app", ask the owner to open it, don't conclude "no design". Frame-level compare here;
   pixel-level belongs to the Visual-Regression kit.

9. **Performance numbers do NOT live in this round's report.** A web round may notice that a
   page feels slow — but page-load metrics (Lighthouse score, LCP/TBT/CLS) belong to the
   [PageSpeed report](../../QA-Documentation/Custom-Reports/PageSpeed-report/) document type,
   which collects them itself (median of ≥3 runs, one round = one env) and tracks them round
   over round. Never paste a one-off score into `REPORT.md`: a single load is noise, and a
   number with no round, no env and no run history cannot be compared to anything later.
   Cross-reference the PageSpeed round from the web round's LINKS section instead.

10. **Artefacts:** everything lands in `<Project>/Web-Testing/` at creation time —
   `config.json`, `tools/`, `runs/<date>-<slug>/{shots,logs,annotated,REPORT.md}`.
   Findings go through the bug-candidates funnel with annotated evidence (red actual /
   green expected); every verdict names its oracle; contradictions between design, site
   and copy get an explicit comment, never a silent pass.
