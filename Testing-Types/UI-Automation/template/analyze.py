# UI-Automation kit — DOM snapshot inventory extractor (QA-SetupKit/Testing-Types/UI-Automation)
# Usage: python3 analyze.py <dom-snapshots-dir> <output-json>
# Per snapshot extracts: form fields (aria-label/placeholder + kind), buttons
# (aria-label/title), tabs, grid column markers, detail-registry markers.
# The curated locators/*.json, LOCATORS.md and page objects are authored FROM this.
import re, json, glob, html as H, os, sys

def clean(s):
    return H.unescape(re.sub(r'\s+', ' ', s or '').strip())

def dedup(seq):
    seen = set()
    return [x for x in seq if x and not (x in seen or seen.add(x))]

if len(sys.argv) < 3:
    print("usage: analyze.py <dom-snapshots-dir> <out.json>", file=sys.stderr)
    sys.exit(2)
src_dir, out_path = sys.argv[1], sys.argv[2]
inv = {}
for f in sorted(glob.glob(os.path.join(src_dir, '*.html'))):
    html = open(f, encoding='utf-8', errors='replace').read()
    fields = []
    for m in re.finditer(r'<(input|textarea)([^>]*)>', html):
        attrs = m.group(2)
        al = re.search(r'aria-label="([^"]*)"', attrs)
        ph = re.search(r'placeholder="([^"]*)"', attrs)
        if not (al or ph):
            continue
        kind = ('number' if 'crtnumbercontrol' in attrs
                else 'lookup' if 'autocomplete-trigger' in attrs
                else 'textarea' if m.group(1) == 'textarea' else 'text')
        fields.append({'label': clean((al or ph).group(1)), 'kind': kind})
    seen = set()
    d = {'fields': [x for x in fields if not (x['label'] in seen or seen.add(x['label']))]}
    btns = []
    for m in re.finditer(r'<button([^>]*)>', html):
        a = m.group(1)
        al = re.search(r'aria-label="([^"]*)"', a)
        ti = re.search(r'title="([^"]*)"', a)
        if al or ti:
            btns.append(clean((al or ti).group(1)))
    d['buttons'] = dedup(btns)
    d['tabs'] = dedup(clean(t) for t in re.findall(
        r'role="tab"[^>]*>.*?(?:__text-label[^>]*>|>)\s*([^<]{2,60})<', html))
    d['grid_columns'] = dedup(clean(c) for c in re.findall(r'data-item-marker="([^"]+) column"', html))
    d['detail_registries'] = dedup(clean(c) for c in re.findall(
        r'aria-label="Додати колонки до Реєстр ([^"]+)"', html))
    d['data_markers'] = dedup(clean(c) for c in re.findall(r'data-item-marker="([^"]{2,60})"', html))[:80]
    inv[os.path.basename(f).replace('.html', '')] = d

os.makedirs(os.path.dirname(out_path), exist_ok=True)
json.dump(inv, open(out_path, 'w'), ensure_ascii=False, indent=1)
for k, v in inv.items():
    print(f"{k}: fields={len(v['fields'])} buttons={len(v['buttons'])} "
          f"tabs={v['tabs'][:6]} registries={v['detail_registries']}")
