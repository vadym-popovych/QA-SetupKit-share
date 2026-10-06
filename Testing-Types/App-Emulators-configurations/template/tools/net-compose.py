"""Pair a screen recording with its request timeline: LEFT the app, RIGHT a live panel of every
request — method, path, a running timer while it is pending, then status + duration (or who gave
up and when). Rendered with Pillow; only plain ffmpeg (hstack) is needed, no drawtext.

  python3 net-compose.py <clip.mp4> [out.mp4] [--host <substring>] [--timeout <s>]

Reads <clip.mp4>.net.json (record-with-network.py). --timeout draws the client's timeout as a tick
on every timing bar, so "the app gave up at 20 s while the server was still working" is visible.
When the netlog carries connection detail (`d`, net-timeline-addon.py) each request also gets a
line "server IP · new/reused connection · sent · first byte | no answer" revealed as video time
passes, the request body (with netbodies=true), and marks on its bar: blue = request sent,
green = first byte of the response.
"""
import argparse, json, subprocess, tempfile, shutil
from urllib.parse import urlsplit, unquote
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("clip"); ap.add_argument("out", nargs="?")
ap.add_argument("--host", default=""); ap.add_argument("--timeout", type=float, default=None)
a = ap.parse_args()
out = a.out or a.clip.replace(".mp4", "-with-requests.mp4")
meta = json.load(open(a.clip + ".net.json"))
t0 = meta["t0"]; FPS, H, PW = 10, 1280, 980
dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                      "-of", "csv=p=0", a.clip], text=True).strip())
reqs = []
for e in sorted(meta["events"], key=lambda e: e["t0"]):
    u = urlsplit(e["u"])
    if a.host and a.host not in u.netloc:
        continue
    reqs.append({"m": e["m"], "host": u.netloc, "path": unquote(u.path + (("?" + u.query) if u.query else "")),
                 "a": (e["t0"] - t0) / 1000, "b": ((e["t1"] - t0) / 1000) if e.get("t1") else None,
                 "st": e.get("st"), "err": e.get("err"), "d": e.get("d") or {}})

def font(sz, bold=False):
    for p in ("/System/Library/Fonts/Menlo.ttc", "/System/Library/Fonts/SFNSMono.ttf"):
        try: return ImageFont.truetype(p, sz, index=1 if bold else 0)
        except Exception: continue
    return ImageFont.load_default()
F, FB, FS = font(26), font(28, True), font(22)
BG, FG, DIM = (22, 24, 30), (230, 232, 238), (140, 146, 160)
GREEN, RED, AMBER, BLUE = (70, 200, 120), (240, 90, 80), (245, 190, 70), (110, 160, 255)
SCALE = max(25.0, (a.timeout or 0) * 1.25)
wrap = lambda s, w: [s[i:i + w] for i in range(0, len(s), w)] or [""]

tmp = tempfile.mkdtemp()
for k in range(int(dur * FPS)):
    t = k / FPS
    im = Image.new("RGB", (PW, H), BG); d = ImageDraw.Draw(im)
    d.text((28, 24), "Requests (app -> API)", font=FB, fill=FG)
    d.text((28, 64), f"video t = {t:5.1f} s", font=FS, fill=DIM)
    d.text((28, 94), reqs[0]["host"] if reqs else "no requests in this window", font=FS, fill=DIM)
    y = 140
    rel = lambda r, k: ((r["d"][k] - t0) / 1000) if r["d"].get(k) else None
    shown = [r for r in reqs if r["a"] <= t]
    keep = 4 if any(r["d"] for r in reqs) else 7          # what fits above the legend
    if len(shown) > keep:
        d.text((28, 124), f"+{len(shown) - keep} earlier request(s) above", font=FS, fill=DIM)
        y += 20
    for r in shown[-keep:]:
        done = r["b"] is not None and r["b"] <= t
        el = (r["b"] if done else t) - r["a"]
        if not done: col, tag = AMBER, f"... {el:5.1f} s  pending"
        elif r["err"] == "client closed" and not (a.timeout and el >= a.timeout - 0.5):
            col, tag = DIM, f"- cancelled by the app after {el:.2f} s"   # e.g. a debounced search
        elif r["err"] == "client closed": col, tag = RED, f"x client timeout after {el:.2f} s"
        elif r["err"]: col, tag = RED, f"x {r['err']} after {el:.2f} s"
        elif (r["st"] or 0) >= 400: col, tag = RED, f"x HTTP {r['st']} - {el:.2f} s"
        else: col, tag = GREEN, f"ok {r['st']} - {el:.2f} s"
        lines = wrap(r["path"], 52)[:2]
        d.text((28, y), r["m"], font=FB, fill=BLUE)
        for i, ln in enumerate(lines): d.text((120, y + i * 32), ln, font=F, fill=FG)
        y += 32 * len(lines)
        d.text((120, y + 4), tag, font=FB, fill=col)
        if r["d"]:
            dd, parts = r["d"], []
            if dd.get("ip"): parts.append(f"server {dd['ip']}")
            # mitmproxy connects upstream during the client's TLS handshake, before the request,
            # so the connection phases are shown as "new / reused", not as offsets
            parts.append("reused conn" if dd.get("reused") else ("new TLS conn" if dd.get("tls") else "no conn"))
            sent, fb = rel(r, "sent"), rel(r, "fb")
            if sent is not None and sent <= t: parts.append(f"sent +{sent - r['a']:.2f}s")
            if fb is not None and fb <= t: parts.append(f"1st byte +{fb - r['a']:.2f}s")
            elif fb is None and sent is not None and sent <= t:
                parts.append("waiting for server" if not done else
                             ("no answer before cancel" if col == DIM else "NO answer from server"))
            rows = [""]                      # wrap between parts, never inside one
            for p_ in parts:
                cand = (rows[-1] + "  ·  " + p_) if rows[-1] else p_
                if len(cand) > 62 and rows[-1]: rows.append(p_)
                else: rows[-1] = cand
            y += 12
            for ln in rows[:2]:
                y += 30; d.text((120, y), ln, font=FS, fill=RED if "NO answer" in ln else DIM)
            y += 8
            if dd.get("q"):
                y += 28; d.text((120, y), ("body " + dd["q"].replace("\n", " "))[:60], font=FS, fill=DIM)
        bx, bw = 120, PW - 160
        d.rectangle([bx, y + 46, bx + bw, y + 54], fill=(50, 54, 64))
        d.rectangle([bx, y + 46, bx + int(bw * min(el, SCALE) / SCALE), y + 54], fill=col)
        for mk, c in (("sent", BLUE), ("fb", GREEN)):
            v = rel(r, mk)
            if v is not None and v <= t:
                mx = bx + int(bw * min(v - r["a"], SCALE) / SCALE); d.rectangle([mx - 2, y + 42, mx + 2, y + 58], fill=c)
        if a.timeout:
            tx = bx + int(bw * a.timeout / SCALE); d.line([tx, y + 40, tx, y + 60], fill=(210, 210, 210), width=2)
        y += 90
    note = f"bar 0-{SCALE:.0f} s" + (f"  |  white tick = client timeout ({a.timeout:g} s)" if a.timeout else "") + \
        ("  |  blue = sent, green = 1st byte" if any(r["d"] for r in reqs) else "")
    for i, ln in enumerate(note.split("  |  ")): d.text((28, H - 40 - 30 * (len(note.split("  |  ")) - 1 - i)), ln, font=FS, fill=DIM)
    im.save(f"{tmp}/{k:05d}.png")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", a.clip, "-framerate", str(FPS), "-i", f"{tmp}/%05d.png",
                "-filter_complex", f"[0:v]fps={FPS},scale=-2:{H}[a];[1:v]scale={PW}:{H}[b];[a][b]hstack=inputs=2[v]",
                "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-shortest", out], check=True)
shutil.rmtree(tmp)
print(out, f"{dur:.1f}s", f"{len(reqs)} requests")
for r in reqs:
    print(f"  {r['a']:6.2f}s  {r['m']} {r['path'][:70]}  ->  {r['st'] or r['err']}  {((r['b'] or 0) - r['a']):.2f}s")
