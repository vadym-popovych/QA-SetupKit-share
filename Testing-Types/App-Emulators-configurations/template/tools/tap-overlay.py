"""Draw the taps onto an iOS simulator recording — the app-side equivalent of Android's
"Show taps" (EMULATOR_RULES §3.7b, "a clip shows its taps").

Why a post-pass: `simctl io recordVideo` captures the device framebuffer only. Simulator.app's
own touch circles are drawn on its window, not in the device, and Maestro taps through XCTest,
not the mouse, so nothing of a tap reaches the recording. Maestro's XCTest runner logs every tap
with a wall-clock time and the point it hit, which is all a dot needs.

  python3 tap-overlay.py <clip.mp4> [out.mp4] --t0 <ms the recording started>
                         [--maestro-dir <~/.maestro/tests/<run>>] [--scale 3] [--style auto|dark|light]

  --t0          wall-clock ms of the first frame (record-with-network.py / record-repro.sh print
                and store it; defaults to "t0" in <clip>.net.json when that file exists)
  --maestro-dir the Maestro run whose xctest_runner_*.log holds the taps (default: the newest
                run in ~/.maestro/tests)
  --scale       pixels per point: 3 on current iPhones, 2 on SE-class (default: from the width)
  --style       auto (default) measures the frame under each tap: a DARK translucent dot with a
                white ring on a light UI, a LIGHT one on a dark UI — the same two styles as the
                web kit's touch indicator (WEB_TESTING_RULES r.13). Never red: red is the colour
                of the bug markup in our evidence, and a red dot reads as "the bug is here".
Without [out] the clip is rewritten in place. Prints each tap it drew; draws nothing (and says
so) when the log has no taps inside the clip's window — never a silent no-op.
"""
import argparse, datetime, glob, json, os, re, subprocess, tempfile, shutil
from PIL import Image, ImageDraw, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument("clip"); ap.add_argument("out", nargs="?")
ap.add_argument("--t0", type=int); ap.add_argument("--maestro-dir")
ap.add_argument("--scale", type=float); ap.add_argument("--style", choices=["auto", "dark", "light"], default="auto")
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
        taps.append((t, float(m[3]) * scale, float(m[4]) * scale, a.hold))
# Key presses carry no point in the log: `pressKey: Enter` is sent as a keystroke, yet on screen it
# IS a tap on the keyboard's return key, so it is drawn there. The return key's place is fixed by
# iOS per screen size (measured on iPhone 16, 393x852 pt: (343, 751); SE-class has no home
# indicator, so the row sits lower). Other driver actions with no logged point (hideKeyboard and
# swipes go out as /swipeV2, other keys) cannot be placed — they are LISTED, never silently skipped.
cmds = []
for f in glob.glob(os.path.join(mdir, "commands-*.json")):
    for c in json.load(open(f)):
        cmds.append((c["metadata"].get("sequenceNumber", 0), c["command"]))
keys = [c.get("pressKeyCommand", {}).get("code") for _, c in sorted(cmds, key=lambda x: x[0]) if "pressKeyCommand" in c]
req = re.compile(r"^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+)([+-]\d{4}) .*request: POST /(pressKey|swipeV2|swipe|pressButton)\b")
undrawn, ki = [], 0
pt_w, pt_h = w / scale, h / scale
for ln in open(logs[0], errors="replace"):
    m = req.match(ln.strip())
    if not m:
        continue
    t = datetime.datetime.strptime(m[1] + m[2], "%Y-%m-%d %H:%M:%S.%f%z").timestamp() - t0 / 1000
    kind = m[3]
    if kind == "pressKey":
        code = keys[ki] if ki < len(keys) else "?"; ki += 1
        if str(code).upper() in ("ENTER", "RETURN") and 0 <= t <= dur:
            rx, ry = pt_w * 0.873, (pt_h - 101) if pt_h > 700 else (pt_h - 27)
            taps.append((t, rx * scale, ry * scale, 0.25)); continue   # the keyboard slides away right after
        kind = f"pressKey {code}"
    if 0 <= t <= dur:
        undrawn.append((t, "hideKeyboard / swipe" if kind.startswith("swipe") else kind))
taps.sort()
for t, k in undrawn:
    print(f"tap-overlay: NOT drawn at {t:.2f}s — {k} (no point in the log); use an explicit tapOn in a recorded flow")
if not taps:
    print(f"tap-overlay: no taps inside the clip window in {logs[0]} — clip left unchanged")
    raise SystemExit(0)

# The web kit's touch indicator, 1:1 (touch-indicator.js + the light-UI override the design
# review recorded with, 26/08/2026); sizes in points = CSS px there. a = alpha 0..1.
STYLES = {"dark":  {"size": 46, "fill": (17, 19, 26, .36), "ring": (255, 255, 255, .96), "glow": (17, 19, 26, .45)},   # light UI
          "light": {"size": 44, "fill": (255, 255, 255, .45), "ring": (255, 255, 255, .95), "glow": (255, 255, 255, .6)}}  # dark UI
R = int(max(v["size"] for v in STYLES.values()) / 2 * scale)
tmp = tempfile.mkdtemp()

def style_at(t, x, y):
    if a.style != "auto":
        return a.style
    fr = os.path.join(tmp, "probe.png")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{max(0, t - 0.1):.3f}", "-i", a.clip,
                    "-frames:v", "1", fr], check=True)
    g = Image.open(fr).convert("L").crop((int(x - R), int(y - R), int(x + R), int(y + R)))
    px = list(g.getdata()) or [255]
    return "dark" if sum(px) / len(px) >= 110 else "light"

def dot_png(kind):
    path = os.path.join(tmp, f"dot-{kind}.png")
    if not os.path.exists(path):
        st = STYLES[kind]; rr = st["size"] / 2 * scale; ring = 2 * scale; blur = 12 * scale
        rgba = lambda c: c[:3] + (int(c[3] * 255),)
        c = R + 4 + int(blur)                    # canvas centre; the glow needs room around the dot
        im = Image.new("RGBA", (2 * c, 2 * c), (0, 0, 0, 0))
        glow = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(glow).ellipse([c - rr, c - rr, c + rr, c + rr], fill=rgba(st["glow"]))
        im = Image.alpha_composite(im, glow.filter(ImageFilter.GaussianBlur(blur / 2)))
        dot = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(dot)
        d.ellipse([c - rr, c - rr, c + rr, c + rr], fill=rgba(st["fill"]), outline=rgba(st["ring"]), width=int(ring))
        im = Image.alpha_composite(im, dot)
        im.save(path)
    return path

# simctl records variable frame rate: a still screen gets no new frames, so a dot "enabled"
# between two frames would never be drawn — resample to a constant rate first
chain, inputs, last, styles = ["[0:v]fps=30[cfr]"], ["-i", a.clip], "cfr", []
for i, (t, x, y, hold) in enumerate(taps):
    kind = style_at(t, x, y); styles.append(kind)
    inputs += ["-i", dot_png(kind)]
    nxt = f"v{i}"
    chain.append(f"[{last}][{i + 1}:v]overlay=x={x:.0f}-overlay_w/2:y={y:.0f}-overlay_h/2:"
                 f"enable='between(t,{max(0, t - 0.05):.3f},{t + hold:.3f})'[{nxt}]")
    last = nxt
out = a.out or os.path.join(tmp, "out.mp4")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *inputs, "-filter_complex", ";".join(chain),
                "-map", f"[{last}]", "-map", "0:a?", "-c:v", "libx264", "-pix_fmt", "yuv420p", out], check=True)
if not a.out:
    shutil.move(out, a.clip)
shutil.rmtree(tmp, ignore_errors=True)
print(f"tap-overlay: {len(taps)} tap(s) drawn -> {a.out or a.clip}")
for (t, x, y, _), k in zip(taps, styles):
    print(f"  {t:6.2f}s  ({x / scale:.0f}, {y / scale:.0f}) pt  {k} dot")
