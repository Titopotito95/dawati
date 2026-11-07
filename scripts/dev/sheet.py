"""Dev helper: build contact sheets from captured frames. Usage: python3 sheet.py <dir>"""
import glob, os, sys
from PIL import Image, ImageDraw
d = sys.argv[1]
def sheet(names, w, h, cols, out):
    ims = [(os.path.basename(n), Image.open(n).resize((w, h))) for n in names if os.path.exists(n)]
    rows = (len(ims) + cols - 1) // cols
    S = Image.new("RGB", (cols * w, rows * (h + 14)), "white"); dr = ImageDraw.Draw(S)
    for i, (n, im) in enumerate(ims):
        x = (i % cols) * w; y = (i // cols) * (h + 14); S.paste(im, (x, y + 14)); dr.text((x + 3, y + 1), n, fill="black")
    S.save(os.path.join(d, out))
sheet([os.path.join(d, "closed.png")] + sorted(glob.glob(os.path.join(d, "t_*.png"))), 195, 422, 6, "sheet.png")
sheet([os.path.join(d, n) for n in ["open_written.png", "scroll1.png", "scroll2.png", "scroll3.png", "scroll4.png"]], 260, 563, 5, "sheet2.png")
