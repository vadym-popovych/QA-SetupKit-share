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

8b. **A design-deviation finding is worth an "actual | expected" image, and that needs the design as
   a FILE.** The Dev Mode MCP renders a node into the conversation — enough to judge, not enough to
   build evidence with, because a collage is assembled from files on disk. Export the frame with
   [`template/tools/figma-export.mjs`](template/tools/figma-export.mjs)
   (`FIGMA_TOKEN_FILE=<gitignored token> figma-export.mjs <fileKey> <nodeId> --out=<dir> --scale=2`),
   then pair it with the site screenshot via `App-Emulators-configurations/template/tools/collage.py`
   — red box on what the site does, green box on what the design asks for. Crop BOTH sides to the
   same region and the same scale before pairing: two panels normalised to a common height silently
   lie about proportions otherwise. Getting the `fileKey` when no one hands you the URL →
   `MCP-configurations/figma-dev-mode/README.md`.

8a. **You are not limited to what the owner selected — but you are limited to what is OPEN.**
   `get_metadata` takes any node id, including a page id, so the whole file is addressable
   once you know the ids; with **nothing** selected it returns the list of top-level pages,
   which is the only cheap way to learn those ids. The catch measured on a real file
   (15/08/2026): a section on a page the app has not opened comes back as a **childless stub**
   — indistinguishable at a glance from "this screen has no design". So: get the page list
   once, persist EVERY page and section id in `config.json`, and treat a childless section as
   "not loaded — ask the owner to open that page", never as "no design exists". A component
   library page is worth persisting too: it is where the hover/pressed/focus/disabled states
   live, and a round that never opened it can only compare default states.

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

11. **Recording a gesture bug (owner's ask, 17/08/2026) — four things or the video proves nothing:**
   a. **Drive the page with real touch events, not `window.scrollTo`.** On a mobile-emulated context a
      sideways drag pans the VISUAL viewport; `window.scrollX` stays 0 and `scrollTo(x,0)` moves
      nothing. Dispatch `Input.dispatchTouchEvent` over CDP and measure
      `window.visualViewport.offsetLeft`. Two recordings were shot and shipped before this was
      understood — both showed a page sitting perfectly still while the bug text claimed motion.
   b. **`recordVideo.size` must equal the CSS viewport**, not the device-pixel size: ask for
      720×1480 on a 360×740 viewport and the page is drawn at the top-left with half the frame grey.
      Record at viewport size and upscale afterwards (`ffmpeg -vf scale=…:flags=lanczos`).
   c. **Show the finger** — `page.addInitScript` with
      [`template/tools/touch-indicator.js`](template/tools/touch-indicator.js) draws a translucent
      dot wherever a touch is, the way Android's "Show taps" does. It is `position:fixed` +
      `pointer-events:none`, so it changes neither layout nor `scrollWidth`. **Do not explain the dot
      in the bug's Notes** — the reader is a developer looking at a defect, not at our tooling
      (owner, 17/08/2026); keep the harness out of the ticket.
   d. **mp4, not the raw webm** — Playwright records webm and its bundled ffmpeg has no H.264, so a
      real `ffmpeg` is needed for a file that plays anywhere.
   And verify the result **by looking at frames**, not by scanning pixels for "bright": a translucent
   white dot over a dark card is ~(140,145,155), so a brightness threshold reports it missing when it
   is plainly there.

14. **A Basic-auth-protected staging site: proxy it, do not fight the sign-in dialog.** Safari's
   Basic-auth sheet is a WebView-level dialog and typing into its secure field through automation is
   unreliable — measured 31/08/2026, a 24-character password arrived as 10 and the round spent
   twenty minutes on 401s before anyone read the field back.
   [`template/tools/auth-proxy.mjs`](template/tools/auth-proxy.mjs) removes the dialog: it holds the
   credentials, injects `Authorization` on every request and rewrites same-host absolute URLs back
   through itself, so the device browses an unauthenticated origin:
   ```bash
   BASIC_USER=<user> BASIC_PASS=<pass> TARGET=https://<host> \
   HOST_IP=$(ipconfig getifaddr en0) node tools/auth-proxy.mjs [port]
   ```
   Credentials come from the environment only — never hard-coded, never in a committed wrapper.
   **Record the two deviations in the round's REPORT.md**, because they are real: the page is served
   over `http`, so anything gated on a secure context (getUserMedia, service workers, some autoplay
   policies) behaves differently — re-verify such a finding *without* the proxy before filing it.

12. **A request bug is filed with the requests OPEN, and each one walked through its tabs (owner,
   18–20/08/2026).** A list of red rows says "something failed"; the developer needs the status line,
   what was sent and what came back. So for every request being complained about the recording must
   show it **selected**, then **Headers → Payload → Response**, each held long enough to read
   (~3 s) and scrolled to the interesting part when the content does not fit the pane. Filter the
   grid by **Fetch/XHR** — and keep the pauses between steps short: the value is in the panes, not
   in watching a cursor travel.

   Do not hand-roll this per bug — run
   [`template/tools/record-network-bug.mjs`](template/tools/record-network-bug.mjs):

   ```
   PLAYWRIGHT_DIR=<dir with node_modules/playwright> node record-network-bug.mjs \
     --url=<page> --out=<file.mp4> --requests='<row substring>,<row substring>'
   ```

   It launches the page with a debugging port, records DevTools in a second browser, turns the
   screencast off, reloads, applies the filter, and walks every named request through the tabs, with
   the cursor drawn in by [`template/tools/mouse-indicator.js`](template/tools/mouse-indicator.js)
   (the desktop twin of the touch indicator) so a click reads as a click. It
   **exits 1 and names what is missing** when a request never appeared or a tab could not be opened —
   a video that silently skipped half its evidence is worse than no video. Recording real DevTools
   needs no screen-recording permission: Chrome serves its own front-end over the debugging port, and
   that page records like any other.

   The traps it encodes, all measured on a real round — worth knowing when it needs changing:
   - **Turn the screencast pane off** (`Toggle screencast`). It mirrors the page into half the window
     and squeezes the request details into an unreadable column.
   - **DevTools keeps every previously selected request's detail view in the DOM, hidden.** So
     `getByText('Headers').first()` lands on a STALE tab strip whose `boundingBox()` is null, and the
     run concludes "the pane did not open" while the pane is open and correct. Take the first match
     that is actually on screen — same for `.network-item-view` when reading the pane's text, or you
     report one request's headers under another's name.
   - **Do not scroll the request list.** With the details open it becomes a narrow full-height column
     that already shows every row, and it is virtualised: forcing a scroll recycles its `<tr>` nodes,
     so the node just measured can be a different request — or the empty filler below the last row,
     whose click DESELECTS and closes the pane. Scroll only as a second attempt.
   - Click a row at **x + 80** (the Name column); a click on the row centre does not select it. And
     `text=/regex/` does not match these grid cells — `getByText` and `locator('tr').filter({hasText})` do.
   - Re-resolve row locators every time; the grid re-renders on filtering and on new traffic. (An
     earlier version of this rule said "select the request BEFORE applying a filter" — that was the
     wrong lesson from the same symptom. Filtering first works fine as long as nothing holds a
     locator across the re-render.)
   - **Payload exists for a plain GET too** — it shows Query String Parameters. Payload and Response
     render into shadow roots, so their text is invisible to `innerText` on the pane: verify those
     two **by looking at frames**, never by scraping.

13. **A claim about a FLOW ships a clip, and the flow engine is shared (27/08/2026).** A screenshot
   proves a screen exists; it cannot prove a transition. Any claim of the shape *skipped · blocked ·
   refused · reachable in one tap* — a conformance finding, a repro whose point is the sequence — is
   recorded, or it is one person's word.

   [`template/tools/record-ui-flow.mjs`](template/tools/record-ui-flow.mjs) is that engine. It is a
   **library, not a CLI**, because a flow has waits, branches and assertions in it: the caller writes
   the steps, the module owns browser, viewport, tap indicator, one video per clip, and failing loudly.

   ```js
   import { createRecorder } from '<kit>/Testing-Types/Web-Testing/template/tools/record-ui-flow.mjs';
   const rec = await createRecorder({ src: '<url|file>', out: '<Project>/…/evidence' });
   await rec.clip('gate-is-skippable', async (f) => {
     await f.tap('Continue');
     await f.tap('Skip', { hold: 2600 });
     await f.expect('Next screen');        // throws if it never renders
   });
   await rec.close();
   ```

   What it encodes, each of it measured:
   - **Touch, not mouse, for a phone-shaped UI** — and the tap indicator only draws for touch events.
     Playwright's `touchscreen.tap()` is instantaneous, so the dot would flash for ~2 frames; taps go
     through CDP with the finger held ~190 ms. Chrome synthesises the click from `touchEnd`, so the
     app reacts exactly as it would to a real tap. `pointer: 'mouse'` switches to the desktop cursor.
   - **`hasTouch: true` but NOT `isMobile`** — `isMobile` changes layout emulation, and design
     mockups are usually authored for a desktop-sized page with a phone frame drawn inside it.
   - **Override the tap colour on a light UI.** The indicator default is white-on-translucent: on a
     white app it is invisible, and you ship a recording with no taps on it. Pass
     `tapStyle: { fill, ring, glow, size }`.
   - **`exact`-matching, visible-only, by default.** Design bundles commonly ship a hidden index of
     screen names whose entries contain the same words as the real controls; a loose `getByText`
     resolves to both and dies on strict mode — or worse, taps the wrong one.
   - **`expect()` is the other half of a finding.** "It skipped the gate" needs "…and landed here";
     a clip that only shows a tap proves nothing about where it went.
   - `video: false` reuses the same walk engine for a non-recording pass — reading a bundle's own
     `data-*` annotations, say — without paying for encoding. `f.annotations([…])` returns them.
   - It **refuses an `out` path inside the kit**, same as `record-network-bug.mjs`: recordings hold
     real product screens and the kit names no client.

   **Both indicators re-attach the overlay on every event** (fixed 27/08/2026). An init script runs
   against the empty document, and any app that rewrites the document root — an SPA bundle replacing
   `documentElement`'s children — silently drops an overlay appended at start-up. The failure is
   invisible while recording and total afterwards: a finished clip with no taps in it, discovered
   when someone is already reading the report.

   Verify the dot **by looking at a frame**, and note the trap: the browser normalises the attribute
   to `border-radius: 50%` with a space, so a `[style*="border-radius:50%"]` probe reports the
   indicator missing when it is plainly on screen.
