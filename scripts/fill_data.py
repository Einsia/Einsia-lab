#!/usr/bin/env python3
"""
Fill Frontier-Engineering benchmark data from one or more CSV files into YAML files.

Reads (in order — first CSV sets the canonical baseline for each task):
    - Frontier-Eng-ExpRawData_EXp1_Models.csv_表格.csv
    - Frontier-Eng-ExpRawData_EXp2_Frameworks.csv_表格.csv

Generates/updates:
    - public/frontier-eng/data/overall.yaml
    - public/frontier-eng/data/tasks_index.yaml
    - public/frontier-eng/data/problems/{task_name}.yaml
"""

import csv
import os
import yaml
from datetime import datetime, timezone

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.join(BASE_DIR, "..", "public", "frontier-eng", "data")
PROB_DIR   = os.path.join(DATA_DIR, "problems")
CSV_FILES  = [
    os.path.join(BASE_DIR, "..", "Frontier-Eng-ExpRawData_EXp1_Models.csv_表格.csv"),
    os.path.join(BASE_DIR, "..", "Frontier-Eng-ExpRawData_EXp2_Frameworks.csv_表格.csv"),
]
OVERALL    = os.path.join(DATA_DIR, "overall.yaml")
TASKS_IDX  = os.path.join(DATA_DIR, "tasks_index.yaml")

# ── CSV task-name → YAML task_name ──────────────────────────────────────────
TASK_NAME_MAP = {
    "Aerodynamics_CarAerodynamicsSensing":              "CarAerodynamicsSensing",
    "Astrodynamics_MannedLunarLanding":                 "MannedLunarLanding",
    "ComputerSystems_MallocLab":                        "MallocLab",
    "Cryptographic_AES-128":                            "crypto_aes128",
    "Cryptographic_SHA-256":                            "crypto_sha256",
    "Cryptographic_SHA3-256":                          "crypto_sha3_256",
    "Robotics_DynamicObstacleAvoidanceNavigation":      "DynamicObstacleNavigation",
    "Robotics_QuadrupedGaitOptimization":              "QuadrupedGait",
    "Robotics_RobotArmCycleTimeOptimization":          "RobotArmCycleTime",
    "SingleCellAnalysis_predict_modality":              "predict_modality",
    "StructuralOptimization_ISCSO2015":                 "ISCSO2015",
    "StructuralOptimization_ISCSO2023":                 "ISCSO2023",
    "KernelEngineering_MLA":                           "MLA",
    "KernelEngineering_TriMul":                        "TriMul",
    "WirelessChannelSimulation_HighReliableSimulation": "HighReliableSimulation",
}

DOMAIN_MAP = {
    "Aerodynamics":                 "Aerodynamics",
    "Astrodynamics":               "Astrodynamics",
    "ComputerSystems":             "Computer Systems",
    "Cryptographic":               "Cryptographic",
    "EnergyStorage":               "EnergyStorage",
    "InventoryOptimization":       "InventoryOptimization",
    "JobShop":                     "JobShop",
    "KernelEngineering":           "Kernel Engineering",
    "Optics":                      "Optics",
    "PyPortfolioOpt":              "PyPortfolioOpt",
    "QuantumComputing":            "QuantumComputing",
    "ReactionOptimisation":        "ReactionOptimisation",
    "Robotics":                    "Robotics",
    "SingleCellAnalysis":          "Single Cell Analysis",
    "StructuralOptimization":       "StructuralOptimization",
    "SustainableDataCenterControl": "SustainableDataCenterControl",
    "WirelessChannelSimulation":   "WirelessChannelSimulation",
    "EngDesign":                   "EngDesign",
}


def get_yaml_task_name(csv_task: str) -> str:
    if csv_task in TASK_NAME_MAP:
        return TASK_NAME_MAP[csv_task]
    if "_" not in csv_task:
        return csv_task
    return csv_task.split("_", 1)[1]


def get_domain(csv_task: str, yaml_task: str) -> str:
    # Try existing YAML file first
    existing_path = os.path.join(PROB_DIR, f"{yaml_task}.yaml")
    if os.path.exists(existing_path):
        try:
            with open(existing_path, encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            dom = data.get("metadata", {}).get("domain")
            if dom:
                return dom
        except Exception:
            pass
    raw_domain = csv_task.split("_", 1)[0] if "_" in csv_task else csv_task
    return DOMAIN_MAP.get(raw_domain, raw_domain)


def load_existing_yaml(path: str) -> dict:
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        except Exception:
            pass
    return {}


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def dump_yaml(data: dict, path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(data, f,
                  default_flow_style=False,
                  allow_unicode=True,
                  sort_keys=False,
                  width=120)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Read all CSV files, collect raw scores per (yaml_task, model)
# ─────────────────────────────────────────────────────────────────────────────

# raw_data[yaml_task] = {
#   "domain", "csv_task", "baseline",
#   "raw_scores": { model_name: raw_score, ... }
# }
raw_data: dict = {}

all_models: list = []

for csv_path in CSV_FILES:
    if not os.path.exists(csv_path):
        print(f"  [SKIP] {os.path.basename(csv_path)}: file not found")
        continue

    print(f"Reading {os.path.basename(csv_path)}")
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    model_cols = [c for c in rows[0] if c.endswith("_best")]
    model_names = [c[:-5] for c in model_cols]   # strip _best
    all_models.extend(model_names)

    for row in rows:
        csv_task = row["Task"]
        yaml_task = get_yaml_task_name(csv_task)

        if yaml_task not in raw_data:
            raw_data[yaml_task] = {
                "domain":     get_domain(csv_task, yaml_task),
                "csv_task":   csv_task,
                "baseline":   None,
                "raw_scores": {},
            }

        # Set canonical baseline from the FIRST CSV that defines it
        baseline_str = row.get("Baseline", "").strip()
        if baseline_str and raw_data[yaml_task]["baseline"] is None:
            try:
                raw_data[yaml_task]["baseline"] = float(baseline_str)
            except ValueError:
                pass

        # Collect model scores
        for col, mname in zip(model_cols, model_names):
            val = row.get(col, "").strip()
            if val:
                try:
                    raw_data[yaml_task]["raw_scores"][mname] = float(val)
                except ValueError:
                    pass

# Deduplicate model list while preserving order
seen = set()
all_models_unique = []
for m in all_models:
    if m not in seen:
        seen.add(m)
        all_models_unique.append(m)
all_models = all_models_unique

print(f"\n  Total models across all experiments: {len(all_models)}")
print(f"  Models: {all_models}")
print(f"  Tasks found in CSV: {len(raw_data)}")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Filter to tasks with data and compute normalized scores
# ─────────────────────────────────────────────────────────────────────────────

# task_info[yaml_task] = {
#   "domain", "baseline", "raw_scores",
#   "best_raw", "worst_raw",
#   "participants": [{participant_name, normalized_score, raw_score}, ...],
#   "best_participant",
#   "last_updated"
# }
task_info: dict = {}

for yaml_task, info in raw_data.items():
    if info["baseline"] is None:
        print(f"  [SKIP] {yaml_task}: no baseline")
        continue

    raw_scores = info["raw_scores"]
    if not raw_scores:
        print(f"  [SKIP] {yaml_task}: no model scores")
        continue

    baseline_val = info["baseline"]
    best_raw    = max(raw_scores.values())
    worst_raw   = min(raw_scores.values())

    # Normalise: task-internal min-max (best=1.0, worst=0.0)
    # Rationale: a model's score is measured relative to the range of all
    # participants in the same task, not relative to an arbitrary baseline.
    # The baseline is stored as metadata (raw_score.baseline) and displayed
    # in the task page for interpretability.
    #
    # For each participant:
    #   normalized = (raw - min_raw) / (max_raw - min_raw)
    # If max_raw == min_raw (all equal): all get 1.0
    raw_vals = list(raw_scores.values())
    min_raw = min(raw_vals)
    max_raw = max(raw_vals)
    if abs(max_raw - min_raw) < 1e-12:
        participants = [
            {"participant_name": m, "normalized_score": 1.0, "raw_score": v}
            for m, v in raw_scores.items()
        ]
    else:
        participants = [
            {
                "participant_name":    m,
                "normalized_score":    (v - min_raw) / (max_raw - min_raw),
                "raw_score":          v,
            }
            for m, v in raw_scores.items()
        ]

    participants.sort(key=lambda x: x["normalized_score"], reverse=True)

    task_info[yaml_task] = {
        "domain":            info["domain"],
        "csv_task":          info["csv_task"],
        "baseline":          baseline_val,
        "raw_scores":        raw_scores,
        "best_raw":          best_raw,
        "worst_raw":         worst_raw,
        "participants":      participants,
        "best_participant":   participants[0],
        "last_updated":      timestamp(),
    }

print(f"  → {len(task_info)} tasks with valid data\n")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Write individual problem YAML files
# ─────────────────────────────────────────────────────────────────────────────
updated_existing = 0
created_new = 0

for yaml_task, info in task_info.items():
    path = os.path.join(PROB_DIR, f"{yaml_task}.yaml")

    if os.path.exists(path):
        existing   = load_existing_yaml(path)
        metadata   = dict(existing.get("metadata", {}))
        metadata["normalization"] = {
            "baseline_score":     info["baseline"],
            "best_score":        info["best_raw"],
            "improvement_factor": 1.5,
        }
        data = {
            "metadata":    metadata,
            "statistics": {
                "raw_score": {
                    "max":      info["best_raw"],
                    "min":      info["worst_raw"],
                    "baseline": info["baseline"],
                },
                "normalized_score": {
                    "max":      info["best_participant"]["normalized_score"],
                    "min":      info["participants"][-1]["normalized_score"],
                    "baseline": None,  # min-max normalization: baseline is not a reference point
                },
                "best": {
                    "raw_score":         info["best_raw"],
                    "normalized_score":  info["best_participant"]["normalized_score"],
                    "participant":       info["best_participant"]["participant_name"],
                    "achieved_at":        None,
                },
                "last_updated":      info["last_updated"],
                "total_submissions": len(info["participants"]),
            },
            "participants":    info["participants"],
            "global_evolution": [],
        }
        # Preserve any extra keys from the original file
        for key in ("description_md", "readme_md"):
            if key in existing:
                data[key] = existing[key]
        dump_yaml(data, path)
        updated_existing += 1
    else:
        data = {
            "metadata": {
                "task_name":           yaml_task,
                "domain":              info["domain"],
                "title_zh":           yaml_task,
                "title_en":           yaml_task,
                "status":             "Completed",
                "contributor":         None,
                "reviewer":            None,
                "normalization": {
                    "baseline_score":     info["baseline"],
                    "best_score":        info["best_raw"],
                    "improvement_factor": 1.5,
                },
            },
            "statistics": {
                "raw_score": {
                    "max":      info["best_raw"],
                    "min":      info["worst_raw"],
                    "baseline": info["baseline"],
                },
                "normalized_score": {
                    "max":      info["best_participant"]["normalized_score"],
                    "min":      info["participants"][-1]["normalized_score"],
                    "baseline": None,  # min-max normalization: baseline is not a reference point
                },
                "best": {
                    "raw_score":         info["best_raw"],
                    "normalized_score":  info["best_participant"]["normalized_score"],
                    "participant":       info["best_participant"]["participant_name"],
                    "achieved_at":        None,
                },
                "last_updated":      info["last_updated"],
                "total_submissions": len(info["participants"]),
            },
            "participants":    info["participants"],
            "global_evolution": [],
        }
        dump_yaml(data, path)
        created_new += 1

print(f"  Updated {updated_existing} existing YAML files")
print(f"  Created  {created_new} new YAML files")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Write overall.yaml
# ─────────────────────────────────────────────────────────────────────────────
rankings = []

for model in all_models:
    task_scores: dict = {}
    for yaml_task, info in task_info.items():
        if model not in info["raw_scores"]:
            continue
        raw      = info["raw_scores"][model]
        min_raw  = info["worst_raw"]
        max_raw  = info["best_raw"]
        if abs(max_raw - min_raw) < 1e-12:
            norm = 1.0
        else:
            norm = (raw - min_raw) / (max_raw - min_raw)
        task_scores[yaml_task] = {
            "normalized_score": norm,
            "raw_score":       raw,
        }

    if task_scores:
        total_norm = sum(v["normalized_score"] for v in task_scores.values()) / len(task_scores)
    else:
        total_norm = 0.0

    rankings.append({
        "participant_name":        model,
        "total_normalized_score": total_norm,
        "task_scores":            task_scores,
    })

rankings.sort(key=lambda x: x["total_normalized_score"], reverse=True)

overall_data = {
    "metadata": {
        "last_updated": timestamp(),
        "total_tasks": len(task_info),
    },
    "rankings": rankings,
    "statistics": {
        "normalized_score": {
            "max": rankings[0]["total_normalized_score"] if rankings else None,
            "min": rankings[-1]["total_normalized_score"] if rankings else None,
        },
        "raw_score": {"max": None, "min": None},
    },
}
dump_yaml(overall_data, OVERALL)
print(f"\n  Wrote overall.yaml with {len(rankings)} models")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Update tasks_index.yaml
# ─────────────────────────────────────────────────────────────────────────────
idx_data = load_existing_yaml(TASKS_IDX)
existing_tasks_map = {t["task_name"]: t for t in idx_data.get("tasks", [])}

for yaml_task, info in task_info.items():
    if yaml_task in existing_tasks_map:
        existing_tasks_map[yaml_task]["statistics"] = {
            "best_normalized_score": info["best_participant"]["normalized_score"],
            "total_participants":    len(info["participants"]),
            "last_updated":         info["last_updated"],
        }
        existing_tasks_map[yaml_task]["file"] = f"{yaml_task}.yaml"
    else:
        existing_tasks_map[yaml_task] = {
            "task_name": yaml_task,
            "domain":    info["domain"],
            "file":      f"{yaml_task}.yaml",
            "status":    "Completed",
            "statistics": {
                "best_normalized_score": info["best_participant"]["normalized_score"],
                "total_participants":    len(info["participants"]),
                "last_updated":          info["last_updated"],
            },
        }

all_tasks = sorted(existing_tasks_map.values(),
                   key=lambda t: (t.get("domain", ""), t.get("task_name", "")))
idx_data["tasks"] = all_tasks

dump_yaml(idx_data, TASKS_IDX)
print(f"  Updated tasks_index.yaml → {len(all_tasks)} tasks total\n")

print("Done ✓")
