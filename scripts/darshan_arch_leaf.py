"""Gold-leaf edge for the Darśana arch: a ragged gold band just inside the frame line, at the bottom-left
corner and on the top-right curve only (it never reaches more than ~3% into the picture).
Writes arch-leaf.webp at the arch's own aspect (4:5.4); the page lays it over the arch with inset:0."""
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
out = sys.argv[1]
W, H = 800, 1080
def bez(p0, p1, p2, p3, n=60):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3
P = lambda x, y: np.array([x, y])
pts = [P(0, 1), P(0, .40)]
for a, b, c, d in [((0, .40), (0, .20), (.26, .13), (.36, .07)), ((.36, .07), (.43, .03), (.47, .02), (.5, 0)),
                   ((.5, 0), (.53, .02), (.57, .03), (.64, .07)), ((.64, .07), (.74, .13), (1, .20), (1, .40))]:
    pts += list(bez(P(*a), P(*b), P(*c), P(*d)))
pts += [P(1, 1)]
poly = [(x * W, y * H) for x, y in pts]
inside = Image.new('L', (W, H), 0); ImageDraw.Draw(inside).polygon(poly, fill=255)
PAD = 40   # erode on a padded canvas, or the image border counts as 'inside' and the straight edges get no band
padded = Image.new('L', (W + 2 * PAD, H + 2 * PAD), 0); padded.paste(inside, (PAD, PAD))
def band(px):  # inner band px wide
    e = padded.filter(ImageFilter.MinFilter(2 * px + 1)).crop((PAD, PAD, PAD + W, PAD + H))
    return np.asarray(inside, np.float32) / 255 - np.asarray(e, np.float32) / 255
rng = np.random.default_rng(11)
def noise(cut, seed):
    r = np.random.default_rng(seed); f = np.fft.fftfreq(W)[None, :], np.fft.fftfreq(H)[:, None]
    k = np.sqrt(f[0] ** 2 + f[1] ** 2); k[0, 0] = 1; a = 1 / k ** 1.6; a[k > cut] = 0; a[0, 0] = 0
    z = np.real(np.fft.ifft2(np.fft.fft2(r.standard_normal((H, W))) * a)); return (z - z.min()) / (z.max() - z.min())
yy, xx = np.mgrid[0:H, 0:W] / np.array([H, W])[:, None, None]
# where leaf may grow: bottom-left corner and the top-right shoulder of the arch
zone = np.clip(((xx < .34) & (yy > .64)) * 1.0 + ((xx > .62) & (yy < .36)) * 1.0, 0, 1)
zone = np.asarray(Image.fromarray((zone * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(40)), np.float32) / 255
n1, n2 = noise(.05, 3), noise(.18, 4)
thin, wide = band(9), band(24)                     # 6 px along the line, torn flakes up to 24 px (3% of 800)
leaf = np.clip(thin * (n1 > .18) * (zone > .3) + wide * ((n1 > .45) & (n2 > .38)) * (zone > .62), 0, 1)   # torn part only near the corner's middle
# loose flakes just inside the band, like leaf that broke off
d = ImageDraw.Draw(fl := Image.new('L', (W, H), 0)); r = np.random.default_rng(9)
cand = np.argwhere((band(40) > .5) & (zone > .5)); 
for y, x in cand[r.choice(len(cand), 26, replace=False)]:
    k = r.integers(3, 7); rad = r.uniform(2, 6); ang = np.sort(r.uniform(0, 2 * np.pi, k))
    d.polygon([(x + rad * np.cos(a) * r.uniform(.6, 1.3), y + rad * np.sin(a) * r.uniform(.6, 1.3)) for a in ang], fill=255)
leaf = np.clip(leaf + np.asarray(fl, np.float32) / 255 * (np.asarray(inside, np.float32) / 255) * (zone > .5), 0, 1) * np.clip(zone * 1.8, 0, 1)   # taper out, no hard ends
leaf = np.asarray(Image.fromarray((leaf * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.8)), np.float32) / 255
crinkle = noise(.25, 5)                            # leaf texture: bright and dark gold facets
gold_lo, gold_hi = np.array([150, 108, 40]), np.array([246, 218, 142])
t = np.clip((crinkle - .3) / .5, 0, 1)[..., None]
rgb = gold_lo * (1 - t) + gold_hi * t
Image.fromarray(np.dstack([rgb, leaf * 255]).astype(np.uint8), 'RGBA').save(out, quality=85, method=6)
print(out, 'leaf px', int((leaf > .5).sum()))
