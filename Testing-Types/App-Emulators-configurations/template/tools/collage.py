#!/usr/bin/env python3
"""Combine several screenshots into ONE evidence image: side-by-side panels,
label chip above each, optional red/green annotations per panel (same
semantics as annotate.py: red = problem zone, green = expected).

Usage: collage.py spec.json
Spec:
{
  "out": "collage.png",
  "height": 1600,            // common panel height (px), optional
  "panels": [
    { "src": "a.png", "label": "Library — My Books",
      "annotations": [ {"xy":[x1,y1,x2,y2], "color":"red", "label":"no cover",
                        "labelPos":"above"|"below"} ] }   // coords in SOURCE px
  ]
}
"""
import json, sys
from PIL import Image, ImageDraw, ImageFont

COLORS = {"red": (229, 52, 43, 255), "green": (30, 158, 74, 255)}
BG = (43, 43, 43)
CHIP = (24, 24, 24)

def font(size):
    for p in ("/System/Library/Fonts/Helvetica.ttc",
              "/System/Library/Fonts/SFNS.ttf"):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()

def main(spec_path):
    spec = json.load(open(spec_path))
    H = spec.get("height", 1600)
    GAP = 28
    panels = []
    for p in spec["panels"]:
        im = Image.open(p["src"]).convert("RGB")
        k = H / im.height
        im = im.resize((round(im.width * k), H), Image.LANCZOS)
        panels.append((im, p, k))

    header = 96
    W = sum(im.width for im, _, _ in panels) + GAP * (len(panels) + 1)
    out = Image.new("RGB", (W, H + header + GAP), BG)
    d = ImageDraw.Draw(out)
    fnt = font(40)
    afnt = font(max(24, H // 45))

    x = GAP
    for im, p, k in panels:
        out.paste(im, (x, header))
        pd = ImageDraw.Draw(out)
        stroke = max(4, im.width // 200)
        pad = stroke * 2
        for a in p.get("annotations", []):
            col = COLORS[a.get("color", "red")]
            x1, y1, x2, y2 = [round(v * k) for v in a["xy"]]
            x1 += x; x2 += x; y1 += header; y2 += header
            pd.rounded_rectangle([x1, y1, x2, y2], radius=stroke * 3,
                                 outline=col, width=stroke)
            label = a.get("label")
            if not label:
                continue
            tb = pd.textbbox((0, 0), label, font=afnt)
            tw, th = tb[2] - tb[0], tb[3] - tb[1]
            pos = a.get("labelPos", "below")
            ly = y2 + pad if pos == "below" else y1 - th - pad * 3
            ly = min(max(header, ly), H + header - th - pad * 2)
            lx = min(max(x, x1), x + im.width - tw - pad * 2)
            pd.rounded_rectangle([lx, ly, lx + tw + pad * 2, ly + th + pad * 2],
                                 radius=stroke * 2, fill=col)
            pd.text((lx + pad, ly + pad - tb[1]), label, font=afnt,
                    fill=(255, 255, 255))
        # label chip centered above the panel
        label = p.get("label", "")
        if label:
            tb = d.textbbox((0, 0), label, font=fnt)
            tw, th = tb[2] - tb[0], tb[3] - tb[1]
            lx = x + (im.width - tw) // 2 - 16
            d.rounded_rectangle([lx, (header - th - 20) // 2,
                                 lx + tw + 32, (header - th - 20) // 2 + th + 20],
                                radius=12, fill=CHIP)
            d.text((lx + 16, (header - th - 20) // 2 + 10 - tb[1]), label,
                   font=fnt, fill=(255, 255, 255))
        x += im.width + GAP

    out.save(spec["out"], "PNG")
    print("saved:", spec["out"])

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('usage: collage.py <spec.json>  — spec = {"panels": [{src,label}], "height"?}; app+API (backend bug) or screen+Figma (frontend bug)', file=sys.stderr)
        sys.exit(2)
    main(sys.argv[1])
