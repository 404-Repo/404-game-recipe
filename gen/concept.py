#!/usr/bin/env python3
"""Stage 1: Atlas concept images -> what the 404 generator eats.

The 404 generator takes IMAGES, not text: one per asset, single subject,
centred, plain white background, 3/4 view, ~1024x1024. This produces exactly
that, so stage 2 (explore.py) can turn each into Three.js modules.

Two things carried over from the COD asset work, both of which cost real money
to learn:

  * Generate against an EMPTY style reference. The graph paints a scene from the
    reference then segments the requested object out of it; with a busy
    reference the segmentation grabs the reference's dominant object instead, so
    asking for a bollard hands you back a burnt-out car. A plain background
    reference gave 20/20 clean results where a themed one gave about 1 in 15.
  * Composite output_image through object_mask onto white, then crop to the
    subject. The raw output has scene context around it that the generator would
    otherwise try to model.

Style is pinned ONCE here and never varied per object. Live generation drifts
otherwise, which is how an earlier pack ended up with racing livery on rocks.

Usage:
  python3 concept.py objects.json -o out/concepts
"""
import argparse
import io
import json
import os
import sys
import time
from pathlib import Path

import requests
from PIL import Image

API_BASE = 'https://api.prod-market.atlas.design/0.2'
OBJECT_API = '12156c41-4e87-498d-a3a6-efac95dd1d74'   # gta_object_v1 (re-exported after model fix)
# Env var first so this works for anyone who clones the repo; the file is a
# convenience for people who already keep a key there. No key ships in this repo.
KEY = os.environ.get('ATLAS_API_KEY', '').strip()
if not KEY:
    _f = Path(os.path.expanduser('~/.claude/atlas_api_key'))
    if _f.exists():
        KEY = _f.read_text().strip()
if not KEY:
    sys.exit('Set ATLAS_API_KEY (an Atlas workspace key, atk_...). '
             'See gen/README.md for the no-Atlas path.')
H = {'Authorization': f'Bearer {KEY}'}


def upload_image(png_bytes: bytes, name: str) -> str:
    """Upload a PNG, return the opaque id the graph expects for an image input."""
    r = requests.post(f'{API_BASE}/upload', headers=H,
                      files={'file': (name, png_bytes, 'image/png')}, timeout=120)
    r.raise_for_status()
    body = r.json()
    for k in ('result_id', 'id', 'file_id', 'value'):
        if isinstance(body, dict) and body.get(k):
            return body[k]
    if isinstance(body, str):
        return body
    raise RuntimeError(f'unexpected upload response: {body!r}')


def white_reference(size: int = 1024) -> bytes:
    """The empty reference. Deliberately featureless — see the note up top."""
    buf = io.BytesIO()
    Image.new('RGB', (size, size), (255, 255, 255)).save(buf, 'PNG')
    return buf.getvalue()


def download(result_id: str) -> Image.Image:
    r = requests.get(f'{API_BASE}/download_binary_result/{result_id}', headers=H, timeout=180)
    r.raise_for_status()
    return Image.open(io.BytesIO(r.content)).convert('RGBA')


def cutout(img: Image.Image, mask: Image.Image, size: int = 1024, pad: float = 0.06) -> Image.Image:
    """Mask the subject onto white, crop to it, square it, resize."""
    mask = mask.convert('L').resize(img.size, Image.LANCZOS)
    rgb = img.convert('RGB')
    white = Image.new('RGB', img.size, (255, 255, 255))
    comped = Image.composite(rgb, white, mask)

    bbox = mask.point(lambda v: 255 if v > 24 else 0).getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        w, h = x1 - x0, y1 - y0
        side = int(max(w, h) * (1 + pad * 2))
        cx, cy = x0 + w // 2, y0 + h // 2
        left, top = cx - side // 2, cy - side // 2
        square = Image.new('RGB', (side, side), (255, 255, 255))
        square.paste(comped.crop((max(0, left), max(0, top),
                                  min(comped.width, left + side),
                                  min(comped.height, top + side))),
                     (max(0, -left), max(0, -top)))
        comped = square
    return comped.resize((size, size), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('spec', help='JSON: {"style": str, "theme": str, "objects": [{"name","desc","seed"}]}')
    ap.add_argument('-o', '--out', required=True)
    args = ap.parse_args()

    spec = json.loads(Path(args.spec).read_text())
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    (out / '_raw').mkdir(exist_ok=True)

    print('uploading the empty style reference…')
    ref_id = upload_image(white_reference(), 'white_ref.png')
    print('  ref id:', ref_id)

    ok, failed = [], []
    for i, obj in enumerate(spec['objects'], 1):
        name = obj['name']
        dest = out / f'{name}.png'
        if dest.exists():
            print(f'[{i}/{len(spec["objects"])}] {name} — already have it')
            ok.append(name); continue
        print(f'[{i}/{len(spec["objects"])}] {name} …', end='', flush=True)
        t0 = time.time()
        try:
            r = requests.post(
                f'{API_BASE}/api_execute/{OBJECT_API}', headers=H, timeout=900,
                json={
                    'Object_Type': obj['desc'],
                    'Asset_Theme_Context': spec['theme'],
                    'Asset_Art_Style': spec['style'],       # pinned, never per-object
                    'Background_Style_Reference': ref_id,
                    'seed': obj.get('seed', 42),
                })
            r.raise_for_status()
            res = r.json()
            outs = res.get('outputs', res)
            img = download(outs['output_image'] if isinstance(outs['output_image'], str)
                           else outs['output_image']['value'])
            msk = download(outs['object_mask'] if isinstance(outs['object_mask'], str)
                           else outs['object_mask']['value'])
            img.convert('RGB').save(out / '_raw' / f'{name}_raw.png')
            cutout(img, msk).save(dest)
            print(f' ok ({time.time() - t0:.0f}s)')
            ok.append(name)
        except Exception as e:
            print(f' FAILED: {str(e)[:120]}')
            failed.append(name)

    print(f'\n{len(ok)} ok, {len(failed)} failed')
    if failed:
        print('failed:', ', '.join(failed))
        sys.exit(2)


if __name__ == '__main__':
    main()
