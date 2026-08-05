# Report-tab house style (for the QA Trends tab and any stats+table report tab)

Self-contained spec so a fresh machine can reproduce the style without the author's
workspace. Two blocks per tab, built idempotently (re-run recreates the tab):

## 1. Summary block (top)
- **Title row:** bold, font size 11, background **blue `#3D85C6`**, white text.
- **Sub-header row:** bold, background **light-blue `#D8E5EA`**.
- **Stat rows** below (label + value pairs).

## 2. Data table (below one blank spacer row)
- **Header row:** bold, background **teal `#1E4F5B`**, white text.
- Data rows underneath, appended over time (append-only for trend tabs).

## Cell discipline
- **Numbers are REAL numbers** (`valueInputOption: USER_ENTERED`, numeric values —
  never strings via RAW): charts silently ignore text-formatted numbers.
- **`wrapStrategy: OVERFLOW_CELL`** (content on ONE line) + **explicit per-column
  pixel widths** — NOT autoResize, NOT WRAP (this deliberately overrides the
  wrap-everywhere default that governs free-text tabs).
- Human-readable formats: durations ≥ 1 min → store `seconds/86400` with a duration
  numberFormat (`[m]"m" ss"s"`); ms latencies keep ms values + numberFormat
  `#,##0" ms"`; counters `#,##0`.
- **Charts reference whole columns** so appended rows auto-populate — never rebuild
  charts on re-run.

## Trends-tab columns (this kit)
`date · round · open Critical · open Major · open Medium · open Low · inflow ·
outflow · coverage % · gaps · reopen % · verdict` — cells `qa-metrics.mjs` computes
come from `metrics-<round>.json`; the rest (outflow, verdict) are filled from the
plan's Results section by the agent closing the round.
