"""Record a Maestro flow on an iOS simulator AND keep the network timeline of the same window,
so net-compose.py can put the requests next to the screen (EMULATOR_RULES, request-timeline clips).

  python3 record-with-network.py <flow.yaml> <out.mp4> --netlog <mitmdump jsonl> [--udid <sim>]

Writes <out.mp4> and <out.mp4>.net.json = {"t0": ms when recording started, "t1": ms when it
stopped, "flowExit": n, "events": [...lines of the netlog that overlap the window]}.
mitmdump with net-timeline-addon.py must already be running and the app routed through it.
No dead-air trimming here on purpose: a cut would break the sync with the timeline.
"""
import argparse, json, os, signal, subprocess, time, pathlib

ap = argparse.ArgumentParser()
ap.add_argument("flow"); ap.add_argument("out")
ap.add_argument("--netlog", required=True); ap.add_argument("--udid", default="booted")
ap.add_argument("--min-timeout", type=float, default=5.0, help="an app-side abort shorter than this is a cancellation, not a failure")
a = ap.parse_args()
out = pathlib.Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)

rec = subprocess.Popen(["xcrun", "simctl", "io", a.udid, "recordVideo", "--codec=h264", "--force", str(out)],
                       stderr=subprocess.PIPE, text=True)
t0 = None
for line in rec.stderr:
    if "Recording started" in line:
        t0 = int(time.time() * 1000); break
if t0 is None:
    raise SystemExit("recordVideo did not start")
dev = [] if a.udid == "booted" else ["--device", a.udid]
fx = subprocess.run(["maestro", *dev, "test", a.flow], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode
time.sleep(1.5)
t1 = int(time.time() * 1000)
rec.send_signal(signal.SIGINT); rec.wait()   # SIGINT finalises the container; kill -9 leaves it unplayable

ev = []
p = pathlib.Path(a.netlog)
if p.exists():
    for ln in p.read_text().splitlines():
        try: e = json.loads(ln)
        except ValueError: continue
        if e.get("t0", 0) <= t1 and (e.get("t1") or t1) >= t0:
            ev.append(e)
json.dump({"t0": t0, "t1": t1, "flowExit": fx, "events": ev}, open(str(out) + ".net.json", "w"), indent=1)
# simctl captures no touches (EMULATOR_RULES §3.7b) — draw Maestro's taps onto the clip
# (same timeline, so the request sync is kept); NO_TAPS=1 keeps the raw capture
if not os.environ.get("NO_TAPS"):
    subprocess.run(["python3", str(pathlib.Path(__file__).with_name("tap-overlay.py")), str(out), "--t0", str(t0)])
# a request the app abandons within a second is usually its own cancellation (debounced search,
# navigation), not a failure — count "client closed" as failed only after --min-timeout seconds
bad = [e for e in ev if (e.get("st") or 200) >= 400 or (e.get("err") and e.get("err") != "client closed")
       or (e.get("err") == "client closed" and ((e.get("t1") or 0) - e["t0"]) / 1000 >= a.min_timeout)]
print(f"{out}  flow exit {fx}  {len(ev)} requests  {len(bad)} failed")
