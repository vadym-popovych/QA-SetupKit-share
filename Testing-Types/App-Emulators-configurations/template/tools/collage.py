#!/usr/bin/env python3
"""Combine several screenshots into ONE evidence image: side-by-side panels,
label chip above each, optional red/green annotations per panel (same
semantics as annotate.py: red = problem zone, green = expected).

Usage: collage.py spec.json
Spec:
{
  "out": "collage.png",
  "height": 1600,            // common panel height (px), optional
  "arrow"?: {"from":[panelIdx,x,y], "to":[panelIdx,x,y], "color"?}, // endpoints in SOURCE px
  "panels": [
    { "src": "a.png", "label": "Library — My Books",
      "annotations": [ {"xy":[x1,y1,x2,y2], "color":"red", "label":"no cover",
                        "labelPos":"above"|"below", "arrow":true} ] }  // coords in SOURCE px;
                       // arrow:true points into the box in the box's own colour
  ]
}
"""
import json, sys, math
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

    grays = {id(im): im.convert("L") for im, _, _ in panels}
    x = GAP
    for im, p, k in panels:
        boxes_local = p.get("annotations", [])
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
            # "arrow": true on an annotation draws a pointer INTO the box, in the box's own colour —
            # red points at the defect, green at how the design has it (owner, 17/08/2026). A frame
            # says "here"; an arrow says "look at this", which is what a reader scanning a wide
            # collage actually needs.
            if a.get("arrow"):
                # Pick the approach direction by looking at the picture instead of assuming one:
                # sample the corridor each candidate would cross and take the CALMEST one, so the
                # arrow lands over empty background rather than across a heading, a button or a
                # neighbouring annotation (owner, 17/08/2026 — the first version crossed the hero
                # copy because it only ever knew "above" and "below").
                gray = grays[id(im)]
                others = [b for b in boxes_local if b is not a]
                span = max(70, min(240, im.width // 6))
                cands = []
                for deg in range(0, 360, 15):
                    r = math.radians(deg)
                    ex_l = ((x1 - x) + (x2 - x)) / 2 + math.cos(r) * ((x2 - x1) / 2 + stroke)
                    ey_l = ((y1 - header) + (y2 - header)) / 2 + math.sin(r) * ((y2 - y1) / 2 + stroke)
                    sx_l, sy_l = ex_l + math.cos(r) * span, ey_l + math.sin(r) * span
                    if not (4 <= sx_l < im.width - 4 and 4 <= sy_l < im.height - 4):
                        continue
                    energy, prev = 0.0, None
                    hits_other = False
                    for t in range(0, 21):
                        px_ = sx_l + (ex_l - sx_l) * t / 20
                        py_ = sy_l + (ey_l - sy_l) * t / 20
                        if not (0 <= px_ < im.width and 0 <= py_ < im.height):
                            energy += 500; continue
                        for ob in others:                       # never run through another callout
                            ox1, oy1, ox2, oy2 = [round(v * k) for v in ob["xy"]]
                            if ox1 - 8 <= px_ <= ox2 + 8 and oy1 - 8 <= py_ <= oy2 + 8:
                                hits_other = True
                        v = gray.getpixel((int(px_), int(py_)))
                        if prev is not None:
                            energy += abs(v - prev)             # detail crossed = contrast changes
                        prev = v
                    if hits_other:
                        energy += 5000
                    cands.append((energy, sx_l, sy_l, ex_l, ey_l))
                if cands:
                    _, sx_l, sy_l, ex_l, ey_l = min(cands, key=lambda c: c[0])
                    sx, sy = x + round(sx_l), header + round(sy_l)
                    ex, ey = x + round(ex_l), header + round(ey_l)
                    pd.line([(sx, sy), (ex, ey)], fill=col, width=max(3, stroke - 1))
                    ang = math.atan2(ey - sy, ex - sx)
                    hd = max(14, stroke * 5)
                    pd.polygon([(ex, ey),
                                (ex - hd * math.cos(ang - math.pi / 7), ey - hd * math.sin(ang - math.pi / 7)),
                                (ex - hd * math.cos(ang + math.pi / 7), ey - hd * math.sin(ang + math.pi / 7))],
                               fill=col)
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

    # Optional arrow between two panels: "this control produced that screen".
    # Two boxes side by side say "here are two screens"; an arrow says WHY the second one is
    # there, which is the whole claim of a click-leads-somewhere bug (owner's format, 17/08/2026).
    # Endpoints are given in SOURCE pixels of their own panel: {"from":[i,x,y], "to":[j,x,y]}.
    arrow = spec.get("arrow")
    if arrow:
        geom = []           # (x_offset, scale) per panel, recomputed the same way as above
        xx = GAP
        for im, _p, k in panels:
            geom.append((xx, k))
            xx += im.width + GAP
        def pt(spec_pt):
            i, px, py = spec_pt
            ox, k = geom[i]
            return (ox + round(px * k), header + round(py * k))
        x1, y1 = pt(arrow["from"]); x2, y2 = pt(arrow["to"])
        col = COLORS[arrow.get("color", "red")]
        w = max(5, H // 240)
        d.line([(x1, y1), (x2, y2)], fill=col, width=w)
        ang = math.atan2(y2 - y1, x2 - x1)
        head = w * 7
        d.polygon([(x2, y2),
                   (x2 - head * math.cos(ang - math.pi / 7), y2 - head * math.sin(ang - math.pi / 7)),
                   (x2 - head * math.cos(ang + math.pi / 7), y2 - head * math.sin(ang + math.pi / 7))],
                  fill=col)

    out.save(spec["out"], "PNG")
    print("saved:", spec["out"])

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('usage: collage.py <spec.json>  — spec = {"panels": [{src,label,annotations?}], "height"?, '
              '"arrow"?: {"from":[panelIdx,x,y],"to":[panelIdx,x,y]}}; app+API (backend bug), '
              'screen+Figma (frontend bug), or control+resulting-page (a click that leaves the site)', file=sys.stderr)
        sys.exit(2)
    main(sys.argv[1])
