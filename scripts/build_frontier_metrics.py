#!/usr/bin/env python3
"""Build website JSON from the published Frontier-Eng scores and podium.

The raw scores and medal_podium.csv are synchronized from the source commit
below. The CSV podium supplies the frozen medal thresholds; missing scores
earn zero points, and missing thresholds make that medal tier unavailable.
All 47 tasks remain in the full leaderboard's denominator. The ten v1-lite
tasks are read from the existing v1_lite.json without changing its selection
or the historical statistics used to choose it.

Run from any directory with ``python scripts/build_frontier_metrics.py``.
Only medal_podium.json and medal_leaderboard.json are generated.
"""

import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "frontier-eng" / "data"
SRC = DATA / "experiments" / "exp1_models_raw.csv"
PODIUM = DATA / "medal_podium.csv"
SNAPSHOT = "v1 (2026-09-15)"
SOURCE = {
    "repository": "https://github.com/Einsia/Frontier-Engineering",
    "commit": "ccf51f7b2ae9498539e151cc7feb5b1df06543ff",
}

MODELS = [
    "claude-opus-4.6", "deepseek-v3.2", "gemini-3.1-pro-preview", "glm-5",
    "gpt-5.4", "grok-4.20", "qwen3-coder-next", "seed-2.0-pro",
]

# 5 engineering categories (paper Table: Benchmark Overview). 10+9+8+10+10 = 47.
CATEGORY = {
    "Computing & Quantum Information": [
        "KernelEngineering_FlashAttention", "KernelEngineering_MLA", "KernelEngineering_TriMul",
        "ComputerSystems_MallocLab", "Cryptographic_AES-128", "Cryptographic_SHA-256",
        "Cryptographic_SHA3-256", "QuantumComputing_task_01_routing_qftentangled",
        "QuantumComputing_task_02_clifford_t_synthesis", "QuantumComputing_task_03_cross_target_qaoa",
    ],
    "Operations Research & Decision Science": [
        "InventoryOptimization_tree_gsm_safety_stock", "InventoryOptimization_general_meio",
        "InventoryOptimization_joint_replenishment", "InventoryOptimization_finite_horizon_dp",
        "InventoryOptimization_disruption_eoqd", "JobShop_abz", "JobShop_swv", "JobShop_ta",
        "PyPortfolioOpt_robust_mvo_rebalance",
    ],
    "Robotics, Control & Energy Systems": [
        "Robotics_DynamicObstacleAvoidanceNavigation", "Robotics_PIDTuning",
        "Robotics_QuadrupedGaitOptimization", "Robotics_RobotArmCycleTimeOptimization",
        "Robotics_UAVInspectionCoverageWithWind", "EnergyStorage_BatteryFastChargingProfile",
        "EnergyStorage_BatteryFastChargingSPMe", "SustainableDataCenterControl_hand_written_control",
    ],
    "Optics & Communication Systems": [
        "Optics_adaptive_fault_tolerant_fusion", "Optics_adaptive_temporal_smooth_control",
        "Optics_phase_dammann_uniform_orders", "Optics_phase_fourier_pattern_holography",
        "Optics_fiber_wdm_channel_power_allocation", "Optics_fiber_mcs_power_scheduling",
        "Optics_fiber_guardband_spectrum_packing", "Optics_holographic_multifocus_power_ratio",
        "Optics_holographic_multiplane_focusing", "WirelessChannelSimulation_HighReliableSimulation",
    ],
    "Physical Sciences & Engineering Design": [
        "StructuralOptimization_ISCSO2015", "StructuralOptimization_ISCSO2023",
        "StructuralOptimization_TopologyOptimization", "ReactionOptimisation_snar_multiobjective",
        "ReactionOptimisation_mit_case1_mixed", "ReactionOptimisation_reizman_suzuki_pareto",
        "Astrodynamics_MannedLunarLanding", "Aerodynamics_CarAerodynamicsSensing",
        "SingleCellAnalysis_predict_modality", "EngDesign",
    ],
}
TASK_CATEGORY = {t: c for c, ts in CATEGORY.items() for t in ts}

TIERS = {"gold": 1.00, "silver": 0.67, "bronze": 0.33}


def parse_score(value):
    """Represent absent or nonfinite scores as JSON null."""
    if value is None or value.strip() in ("", "-"):
        return None
    score = float(value)
    return score if math.isfinite(score) else None


def load_rows():
    rows = {}
    with SRC.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            task = row["Task"].strip()
            if not task or task == "Average":
                continue
            if task in rows:
                raise ValueError(f"Duplicate raw-score task: {task}")
            rows[task] = {
                "baseline": parse_score(row["Baseline"]),
                "vals": {m: parse_score(row[m + "_best"]) for m in MODELS},
            }
    return rows


def build_podium(rows):
    """Use the released CSV thresholds, including unavailable medal tiers."""
    podium = {}
    with PODIUM.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            task = row["Task"].strip()
            if task in podium:
                raise ValueError(f"Duplicate podium task: {task}")
            info = rows[task]
            baseline = parse_score(row["Baseline"])
            if baseline != info["baseline"]:
                raise ValueError(f"Raw and podium baselines differ: {task}")
            entry = {
                "category": TASK_CATEGORY[task],
                "baseline": baseline,
                "model_scores": info["vals"],
                "model_points": {},
            }
            for name in TIERS:
                score = parse_score(row[name.title()])
                entry[name] = {
                    "score": score,
                    "models": (
                        [m for m in row[name.title() + "_model"].split("/") if m]
                        if score is not None else []
                    ),
                }
            for model, score in info["vals"].items():
                points = 0.0
                if score is not None:
                    for name, credit in TIERS.items():
                        threshold = entry[name]["score"]
                        if threshold is not None and score >= threshold:
                            points = credit
                            break
                entry["model_points"][model] = points
            podium[task] = entry
    if set(podium) != set(rows) or len(podium) != 47:
        raise ValueError("Raw scores and podium must contain the same 47 tasks")
    return podium


def leaderboard_for(podium, tasks):
    """Average credit over the full task set, including invalid submissions."""
    board = []
    for model in MODELS:
        counts = {name: 0 for name in TIERS}
        for task in tasks:
            points = podium[task]["model_points"][model]
            for name, credit in TIERS.items():
                if points == credit:
                    counts[name] += 1
                    break
        # Integer hundredths retain exact ties before ranking and formatting.
        total = counts["gold"] * 100 + counts["silver"] * 67 + counts["bronze"] * 33
        board.append({
            "model": model,
            "medal": total / (100 * len(tasks)),
            "medal_raw": total / 100,
            **counts,
        })
    board.sort(key=lambda entry: -entry["medal_raw"])
    for entry in board:
        entry["rank"] = 1 + sum(other["medal_raw"] > entry["medal_raw"] for other in board)
    return board


def main():
    podium = build_podium(load_rows())
    lite = json.loads((DATA / "v1_lite.json").read_text(encoding="utf-8"))
    lite_tasks = [entry["task"] for entry in lite["tasks"]]
    if len(lite_tasks) != 10 or len(set(lite_tasks)) != 10:
        raise ValueError("The frozen v1-lite subset must contain ten unique tasks")
    if not set(lite_tasks) <= podium.keys():
        raise ValueError("The frozen v1-lite subset contains an unknown task")

    board_v1 = leaderboard_for(podium, list(podium))
    board_lite = leaderboard_for(podium, lite_tasks)
    metadata = {"metric": "medal", "snapshot": SNAPSHOT, "source": SOURCE}
    outputs = {
        "medal_podium.json": {
            **metadata, "n_tasks": len(podium), "tiers": TIERS, "tasks": podium,
        },
        "medal_leaderboard.json": {
            **metadata,
            "normalization": "mean per-task podium credit in [0,1]",
            "models": len(MODELS),
            "v1": {"n_tasks": len(podium), "leaderboard": board_v1},
            "v1_lite": {"n_tasks": len(lite_tasks), "leaderboard": board_lite},
        },
    }
    for name, output in outputs.items():
        (DATA / name).write_text(
            json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )

    print(f"Medal podium: {len(podium)} tasks; snapshot {SNAPSHOT}")
    for label, board in [("v1", board_v1), ("v1-lite", board_lite)]:
        print(f"\nMedal Score · {label}:")
        for entry in board:
            print(f"  {entry['rank']:>2} {entry['model']:24} {entry['medal']:.3f}"
                  f"  (G{entry['gold']} S{entry['silver']} B{entry['bronze']})")


if __name__ == "__main__":
    main()
