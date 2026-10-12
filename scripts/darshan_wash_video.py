# Usage: darshan_wash_video.py clip.mp4 out.mp4 WIDTH l|r [R,G,B paper]
# Make a Darśana wash clip page-ready: paper -> pure white (so multiply blend leaves any light theme untouched)
# and the panel's own edge fades baked in as fades to white. Writes a white RGBA mask, ffmpeg does the rest.
import sys, subprocess, numpy as np
from PIL import Image
src, dst, W = sys.argv[1], sys.argv[2], int(sys.argv[3])
side = sys.argv[4] if len(sys.argv) > 4 else 'l'   # l: page centre is to the right; r: to the left
H = W * 4 // 3
paper = [int(v) for v in sys.argv[5].split(',')] if len(sys.argv) > 5 else [240, 232, 216]
# Panel fades in original-pixel space: panel 600 x 874, clip covers its top 600 x 800.
x = np.linspace(0, 1, W); y = np.linspace(0, 800, H)
fx = np.clip(((1 - x) if side == 'l' else x) / 0.35, 0, 1); fy = np.clip(np.minimum(np.minimum(y, 874 - y) / (0.12 * 874), (800 - y) / 90), 0, 1)   # also fade out at the clip's own bottom
fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
a = fy[:, None] * fx[None, :]
m = np.dstack([np.full((H, W, 3), 255, np.uint8), ((1 - a) * 255 + .5).astype(np.uint8)])
Image.fromarray(m, 'RGBA').save(dst + '.mask.png')
lut = "lutrgb=r='min(255,val*255/%d)':g='min(255,val*255/%d)':b='min(255,val*255/%d)'" % tuple(paper)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-i', dst + '.mask.png', '-filter_complex',
  f'[0:v]scale={W}:{H},{lut}[v];[v][1:v]overlay=0:0,format=yuv420p', '-c:v', 'libx264', '-crf', '27', '-preset', 'slow',
  '-profile:v', 'high', '-movflags', '+faststart', '-an', dst], check=True)
