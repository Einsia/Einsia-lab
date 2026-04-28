"""
Copy / rasterize paper figures from the LaTeX tree into the static site.

Source (update path if you move the paper repo):
  C:\\CODE\\Einsia-lab\\AI4Eng (3)\\figures

Run after updating PDFs/SVGs in that folder:
  python public/frontier-eng/scripts/sync_paper_figures_from_ai4eng.py
"""
import shutil
from pathlib import Path

import fitz

BASE = Path(r"C:\CODE\Einsia-lab\AI4Eng (3)\figures")
OUT = Path(__file__).resolve().parent.parent / "img" / "paper"
ZOOM = 2.15


def raster_pdf(pdf_path: Path, dest_png: Path, clip=None) -> None:
    doc = fitz.open(str(pdf_path))
    page = doc[0]
    mat = fitz.Matrix(ZOOM, ZOOM)
    pix = page.get_pixmap(matrix=mat, alpha=False, clip=clip)
    pix.save(str(dest_png))
    doc.close()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    shutil.copy2(BASE / "Method_0408.pdf", OUT / "Method_0408.pdf")
    raster_pdf(BASE / "Method_0408.pdf", OUT / "method_0408_overview.png")

    raster_pdf(BASE / "fig_ablation_heatmap.pdf", OUT / "fig_ablation_heatmap.png")

    doc = fitz.open(str(BASE / "fig_longhorizon_v7.pdf"))
    page = doc[0]
    rect = page.rect
    mid = rect.width / 2
    mat = fitz.Matrix(ZOOM, ZOOM)
    # Single wide page: left panel → freq, right panel → magnitude (matches paper layout).
    for name, clip in [
        ("longhorizon_freq.png", fitz.Rect(0, 0, mid, rect.height)),
        ("longhorizon_mag.png", fitz.Rect(mid, 0, rect.width, rect.height)),
    ]:
        pix = page.get_pixmap(matrix=mat, alpha=False, clip=clip)
        pix.save(str(OUT / name))
    doc.close()

    shutil.copy2(
        BASE / "EnergyStorage_BatteryFastChargingProfile__step_plot_notext.svg",
        OUT / "battery_charging.svg",
    )
    shutil.copy2(
        BASE / "ComputerSystems_MallocLab__step_plot_notext.svg",
        OUT / "malloc_lab.svg",
    )
    shutil.copy2(BASE / "benchmark_composition.png", OUT / "benchmark_composition.png")

    shutil.copy2(BASE / "performance_profile.pdf", OUT / "performance_profile.pdf")
    raster_pdf(BASE / "performance_profile.pdf", OUT / "performance_profile.png")

    print("Synced to", OUT)


if __name__ == "__main__":
    main()
