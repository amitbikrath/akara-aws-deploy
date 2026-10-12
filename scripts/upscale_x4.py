"""Real-ESRGAN x4plus upscale, no extra packages: torch + the RRDBNet net below.
Usage: "/Volumes/AKARA SSD/projects/realsr/bin/python" upscale_x4.py in.png out.png
Weights: /Volumes/AKARA SSD/projects/weights/RealESRGAN_x4plus.pth. Runs on Apple GPU (mps) in tiles."""
import sys, numpy as np, torch, torch.nn as nn, torch.nn.functional as F
from PIL import Image
W = '/Volumes/AKARA SSD/projects/weights/RealESRGAN_x4plus.pth'

class RDB(nn.Module):
    def __init__(s, f=64, g=32):
        super().__init__()
        s.conv1 = nn.Conv2d(f, g, 3, 1, 1); s.conv2 = nn.Conv2d(f + g, g, 3, 1, 1); s.conv3 = nn.Conv2d(f + 2 * g, g, 3, 1, 1)
        s.conv4 = nn.Conv2d(f + 3 * g, g, 3, 1, 1); s.conv5 = nn.Conv2d(f + 4 * g, f, 3, 1, 1); s.l = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        x1 = s.l(s.conv1(x)); x2 = s.l(s.conv2(torch.cat((x, x1), 1))); x3 = s.l(s.conv3(torch.cat((x, x1, x2), 1)))
        x4 = s.l(s.conv4(torch.cat((x, x1, x2, x3), 1))); return s.conv5(torch.cat((x, x1, x2, x3, x4), 1)) * 0.2 + x
class RRDB(nn.Module):
    def __init__(s, f=64):
        super().__init__(); s.rdb1 = RDB(f); s.rdb2 = RDB(f); s.rdb3 = RDB(f)
    def forward(s, x): return s.rdb3(s.rdb2(s.rdb1(x))) * 0.2 + x
class RRDBNet(nn.Module):
    def __init__(s, f=64, n=23):
        super().__init__()
        s.conv_first = nn.Conv2d(3, f, 3, 1, 1); s.body = nn.Sequential(*[RRDB(f) for _ in range(n)]); s.conv_body = nn.Conv2d(f, f, 3, 1, 1)
        s.conv_up1 = nn.Conv2d(f, f, 3, 1, 1); s.conv_up2 = nn.Conv2d(f, f, 3, 1, 1); s.conv_hr = nn.Conv2d(f, f, 3, 1, 1)
        s.conv_last = nn.Conv2d(f, 3, 3, 1, 1); s.l = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        fe = s.conv_first(x); fe = fe + s.conv_body(s.body(fe))
        fe = s.l(s.conv_up1(F.interpolate(fe, scale_factor=2, mode='nearest')))
        fe = s.l(s.conv_up2(F.interpolate(fe, scale_factor=2, mode='nearest')))
        return s.conv_last(s.l(s.conv_hr(fe)))

def main(src, dst, tile=256, pad=16):
    dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
    net = RRDBNet(); sd = torch.load(W, map_location='cpu'); net.load_state_dict(sd.get('params_ema', sd.get('params', sd)), strict=True)
    net.eval().to(dev)
    img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
    h, w, _ = img.shape; out = np.zeros((h * 4, w * 4, 3), np.float32)
    t = torch.from_numpy(img).permute(2, 0, 1)[None]
    with torch.no_grad():
        for y in range(0, h, tile):
            for x in range(0, w, tile):
                y0, x0, y1, x1 = max(y - pad, 0), max(x - pad, 0), min(y + tile + pad, h), min(x + tile + pad, w)
                r = net(t[:, :, y0:y1, x0:x1].to(dev)).clamp(0, 1).cpu()[0].permute(1, 2, 0).numpy()
                ty1, tx1 = min(y + tile, h), min(x + tile, w)
                out[y * 4:ty1 * 4, x * 4:tx1 * 4] = r[(y - y0) * 4:(ty1 - y0) * 4, (x - x0) * 4:(tx1 - x0) * 4]
    Image.fromarray((out * 255 + .5).astype(np.uint8)).save(dst); print(dst, out.shape[1], 'x', out.shape[0], 'on', dev)

if __name__ == '__main__': main(sys.argv[1], sys.argv[2])
