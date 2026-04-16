"""One-off: rasterize key paper figures to PNG for frontier-eng homepage."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import fitz

SRC = Path(r"C:\CODE\Einsia-lab\AI4Eng (2)\figures")
OUT = Path(r"C:\CODE\Einsia-lab\public\frontier-eng\img\paper")
ZOOM = fitz.Matrix(2.8, 2.8)


def rasterize(pdf: Path, png: Path, clip: Optional[fitz.Rect] = None) -> None:
    doc = fitz.open(pdf)
    page = doc[0]
    pix = page.get_pixmap(matrix=ZOOM, clip=clip, alpha=False)
    png.parent.mkdir(parents=True, exist_ok=True)
    pix.save(str(png))
    doc.close()
    print(f"saved {png} ({png.stat().st_size // 1024} KB)")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    long = SRC / "fig_longhorizon_v7.pdf"
    if not long.is_file():
        raise SystemExit(f"missing {long}")
    doc = fitz.open(long)
    r = doc[0].rect
    doc.close()
    print("longhorizon page rect:", r.width, "x", r.height)
    mid = r.width / 2
    rasterize(long, OUT / "longhorizon_freq.png", clip=fitz.Rect(0, 0, mid, r.height))
    rasterize(long, OUT / "longhorizon_mag.png", clip=fitz.Rect(mid, 0, r.width, r.height))

    heat = SRC / "fig_ablation_heatmap.pdf"
    if not heat.is_file():
        raise SystemExit(f"missing {heat}")
    rasterize(heat, OUT / "fig_ablation_heatmap.png", clip=None)


if __name__ == "__main__":
    main()
