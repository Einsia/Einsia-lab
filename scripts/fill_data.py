#!/usr/bin/env python3
"""
Fill Frontier-Engineering benchmark data from one or more CSV files into YAML files.

Two separate experiments are tracked:
    - Experiment 1 (Frontier-Eng-ExpRawData_EXp1_Models.csv_表格.csv): Model Leaderboard
    - Experiment 2 (Frontier-Eng-ExpRawData_EXp2_Frameworks.csv_表格.csv): Framework Leaderboard

Generates/updates:
    - public/frontier-eng/data/overall-model.yaml    (Experiment 1 rankings)
    - public/frontier-eng/data/overall-framework.yaml (Experiment 2 rankings)
    - public/frontier-eng/data/tasks_index.yaml
    - public/frontier-eng/data/problems/{task_name}.yaml
       (participants tagged with experiment_type: "model" | "framework")
"""

import csv
import os
import yaml
from datetime import datetime, timezone

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.join(BASE_DIR, "..", "public", "frontier-eng", "data")
PROB_DIR   = os.path.join(DATA_DIR, "problems")

# CSV files: (csv_path, experiment_type)
#   "model"     → Frontier-Eng-ExpRawData_EXp1_Models.csv_表格.csv
#   "framework" → Frontier-Eng-ExpRawData_EXp2_Frameworks.csv_表格.csv
CSV_CONFIG = [
    (os.path.join(BASE_DIR, "..", "Frontier-Eng-ExpRawData_EXp1_Models.csv_表格.csv"),    "model"),
    (os.path.join(BASE_DIR, "..", "Frontier-Eng-ExpRawData_EXp2_Frameworks.csv_表格.csv"), "framework"),
]

OVERALL_MODEL     = os.path.join(DATA_DIR, "overall-model.yaml")
OVERALL_FRAMEWORK = os.path.join(DATA_DIR, "overall-framework.yaml")
TASKS_IDX         = os.path.join(DATA_DIR, "tasks_index.yaml")

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
# STEP 1: Read all CSV files, collect raw scores per (experiment, yaml_task, model)
# ─────────────────────────────────────────────────────────────────────────────

# raw_data[experiment][yaml_task] = {
#     "domain", "csv_task", "baseline",
#     "raw_scores": { model_name: raw_score, ... }
# }
raw_data: dict = {"model": {}, "framework": {}}

# all_models[experiment] = [model_name, ...]
all_models: dict = {"model": [], "framework": []}

for csv_path, exp_type in CSV_CONFIG:
    if not os.path.exists(csv_path):
        print(f"  [SKIP] {os.path.basename(csv_path)}: file not found")
        continue

    print(f"Reading {os.path.basename(csv_path)}  (experiment: {exp_type})")
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    model_cols  = [c for c in rows[0] if c.endswith("_best")]
    model_names = [c[:-5] for c in model_cols]   # strip _best
    all_models[exp_type].extend(model_names)

    for row in rows:
        csv_task  = row["Task"]
        yaml_task = get_yaml_task_name(csv_task)

        if yaml_task not in raw_data[exp_type]:
            raw_data[exp_type][yaml_task] = {
                "domain":     get_domain(csv_task, yaml_task),
                "csv_task":   csv_task,
                "baseline":   None,
                "raw_scores": {},
            }

        # Baseline from the first CSV that defines it for this task (across all experiments)
        # For the "framework" CSV, we also use its baseline
        baseline_str = row.get("Baseline", "").strip()
        if baseline_str:
            try:
                raw_data[exp_type][yaml_task]["baseline"] = float(baseline_str)
            except ValueError:
                pass

        for col, mname in zip(model_cols, model_names):
            val = row.get(col, "").strip()
            if val:
                try:
                    raw_data[exp_type][yaml_task]["raw_scores"][mname] = float(val)
                except ValueError:
                    pass

# Deduplicate model lists while preserving order
for exp_type in all_models:
    seen = []
    for m in all_models[exp_type]:
        if m not in seen:
            seen.append(m)
    all_models[exp_type] = seen

for exp_type, models in all_models.items():
    print(f"\n  [{exp_type}] models: {len(models)}  →  {models}")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Compute normalised participants per experiment per task
# ─────────────────────────────────────────────────────────────────────────────

# task_info[yaml_task] = {
#   "domain", "csv_task",
#   "baseline",
#   "by_experiment": {
#       "model": {
#           "raw_scores":  {model: score},
#           "best_raw", "worst_raw",
#           "participants": [{participant_name, experiment_type, normalized_score, raw_score}],
#           "best_participant",
#       },
#       "framework": { ... },
#   },
#   "last_updated"
# }
task_info: dict = {}

for exp_type, exp_raw in raw_data.items():
    for yaml_task, info in exp_raw.items():
        if info["baseline"] is None:
            continue
        raw_scores = info["raw_scores"]
        if not raw_scores:
            continue

        if yaml_task not in task_info:
            task_info[yaml_task] = {
                "domain":        info["domain"],
                "csv_task":      info["csv_task"],
                "baseline":      info["baseline"],
                "by_experiment": {},
                "last_updated": timestamp(),
            }

        best_raw  = max(raw_scores.values())
        worst_raw = min(raw_scores.values())

        raw_vals = list(raw_scores.values())
        min_raw  = min(raw_vals)
        max_raw  = max(raw_vals)
        if abs(max_raw - min_raw) < 1e-12:
            participants = [
                {"participant_name": m, "experiment_type": exp_type,
                 "normalized_score": 1.0, "raw_score": v}
                for m, v in raw_scores.items()
            ]
        else:
            participants = [
                {"participant_name": m, "experiment_type": exp_type,
                 "normalized_score": (v - min_raw) / (max_raw - min_raw),
                 "raw_score": v}
                for m, v in raw_scores.items()
            ]

        participants.sort(key=lambda x: x["normalized_score"], reverse=True)

        task_info[yaml_task]["by_experiment"][exp_type] = {
            "raw_scores":       dict(raw_scores),
            "best_raw":        best_raw,
            "worst_raw":       worst_raw,
            "participants":    participants,
            "best_participant": participants[0],
        }

# Fill in missing experiment entries (e.g. TriMul only in framework CSV)
for yaml_task, info in task_info.items():
    for exp_type in ("model", "framework"):
        if exp_type not in info["by_experiment"]:
            info["by_experiment"][exp_type] = {
                "raw_scores":      {},
                "best_raw":        None,
                "worst_raw":       None,
                "participants":    [],
                "best_participant": None,
            }

total_tasks = len(task_info)
print(f"\n  → {total_tasks} tasks with valid data\n")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Write individual problem YAML files
# ─────────────────────────────────────────────────────────────────────────────
updated_existing = 0
created_new = 0

for yaml_task, info in task_info.items():
    path = os.path.join(PROB_DIR, f"{yaml_task}.yaml")

    # Merge participants from both experiments (already sorted by norm score desc)
    all_participants = (
        info["by_experiment"]["model"]["participants"] +
        info["by_experiment"]["framework"]["participants"]
    )

    model_p = info["by_experiment"]["model"]["participants"]
    fw_p    = info["by_experiment"]["framework"]["participants"]

    if model_p:
        best_model_raw  = info["by_experiment"]["model"]["best_raw"]
        worst_model_raw = info["by_experiment"]["model"]["worst_raw"]
    else:
        best_model_raw  = None
        worst_model_raw = None

    if fw_p:
        best_fw_raw  = info["by_experiment"]["framework"]["best_raw"]
        worst_fw_raw = info["by_experiment"]["framework"]["worst_raw"]
    else:
        best_fw_raw  = None
        worst_fw_raw = None

    overall_best_raw  = None
    overall_worst_raw = None
    if best_raws := [r for r in (best_model_raw, best_fw_raw) if r is not None]:
        overall_best_raw = max(best_raws)
    if worst_raws := [r for r in (worst_model_raw, worst_fw_raw) if r is not None]:
        overall_worst_raw = min(worst_raws)

    overall_best_participant = all_participants[0] if all_participants else None

    if os.path.exists(path):
        existing = load_existing_yaml(path)
        metadata = dict(existing.get("metadata", {}))
        metadata["normalization"] = {
            "baseline_score":     info["baseline"],
            "best_score":        overall_best_raw,
            "improvement_factor": 1.5,
        }
        data = {
            "metadata":   metadata,
            "statistics": {
                "raw_score": {
                    "max":      overall_best_raw,
                    "min":      overall_worst_raw,
                    "baseline": info["baseline"],
                },
                "normalized_score": {
                    "max":      overall_best_participant["normalized_score"] if overall_best_participant else None,
                    "min":      all_participants[-1]["normalized_score"] if all_participants else None,
                    "baseline": None,
                },
                "best": {
                    "raw_score":         overall_best_raw,
                    "normalized_score":  overall_best_participant["normalized_score"] if overall_best_participant else None,
                    "participant":       overall_best_participant["participant_name"] if overall_best_participant else None,
                    "achieved_at":        None,
                },
                "last_updated":       info["last_updated"],
                "total_submissions":  len(all_participants),
                "model_submissions":   len(model_p),
                "framework_submissions": len(fw_p),
            },
            "participants":    all_participants,
            "global_evolution": [],
        }
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
                    "best_score":        overall_best_raw,
                    "improvement_factor": 1.5,
                },
            },
            "statistics": {
                "raw_score": {
                    "max":      overall_best_raw,
                    "min":      overall_worst_raw,
                    "baseline": info["baseline"],
                },
                "normalized_score": {
                    "max":      overall_best_participant["normalized_score"] if overall_best_participant else None,
                    "min":      all_participants[-1]["normalized_score"] if all_participants else None,
                    "baseline": None,
                },
                "best": {
                    "raw_score":         overall_best_raw,
                    "normalized_score":  overall_best_participant["normalized_score"] if overall_best_participant else None,
                    "participant":       overall_best_participant["participant_name"] if overall_best_participant else None,
                    "achieved_at":        None,
                },
                "last_updated":       info["last_updated"],
                "total_submissions":  len(all_participants),
                "model_submissions":   len(model_p),
                "framework_submissions": len(fw_p),
            },
            "participants":    all_participants,
            "global_evolution": [],
        }
        dump_yaml(data, path)
        created_new += 1

print(f"  Updated {updated_existing} existing YAML files")
print(f"  Created  {created_new} new YAML files")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Write separate overall leaderboard files for each experiment
# ─────────────────────────────────────────────────────────────────────────────
def write_overall_yaml(exp_type: str, models: list, out_path: str):
    rankings = []
    for model in models:
        task_scores: dict = {}
        for yaml_task, info in task_info.items():
            exp_data = info["by_experiment"].get(exp_type)
            if not exp_data:
                continue
            rs = exp_data["raw_scores"]
            if model not in rs:
                continue
            raw      = rs[model]
            min_raw  = exp_data["worst_raw"]
            max_raw  = exp_data["best_raw"]
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
            "total_tasks": total_tasks,
            "experiment_type": exp_type,
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
    dump_yaml(overall_data, out_path)
    print(f"  Wrote {os.path.basename(out_path)}: {len(rankings)} participants")

write_overall_yaml("model",     all_models["model"],     OVERALL_MODEL)
write_overall_yaml("framework", all_models["framework"], OVERALL_FRAMEWORK)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Update tasks_index.yaml
# ─────────────────────────────────────────────────────────────────────────────
idx_data = load_existing_yaml(TASKS_IDX)
existing_tasks_map = {t["task_name"]: t for t in idx_data.get("tasks", [])}

for yaml_task, info in task_info.items():
    model_p = info["by_experiment"]["model"]["participants"]
    fw_p    = info["by_experiment"]["framework"]["participants"]

    if yaml_task in existing_tasks_map:
        existing_tasks_map[yaml_task]["statistics"] = {
            "best_normalized_score": (model_p[0]["normalized_score"] if model_p
                                     else fw_p[0]["normalized_score"] if fw_p else None),
            "total_participants":    len(model_p) + len(fw_p),
            "model_submissions":     len(model_p),
            "framework_submissions": len(fw_p),
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
                "best_normalized_score": (model_p[0]["normalized_score"] if model_p
                                         else fw_p[0]["normalized_score"] if fw_p else None),
                "total_participants":    len(model_p) + len(fw_p),
                "model_submissions":     len(model_p),
                "framework_submissions": len(fw_p),
                "last_updated":         info["last_updated"],
            },
        }

all_tasks = sorted(existing_tasks_map.values(),
                   key=lambda t: (t.get("domain", ""), t.get("task_name", "")))

# Only keep tasks that are present in CSV data; remove stale entries.
csv_task_set = set(task_info.keys())
all_tasks = [t for t in all_tasks if t["task_name"] in csv_task_set]
idx_data["tasks"] = all_tasks

dump_yaml(idx_data, TASKS_IDX)
print(f"\n  Updated tasks_index.yaml → {len(all_tasks)} tasks total\n")

print("Done ✓")
