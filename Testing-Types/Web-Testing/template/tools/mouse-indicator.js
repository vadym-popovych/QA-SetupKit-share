// Mouse indicator for screen recordings — the desktop twin of touch-indicator.js.
// Playwright's video contains the page only: no cursor is drawn, so a recorded click looks like the
// UI reacting to nothing. Inject this and the pointer, plus a ring on every click, is visible.
//
//   await context.addInitScript({ path: '<kit>/Testing-Types/Web-Testing/template/tools/mouse-indicator.js' });
//
// Overlay only: position:fixed, pointer-events:none, top z-index — it neither takes clicks nor
// affects layout. Works in any page, including the DevTools front-end served over the debugging port.
(() => {
  const start = () => {
    const layer = document.createElement('div');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;'
      + 'border-radius:50%;background:rgba(255,60,60,.55);border:2px solid #fff;'
      + 'box-shadow:0 0 10px rgba(0,0,0,.6);transition:transform .02s linear';
    layer.appendChild(dot);
    // Re-attach on every event instead of once at start-up: an init script runs against the EMPTY
    // document, and any app that rewrites the document root drops the overlay — leaving a recording
    // with no cursor on it, which nobody notices until the evidence is useless.
    const ensure = () => { if (!layer.isConnected) (document.body || document.documentElement).appendChild(layer); };
    ensure();
    addEventListener('mousemove', (e) => {
      ensure();
      dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }, { capture: true, passive: true });
    addEventListener('mousedown', (e) => {
      ensure();
      const ring = document.createElement('div');
      ring.style.cssText = 'position:fixed;left:0;top:0;width:54px;height:54px;margin:-27px 0 0 -27px;'
        + 'border-radius:50%;border:3px solid rgba(255,60,60,.95);pointer-events:none;'
        + `transform:translate(${e.clientX}px, ${e.clientY}px) scale(.4);opacity:1;`
        + 'transition:transform .35s ease-out, opacity .35s ease-out';
      layer.appendChild(ring);
      requestAnimationFrame(() => {
        ring.style.transform = `translate(${e.clientX}px, ${e.clientY}px) scale(1.15)`;
        ring.style.opacity = '0';
      });
      setTimeout(() => ring.remove(), 420);
    }, { capture: true, passive: true });
  };
  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
