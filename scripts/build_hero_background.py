#!/usr/bin/env python3
"""
Landing-page animated background: recomposes the supplied luxury video so its ornaments sit at
the outer edges and the champagne centre is much wider. Nothing is regenerated or redrawn.

  input : assets-src/hero/background.mp4  (720x1280, 24 fps, 10 s)
  output: public/assets/hero/hero-mobile.mp4 + .webp poster   (900x1950, phones)
          public/assets/hero/hero-desktop.mp4 + .webp poster  (1800x1400, laptops/desktops)

Method (ffmpeg only, run once):
  1. Loop: the clip's first/last frames differ slightly, so the final 0.6 s cross-fades into the
     first 0.6 s (the clip then restarts exactly where the fade ended).
  2. Ornament columns are cut out UNCHANGED (uniform scaling only, never stretched):
       left  x 0..305  (crystal drape, flower, bottle, floor diamonds)
       right x 425..720 (hanging crystals, flower, floor diamonds)
     and placed at the canvas edges; on phones they bleed slightly off-screen.
  3. The wider centre is the video's own empty champagne column (x 330..410) widened and softly
     blurred, so its moving light keeps animating behind the content (it contains no objects).
  4. Columns blend into the centre through feathered alpha masks (no hard seams).
  5. Taller canvas: the whole original height is kept (bottom flowers and diamonds included); the
     shiny floor continues below it and fades into the page colour PAGE_BG, so the page has no edge.
Requires: ffmpeg, Python 3 with Pillow + NumPy.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src" / "hero" / "background.mp4"
OUT = ROOT / "public" / "assets" / "hero"
TMP = ROOT / "assets-src" / "hero" / "build"

SRC_W, SRC_H, FLOOR_Y = 720, 1280, 1060
LEFT = (0, 305)  # x range of the left ornament column
RIGHT = (425, 720)  # x range of the right ornament column
BAND = (330, 410)  # empty champagne column used to widen the centre
FEATHER = 35  # px (source scale) soft blend on the inner side of each column
XFADE = 0.6  # s loop cross-fade
PAGE_BG = "CBBCAC"  # champagne floor colour = website background colour

TARGETS = {
    # phones: original height and framing, widened horizontally by 25% (ornaments at full size)
    "mobile": {"w": 900, "h": 1950, "scale": 1.0, "bleed": 0, "bottom_fade": 60, "fill": (1250, 1760), "crf": 28},
    # laptops / desktops
    "desktop": {"w": 1800, "h": 1400, "scale": 1080 / SRC_H, "bleed": 0, "bottom_fade": 50, "fill": (1050, 1270), "crf": 27},
}


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def even(n: float) -> int:
    v = int(round(n))
    return v + (v % 2)


def make_mask(w: int, h: int, inner: str, feather: int, bottom_fade: int, path: Path) -> None:
    """White = keep. Fades to black toward the inner (centre-facing) edge and optionally the bottom."""
    x = np.arange(w, dtype=np.float64)
    if inner == "right":
        a = np.clip((w - 1 - x) / max(1, feather), 0, 1)
    else:
        a = np.clip(x / max(1, feather), 0, 1)
    a = a ** 1.4  # smoother shoulder
    m = np.tile(a, (h, 1))
    if bottom_fade:
        y = np.arange(h, dtype=np.float64)
        m *= np.clip((h - 1 - y) / bottom_fade, 0, 1)[:, None] ** 1.4
    Image.fromarray((m * 255).astype(np.uint8), "L").save(path)


def make_fill_mask(w: int, h: int, start: int, end: int, path: Path) -> None:
    """Alpha of the flat page-colour layer: 0 above `start`, 1 below `end` (smoothstep)."""
    t = np.clip((np.arange(h, dtype=np.float64) - start) / max(1, end - start), 0, 1)
    t = t * t * (3 - 2 * t)
    Image.fromarray((np.tile(t[:, None], (1, w)) * 255).astype(np.uint8), "L").save(path)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)

    # 1) loop cross-fade
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(SRC)],
                               capture_output=True, text=True, check=True).stdout.strip())
    loop = TMP / "loop.mp4"
    a_len = dur - XFADE
    run(["ffmpeg", "-v", "error", "-y", "-i", str(SRC), "-filter_complex",
         f"[0:v]split[a][b];[a]trim=start={XFADE},setpts=PTS-STARTPTS[A];[b]trim=0:{XFADE},setpts=PTS-STARTPTS[B];"
         f"[A][B]xfade=transition=fade:duration={XFADE}:offset={a_len - XFADE:.3f},format=yuv420p[v]",
         "-map", "[v]", "-an", "-c:v", "libx264", "-crf", "12", "-preset", "fast", str(loop)])
    loop_len = a_len

    for name, t in TARGETS.items():
        s, W, H, bleed = t["scale"], t["w"], t["h"], t["bleed"]
        lw, rw = even((LEFT[1] - LEFT[0]) * s), even((RIGHT[1] - RIGHT[0]) * s)
        ch = even(SRC_H * s)
        wall_h = even(FLOOR_Y * s)  # floor horizon of the scaled columns (top-aligned)
        floor_h = H - wall_h
        f = max(8, int(FEATHER * s))
        bf = t["bottom_fade"] if ch < H else 0
        make_mask(lw, ch, "right", f, bf, TMP / f"{name}-maskL.png")
        make_mask(rw, ch, "left", f, bf, TMP / f"{name}-maskR.png")
        make_fill_mask(W, H, *t["fill"], TMP / f"{name}-fill.png")
        bw = BAND[1] - BAND[0]
        graph = (
            f"[0:v]split=3[v1][v2][v3];"
            # widened, blurred champagne centre (wall and floor scaled separately so the floor horizon matches)
            f"[v1]crop={bw}:{SRC_H}:{BAND[0]}:0,split=2[bw][bf];"
            f"[bw]crop={bw}:{FLOOR_Y}:0:0,scale={W}:{wall_h}:flags=bicubic[pw];"
            f"[bf]crop={bw}:{SRC_H - FLOOR_Y}:0:{FLOOR_Y},scale={W}:{floor_h}:flags=bicubic[pf];"
            f"[pw][pf]vstack,gblur=sigma={16 if name == 'mobile' else 14}[plate];"
            # ornament columns: uniform scale only + feathered alpha
            f"[v2]crop={LEFT[1] - LEFT[0]}:{SRC_H}:{LEFT[0]}:0,scale={lw}:{ch}:flags=lanczos,format=yuva420p[l0];"
            f"[1:v]format=gray[ml];[l0][ml]alphamerge[l];"
            f"[v3]crop={RIGHT[1] - RIGHT[0]}:{SRC_H}:{RIGHT[0]}:0,scale={rw}:{ch}:flags=lanczos,format=yuva420p[r0];"
            f"[2:v]format=gray[mr];[r0][mr]alphamerge[r];"
            f"[plate][l]overlay=x={-bleed}:y=0:shortest=1[t1];"
            f"[t1][r]overlay=x={W - rw + bleed}:y=0:shortest=1[t2];"
            # floor fades into the flat page colour at the bottom
            f"color=c=0x{PAGE_BG}:s={W}x{H}:r=24,format=yuva420p[cc];[3:v]format=gray[mg];[cc][mg]alphamerge[fill];"
            f"[t2][fill]overlay=0:0:shortest=1,format=yuv420p[out]"
        )
        mp4 = OUT / f"hero-{name}.mp4"
        run(["ffmpeg", "-v", "error", "-y", "-i", str(loop),
             "-loop", "1", "-i", str(TMP / f"{name}-maskL.png"), "-loop", "1", "-i", str(TMP / f"{name}-maskR.png"),
             "-loop", "1", "-i", str(TMP / f"{name}-fill.png"),
             "-filter_complex", graph, "-map", "[out]", "-t", f"{loop_len:.3f}", "-r", "24", "-an",
             "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", str(t["crf"]),
             "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4)])
        run(["ffmpeg", "-v", "error", "-y", "-i", str(mp4), "-frames:v", "1", "-q:v", "82", str(OUT / f"hero-{name}.webp")])
        print(f"{name}: {mp4.stat().st_size / 1024:.0f} KiB, {W}x{H}, columns at {s:.2f}x")


if __name__ == "__main__":
    main()
