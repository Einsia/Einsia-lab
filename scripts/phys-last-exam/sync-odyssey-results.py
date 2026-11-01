"""Import Odyssey-3's supplied PDF into the leaderboard snapshot.

Requires PyMuPDF locally; CI consumes the committed JSON. The PDF's published
aggregate averages task means, whereas the original manuscript uses video weights.
"""
import hashlib
import json
import re
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public/phys-last-exam"
SOURCE = PUBLIC / "Odyssey-3_task_scores.pdf"
MODEL = "odyssey-3"
SEEDS = (42, 43, 44, 45)
# The score report uses the more specific name of the canonical legacy-P12 task.
NAME_ALIASES = {"P20": "Total-reflection critical angle"}


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")


def main():
    results = json.loads((PUBLIC / "paper-results.json").read_text())
    canonical = json.loads((PUBLIC / "task-index.json").read_text())
    tasks = {task["id"]: task for task in results["tasks"]}
    rows = {}
    aggregates = set()
    pattern = re.compile(
        r"^\s*(P\d+)\s+(.+?)\s+"
        r"((?:(?:\d+\.\d+|N/A)\s+){5}\d+\.\d+)\s*$"
    )
    with pymupdf.open(SOURCE) as document:
        for page in document:
            text = page.get_text(sort=True)
            aggregates.update(re.findall(r"40-task aggregate:\s*([\d.]+)/100", text))
            for line in text.splitlines():
                match = pattern.fullmatch(line)
                if not match:
                    continue
                task_id, name, cells = match.groups()
                assert task_id in tasks, line
                assert name.strip() == NAME_ALIASES.get(task_id, tasks[task_id]["name"]), line
                assert task_id not in rows, f"Duplicate task: {task_id}"
                values = [None if cell == "N/A" else Decimal(cell) for cell in cells.split()]
                assert all(value is None or 0 <= value <= 100 for value in values)
                scored = [value for value in values[:4] if value is not None]
                final_mean = values[4]
                # Seed values and means are independently rounded in the PDF.
                assert scored and abs(sum(scored) / len(scored) - final_mean) <= Decimal(".01")
                rows[task_id] = (values[:4], final_mean)

    assert set(rows) == set(tasks) == {task["id"] for task in canonical["tasks"]}
    assert len(rows) == 40 and len(aggregates) == 1
    aggregate = Decimal(aggregates.pop())
    assert abs(sum(mean for _, mean in rows.values()) / len(rows) - aggregate) <= Decimal(".005")
    assert [(task, seed) for task, (values, _) in rows.items()
            for seed, value in zip(SEEDS, values) if value is None] == [("P14", 43)]

    model = dict(
        id=MODEL, name="Odyssey-3", color="#0f766e", average=float(aggregate),
        logo="/phys-last-exam/logos/odyssey-3.webp", averageWeighting="task", scoredVideos=159,
        logoSource="https://drive.google.com/file/d/1mlrXPshy7y3XrOguKVwtTE7-iwm9U-wF/view",
        source="/phys-last-exam/" + SOURCE.name,
        sourceSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        scoreColumn="Final mean",
        scoreNote="Published aggregate averages all 40 Final mean task scores. "
                  "Task means include every available scored seed; P14 seed 43 is unreported. "
                  "Submitted-column values are not used. Consistency gates are unreported. "
                  "Seed scores are rounded to two decimals in the source PDF.",
    )
    results["models"] = [m for m in results["models"] if m["id"] != MODEL] + [model]
    results["models"].sort(key=lambda m: m["average"], reverse=True)
    for task_id, (values, mean) in rows.items():
        task = tasks[task_id]
        task["scores"][MODEL] = float(mean)
        task["consistency"][MODEL] = None
        task.setdefault("seedScores", {})[MODEL] = {
            str(seed): None if value is None else float(value)
            for seed, value in zip(SEEDS, values)
        }
    results["updated"] = date.today().isoformat()
    results["scoreNote"] = (
        "Composite scores, 0–100; manuscript averages are video-weighted. "
        "Odyssey-3 uses its report's published task-weighted aggregate. "
        "S = 0.15C + 0.85P × 1[C ≥ 80]. C is automatic consistency; "
        "P is the independently recorded physical score."
    )
    write_json(PUBLIC / "paper-results.json", results)

    # Update only changed/new assets; leave every other integrity record intact.
    manifest_path = PUBLIC / "release-assets.json"
    manifest = json.loads(manifest_path.read_text())
    assets = {asset["url"]: asset for asset in manifest["assets"]}
    assets.pop("/phys-last-exam/logos/odyssey-3.png", None)
    for path in (SOURCE, PUBLIC / "paper-results.json", PUBLIC / "logos/odyssey-3.webp"):
        url = "/phys-last-exam/" + path.relative_to(PUBLIC).as_posix()
        assets[url] = dict(url=url, bytes=path.stat().st_size,
                           sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    manifest["assets"] = sorted(assets.values(), key=lambda asset: asset["url"])
    manifest["bytes"] = sum(asset["bytes"] for asset in manifest["assets"])
    manifest["generatedAt"] = datetime.now(timezone.utc).isoformat()
    write_json(manifest_path, manifest)
    print(f"Imported Odyssey-3: {len(rows)} tasks, 159 scored seeds, {aggregate}/100 (task mean).")


if __name__ == "__main__":
    main()
