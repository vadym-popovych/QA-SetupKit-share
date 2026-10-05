"""Draw the taps onto an iOS simulator recording — the app-side equivalent of Android's
"Show taps" (EMULATOR_RULES §3.7b, "a clip shows its taps").

Why a post-pass: `simctl io recordVideo` captures the device framebuffer only. Simulator.app's
own touch circles are drawn on its window, not in the device, and Maestro taps through XCTest,
not the mouse, so nothing of a tap reaches the recording. Maestro's XCTest runner logs every tap
with a wall-clock time and the point it hit, which is all a dot needs.

  python3 tap-overlay.py <clip.mp4> [out.mp4] --t0 <ms the recording started>
                         [--maestro-dir <~/.maestro/tests/<run>>] [--scale 3] [--color FF3B30]

  --t0          wall-clock ms of the first frame (record-with-network.py / record-repro.sh print
                and store it; defaults to "t0" in <clip>.net.json when that file exists)
  --maestro-dir the Maestro run whose xctest_runner_*.log holds the taps (default: the newest
                run in ~/.maestro/tests)
  --scale       pixels per point: 3 on current iPhones, 2 on SE-class (default: from the width)
Without [out] the clip is rewritten in place. Prints each tap it drew; draws nothing (and says
so) when the log has no taps inside the clip's window — never a silent no-op.
"""
import argparse, datetime, glob, json, os, re, subprocess, tempfile, shutil
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("clip"); ap.add_argument("out", nargs="?")
ap.add_argument("--t0", type=int); ap.add_argument("--maestro-dir")
ap.add_argument("--scale", type=float); ap.add_argument("--color", default="FF3B30")
ap.add_argument("--hold", type=float, default=0.6, help="seconds a dot stays on screen")
a = ap.parse_args()

t0 = a.t0
if t0 is None and os.path.exists(a.clip + ".net.json"):
    t0 = json.load(open(a.clip + ".net.json"))["t0"]
if t0 is None:
    raise SystemExit("tap-overlay: no --t0 and no <clip>.net.json — the taps cannot be placed in time")
mdir = a.maestro_dir or max(glob.glob(os.path.expanduser("~/.maestro/tests/*")), key=os.path.getmtime)
logs = glob.glob(os.path.join(mdir, "xctest_runner_*.log"))
if not logs:
    raise SystemExit(f"tap-overlay: no xctest_runner_*.log in {mdir}")

w, h, dur = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries",
    "stream=width,height:format=duration", "-of", "default=nw=1:nk=1", a.clip], text=True).split()[:3]
w, h, dur = int(w), int(h), float(dur)
scale = a.scale or (2.0 if w < 1000 else 3.0)

# "2026-10-01 00:24:26.202018+0200 maestro-driver-iosUITests-Runner[..] Tapping 186.0, 232.0"
pat = re.compile(r"^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+)([+-]\d{4}) .*\bTapping (-?[\d.]+), (-?[\d.]+)\s*$")
taps = []
for ln in open(logs[0], errors="replace"):
    m = pat.match(ln.strip())
    if not m:
        continue
    ts = datetime.datetime.strptime(m[1] + m[2], "%Y-%m-%d %H:%M:%S.%f%z").timestamp()
    t = ts - t0 / 1000
    if 0 <= t <= dur:
        taps.append((t, float(m[3]) * scale, float(m[4]) * scale))
if not taps:
    print(f"tap-overlay: no taps inside the clip window in {logs[0]} — clip left unchanged")
    raise SystemExit(0)

R = int(28 * scale)
rgb = tuple(int(a.color[i:i + 2], 16) for i in (0, 2, 4))
tmp = tempfile.mkdtemp()
dot = os.path.join(tmp, "dot.png")
im = Image.new("RGBA", (2 * R + 8, 2 * R + 8), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.ellipse([4, 4, 4 + 2 * R, 4 + 2 * R], fill=rgb + (110,), outline=(255, 255, 255, 230), width=int(2 * scale))
d.ellipse([4 + R * 0.62, 4 + R * 0.62, 4 + R * 1.38, 4 + R * 1.38], fill=rgb + (230,))
im.save(dot)

# simctl records variable frame rate: a still screen gets no new frames, so a dot "enabled"
# between two frames would never be drawn — resample to a constant rate first
chain, inputs, last = ["[0:v]fps=30[cfr]"], ["-i", a.clip], "cfr"
for i, (t, x, y) in enumerate(taps):
    inputs += ["-i", dot]
    nxt = f"v{i}"
    chain.append(f"[{last}][{i + 1}:v]overlay=x={x - R - 4:.0f}:y={y - R - 4:.0f}:"
                 f"enable='between(t,{max(0, t - 0.05):.3f},{t + a.hold:.3f})'[{nxt}]")
    last = nxt
out = a.out or os.path.join(tmp, "out.mp4")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *inputs, "-filter_complex", ";".join(chain),
                "-map", f"[{last}]", "-map", "0:a?", "-c:v", "libx264", "-pix_fmt", "yuv420p", out], check=True)
if not a.out:
    shutil.move(out, a.clip)
shutil.rmtree(tmp, ignore_errors=True)
print(f"tap-overlay: {len(taps)} tap(s) drawn -> {a.out or a.clip}")
for t, x, y in taps:
    print(f"  {t:6.2f}s  ({x / scale:.0f}, {y / scale:.0f}) pt")
