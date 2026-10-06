"""Type like a user: turn a Maestro flow's typing into TAPS on the on-screen keyboard, so a
recorded clip shows every key the "user" touched (EMULATOR_RULES §3.7b, "every touch gets a dot").

Why: `inputText` is injected through XCTest — no key is pressed, so tap-overlay.py has nothing to
draw and the keyboard on screen may not even have the letters typed (a Ukrainian layout "typed"
Latin "sense" on 01/10/2026). A flow expanded by this tool presses the real keys instead.

  python3 keyboard-taps.py calibrate <screenshot.png> <kb.json> [--scale 3]
      reads a screenshot with the ENGLISH QWERTY keyboard open (letters, lower case) and writes
      every key's centre in points: a-z, shift, delete, 123, space, return
  python3 keyboard-taps.py expand <flow.yaml> <kb.json> <out.yaml>
      rewrites `- inputText: "..."` into one `tapOn: point` per character (upper case = shift
      first), `- eraseText: N` into N taps on delete, `- pressKey: Enter` into a tap on return.
      Characters outside a-z, A-Z and space are REFUSED (exit 2) — never silently typed some other
      way; digits and symbols need the 123 layer, which is not calibrated.

Two simulator facts the flow must respect (measured 05/10/2026, Xcode 27, no Simulator.app):
  - the on-screen keyboard appears only after XCTest has typed once IN THE SAME Maestro session
    (a new session re-attaches the hardware keyboard). `expand` therefore puts `eraseText: 1`
    right after the tap that focuses the first field: on an empty field it deletes nothing, and
    on the clip it reads as "tap the field -> the keyboard opens";
  - the layout must be English QWERTY: switch once with the globe key; the choice persists
    (`KeyboardLastUsed`). Editing the device's keyboard defaults instead broke the keyboard.
Calibrate per device model (key places are fixed by iOS per screen size), and look at the clip.
"""
import json, re, sys
from PIL import Image

ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]


def is_key(p):          # a white letter key on the grey keyboard background
    return p[0] > 240 and p[1] > 240 and p[2] > 240


def calibrate(png, out, scale=None):
    im = Image.open(png).convert("RGB"); W, H = im.size
    scale = scale or (2.0 if W < 1000 else 3.0)
    px = im.load()
    top = int(H * 0.45)
    # rows of the keyboard: horizontal bands where many pixels are white keys
    dens = [sum(is_key(px[x, y]) for x in range(0, W, 3)) / (W / 3) for y in range(top, H)]
    bands, start = [], None
    for i, d in enumerate(dens):
        if d > 0.25 and start is None: start = i
        if d <= 0.25 and start is not None:
            if i - start > 20 * scale / 3: bands.append((top + start, top + i))
            start = None
    bands = bands[-4:]                     # the 4 key rows; anything above is app content
    if len(bands) != 4:
        raise SystemExit(f"calibrate: expected 4 key rows, found {len(bands)} — is the keyboard open?")

    def runs(y):
        rs, s = [], None
        for x in range(W):
            k = is_key(px[x, y])
            if k and s is None: s = x
            if not k and s is not None:
                if x - s > 20: rs.append((s, x))
                s = None
        if s is not None: rs.append((s, W))
        return rs

    kb, pt = {}, lambda x, y: [round(x / scale), round(y / scale)]
    # measure runs near a key's lower edge, below its glyph (the black letter splits a mid-line
    # run in two); tap at the band's middle
    low = lambda a, b: b - max(3, (b - a) // 8)
    for row, (a, b) in zip(ROWS, bands[:3]):
        y = (a + b) // 2; rs = runs(low(a, b))
        if len(rs) != len(row):
            raise SystemExit(f"calibrate: row '{row}' has {len(rs)} keys on screen, expected {len(row)} — "
                             "English QWERTY, lower case?")
        for ch, (s, e) in zip(row, rs):
            kb[ch] = pt((s + e) / 2, y)
    y3 = (bands[2][0] + bands[2][1]) // 2; r3 = runs(low(*bands[2]))
    kb["shift"] = pt(r3[0][0] / 2 - 4, y3); kb["delete"] = pt((r3[-1][1] + W) / 2 + 4, y3)
    y4 = (bands[3][0] + bands[3][1]) // 2; sp = max(runs(low(*bands[3])), key=lambda r: r[1] - r[0])
    kb["space"] = pt((sp[0] + sp[1]) / 2, y4)
    kb["return"] = pt((sp[1] + W) / 2, y4)
    kb["123"] = pt(W * 0.06, y4)
    json.dump({"screen": [round(W / scale), round(H / scale)], "keys": kb}, open(out, "w"), indent=1)
    print(f"calibrated {len(kb)} keys -> {out}")


def tap(p):
    return [f"- tapOn:\n    point: \"{p[0]},{p[1]}\"\n"]


def expand(flow, kbfile, out):
    k = json.load(open(kbfile))["keys"]
    lines, res, primed = open(flow).read().splitlines(keepends=True), [], False
    i = 0
    while i < len(lines):
        ln = lines[i]; s = ln.strip()
        m = re.match(r'- inputText:\s*"?(.*?)"?\s*$', s)
        if m:
            for ch in m[1]:
                if ch == " ": res += tap(k["space"])
                elif ch.lower() in k and ch.isalpha():
                    if ch.isupper(): res += tap(k["shift"])
                    res += tap(k[ch.lower()])
                else:
                    raise SystemExit(f"expand: cannot type {ch!r} by taps (only a-z, A-Z, space) — line {i + 1}")
            i += 1; continue
        m = re.match(r'- eraseText:\s*(\d+)\s*$', s)
        if m and primed:
            res += tap(k["delete"]) * int(m[1]); i += 1; continue
        if re.match(r'- pressKey:\s*(Enter|enter|Return|return)\s*$', s):
            res += tap(k["return"]); i += 1; continue
        if s == "- hideKeyboard":
            raise SystemExit(f"expand: hideKeyboard is a swipe with no logged point — tap a neutral spot instead (line {i + 1})")
        res.append(ln); i += 1
        # the first tap of the flow that is followed by typing focuses a field: prime the keyboard
        if not primed and s.startswith("- tapOn") and any(
                re.match(r'\s*- (inputText|eraseText)', x) for x in lines[i:i + 6]):
            while i < len(lines) and lines[i].startswith("    "):
                res.append(lines[i]); i += 1
            res.append("- eraseText: 1          # brings the on-screen keyboard up (keyboard-taps.py)\n")
            primed = True
    open(out, "w").write("".join(res))
    print(f"expanded -> {out}")


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "calibrate":
        calibrate(sys.argv[2], sys.argv[3], float(sys.argv[5]) if len(sys.argv) > 5 else None)
    elif len(sys.argv) == 5 and sys.argv[1] == "expand":
        expand(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        raise SystemExit(__doc__)
