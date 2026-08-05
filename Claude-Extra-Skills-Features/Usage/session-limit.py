#!/usr/bin/env python3
"""Claude Code session-limit estimator (no credentials needed).

Estimates the CURRENT 5-hour session window from local logs
(~/.claude/projects/**/*.jsonl) and prints one line:

    Claude session: started 14:03, resets 19:03 (in 2h41m) | ~$12.4 cost-units | ~64% (est)

How it works
  * Session windows are 5h blocks: a window opens at the first message
    (floored to the hour, matching Anthropic's behaviour) and closes 5h later.
    The RESET TIME is therefore exact, computed purely from log timestamps.
  * The %-used is an ESTIMATE: Anthropic does not expose the cap. We convert
    tokens to API-equivalent cost units and scale by a user calibration.

Calibration (do this whenever you see the real banner / /usage):
    session-limit.py --cal 97        # "the banner says 97% right now"
  This stores cost-units-per-percent in ~/.claude/usage-calibration.json and
  future runs extrapolate from it (calibration survives across windows).

Usage:
    session-limit.py            # one-line status (for hooks)
    session-limit.py --json     # machine-readable
    session-limit.py --fresh    # bypass the 120s live cache (exact data NOW)
    session-limit.py --cal N    # calibrate at N percent
"""
import glob
import json
import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime

HOME = os.path.expanduser("~")
CAL_FILE = f"{HOME}/.claude/usage-calibration.json"
LIVE_CACHE = f"{HOME}/.claude/usage-live-cache.json"
LIVE_TTL = 120  # s — don't hit the usage endpoint more often than this
WINDOW_H = 5.0
LOOKBACK_H = 11.0  # scan a bit more than 2 windows back

# API-equivalent $/Mtok weights (Opus-class) — only used as a linear usage
# proxy for calibration; absolute values don't matter, ratios do.
PX_IN, PX_OUT, PX_CW, PX_CR = 15.0, 75.0, 18.75, 1.5


def iso_ts(entry):
    t = entry.get("timestamp")
    if not t:
        return None
    try:
        return datetime.fromisoformat(t.replace("Z", "+00:00")).timestamp()
    except Exception:
        return None


def scan(lookback_s):
    """Return sorted [(ts, cost_units)] for every usage-bearing log entry."""
    cutoff = time.time() - lookback_s
    events = []
    for f in glob.glob(f"{HOME}/.claude/projects/**/*.jsonl", recursive=True):
        try:
            if os.path.getmtime(f) < cutoff:
                continue
            for line in open(f, errors="ignore"):
                try:
                    o = json.loads(line)
                except Exception:
                    continue
                ts = iso_ts(o)
                if ts is None or ts < cutoff:
                    continue
                msg = o.get("message")
                u = msg.get("usage") if isinstance(msg, dict) else None
                cost = 0.0
                if u:
                    cost = (
                        u.get("input_tokens", 0) * PX_IN
                        + u.get("output_tokens", 0) * PX_OUT
                        + u.get("cache_creation_input_tokens", 0) * PX_CW
                        + u.get("cache_read_input_tokens", 0) * PX_CR
                    ) / 1e6
                events.append((ts, cost))
        except Exception:
            continue
    events.sort()
    return events


def load_cal():
    try:
        return json.load(open(CAL_FILE))
    except Exception:
        return {}


def save_cal(cal):
    json.dump(cal, open(CAL_FILE, "w"), indent=2)


def current_window(events):
    """Return (start, end) of the 5h window covering `now`.

    Preferred: chain forward from a CALIBRATED anchor (a window start confirmed
    against the real /usage banner via --reset-at). Each next window opens at
    the first event after the previous window closed, floored to the hour.
    Fallback (no anchor): same chaining from the earliest scanned event —
    can be wrong if history is shorter than the true chain; calibrate ASAP.
    """
    now = time.time()
    cal = load_cal()
    anchor = cal.get("window_anchor")

    start = None
    if anchor is not None and anchor <= now:
        start = anchor
    for ts, _ in events:
        if start is not None and ts <= start + WINDOW_H * 3600:
            continue  # inside the current chained window
        if start is not None and anchor is not None and ts < anchor:
            continue  # pre-anchor history is irrelevant once calibrated
        if start is None or ts > start + WINDOW_H * 3600:
            if start is None or anchor is None or ts >= anchor:
                start = ts - (ts % 3600)  # floor to the hour
    if start is None or now > start + WINDOW_H * 3600:
        return None, None
    return start, start + WINDOW_H * 3600


def fmt_clock(ts):
    return datetime.fromtimestamp(ts).strftime("%H:%M")


def fmt_dur(secs):
    secs = max(0, int(secs))
    h, m = secs // 3600, (secs % 3600) // 60
    return f"{h}h{m:02d}m" if h else f"{m}m"


def fetch_live():
    """EXACT data from Anthropic's oauth usage endpoint (same source as the
    in-app banner). OAuth token is read from the macOS Keychain and sent ONLY
    to api.anthropic.com. Responses are cached for LIVE_TTL seconds.
    Returns the parsed JSON dict, or None on any failure (offline, revoked
    token, rate limit, schema change) — caller falls back to the estimate.
    --fresh skips the read-side cache (write still happens) — use near the
    session limit, where a 2-min-stale percentage is dangerous."""
    if "--fresh" not in sys.argv:
        try:
            c = json.load(open(LIVE_CACHE))
            if time.time() - c["fetched_at"] < LIVE_TTL:
                return c["data"]
        except Exception:
            pass
    try:
        raw = subprocess.run(
            ["security", "find-generic-password", "-s", "Claude Code-credentials", "-w"],
            capture_output=True, text=True, timeout=3).stdout.strip()
        token = json.loads(raw)["claudeAiOauth"]["accessToken"]
        req = urllib.request.Request(
            "https://api.anthropic.com/api/oauth/usage",
            headers={"Authorization": f"Bearer {token}",
                     "anthropic-beta": "oauth-2025-04-20"})
        data = json.loads(urllib.request.urlopen(req, timeout=4).read())
        if "five_hour" not in data:
            return None
        json.dump({"fetched_at": time.time(), "data": data}, open(LIVE_CACHE, "w"))
        return data
    except Exception:
        return None


def parse_iso(v):
    """Parse an ISO-8601 string to an epoch float, or None. Tolerates the
    endpoint returning null / a non-string (happens for `resets_at` right after
    a window resets, when there is no active limit)."""
    if not isinstance(v, str):
        return None
    try:
        return datetime.fromisoformat(v.replace("Z", "+00:00")).timestamp()
    except Exception:
        return None


def live_line(data):
    """Render the exact-data status line + silently recalibrate the fallback."""
    now = time.time()
    fh = data["five_hour"]
    pct = fh.get("utilization") or 0
    resets = parse_iso(fh.get("resets_at"))
    wk = data.get("seven_day") or {}
    wk_pct = wk.get("utilization")
    wk_model = next((l["percent"] for l in data.get("limits", [])
                     if l.get("kind") == "weekly_scoped"), None)
    wk_txt = ""
    if wk_pct is not None:
        wk_txt = f" | week: {wk_pct:.0f}%" + (f" (model: {wk_model:.0f}%)" if wk_model is not None else "")

    # self-calibrate the offline fallback from ground truth (needs a real
    # reset time to anchor the window — skip when the window is idle/just reset)
    if resets is not None:
        try:
            cal = load_cal()
            cal["window_anchor"] = resets - WINDOW_H * 3600
            if pct > 3:  # only when the signal is meaningful
                events = scan(LOOKBACK_H * 3600)
                used_cost = sum(c for ts, c in events if ts >= cal["window_anchor"])
                if used_cost > 0:
                    cal.update({"cost_per_pct": used_cost / pct, "cal_pct": pct,
                                "cal_ts": now, "cal_cost": used_cost})
            save_cal(cal)
        except Exception:
            pass

    if resets is None:
        # window idle / just reset — no active 5h limit, so no reset clock
        return f"Claude session: {pct:.0f}% used, window idle (next message starts a fresh 5h window){wk_txt}"

    return (f"Claude session: {pct:.0f}% used, resets {fmt_clock(resets)} "
            f"(in {fmt_dur(resets - now)}){wk_txt}")


def main():
    now = time.time()

    # Exact data first (unless explicitly running estimate-only / calibration)
    if not any(a in sys.argv for a in ("--cal", "--reset-at", "--est")):
        data = fetch_live()
        if data is not None:
            if "--json" in sys.argv:
                fh = data["five_hour"]
                print(json.dumps({"exact": True, "session_pct": fh.get("utilization"),
                                  "resets_at": fh.get("resets_at"),
                                  "week_pct": (data.get("seven_day") or {}).get("utilization")}))
            else:
                print(live_line(data))
            return

    # --reset-at HH:MM : the real reset time from /usage → anchors the window
    if "--reset-at" in sys.argv:
        hhmm = sys.argv[sys.argv.index("--reset-at") + 1]
        h, m = map(int, hhmm.split(":"))
        d = datetime.now().replace(hour=h, minute=m, second=0, microsecond=0)
        reset = d.timestamp()
        if reset <= now:
            reset += 86400  # reset time already passed today -> tomorrow
        cal = load_cal()
        cal["window_anchor"] = reset - WINDOW_H * 3600
        save_cal(cal)
        print(f"window anchored: {fmt_clock(cal['window_anchor'])} -> resets {fmt_clock(reset)}")
        return

    events = scan(LOOKBACK_H * 3600)
    start, end = current_window(events)

    if start is None:
        print("Claude session: no active window (next message starts a fresh 5h window)")
        return

    used_cost = sum(c for ts, c in events if ts >= start)

    # --cal N : store cost-per-percent for this and future estimates
    if "--cal" in sys.argv:
        pct = float(sys.argv[sys.argv.index("--cal") + 1])
        if pct <= 0:
            sys.exit("--cal needs a positive percent")
        cal = load_cal()
        cal.update({"cost_per_pct": used_cost / pct, "cal_pct": pct,
                    "cal_ts": now, "cal_cost": used_cost})
        save_cal(cal)
        print(f"calibrated: {pct:g}% == {used_cost:.2f} cost-units "
              f"(1% ≈ {cal['cost_per_pct']:.3f})")
        return

    pct_txt, pct_val = "", None
    cal = load_cal()
    try:
        cpp = float(cal["cost_per_pct"])
        if cpp > 0:
            pct_val = used_cost / cpp
            pct_txt = f" | ~{pct_val:.0f}% of session limit (est)"
    except Exception:
        pct_txt = " | % unknown (calibrate: session-limit.py --cal <pct from /usage>)"

    line = (f"Claude session: started {fmt_clock(start)}, resets {fmt_clock(end)} "
            f"(in {fmt_dur(end - now)}) | ~{used_cost:.1f} cost-units{pct_txt}")

    if "--json" in sys.argv:
        print(json.dumps({"window_start": start, "resets_at": end,
                          "resets_in_s": int(end - now), "cost_units": round(used_cost, 2),
                          "est_pct": round(pct_val, 1) if pct_val is not None else None}))
    else:
        print(line)


if __name__ == "__main__":
    main()
