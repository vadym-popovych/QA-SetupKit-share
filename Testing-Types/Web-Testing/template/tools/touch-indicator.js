// Touch indicator for screen recordings — the browser equivalent of Android's "Show taps".
// Inject with page.addInitScript(); it draws a translucent white dot wherever a finger is, so a
// recorded gesture reads as a gesture instead of the page mysteriously moving by itself.
//
//   await page.addInitScript({ path: '<kit>/Testing-Types/Web-Testing/template/tools/touch-indicator.js' });
//
// It is an OVERLAY, not a change to the page under test: position:fixed (excluded from
// scrollWidth), pointer-events:none (never intercepts), z-index at the top, and it only reacts to
// touch events the harness itself dispatches. State it in the bug's evidence note so nobody mistakes
// the dot for part of the product.
//
// The default dot is white-on-translucent, which reads on a dark or photographic UI and DISAPPEARS
// on a light one. Override it before injecting this file — set the globals in their own
// addInitScript, since init scripts run in order:
//
//   await page.addInitScript(() => { window.__TOUCH_INDICATOR__ = { fill: 'rgba(17,19,26,.34)' }; });
//
// Accepted keys: size (px), fill, ring (border color), glow (box-shadow color). Anything omitted
// keeps the default, so existing callers are unaffected.
(() => {
  const cfg = (typeof window !== 'undefined' && window.__TOUCH_INDICATOR__) || {};
  const SIZE = cfg.size || 44;
  const FILL = cfg.fill || 'rgba(255,255,255,.45)';
  const RING = cfg.ring || 'rgba(255,255,255,.95)';
  const GLOW = cfg.glow || 'rgba(255,255,255,.6)';
  const make = () => {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;width:${SIZE}px;height:${SIZE}px;margin:${-SIZE / 2}px 0 0 ${-SIZE / 2}px;`
      + `border-radius:50%;background:${FILL};border:2px solid ${RING};`
      + 'pointer-events:none;z-index:2147483647;opacity:0;transition:opacity .12s linear;'
      + `box-shadow:0 0 12px ${GLOW};left:0;top:0`;
    return d;
  };
  const dots = new Map();
  const start = () => {
    const layer = document.createElement('div');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
    // Re-attach on every touch instead of once at start-up. An init script runs against the EMPTY
    // document, and any app that rewrites the document root — SPA bundles that replace
    // documentElement's children, anything document.write-ing — silently drops the overlay, so the
    // recording comes out with no taps on it and nobody notices until the evidence is useless.
    const ensure = () => { if (!layer.isConnected) (document.body || document.documentElement).appendChild(layer); };
    ensure();
    const move = (e) => {
      ensure();
      for (const t of e.changedTouches) {
        let d = dots.get(t.identifier);
        if (!d) { d = make(); layer.appendChild(d); dots.set(t.identifier, d); }
        d.style.transform = `translate(${t.clientX}px, ${t.clientY}px)`;
        d.style.opacity = e.type === 'touchend' || e.type === 'touchcancel' ? '0' : '1';
        if (e.type === 'touchend' || e.type === 'touchcancel') {
          const id = t.identifier;
          setTimeout(() => { const el = dots.get(id); if (el) { el.remove(); dots.delete(id); } }, 160);
        }
      }
    };
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      document.addEventListener(type, move, { capture: true, passive: true });
    }
  };
  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
