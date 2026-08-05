#!/usr/bin/env python3
"""Annotate bug screenshots: red = problem zone, green = expected/reference zone.

Usage: annotate.py spec.json
Spec:
{
  "src": "in.png", "out": "out.png",
  "annotations": [
    {"xy": [x1,y1,x2,y2], "color": "red"|"green", "label": "text",
     "labelPos": "above"|"below"}  // label optional
  ]
}
Colors: red = #E5342B (problem), green = #1E9E4A (expected). Rounded rects,
label chips with matching background. Coordinates in ORIGINAL image pixels.
"""
import json, sys
from PIL import Image, ImageDraw, ImageFont

COLORS = {"red": (229, 52, 43, 255), "green": (30, 158, 74, 255)}

def font(size):
    for p in ("/System/Library/Fonts/Helvetica.ttc",
              "/System/Library/Fonts/SFNS.ttf",
              "/Library/Fonts/Arial.ttf"):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()

def main(spec_path):
    spec = json.load(open(spec_path))
    im = Image.open(spec["src"]).convert("RGBA")
    d = ImageDraw.Draw(im)
    W, H = im.size
    stroke = max(4, W // 200)
    fnt = font(max(24, W // 34))
    pad = stroke * 2

    for a in spec["annotations"]:
        col = COLORS[a.get("color", "red")]
        if a.get("type") == "chip":
            # standalone label chip at xy=[x,y] (no rectangle) — e.g. green "Expected: …"
            x, y = a["xy"][:2]
            label = a["label"]
            tb = d.textbbox((0, 0), label, font=fnt)
            tw, th = tb[2] - tb[0], tb[3] - tb[1]
            d.rounded_rectangle([x, y, x + tw + pad * 2, y + th + pad * 2],
                                radius=stroke * 2, fill=col)
            d.text((x + pad, y + pad - tb[1]), label, font=fnt,
                   fill=(255, 255, 255, 255))
            continue
        if a.get("type") == "underline":
            (x1, y1), (x2, y2) = a["from"], a["to"]
            d.line([x1, y1, x2, y2], fill=col, width=stroke)
            continue
        if a.get("type") == "arrow":
            import math
            (fx, fy), (tx, ty) = a["from"], a["to"]
            ang = math.atan2(ty - fy, tx - fx)
            length = math.hypot(tx - fx, ty - fy)
            hl = min(max(stroke * 7, length * 0.18), stroke * 14)  # head length
            hw = hl * 0.45        # head half-width
            sw = stroke * 0.9     # shaft half-width
            bx = tx - hl * math.cos(ang)   # head base center
            by = ty - hl * math.sin(ang)
            px, py = math.sin(ang), -math.cos(ang)  # perpendicular unit
            d.polygon([
                (fx + px * sw, fy + py * sw),
                (bx + px * sw, by + py * sw),
                (bx + px * hw, by + py * hw),
                (tx, ty),
                (bx - px * hw, by - py * hw),
                (bx - px * sw, by - py * sw),
                (fx - px * sw, fy - py * sw),
            ], fill=col)
            continue
        x1, y1, x2, y2 = a["xy"]
        d.rounded_rectangle([x1, y1, x2, y2], radius=stroke * 3,
                            outline=col, width=stroke)
        label = a.get("label")
        if not label:
            continue
        tb = d.textbbox((0, 0), label, font=fnt)
        tw, th = tb[2] - tb[0], tb[3] - tb[1]
        pos = a.get("labelPos", "below")
        ly = y2 + pad if pos == "below" else y1 - th - pad * 3
        ly = min(max(0, ly), H - th - pad * 2)
        lx = min(max(0, x1), W - tw - pad * 2)
        d.rounded_rectangle([lx, ly, lx + tw + pad * 2, ly + th + pad * 2],
                            radius=stroke * 2, fill=col)
        d.text((lx + pad, ly + pad - tb[1]), label, font=fnt,
               fill=(255, 255, 255, 255))

    im.convert("RGB").save(spec["out"], "PNG")
    print("saved:", spec["out"])

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('usage: annotate.py <spec.json>  — spec = {"src": screenshot.png, "annotations": [{type,color,xy,label}]}; red = actual, green = expected', file=sys.stderr)
        sys.exit(2)
    main(sys.argv[1])
