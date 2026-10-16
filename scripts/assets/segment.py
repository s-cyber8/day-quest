"""Rough object segmentation of a white-background sprite sheet: returns bounding boxes (x0,y0,x1,y1) sorted row-major."""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def rough_boxes(path, thr=14, dil=9, min_area=900):
    im = np.asarray(Image.open(path).convert('RGB')).astype(int)
    diff = (255 - im).max(axis=2)
    m = diff > thr
    m = ndi.binary_opening(m, iterations=1)
    md = ndi.binary_dilation(m, iterations=dil)
    lab, n = ndi.label(md)
    boxes = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        area = (m[sl] & (lab[sl] == i)).sum()
        if area < min_area: continue
        boxes.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop, int(area)))
    return boxes

def sort_rows(boxes, row_tol=140):
    boxes = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    rows = []
    for b in boxes:
        cy = (b[1] + b[3]) / 2
        if rows and abs(cy - np.mean([(r[1] + r[3]) / 2 for r in rows[-1]])) < row_tol: rows[-1].append(b)
        else: rows.append([b])
    out = []
    for r in rows: out += sorted(r, key=lambda b: (b[0] + b[2]) / 2)
    return out

if __name__ == '__main__':
    import sys, glob
    for p in sorted(glob.glob(sys.argv[1] + '/game-art/sprites-*.jpg')):
        bs = sort_rows(rough_boxes(p))
        print(p.split('/')[-1], len(bs))
        for b in bs: print('   ', b)
