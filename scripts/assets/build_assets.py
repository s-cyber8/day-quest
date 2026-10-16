"""Asset pipeline: converts the supplied art to WebP and cuts every sprite out with rembg (local).
Usage: python3 -I scripts/assets/build_assets.py <src dir> <public dir>   (src = ~/Downloads/rafael-stories)
Raw downloads are never copied into the repo; only the converted outputs under public/assets."""
import sys, os, glob, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from segment import rough_boxes, sort_rows

SRC, PUB = sys.argv[1], sys.argv[2]
A = os.path.join(PUB, 'assets')

def webp(src, dst, width, q=80):
    im = Image.open(src).convert('RGB')
    if im.width > width: im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'WEBP', quality=q, method=6)

def convert_all():
    for p in sorted(glob.glob(f'{SRC}/chars/*.jpg')):
        webp(p, f'{A}/stories/chars/{os.path.basename(p)[:-4]}.webp', 1600, 78)
    for p in sorted(glob.glob(f'{SRC}/faces/*.jpg')):
        webp(p, f'{A}/stories/faces/{os.path.basename(p)[:-4]}.webp', 512, 82)
    for p in sorted(glob.glob(f'{SRC}/scenes/*.jpg')):
        webp(p, f'{A}/stories/scenes/{os.path.basename(p)[:-4]}.webp', 1280, 74)
    for p in sorted(glob.glob(f'{SRC}/game-art/bg-*.jpg')):
        webp(p, f'{A}/game/bg/{os.path.basename(p)[3:-4]}.webp', 900, 76)

_session = None
def rembg_rgba(img):
    global _session
    from rembg import remove, new_session
    if _session is None: _session = new_session('isnet-general-use')
    return remove(img, session=_session)

def decontaminate(rgba):
    """Source background is pure white: remove the white fringe from semi-transparent edge pixels."""
    a = np.asarray(rgba).astype(float)
    al = a[..., 3] / 255.0
    rgb = a[..., :3]
    out = rgb.copy()
    m = (al > 0.02) & (al < 0.98)
    out[m] = np.clip((rgb[m] - (1 - al[m, None]) * 255) / al[m, None], 0, 255)
    # shave a hairline: erode alpha slightly on the weakest fringe
    al2 = np.where(al < 0.12, 0, al)
    res = np.dstack([out, al2 * 255]).astype(np.uint8)
    return Image.fromarray(res, 'RGBA')

def keep_main(rgba, frac=0.0):
    """Drop stray specks: keep components of alpha (after small dilation) that hold >= frac of the largest one's area."""
    a = np.asarray(rgba)[..., 3] > 20
    d = ndi.binary_dilation(a, iterations=6)
    lab, n = ndi.label(d)
    if n <= 1: return rgba
    sizes = ndi.sum(a, lab, range(1, n + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s >= max(sizes) * max(frac, 0.02)]
    mask = np.isin(lab, keep)
    arr = np.asarray(rgba).copy(); arr[..., 3] = np.where(mask, arr[..., 3], 0)
    return Image.fromarray(arr, 'RGBA')

def trim(rgba, pad=4):
    bb = rgba.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
    if not bb: return rgba
    l, t, r, b = bb
    return rgba.crop((max(0, l - pad), max(0, t - pad), min(rgba.width, r + pad), min(rgba.height, b + pad)))

NOFILL = {'goal', 'monkey-bars', 'curtains', 'bubbles', 'lamp-on', 'lamp-off'}
def fill_interior(rgba, crop):
    """white-on-white areas (shirt stripes, ball patches) get a weak matte: make every enclosed hole opaque with the original colours."""
    a = np.asarray(rgba).astype(float)
    solid = a[..., 3] > 110
    core = ndi.binary_fill_holes(ndi.binary_closing(solid, iterations=3))
    inner = ndi.binary_erosion(core, iterations=2)
    o = np.asarray(crop.convert('RGB')).astype(float)
    rgb = np.where(inner[..., None], o, a[..., :3])
    al = np.where(inner, 255, a[..., 3])
    return Image.fromarray(np.dstack([rgb, al]).astype(np.uint8), 'RGBA')

def cut(img, box, pad=28, main_only=True, frac=0.0, fill=True):
    x0, y0, x1, y1 = box[:4]
    W, H = img.size
    crop = img.crop((max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)))
    # upscale small crops 2x so the matte has more detail to work with
    up = crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS)
    r = rembg_rgba(up)
    r = r.resize(crop.size, Image.LANCZOS)
    r = decontaminate(r)
    if fill: r = fill_interior(r, crop)
    if main_only: r = keep_main(r, frac)
    return trim(r)

def save_png(im, dst, maxside=512):
    s = maxside / max(im.size)
    if s < 1: im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'PNG', optimize=True)
    return im.size

NAMES = {
  'bath':    ['duck', 'bubbles', 'sponge', 'towel', 'foam'],
  'bedroom': ['lamp-on', 'lamp-off', 'alarm-clock', 'curtains', 'pillow'],
  'clothes': ['shirt-argentina', 'shorts-navy', 'raincoat-yellow', 'socks', 'sneakers', 'pajamas'],
  'food':    ['cereal-bowl', 'milk', 'toast', 'apple', 'banana', 'broccoli', 'chicken', 'sweet-potato', 'candy', 'plate', 'water-glass', 'spoon', 'fork'],
  'rewards': ['star', 'heart', 'medal', 'rainbow', 'trophy', 'calm-medal'],
  'sports':  ['football', 'goal', 'cone', 'cushion-blue', 'monkey-bars', 'trophy'],
  'teeth':   ['mouth', 'toothbrush', 'toothpaste', 'germ-1', 'germ-2', 'germ-3', 'germ-4'],
  'toys':    ['block-arch-red', 'block-cube-blue', 'block-bar-green', 'tile-square-red', 'tile-square-green',
              'block-cylinder', 'block-triangle-yellow', 'block-ramp-orange', 'tile-triangle-blue', 'tile-triangle-orange',
              'star-gold', 'tile-flat-blue', 'tile-triangle-orange-2', 'card-back', 'teddy'],
}
# sheet-specific rough-segmentation tuning
OPTS = {'bath': dict(dil=14, min_area=3000), 'rewards': dict(dil=14, min_area=8000), 'bedroom': dict(dil=14), 'clothes': dict(dil=14)}

def sprites():
    report = {}
    for sheet, names in NAMES.items():
        p = f'{SRC}/game-art/sprites-{sheet}.jpg'
        img = Image.open(p).convert('RGB')
        boxes = sort_rows(rough_boxes(p, **OPTS.get(sheet, dict(dil=9))))
        if sheet == 'bath':
            # the bubble cluster is split in several pieces by the mask: merge everything in the middle column
            mid = [b for b in boxes if 540 < (b[0] + b[2]) / 2 < 860 and b[3] < 400]
            rest = [b for b in boxes if b not in mid]
            merged = (min(b[0] for b in mid), min(b[1] for b in mid), max(b[2] for b in mid), max(b[3] for b in mid), 0)
            boxes = sort_rows(rest + [merged])
        if len(boxes) != len(names):
            print(f'!! {sheet}: expected {len(names)} objects, found {len(boxes)}: {boxes}'); report[sheet] = 'COUNT MISMATCH'; continue
        for nm, b in zip(names, boxes):
            im = cut(img, b, fill=nm not in NOFILL)
            sz = save_png(im, f'{A}/game/sprites/{sheet}/{nm}.png')
            print(f'{sheet}/{nm}.png {sz}')
        report[sheet] = len(names)
    return report

def confetti_bits():
    """Small confetti pieces from the rewards sheet (squares, swirls, stars) -> game/sprites/rewards/confetti-N.png"""
    p = f'{SRC}/game-art/sprites-rewards.jpg'
    img = Image.open(p).convert('RGB')
    boxes = rough_boxes(p, thr=30, dil=1, min_area=60)
    # skip the big objects (their bbox is much larger)
    bits = [b for b in boxes if (b[2] - b[0]) < 70 and (b[3] - b[1]) < 70 and b[4] > 60]
    n = 0
    for b in bits:
        x0, y0, x1, y1 = b[:4]
        crop = img.crop((x0 - 3, y0 - 3, x1 + 3, y1 + 3))
        arr = np.asarray(crop).astype(float)
        diff = (255 - arr).max(axis=2)
        al = np.clip((diff - 8) / 40, 0, 1)
        out = np.clip((arr - (1 - al[..., None]) * 255) / np.maximum(al[..., None], 0.05), 0, 255)
        rgba = Image.fromarray(np.dstack([out, al * 255]).astype(np.uint8), 'RGBA')
        rgba = trim(rgba, 1)
        if max(rgba.size) < 8: continue
        n += 1
        rgba = rgba.resize((rgba.width * 2, rgba.height * 2), Image.LANCZOS)
        rgba.save(f'{A}/game/sprites/rewards/confetti-{n}.png', optimize=True)
    print('confetti bits', n)
    return n

def refine_white():
    """White garments on the white sheet: rembg leaves ghost sleeves / notches. Use the colour-difference mask (closed + filled),
    limited to the neighbourhood of the rembg cut-out so cast shadows are not included."""
    img = Image.open(f'{SRC}/game-art/sprites-clothes.jpg').convert('RGB')
    boxes = sort_rows(rough_boxes(f'{SRC}/game-art/sprites-clothes.jpg', dil=14))
    for name, b in [('shirt-argentina', boxes[0]), ('pajamas', boxes[5])]:
        x0, y0, x1, y1 = [int(v) for v in b[:4]]
        pad = 20; box = (max(0, x0 - pad), max(0, y0 - pad), min(img.width, x1 + pad), min(img.height, y1 + pad))
        crop = img.crop(box); arr = np.asarray(crop).astype(float)
        diff = (255 - arr).max(axis=2)
        m = diff > 19
        m = ndi.binary_closing(m, iterations=4); m = ndi.binary_fill_holes(m)
        m = ndi.binary_opening(m, iterations=2)
        lab, n = ndi.label(ndi.binary_dilation(m, iterations=3))
        if name == 'pajamas':
            keep = m
        else:
            sizes = ndi.sum(m, lab, range(1, n + 1)); keep = m & (lab == (1 + int(np.argmax(sizes))))
        al = ndi.gaussian_filter(keep.astype(float), 0.9)
        out = np.clip((arr - (1 - al[..., None]) * 255) / np.maximum(al[..., None], 0.3), 0, 255)
        rgba = trim(Image.fromarray(np.dstack([out, al * 255]).astype(np.uint8), 'RGBA'))
        print(name, save_png(rgba, f'{A}/game/sprites/clothes/{name}.png'))

def curtain_halves():
    im = Image.open(f'{A}/game/sprites/bedroom/curtains.png').convert('RGBA'); w, h = im.size
    im.crop((0, 0, w // 2, h)).save(f'{A}/game/sprites/bedroom/curtain-left.png', optimize=True)
    im.crop((w // 2, 0, w, h)).save(f'{A}/game/sprites/bedroom/curtain-right.png', optimize=True)

def bubble_bits():
    """Single soap bubbles from the bath sheet (transparent: alpha comes from the difference to the white background)."""
    img = Image.open(f'{SRC}/game-art/sprites-bath.jpg').convert('RGB')
    for n, (x0, y0, x1, y1) in enumerate([(560, 86, 642, 170), (730, 82, 834, 186), (664, 308, 740, 384), (790, 184, 828, 220)], 1):
        crop = img.crop((x0, y0, x1, y1)); arr = np.asarray(crop).astype(float)
        diff = (255 - arr).max(axis=2); al = np.clip((diff - 3) / 30, 0, 1)
        out = np.clip((arr - (1 - al[..., None]) * 255) / np.maximum(al[..., None], 0.05), 0, 255)
        # soft-edge the crop so a neighbouring bubble does not leave a hard cut
        yy, xx = np.mgrid[0:arr.shape[0], 0:arr.shape[1]]; cx, cy = arr.shape[1] / 2, arr.shape[0] / 2
        r = np.hypot((xx - cx) / cx, (yy - cy) / cy); al *= np.clip((1.0 - r) / 0.12, 0, 1)
        rgba = Image.fromarray(np.dstack([out, al * 255]).astype(np.uint8), 'RGBA')
        rgba = rgba.resize((rgba.width * 2, rgba.height * 2), Image.LANCZOS)
        os.makedirs(f'{A}/game/sprites/bath', exist_ok=True); rgba.save(f'{A}/game/sprites/bath/bubble-{n}.png', optimize=True)

def moka_and_aviv():
    # five poses
    p = f'{SRC}/chars/moka-poses.jpg'
    img = Image.open(p).convert('RGB')
    # concerned and sleepy touch each other, so the boxes are fixed by hand (x,y ranges read off the sheet)
    boxes = [(0, 150, 330, 640), (300, 165, 575, 640), (520, 380, 870, 640), (800, 180, 1095, 645), (1065, 150, 1365, 590)]
    names = ['happy', 'concerned', 'sleepy', 'walk', 'jump']
    for nm, b in zip(names, boxes):
        im = cut(img, b, pad=0, frac=0.08)
        print('moka', nm, save_png(im, f'{A}/moka/{nm}.png', 560))
    # front view of the 3-view sheet -> idle
    p = f'{SRC}/chars/moka-sheet.jpg'
    img = Image.open(p).convert('RGB')
    boxes = sort_rows(rough_boxes(p, thr=40, dil=2, min_area=4000), row_tol=400)
    print('moka sheet boxes', boxes)
    im = cut(img, boxes[0], pad=20, frac=0.08)
    print('moka idle', save_png(im, f'{A}/moka/idle.png', 560))
    # Aviv front view (goalie / defender)
    p = f'{SRC}/chars/aviv-sheet.jpg'
    img = Image.open(p).convert('RGB')
    boxes = sort_rows(rough_boxes(p, thr=40, dil=2, min_area=4000), row_tol=400)
    print('aviv boxes', boxes)
    im = cut(img, boxes[0], pad=20, frac=0.08)
    print('aviv', save_png(im, f'{A}/game/sprites/chars/aviv.png', 560))

if __name__ == '__main__':
    what = sys.argv[3:] or ['convert', 'sprites', 'confetti', 'bubbles', 'moka']
    if 'convert' in what: convert_all()
    if 'sprites' in what: print(json.dumps(sprites()))
    if 'confetti' in what: confetti_bits()
    if 'refine' in what: refine_white()
    if 'bubbles' in what: bubble_bits()
    if 'curtains' in what or 'sprites' in what: curtain_halves()
    if 'moka' in what: moka_and_aviv()
