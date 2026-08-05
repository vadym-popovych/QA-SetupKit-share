// Per-run HTML report — variant 2 of the "reports in 3 variants" rule
// (see LOAD_TESTING_RULES.md): Sheets Runs tab = cross-run history,
// THIS = self-contained per-run file, Grafana Cloud = in-run time-series.
//
// Produces results/<RUN_ID>.html (charts, checks, thresholds — offline,
// attachable to an email/ticket) plus the standard terminal summary.
// Re-export from every scenario:
//   export { handleSummary } from '../lib/report.js';
// Name the artefact per run:  -e RUN_ID=2026-07-03-load-01
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Human-readable time values — EVERY cell carries its unit (same rule as the
// Sheets run log; a bare "46.99" tells the reader nothing):
//   184358 -> "3m 4s", 1870 -> "1.87s", 46.99 -> "46.99ms"
function fmtMs(v) {
  if (v >= 3600000) {
    const h = Math.floor(v / 3600000);
    const m = Math.floor((v % 3600000) / 60000);
    const s = Math.floor((v % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  }
  if (v >= 60000) {
    const m = Math.floor(v / 60000);
    const s = Math.floor((v % 60000) / 1000);
    return `${m}m ${s}s`;
  }
  if (v >= 1000) return (v / 1000).toFixed(2) + 's';
  return v.toFixed(2) + 'ms';
}

// k6-reporter prints time trends as bare "46.99" numbers. Add units to every
// value, but ONLY inside the table row of a time-typed metric — counters,
// rates and data metrics must stay untouched.
function humanizeDurations(html, metrics) {
  for (const [name, metric] of Object.entries(metrics || {})) {
    if (metric.type !== 'trend' || metric.contains !== 'time') continue;
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(
      new RegExp(`(>\\s*${esc}\\s*<)([\\s\\S]*?)(</tr>)`, 'g'),
      (_m, open, cells, close) =>
        open +
        cells.replace(/>(\d+(?:\.\d+)?)</g, (_c, num) => `>${fmtMs(Number(num))}<`) +
        close
    );
  }
  return html;
}

export function handleSummary(data) {
  const id = __ENV.RUN_ID || 'run';
  const out = { stdout: textSummary(data, { indent: ' ', enableColors: true }) };
  try {
    out[`results/${id}.html`] = humanizeDurations(htmlReport(data), data.metrics);
  } catch (e) {
    // k6-reporter chokes on zero-traffic (aborted-init) runs — never let the
    // HTML report kill the real summary.
    console.warn(`html report skipped: ${e}`);
  }
  return out;
}
