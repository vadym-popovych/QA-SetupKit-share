<!-- Copy to <Project>/Compatibility-Testing/MATRIX.md. Owner signs (🟡) before it
     governs testing; re-weight on analytics shift and log it in the Revision log. -->

# <Project> — Compatibility matrix

| | |
|---|---|
| **Usage source** | <analytics link / store dashboard / "market defaults for <region>" — assumption recorded> |
| **Signed by** | <owner, date> |
| **Depth per tier** | T1 full pass · T2 smoke + risk ≥ 7 flows · T3 renders · OUT declared behaviour verified once |

## Web

<!-- Web screen classes are EXECUTION PRESETS (Playwright viewport projects, e.g.
     1440×900 desktop + 390×844 mobile-web), applied uniformly to every T1/T2
     browser cell — they are not tracked as separate matrix cells. -->

| Cell (browser × version) | Usage % | Tier | Last pass (round, verdict) |
|---|---:|---|---|
| Chrome (last 2) desktop | | T1 | |
| Safari (last 2) desktop | | | |
| Chrome Android | | | |
| Safari iOS | | | |
| Firefox / Edge (last 2) | | | |
| <analytics tail…> | | | |

## Mobile (native)

| Cell (OS × device class) | Usage % | Tier | Last pass |
|---|---:|---|---|
| iOS <min supported> / small (SE class) | | | |
| iOS <latest> / large (Pro Max class) | | | |
| Android <min supported> / small | | | |
| Android <latest> / large | | | |

## OUT (unsupported — declared behaviour verified once)

| Cell | Declared behaviour | Verified (date) |
|---|---|---|
| <e.g. IE11 / Android < 10> | <upgrade prompt / graceful error> | |

## Platform-convention notes (expected look differences — noted once, not re-triaged)
- <e.g. iOS date picker is a wheel, Android a dialog — both fine>

## Revision log
| Date | Change (cells/weights/tiers) | Why | By |
|------|------------------------------|-----|-----|
