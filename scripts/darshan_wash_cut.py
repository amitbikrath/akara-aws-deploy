"""Cut Darśana side-art panels from a 4x-upscaled mockup (see upscale_x4.py).
Paper becomes transparent (colour-to-alpha); the edge toward the page centre and the top/bottom fade out
so panels stack down the page. Writes NAME.webp (1200 px wide) and NAME-s.webp (600 px wide, phones).
Usage: python3 darshan_wash_cut.py up.png OUTDIR NAME x0 x1 l|r   (x0/x1 in ORIGINAL 1x pixels)"""
import sys, numpy as np
from PIL import Image
src, out, name, x0, x1, side = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]), sys.argv[6]
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
paper = np.percentile(im[::8, ::8].reshape(-1, 3), 75, axis=0)
c = im[:, x0 * 4:x1 * 4]
d = np.clip((paper - c) / np.maximum(paper, 1e-3), 0, 1); a = d.max(axis=2)
a = np.clip((a - 0.035) / 0.965, 0, 1); a[a < 0.02] = 0
col = np.clip(paper - (paper - c) / np.maximum(a, 1e-3)[..., None], 0, 1)
h, w = a.shape; x = np.linspace(0, 1, w); y = np.linspace(0, 1, h)
fx = np.clip((1 - x) / 0.35, 0, 1) if side == 'l' else np.clip(x / 0.35, 0, 1)
fy = np.clip(np.minimum(y, 1 - y) / 0.12, 0, 1)
fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
a = a * fx[None, :] * fy[:, None]
img = Image.fromarray((np.dstack([col, a]) * 255 + .5).astype(np.uint8), 'RGBA')
for suffix, W in (('', 1200), ('-s', 600)):
    img.resize((W, round(h * W / w)), Image.LANCZOS).save(f'{out}/{name}{suffix}.webp', quality=80, method=6)
print(name, w // 4, 'x', h // 4, 'paper', (paper * 255).round())
