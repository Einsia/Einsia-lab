#!/usr/bin/env python3
"""Create the approved 480×360 web copies from an existing RoboDojo export.

The source must be a separate replays directory containing the pre-compression
videos and traces. Only examples in the destination catalog are processed.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import subprocess

ENCODING = "H.264, CRF 34, 480x360; original frame rate, every frame and duration retained"
ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads(path.read_text())


def write(path, data):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    temporary.replace(path)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe(tool, path):
    return json.loads(subprocess.check_output([
        tool, "-v", "error", "-select_streams", "v:0", "-show_entries",
        "stream=width,height,r_frame_rate,nb_frames,duration", "-of", "json", str(path)
    ]))["streams"][0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--ffprobe", default="ffprobe")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    output = ROOT / "public/embodied-rsi/replays"
    source = args.source.resolve()
    if source == output.resolve():
        parser.error("--source must be separate from the destination export")
    catalog = read(output / "catalog.json")
    identifiers = [identifier for task in catalog["tasks"] for identifier in task["examples"]]

    def compress(identifier):
        assert Path(identifier).name == identifier
        dest = output / "episodes" / identifier
        original = source / "episodes" / identifier
        trace = read(dest / "trace.json")
        source_trace = read(original / "trace.json")
        total_before = total_after = 0
        for provenance in trace["provenance"]["videos"]:
            camera = provenance["camera"]
            previous = next(v for v in source_trace["provenance"]["videos"] if v["camera"] == camera)
            src = original / trace["videos"][camera]["file"]
            target = dest / src.name
            assert digest(src) == previous["webSha256"], src
            assert previous["originalSha256"] == provenance["originalSha256"], src
            before = probe(args.ffprobe, src)
            total_before += src.stat().st_size
            reusable = (trace["provenance"].get("encoding") == ENCODING
                        and target.is_file() and digest(target) == provenance["webSha256"])
            temporary = target.with_suffix(".compressing.mp4")
            if not reusable:
                subprocess.run([
                    args.ffmpeg, "-v", "error", "-y", "-i", str(src),
                    "-vf", "scale=480:360", "-c:v", "libx264", "-preset", "slow",
                    "-crf", "34", "-threads", "2", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", "-an", str(temporary)
                ], check=True)
            after = probe(args.ffprobe, target if reusable else temporary)
            assert (after["width"], after["height"]) == (480, 360), (identifier, camera)
            for key in ("r_frame_rate", "nb_frames"):
                assert after[key] == before[key], (identifier, camera, key)
            assert abs(float(after["duration"]) - float(before["duration"])) < .001
            if not reusable:
                temporary.replace(target)
                provenance.update({
                    "inputWebSha256": previous["webSha256"], "inputWebBytes": src.stat().st_size,
                    "originalWidth": previous.get("originalWidth", before["width"]),
                    "originalHeight": previous.get("originalHeight", before["height"]),
                    "webSha256": digest(target), "webBytes": target.stat().st_size,
                    "width": after["width"], "height": after["height"]
                })
            total_after += target.stat().st_size
        trace["provenance"]["encoding"] = ENCODING
        write(dest / "trace.json", trace)
        return total_before, total_after

    before = after = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(compress, identifier) for identifier in identifiers]
        for count, future in enumerate(as_completed(futures), 1):
            old, new = future.result()
            before += old
            after += new
            if count % 10 == 0 or count == len(futures):
                print(f"{count}/{len(futures)} trajectories: {before / 1e6:.1f} MB → {after / 1e6:.1f} MB", flush=True)
    inventory_path = output / "inventory.json"
    inventory = read(inventory_path)
    inventory["videoBytes"] = sum(p.stat().st_size for p in output.glob("episodes/*/*.mp4"))
    other_bytes = sum(p.stat().st_size for p in output.rglob("*") if p.is_file() and p != inventory_path)
    for _ in range(3):
        write(inventory_path, inventory)
        inventory["totalBytes"] = other_bytes + inventory_path.stat().st_size
    write(inventory_path, inventory)
    print(json.dumps(inventory, indent=2), flush=True)


if __name__ == "__main__":
    main()
