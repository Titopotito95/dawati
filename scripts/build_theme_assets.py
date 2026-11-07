#!/usr/bin/env python3
"""
Theme asset pipeline for theme #1 "Pearl Lace" (لؤلؤة الدانتيل).

Input  : assets-src/themes/pearl-lace/ref-1.jpg .. ref-5.jpg  (flattened reference art)
Output : public/themes/pearl-lace/v1/<variant>/<size>/*.webp + manifest.json

What it does (honest description):
  * ref-1 (closed envelope) is segmented into separate physical layers:
      flap-top, flap-left, flap-right, flap-bottom, seal, gaps (shadow recess between flaps).
    Segmentation follows the REAL scalloped rims: the dark shadow bands between the flaps are
    detected (warm, darker pixels) inside a corridor around each gap centre-line, so each flap
    keeps its own beaded rim, pearls, lace and attached tulle.
  * Areas hidden under the seal are reconstructed by diffusion in-painting (they are only visible
    for a fraction of a second while the top flap carries the seal away).
  * Back faces are synthesised (mirrored debossed paper) because the references never show the
    reverse side of a flap.
  * ref-5 (open lace card) becomes the inner invitation card.
  * Colour variants are produced OFFLINE as separately prepared art (not runtime CSS filters).

Requires: python3, Pillow, numpy (no OpenCV / SciPy).
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src" / "themes" / "pearl-lace"
OUT = ROOT / "public" / "assets" / "themes" / "pearl-lace" / "v1"

W, H = 561, 1080  # ref-1 native size
SEAL_C = (282.0, 530.0)
SEAL_R = (80.0, 104.0)

# Rough gap centre-lines (y as a function of x) read from the reference; refined from pixels below.
GUESS = {
    "TL": lambda x: 210 + 0.95 * x,
    "TR": lambda x: 210 + 0.95 * (W - 1 - x),
    "BL": lambda x: 890 - 1.13 * x,
    "BR": lambda x: 890 - 1.13 * (W - 1 - x),
}
XRANGE = {"TL": (0, 236), "TR": (W - 237, W - 1), "BL": (0, 226), "BR": (W - 227, W - 1)}


def luminance(a: np.ndarray) -> np.ndarray:
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def box_mean(m: np.ndarray, r: int) -> np.ndarray:
    """Fast box filter via integral image."""
    p = np.pad(m.astype(np.float64), ((r + 1, r), (r + 1, r)), mode="edge")
    c = p.cumsum(0).cumsum(1)
    k = 2 * r + 1
    s = c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]
    return s / (k * k)


def dilate(m: np.ndarray, r: int) -> np.ndarray:
    img = Image.fromarray((m * 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.MaxFilter(2 * r + 1))) > 127


def erode(m: np.ndarray, r: int) -> np.ndarray:
    img = Image.fromarray((m * 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.MinFilter(2 * r + 1))) > 127


def fit_centerline(density: np.ndarray, key: str) -> np.ndarray:
    """For each x in range, find y of max dark density near the guess; fit a quadratic."""
    x0, x1 = XRANGE[key]
    xs, ys, ws = [], [], []
    for x in range(x0, x1 + 1):
        g = GUESS[key](x)
        lo, hi = int(max(0, g - 45)), int(min(H - 1, g + 45))
        col = density[lo:hi, x]
        if col.size == 0:
            continue
        i = int(col.argmax())
        if col[i] > 0.45:
            xs.append(x)
            ys.append(lo + i)
            ws.append(col[i])
    xs, ys, ws = np.array(xs), np.array(ys), np.array(ws)
    coef = np.polyfit(xs, ys, 2, w=ws)
    return coef


def line_y(coef: np.ndarray, x: np.ndarray | float):
    return np.polyval(coef, x)


def inpaint(rgb: np.ndarray, known: np.ndarray, iters: int = 400) -> np.ndarray:
    """Simple diffusion in-painting for small hidden regions (no OpenCV)."""
    out = rgb.astype(np.float64).copy()
    unknown = ~known
    if not unknown.any():
        return rgb
    # initialise unknown with mean of known border
    out[unknown] = out[known].mean(0)
    for _ in range(iters):
        blurred = np.stack([box_mean(out[..., c], 2) for c in range(3)], -1)
        out[unknown] = blurred[unknown]
    # add a little grain back so it doesn't look plastic
    rng = np.random.default_rng(7)
    noise = rng.normal(0, 1.6, out.shape)
    out[unknown] += noise[unknown]
    return np.clip(out, 0, 255).astype(np.uint8)


def soften(mask: np.ndarray, radius: float) -> np.ndarray:
    img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(img).astype(np.float64) / 255.0


def make_variant(rgb: np.ndarray, variant: str) -> np.ndarray:
    """Offline colour preparation. 'ivory' = untouched reference."""
    a = rgb.astype(np.float64)
    if variant == "ivory":
        return rgb
    L = luminance(a)[..., None]
    if variant == "white":
        # true pearl white: almost no chroma, mid-tones lifted with a gamma curve so the paper reads
        # white while the embossing, pearls and shadows keep their relief; a breath of cool pearl.
        Ln = np.clip(luminance(a) / 255.0, 0, 1)
        detail = Ln - box_mean(Ln, 5)  # local "clarity": pearls, beads and embossing keep real relief
        Lw = 255.0 * (0.05 + 0.94 * Ln ** 0.64) + 255.0 * detail * 0.6
        out = Lw[..., None] + (a - L) * 0.09
        out = out + np.array([-0.5, 0.3, 2.2])
    elif variant == "champagne":
        out = L + (a - L) * 0.55
        tint = np.array([1.0, 0.955, 0.86])
        out = out * tint + np.array([6, 4, -2])
    else:
        raise ValueError(variant)
    return np.clip(out, 0, 255).astype(np.uint8)


def back_face(rgb: np.ndarray, alpha: np.ndarray, axis: str) -> tuple[np.ndarray, np.ndarray]:
    """Debossed reverse side of embossed paper, mirrored to match flip geometry."""
    a = rgb.astype(np.float64)
    L = luminance(a)
    detail = L - box_mean(L, 6)
    base = np.median(a[alpha > 0.9], axis=0) if (alpha > 0.9).any() else a.mean((0, 1))
    paper = np.ones_like(a) * base * 0.985
    out = paper - detail[..., None] * 0.22  # inverted relief
    # gentle edge darkening (paper thickness / ambient occlusion)
    edge = 1.0 - soften(alpha > 0.5, 10)
    out *= (1.0 - 0.10 * np.clip(edge * 2.2, 0, 1))[..., None]
    rng = np.random.default_rng(3)
    out += rng.normal(0, 1.2, out.shape)
    out = np.clip(out, 0, 255).astype(np.uint8)
    if axis == "x":
        return out[::-1, :, :], alpha[::-1, :]
    return out[:, ::-1, :], alpha[:, ::-1]


def bbox(alpha: np.ndarray, pad: int = 2):
    ys, xs = np.where(alpha > 0.003)
    return (max(0, xs.min() - pad), max(0, ys.min() - pad), min(alpha.shape[1], xs.max() + pad + 1), min(alpha.shape[0], ys.max() + pad + 1))


def save_rgba(rgb: np.ndarray, alpha: np.ndarray, path: Path, scale: float, quality: int = 84):
    img = Image.fromarray(np.dstack([rgb, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)]), "RGBA")
    if scale != 1:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
        if scale > 1:
            img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=40, threshold=2))
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=quality, method=6, alpha_quality=90)


def save_rgb(rgb: np.ndarray, path: Path, scale: float, quality: int = 84):
    img = Image.fromarray(rgb, "RGB")
    if scale != 1:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
        if scale > 1:
            img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=40, threshold=2))
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=quality, method=6)


def main():
    debug = "--debug" in sys.argv
    ref1 = np.asarray(Image.open(SRC / "ref-1.jpg").convert("RGB"))
    assert ref1.shape[:2] == (H, W), ref1.shape
    a = ref1.astype(np.float64)
    L = luminance(a)
    sat = a.max(-1) - a.min(-1)
    dark = (L < 205) & (sat > 28)
    density = box_mean(dark.astype(np.float64), 3)

    yy, xx = np.mgrid[0:H, 0:W]
    coefs = {k: fit_centerline(box_mean(dark.astype(np.float64), 8), k) for k in GUESS}

    # ---- seal (anti-aliased ellipse, slightly soft) ----
    ex = (xx - SEAL_C[0]) / SEAL_R[0]
    ey = (yy - SEAL_C[1]) / SEAL_R[1]
    er = np.sqrt(ex ** 2 + ey ** 2)
    # The seal layer carries its own contact-shadow ring (a few px beyond the medallion), so the
    # flaps underneath can simply be notched where they were tucked under the seal.
    SEAL_PAD = 6.0
    exr = np.sqrt(((xx - SEAL_C[0]) / (SEAL_R[0] + SEAL_PAD)) ** 2 + ((yy - SEAL_C[1]) / (SEAL_R[1] + SEAL_PAD)) ** 2)
    seal_alpha = np.clip((1.0 - exr) * (SEAL_R[0] + SEAL_PAD) / 1.3 + 0.5, 0, 1)
    seal_hard = exr <= 1.0

    # ---- sector polygons (gap centre-lines extended to the seal centre) ----
    def pts(key, x_from, x_to, n=60):
        xs = np.linspace(x_from, x_to, n)
        return [(float(x), float(line_y(coefs[key], x))) for x in xs]

    cx, cy = SEAL_C
    tl = pts("TL", -2, XRANGE["TL"][1]) + [(cx, cy)]
    tr = [(cx, cy)] + pts("TR", XRANGE["TR"][0], W + 1)
    bl = pts("BL", -2, XRANGE["BL"][1]) + [(cx, cy)]
    br = [(cx, cy)] + pts("BR", XRANGE["BR"][0], W + 1)

    def poly_mask(poly):
        img = Image.new("L", (W, H), 0)
        ImageDraw.Draw(img).polygon(poly, fill=255)
        return np.asarray(img) > 127

    top_sector = poly_mask([(-2, -2)] + tl + tr[1:] + [(W + 1, -2)])
    bottom_sector = poly_mask([(-2, H + 1)] + bl + br[1:] + [(W + 1, H + 1)])
    left_sector = poly_mask([(-2, -2)] + tl + bl[::-1] + [(-2, H + 1)])
    left_sector &= ~top_sector & ~bottom_sector
    right_sector = ~(top_sector | bottom_sector | left_sector)

    # ---- gap (shadow recess) mask: dark pixels inside a corridor around each centre-line ----
    corridor = np.zeros((H, W), bool)
    centre_strip = np.zeros((H, W), bool)
    for k, c in coefs.items():
        x0, x1 = XRANGE[k]
        d = np.abs(yy - line_y(c, xx))
        inx = (xx >= x0 - 2) & (xx <= x1 + 2)
        corridor |= (d <= 30) & inx
        centre_strip |= (d <= 2.5) & inx
    gap = corridor & (density > 0.52) & ~seal_hard
    gap = erode(dilate(gap, 1), 1)  # close pin-holes
    gap = dilate(erode(gap, 2), 2)  # open: drop speckles where tulle crosses the recess
    gap = erode(dilate(gap, 2), 2)
    # remove tiny islands far from the centre-line (pearl shadows etc.)
    gap &= dilate(centre_strip | (corridor & (box_mean(gap.astype(float), 6) > 0.5)), 2)

    gap_layer = (dilate(gap, 2) | centre_strip) & ~seal_hard
    gap_alpha = soften(gap_layer, 0.6)

    # ---- what lies UNDER the seal: rebuilt by radial extension ----
    # The tulle and lace of every flap converge toward the seal centre, so each hidden pixel takes
    # the colour found just outside the seal on the same ray from the centre. This continues the
    # gathered tulle streaks into a clean point (no round hole when the seal leaves). Rays that land
    # in a shadow recess stay transparent, so the gaps between flaps also taper into the centre.
    hx = xx - SEAL_C[0]
    hy = yy - SEAL_C[1]
    inv = 1.0 / np.maximum(exr, 1e-6)
    acc = np.zeros((H, W, 3))
    radii = (1.02, 1.05, 1.08, 1.11)
    for rr in radii:
        sx = np.clip(np.round(SEAL_C[0] + hx * inv * rr).astype(int), 0, W - 1)
        sy = np.clip(np.round(SEAL_C[1] + hy * inv * rr).astype(int), 0, H - 1)
        acc += ref1[sy, sx].astype(np.float64)
    radial_rgb = acc / len(radii)
    depth = (0.94 + 0.06 * np.clip(exr, 0, 1))[..., None]  # gathered tulle sits slightly deeper
    radial_rgb = np.clip(radial_rgb * depth + np.random.default_rng(11).normal(0, 1.2, radial_rgb.shape), 0, 255).astype(np.uint8)
    # shadow recess continues inward by ANGLE (smoothed), never as isolated streaks
    nb = 720
    ang = (np.arctan2(hy / (SEAL_R[1] + SEAL_PAD), hx / (SEAL_R[0] + SEAL_PAD)) + np.pi) / (2 * np.pi)
    bins = np.minimum((ang * nb).astype(int), nb - 1)
    frac = np.zeros(nb)
    for b in range(nb):
        t = (b + 0.5) / nb * 2 * np.pi - np.pi
        hits = 0
        for rr in (1.1, 1.2, 1.3, 1.4, 1.5):
            x = int(round(SEAL_C[0] + np.cos(t) * (SEAL_R[0] + SEAL_PAD) * rr))
            y = int(round(SEAL_C[1] + np.sin(t) * (SEAL_R[1] + SEAL_PAD) * rr))
            if 0 <= x < W and 0 <= y < H and gap[y, x]:
                hits += 1
        frac[b] = hits / 5
    k = 9
    smooth = np.array([frac[[(b + j) % nb for j in range(-k, k + 1)]].mean() for b in range(nb)])
    radial_gap = (smooth > 0.5)[bins]

    flaps = {}
    for name, sector in (("top", top_sector), ("left", left_sector), ("right", right_sector), ("bottom", bottom_sector)):
        m = sector & ~gap & ~seal_hard
        m = erode(dilate(m, 1), 1) & sector  # drop specks
        under = sector & seal_hard & ~radial_gap
        rgb = ref1.copy()
        rgb[under] = radial_rgb[under]
        full = m | under
        alpha = soften(full, 0.65)
        alpha[~dilate(full, 2)] = 0
        flaps[name] = (rgb, alpha)

    # ---- inner card from ref-5 ----
    ref5 = np.asarray(Image.open(SRC / "ref-5.jpg").convert("RGB"))

    # ---- shadows (soft silhouettes) ----
    shadows = {n: soften(al > 0.5, 9) for n, (_, al) in flaps.items()}

    manifest = {
        "theme": "pearl-lace",
        "version": 1,
        "source": {"width": W, "height": H},
        "seal": {"cx": SEAL_C[0] / W, "cy": SEAL_C[1] / H, "rx": SEAL_R[0] / W, "ry": SEAL_R[1] / H},
        "card": {"aspect": ref5.shape[1] / ref5.shape[0]},
        "layers": {},
        "variants": ["ivory", "white", "champagne"],
        "sizes": {"sm": 1, "lg": 2},
    }

    def rel_box(b):
        x0, y0, x1, y1 = b
        return {"x": x0 / W, "y": y0 / H, "w": (x1 - x0) / W, "h": (y1 - y0) / H}

    boxes = {}
    for n, (_, al) in flaps.items():
        boxes[n] = bbox(al, 3)
    # hinge edges must touch the envelope edge exactly
    x0, y0, x1, y1 = boxes["top"]; boxes["top"] = (0, 0, W, y1)
    x0, y0, x1, y1 = boxes["bottom"]; boxes["bottom"] = (0, y0, W, H)
    x0, y0, x1, y1 = boxes["left"]; boxes["left"] = (0, y0, x1, y1)
    x0, y0, x1, y1 = boxes["right"]; boxes["right"] = (x0, y0, W, y1)
    seal_box = bbox(seal_alpha, 4)
    gap_box = (0, 0, W, H)

    for n in boxes:
        manifest["layers"][f"flap-{n}"] = rel_box(boxes[n])
    manifest["layers"]["seal"] = rel_box(seal_box)
    manifest["layers"]["gaps"] = rel_box(gap_box)

    for variant in manifest["variants"]:
        for size, scale in manifest["sizes"].items():
            d = OUT / variant / size
            for n, (rgb, al) in flaps.items():
                x0, y0, x1, y1 = boxes[n]
                vr = make_variant(rgb, variant)
                save_rgba(vr[y0:y1, x0:x1], al[y0:y1, x0:x1], d / f"flap-{n}.webp", scale)
                axis = "x" if n in ("top", "bottom") else "y"
                brgb, bal = back_face(vr[y0:y1, x0:x1], al[y0:y1, x0:x1], axis)
                save_rgba(brgb, bal, d / f"flap-{n}-back.webp", scale, quality=78)
            x0, y0, x1, y1 = seal_box
            save_rgba(make_variant(ref1, variant)[y0:y1, x0:x1], seal_alpha[y0:y1, x0:x1], d / "seal.webp", scale, quality=88)
            save_rgba(make_variant(ref1, variant), gap_alpha, d / "gaps.webp", scale, quality=78)
            save_rgb(make_variant(ref5, variant), d / "card.webp", scale, quality=84)
            # closed envelope composite for thumbnails / instant first paint
            save_rgb(make_variant(ref1, variant), d / "closed.webp", scale, quality=80)
        # shadows are colour independent; store once per variant folder for simple URL building
        for n, sh in shadows.items():
            x0, y0, x1, y1 = boxes[n]
            sh_rgb = np.zeros((y1 - y0, x1 - x0, 3), np.uint8) + np.array([70, 40, 35], np.uint8)
            save_rgba(sh_rgb, sh[y0:y1, x0:x1], OUT / variant / "sm" / f"shadow-{n}.webp", 1, quality=60)
        # thumbnail
        thumb = Image.fromarray(make_variant(ref1, variant)).resize((280, 539), Image.LANCZOS)
        thumb.save(OUT / variant / "thumb.webp", "WEBP", quality=80, method=6)

    # ---- lace band for section transitions (cut from the real lace at the bottom of ref-1) ----
    band = ref1[928:1080, :, :].astype(np.float64)
    bh, bw = band.shape[:2]
    by, bx = np.mgrid[0:bh, 0:bw]
    pitch = bw / 9.0
    phase = (bx % pitch) / pitch
    scallop_depth = 16.0
    edge_y = bh - 6 - scallop_depth * (1 - np.sqrt(np.clip(1 - (2 * phase - 1) ** 2, 0, 1)))
    band_alpha = np.clip((edge_y - by) / 1.4 + 0.5, 0, 1)
    band_alpha *= np.clip(by / 22.0, 0, 1) ** 0.8  # soft fade into the section above
    for variant in manifest["variants"]:
        vb = make_variant(band.astype(np.uint8), variant)
        for size, scale in manifest["sizes"].items():
            save_rgba(vb, band_alpha, OUT / variant / size / "lace-band.webp", scale, quality=82)
    manifest["laceBand"] = {"aspect": bw / bh}

    # ---- sparkle points (pearl and bead highlights) for crystal-like glints ----
    def find_sparkles(img_rgb, allow, count, min_dist):
        fa = img_rgb.astype(np.float64)
        Li = luminance(fa)
        si = fa.max(-1) - fa.min(-1)
        hi = (Li > 238) & (si < 40) & allow
        hd = box_mean(hi.astype(np.float64), 1) * (Li / 255.0)
        taken = np.zeros(hi.shape, bool)
        pts_out = []
        hh, ww = hi.shape
        for idx in np.argsort(-hd.ravel())[:20000]:
            y, x = divmod(int(idx), ww)
            if hd[y, x] < 0.25 or taken[y, x]:
                continue
            taken[max(0, y - min_dist):y + min_dist + 1, max(0, x - min_dist):x + min_dist + 1] = True
            pts_out.append((x, y, float(hd[y, x])))
            if len(pts_out) >= count:
                break
        return pts_out

    glints = []
    for x, y, strength in find_sparkles(ref1, ~seal_hard & ~gap, 56, 11):
        layer = next((n for n, (_, al) in flaps.items() if al[y, x] > 0.6), None)
        if layer is None:
            continue
        glints.append({"x": round(x / W, 4), "y": round(y / H, 4), "layer": layer, "s": round(min(1.0, strength * 1.4), 2)})
    r5h, r5w = ref5.shape[:2]
    cyy, cxx = np.mgrid[0:r5h, 0:r5w]
    frame_only = (((cxx - r5w / 2) / (r5w * 0.40)) ** 2 + ((cyy - r5h * 0.52) / (r5h * 0.43)) ** 2) > 1.0
    card_glints = [{"x": round(x / r5w, 4), "y": round(y / r5h, 4), "s": round(min(1.0, st * 1.4), 2)} for x, y, st in find_sparkles(ref5, frame_only, 26, 14)]
    manifest["cardGlints"] = card_glints
    manifest["glints"] = glints
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))

    if debug:
        dbg = ROOT / "assets-src" / "debug"
        dbg.mkdir(exist_ok=True)
        vis = ref1.copy().astype(np.float64)
        colors = {"top": (255, 0, 0), "left": (0, 160, 0), "right": (0, 0, 255), "bottom": (200, 0, 200)}
        for n, (_, al) in flaps.items():
            vis = vis * (1 - 0.35 * al[..., None]) + np.array(colors[n]) * 0.35 * al[..., None]
        vis[gap] = vis[gap] * 0.3 + np.array([255, 255, 0]) * 0.7
        vis = vis * (1 - 0.4 * seal_alpha[..., None]) + np.array([0, 220, 220]) * 0.4 * seal_alpha[..., None]
        Image.fromarray(np.clip(vis, 0, 255).astype(np.uint8)).resize((W * 2, H * 2), Image.NEAREST).save(dbg / "segmentation.png")
        print("centre-lines:", {k: [round(float(v), 5) for v in c] for k, c in coefs.items()})
    total = sum(f.stat().st_size for f in OUT.rglob("*.webp"))
    print(f"wrote assets to {OUT} ({total/1024:.0f} KiB total across variants/sizes)")


if __name__ == "__main__":
    main()
