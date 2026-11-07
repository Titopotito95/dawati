#!/usr/bin/env python3
"""
Home-page cinematic intro (jewellery box): prepares the supplied Gemini video for the web.
The footage itself is not changed or regenerated; it is only re-framed and compressed.

  input : assets-src/intro/jewelry-box.mp4   (1280x720, 24 fps, 6.3 s, trimmed by the owner)
  output: public/assets/intro/intro-desktop.mp4 + .webp poster  (1280x720, original framing)
          public/assets/intro/intro-mobile.mp4  + .webp poster  (480x720 centre crop, phones)

Phones (portrait): the video is shown full screen, zoomed in (CSS object-fit: cover) and centred on
the jewellery box. The phone file is the centre 480x720 of the frame (x 400..880: gloved hand and box),
so phones download only the part they can show; nothing is stretched or regenerated.
The original sound track is kept (AAC). Requires: ffmpeg.
"""
from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src" / "intro" / "jewelry-box.mp4"
OUT = ROOT / "public" / "assets" / "intro"

CROP_W, CROP_X = 480, 400  # phone file: centre of the frame (hand + jewellery box)


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    enc = ["-c:a", "aac", "-b:a", "96k", "-shortest", "-r", "24", "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]

    desktop = OUT / "intro-desktop.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-i", str(SRC), "-map", "0:v:0", "-map", "0:a:0?", *enc, "-crf", "26", str(desktop)])

    mobile = OUT / "intro-mobile.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-i", str(SRC), "-map", "0:v:0", "-map", "0:a:0?",
         "-vf", f"crop={CROP_W}:720:{CROP_X}:0", *enc, "-crf", "25", str(mobile)])

    for mp4 in (desktop, mobile):
        run(["ffmpeg", "-v", "error", "-y", "-i", str(mp4), "-frames:v", "1", "-q:v", "78", str(mp4.with_suffix(".webp"))])
        print(f"{mp4.name}: {mp4.stat().st_size / 1024:.0f} KiB")


if __name__ == "__main__":
    main()
