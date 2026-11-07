#!/usr/bin/env python3
"""
Theme "Pearl Lotus" (pearl-lotus@1): prepares the four supplied artworks for the web.
The artwork is not redrawn: only cut into layers and compressed.

  input : assets-src/lotus/cover.jpg  (721x1280 closed cover: medallion on the vertical gold seam)
          assets-src/lotus/page1.jpg  (721x1280 arch frame)
          assets-src/lotus/page2.jpg  (634x1280 frame with hourglass)
          assets-src/lotus/page3.jpg  (721x1280 oval frame)
  output: public/assets/themes/pearl-lotus/v1/<variant>/
          cover-base.webp  cover with the medallion lifted out (seam line continued) - seen only
                           around the medallion while it spins
          medallion.webp   the medallion alone, transparent around it (spins on its own)
          page1..3.webp    the three interior pages
          thumb.webp       catalogue thumbnail
          + manifest.json  geometry (seam, medallion box, page sizes) used by the renderer

The supplied cover carried a third-party brand name inside the medallion; that lettering is
removed here (the renderer writes the couple's initials and "دعوة" there as live text).
Requires: Python 3, opencv-python-headless, NumPy, Pillow.
"""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src" / "lotus"
VARIANT = "blush"
OUT = ROOT / "public" / "assets" / "themes" / "pearl-lotus" / "v1"

SEAM_X = 356.5  # centre of the vertical gold line (cover px)
BOX = (186, 452, 530, 828)  # search window around the medallion
TIPS = (464, 807)  # medallion top / bottom tip rows (the seam line continues beyond them)
TEXT = (588, 686, 258, 458)  # rows / cols of the lettering inside the medallion (flourish below is kept)


def gold_mask(img: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(int)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    return ((h >= 8) & (h <= 28) & (s >= 70) & (v >= 90) & (v <= 235)).astype(np.uint8)


def medallion_mask(img: np.ndarray) -> np.ndarray:
    """Full-size 0/1 mask of the medallion (gold frame + its inside)."""
    x0, y0, x1, y1 = BOX
    walls = cv2.dilate(gold_mask(img), np.ones((5, 5), np.uint8))[y0:y1, x0:x1]
    ff = (1 - walls).astype(np.uint8)
    h, w = ff.shape
    fm = np.zeros((h + 2, w + 2), np.uint8)
    for x in range(w):
        for y in (0, h - 1):
            if ff[y, x] == 1:
                cv2.floodFill(ff, fm, (x, y), 2)
    for y in range(h):
        for x in (0, w - 1):
            if ff[y, x] == 1:
                cv2.floodFill(ff, fm, (x, y), 2)
    m = (ff != 2).astype(np.uint8)
    m[: TIPS[0] - y0] = 0
    m[TIPS[1] - y0 :] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    m = (lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    full = np.zeros(img.shape[:2], np.uint8)
    full[y0:y1, x0:x1] = m
    return full


def remove_lettering(img: np.ndarray, medal: np.ndarray) -> np.ndarray:
    inner = cv2.erode(medal, np.ones((29, 29), np.uint8))
    lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    dark = (lum.astype(int) < cv2.GaussianBlur(lum, (41, 41), 0).astype(int) - 18).astype(np.uint8)
    t = inner & (gold_mask(img) | dark)
    r0, r1, c0, c1 = TEXT
    keep = np.zeros_like(t)
    keep[r0:r1, c0:c1] = 1
    t = cv2.dilate(t & keep, np.ones((9, 9), np.uint8))
    return cv2.inpaint(img, t * 255, 7, cv2.INPAINT_TELEA)


def lift_medallion(img: np.ndarray, medal: np.ndarray, pearl: np.ndarray) -> np.ndarray:
    """Cover without the medallion: real pearl texture filled in (taken from the same, empty area of
    page 1 and matched in colour), and the vertical seam line continued through."""
    hole = cv2.dilate(medal, np.ones((15, 15), np.uint8))
    x0, y0, x1, y1 = BOX
    ring = (cv2.dilate(hole, np.ones((31, 31), np.uint8)) - hole).astype(bool)
    tex = pearl.astype(np.float32)
    tex += img[ring].mean(0) - tex[ring].mean(0)
    soft = np.maximum(cv2.GaussianBlur(hole.astype(np.float32), (41, 41), 0), hole.astype(np.float32))[..., None]
    base = (img.astype(np.float32) * (1 - soft) + np.clip(tex, 0, 255) * soft).astype(np.uint8)
    cx = int(round(SEAM_X))
    half = 9
    src = img[345:455, cx - half : cx + half + 1].astype(np.float32)  # clean stretch of the seam line
    a = np.cos(np.linspace(-np.pi / 2, np.pi / 2, 2 * half + 1)) ** 1.5  # feathered sides
    a = a[None, :, None]
    for y in range(y0, y1):
        row = src[(y - y0) % src.shape[0]]
        dst = base[y, cx - half : cx + half + 1].astype(np.float32)
        base[y, cx - half : cx + half + 1] = (row * a[0] + dst * (1 - a[0])).astype(np.uint8)
    return base


def save_webp(arr_bgr_or_bgra: np.ndarray, path: Path, q: int = 86) -> None:
    if arr_bgr_or_bgra.shape[2] == 4:
        im = Image.fromarray(cv2.cvtColor(arr_bgr_or_bgra, cv2.COLOR_BGRA2RGBA), "RGBA")
    else:
        im = Image.fromarray(cv2.cvtColor(arr_bgr_or_bgra, cv2.COLOR_BGR2RGB), "RGB")
    im.save(path, "WEBP", quality=q, method=6)


def main() -> None:
    out = OUT / VARIANT
    out.mkdir(parents=True, exist_ok=True)
    cover = cv2.imread(str(SRC / "cover.jpg"))
    H, W = cover.shape[:2]
    medal = medallion_mask(cover)
    clean = remove_lettering(cover, medal)
    page1 = cv2.imread(str(SRC / "page1.jpg"))
    base = lift_medallion(clean, medal, page1)

    ys, xs = np.where(medal)
    mx0, my0, mx1, my1 = xs.min() - 3, ys.min() - 3, xs.max() + 4, ys.max() + 4
    alpha = cv2.GaussianBlur(cv2.dilate(medal, np.ones((3, 3), np.uint8)) * 255, (3, 3), 0)
    rgba = np.dstack([clean, alpha])[my0:my1, mx0:mx1]

    save_webp(base, out / "cover-base.webp")
    save_webp(rgba, out / "medallion.webp", 92)
    pages = {}
    for i in (1, 2, 3):
        p = cv2.imread(str(SRC / f"page{i}.jpg"))
        save_webp(p, out / f"page{i}.webp")
        pages[f"page{i}"] = {"w": p.shape[1], "h": p.shape[0]}
    save_webp(cv2.resize(clean, (480, round(480 * H / W)), interpolation=cv2.INTER_AREA), out / "thumb.webp", 82)

    manifest = {
        "cover": {"w": W, "h": H},
        "seam": SEAM_X / W,
        "medallion": {"left": mx0 / W, "top": my0 / H, "width": (mx1 - mx0) / W, "height": (my1 - my0) / H},
        **pages,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
