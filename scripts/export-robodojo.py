"""One-time, read-only export of completed RoboDojo records into this repository.

Normal builds never run this script or access the experiment checkout. Requires
Pillow and ffmpeg/ffprobe. Selection follows the official provenance, never score.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

from PIL import Image

RUN = "202610061832_robodojo_D_recipe_astra_xhigh_v01_a01"
CAMERAS = ("cam_head", "cam_left_wrist", "cam_right_wrist")
ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads(path.read_text())


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def probe(tool, path):
    return json.loads(subprocess.check_output([
        tool, "-v", "error", "-select_streams", "v:0", "-show_entries",
        "stream=width,height,r_frame_rate,nb_frames,duration", "-of", "json", str(path)
    ]))["streams"][0]


def text_parts(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(x.get("text", "") for x in content
                         if isinstance(x, dict) and x.get("type") in {"input_text", "output_text", "text"})
    return ""


def public_log(path):
    """Export public assistant messages and tool I/O, without prompt or reasoning payloads."""
    events = []
    if not path.is_file():
        return events
    with path.open() as source:
        for line in source:
            event = json.loads(line)
            if event.get("type") != "response_item":
                continue
            item = event.get("payload", {})
            kind = item.get("type")
            timestamp = event.get("timestamp")
            record = None
            if kind == "message" and item.get("role") == "assistant":
                record = {"kind": "message", "label": "Agent message", "text": text_parts(item.get("content"))}
            elif kind in {"function_call", "custom_tool_call"}:
                record = {"kind": "tool", "label": item.get("name", "Tool call"),
                          "text": item.get("arguments", item.get("input", "")), "callId": item.get("call_id")}
            elif kind in {"function_call_output", "custom_tool_call_output"}:
                record = {"kind": "output", "label": "Tool response", "text": text_parts(item.get("output")),
                          "callId": item.get("call_id")}
            if record:
                # Image payloads are represented by the copied camera recordings,
                # never by megabytes of inline base64 in a text transcript.
                record["text"] = re.sub(r"data:image/[^;]+;base64,[A-Za-z0-9+/=]+", "[Recorded image]", record["text"])
                if record["text"].strip():
                    record["timestamp"] = timestamp
                    events.append(record)
    return events


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--ffprobe", default="ffprobe")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    source = args.source.resolve()
    run = source / "runs/final" / RUN
    output = ROOT / "public/embodied-rsi/replays"
    output.mkdir(parents=True, exist_ok=True)
    rows = read(run / "submission/provenance.json")
    assert read(run / "validation.json")["complete"] and len(rows) == 2100
    tasks = read(source / "configs/benchmark_suites.json")["benchmarks"]["RoboDojo"]["tasks"]
    grouped = defaultdict(list)
    for row in rows:
        grouped[row["task"]].append(row)
    selected, catalog_tasks, outcomes = [], [], []
    for task in tasks:
        name = task["name"]
        variants = [name, name + "_random"] if name + "_random" in grouped else [name]
        for variant in variants:
            scores, successes, examples = [], [], []
            ordered = sorted(grouped[variant], key=lambda x: x["record"])
            for row in ordered:
                report_bytes = (run / row["original_report"]).read_bytes()
                assert sha(report_bytes) == row["report_sha256"], row["original_report"]
                report = json.loads(report_bytes)
                detail = report["details"]["0"]
                assert detail["layout_id"] == row["layout_id"] and type(detail["success"]) is bool
                scores.append(report["score"])
                successes.append(detail["success"])
                outcomes.append({"task": name, "variant": variant, "layout": row["layout_id"],
                                 "score": report["score"], "success": detail["success"], "reportSha256": row["report_sha256"]})
            for row in ordered[:6]:
                identifier = f'{variant}--{row["layout_id"]:05d}'
                examples.append(identifier)
                selected.append((task, row, identifier))
            assert len(examples) == 6 and len(scores) == (25 if len(variants) == 2 else 50)
            variant_label = "Random" if variant.endswith("_random") else "Standard"
            title = name.replace("_", " ").capitalize()
            if len(variants) == 2:
                title += f" · {variant_label}"
            catalog_tasks.append({"id": variant, "baseTask": name, "title": title,
                                  "variantLabel": variant_label,
                                  "category": task["group"], "score": sum(scores) / len(scores),
                                  "successRate": 100 * sum(successes) / len(successes),
                                  "evaluatedScenes": len(scores), "examples": examples})
    catalog_tasks.sort(key=lambda task: task["id"].lower())
    assert len(selected) == 324 and len(catalog_tasks) == 54
    write(output / "evaluation.json", {"seed": 1, "episodes": outcomes})
    result_entries = {}

    def export(selection):
        task, row, identifier = selection
        stage = run / Path(*Path(row["original_report"]).parts[:5])
        episode = stage / "policy/episodes/episode_0000"
        workspace = episode / "workspace"
        dest = output / "episodes" / identifier
        dest.mkdir(parents=True, exist_ok=True)
        report = read(run / row["original_report"])
        shutil.copyfile(run / row["original_report"], dest / "report.json")
        initial = read(workspace / "observations/000000/observation.json")
        instruction = initial.get("instruction", "")
        with Image.open(workspace / "observations/000000/current_cam_head.png") as im:
            im.convert("RGB").save(dest / "poster.webp", quality=78)
        videos, provenance = {}, []
        existing = read(dest / "trace.json") if (dest / "trace.json").is_file() else {}
        for camera in CAMERAS:
            native = next(v for v in row["videos"] if f"_{camera}_" in v["source"])
            src = run / native["source"]
            assert sha(src.read_bytes()) == native["sha256"], src
            target = dest / f"{camera}.mp4"
            original_info = probe(args.ffprobe, src)
            # Preserve every frame, its rate, and 640x480 resolution. This is a
            # web encoding of the official movie, without cuts or speed changes.
            previous = next((v for v in existing.get("provenance", {}).get("videos", []) if v["camera"] == camera), {})
            reusable = (target.is_file() and previous.get("originalSha256") == native["sha256"]
                        and "CRF 30" in existing.get("provenance", {}).get("encoding", "")
                        and sha(target.read_bytes()) == previous.get("webSha256"))
            if not reusable:
                temporary = target.with_suffix(".tmp.mp4")
                subprocess.run([args.ffmpeg, "-v", "error", "-y", "-threads", "1", "-i", str(src),
                                "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "30", "-threads", "1",
                                "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(temporary)], check=True)
                temporary.replace(target)
            info = probe(args.ffprobe, target)
            for key in ("width", "height", "r_frame_rate", "nb_frames"):
                assert info[key] == original_info[key], (identifier, camera, key)
            assert abs(float(info["duration"]) - float(original_info["duration"])) < .001
            videos[camera] = {"file": target.name, "duration": float(info["duration"]), "frames": int(info["nb_frames"])}
            provenance.append({"camera": camera, "originalSha256": native["sha256"],
                               "webSha256": sha(target.read_bytes()), "originalBytes": src.stat().st_size,
                               "webBytes": target.stat().st_size, "frames": int(info["nb_frames"]),
                               "width": info["width"], "height": info["height"], "fps": info["r_frame_rate"]})
        contents = {}

        def blob(text):
            key = sha(text.encode())
            contents.setdefault(key, text)
            return key

        segments = []
        previous_steps = 0
        for folder in sorted((workspace / "observations").glob("[0-9]*")):
            if not (folder / "code.py").is_file():
                continue
            code = (folder / "code.py").read_text()
            feedback = read(folder / "result.json")
            sources = read(folder / "sources.json") if (folder / "sources.json").is_file() else []
            files, offset = [], 0
            for part in sources:
                text = code[offset:offset + part["bytes"]]
                assert sha(text.encode()) == part["sha256"], (identifier, folder.name, part["path"])
                files.append({"name": part["path"], "content": blob(text)})
                offset += part["bytes"] + 2
            if sources:
                assert offset - 2 == len(code)
            total = feedback.get("native_steps_used", previous_steps)
            segments.append({"execution": int(folder.name), "code": blob(code), "files": files,
                             "ok": feedback.get("ok"), "success": feedback.get("success"),
                             "nativeSteps": total - previous_steps, "nativeStepsTotal": total,
                             "stdout": feedback.get("stdout", ""), "stderr": feedback.get("stderr", ""),
                             "reason": feedback.get("reason", ""), "timing": feedback.get("timing", {})})
            previous_steps = total
        knowledge = {}
        for kind in ("skills", "lessons"):
            files = []
            for file in sorted((workspace / kind).rglob("*")):
                if not file.is_file() or "__pycache__" in file.parts or file.suffix not in {".md", ".py", ".txt", ".json", ".toml"}:
                    continue
                if not file.resolve().is_relative_to(workspace.resolve()):
                    raise ValueError("Knowledge outside the selected workspace")
                files.append({"name": file.relative_to(workspace).as_posix(), "content": blob(file.read_text())})
            knowledge[kind] = files
        log = public_log(episode / "agent/session.jsonl")
        entry = {"id": identifier, "task": row["task"], "baseTask": task["name"], "variant": row["task"],
                 "variantLabel": "Random" if row["task"].endswith("_random") else "Standard",
                 "layout": row["layout_id"], "seed": 1, "attempt": row["attempt"],
                 "score": report["score"], "success": report["details"]["0"]["success"],
                 "instruction": instruction, "executions": len(segments), "nativeSteps": previous_steps,
                 "duration": videos["cam_head"]["duration"], "agentEvents": len(log)}
        trace = {**entry, "model": "GPT-6 Astra", "effort": "xhigh", "condition": "Self-generated harness + wiki",
                 "videos": videos, "segments": segments, "contents": contents, "knowledge": knowledge, "agentLog": log,
                 "timingNote": "Official movies use the evaluator's video clock. Executions and agent events are browsed in recorded order; code is not timestamp-aligned to this movie.",
                 "provenance": {"run": RUN, "reportSha256": row["report_sha256"], "videos": provenance,
                                "encoding": "H.264, CRF 30; original resolution, frame rate and every frame retained"}}
        write(dest / "trace.json", trace)
        return identifier, entry

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = [pool.submit(export, x) for x in selected]
        for n, job in enumerate(as_completed(jobs), 1):
            identifier, entry = job.result()
            result_entries[identifier] = entry
            if n % 12 == 0 or n == len(selected):
                print(f"Exported {n}/{len(selected)} complete episodes", flush=True)
    catalog = {"version": 2, "benchmark": "RoboDojo", "run": RUN, "seed": 1,
               "evaluatedScenes": 2100, "baseTaskCount": 42, "taskCount": 54,
               "examplesPerTask": 6, "exampleCount": 324,
               "selection": "6 examples per displayed task: the first 6 official records, without outcome filtering. Generalization Standard and Random variants appear separately, matching the official 54-task gallery. Paper metrics group them into 42 base tasks.",
               "tasks": catalog_tasks, "episodes": [result_entries[x[2]] for x in selected]}
    write(output / "catalog.json", catalog)
    media = [p for p in output.rglob("*.mp4")]
    inventory = {"episodes": len(result_entries), "tasks": len(catalog_tasks), "videos": len(media),
                 "videoBytes": sum(p.stat().st_size for p in media),
                 "totalBytes": sum(p.stat().st_size for p in output.rglob("*") if p.is_file()),
                 "selection": catalog["selection"]}
    write(output / "inventory.json", inventory)
    print(json.dumps(inventory, indent=2), flush=True)


if __name__ == "__main__":
    main()
