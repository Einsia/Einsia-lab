#!/usr/bin/env python3
"""
Convert the paper's framework figure into the /research card banner.

The source is a 1-page PDF exported from Keynote/Quartz. It is *not* line art:
37 embedded rasters make up about 1.0 MB of its 1.06 MB, so tracing it to SVG
would base64-inline all of them and land larger than the PDF itself, and its
Wingdings bullets would not survive the font substitution. Raster is the correct
target here; the only real choice is the codec.

WebP q90 is what ships. Against a lossless render it measures ~42 dB PSNR
overall and ~43 dB on the letter-spaced small-caps strip -- visually
indistinguishable -- at roughly a quarter of the PNG's bytes.

The canvas is padded to 16:9 because /research frames every banner in
`aspect-[16/9] ... p-4` with object-contain. At the figure's native 1.52:1 the
image would fit by height and leave gutters wider on the sides than the top,
which reads as a misplaced image rather than a deliberate inset. Padding to the
frame's own ratio makes the white block sit inside an even 16px border, and the
added pixels are flat white, so they cost almost nothing.

    python3 scripts/swemorph-framework-figure.py [source.pdf]
"""
import os
import subprocess
import sys
import tempfile
from PIL import Image

# The source PDF is vendored next to its output so a checkout can regenerate the
# banner without reaching outside the repository.
SRC = sys.argv[1] if len(sys.argv) > 1 else "public/swe-morph-bench/img/paper/framework.pdf"
OUT = "public/swe-morph-bench/img/framework.webp"

# Render well above the target, then downsample with Lanczos: the embedded
# rasters are 300-565 ppi, so rendering at the final size directly would resample
# them twice, once by the PDF renderer and once by us.
RENDER_DPI = 200
TARGET_W = 1600  # the banner column is ~588 CSS px, so this covers 3x displays
QUALITY = 90


def main():
    if not os.path.exists(SRC):
        sys.exit(f"source not found: {SRC}")

    with tempfile.TemporaryDirectory() as tmp:
        stem = os.path.join(tmp, "page")
        subprocess.run(
            ["pdftocairo", "-png", "-r", str(RENDER_DPI), "-singlefile", SRC, stem],
            check=True,
        )
        im = Image.open(stem + ".png").convert("RGB")

        h = round(TARGET_W * im.height / im.width)
        im = im.resize((TARGET_W, h), Image.LANCZOS)

        # Pad to the frame's 16:9. The figure is wider than tall, so this always
        # adds width; the branch keeps it correct if a future figure is not.
        tw, th = round(h * 16 / 9), h
        if tw < TARGET_W:
            tw, th = TARGET_W, round(TARGET_W * 9 / 16)
        canvas = Image.new("RGB", (tw, th), (255, 255, 255))
        canvas.paste(im, ((tw - TARGET_W) // 2, (th - h) // 2))

        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        canvas.save(OUT, quality=QUALITY, method=6)

    kb = os.path.getsize(OUT) / 1024
    print(f"wrote {OUT}  {tw}x{th} (16:9)  {kb:.1f} kB  webp q{QUALITY}")


if __name__ == "__main__":
    main()
