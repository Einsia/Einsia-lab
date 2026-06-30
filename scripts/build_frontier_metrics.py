#!/usr/bin/env python3
"""
Build Frontier-Eng derived metrics from the released raw score table.

Inputs
------
public/frontier-eng/data/experiments/exp1_models_raw.csv
    Experiment 1 best-feasible scores: 8 foundation models x 47 tasks under
    openevolve (100 iterations), with gpt-5.4 replaced by its retest run.
    Higher is always better (every model starts from a feasible baseline and
    can only improve on it).

Outputs (public/frontier-eng/data/)
-----------------------------------
medal_podium.json       per-task gold / silver / bronze threshold scores
medal_podium.csv        same, human-readable
medal_leaderboard.json  per-model Medal Score (sum of per-task podium credit)
v1_lite.json            the 10-task v1-lite representative subset + rationale

Medal Score (a.k.a. the gold/silver/bronze podium)
--------------------------------------------------
For each task we take the top-3 best-feasible scores across the participating
models and freeze them as peer baselines: gold = 1st, silver = 2nd, bronze = 3rd.
A model then earns, on that task,
    1.00  if its score >= gold
    0.67  if its score >= silver
    0.33  if its score >= bronze
    0.00  otherwise
A model's Medal Score is the sum over all tasks. The metric is peer-relative
(no theoretical optimum needed), unit-free, and robust to negligible margins:
it only rewards reaching the per-task frontier (podium), which makes
cross-task aggregation fairer than crediting every ordinal position.

gpt-oss-120b is part of the paper's 9-model rank tables but its per-task raw
scores were not retained, so the released podium is computed over the 8 models
with available raw scores (consistent with "release concrete podium values").
"""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "frontier-eng" / "data"
SRC = DATA / "experiments" / "exp1_models_raw.csv"

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

GOLD, SILVER, BRONZE = 1.00, 0.67, 0.33


def load_rows():
    rows = {}
    with open(SRC, encoding="utf-8-sig") as f:
        r = csv.reader(f)
        header = next(r)
        idx = {m: header.index(m + "_best") for m in MODELS}
        bi = header.index("Baseline")
        for row in r:
            if not row or not row[0].strip() or row[0].strip() == "Average":
                continue
            t = row[0].strip()
            baseline = row[bi].strip()
            vals = {}
            for m in MODELS:
                c = row[idx[m]].strip()
                vals[m] = float(c) if c not in ("", "-") else None
            rows[t] = {
                "baseline": float(baseline) if baseline not in ("", "-") else None,
                "vals": vals,
            }
    return rows


def build_podium(rows):
    """Per-task gold/silver/bronze thresholds and each model's medal points."""
    podium = {}
    for t, info in rows.items():
        present = sorted(
            ((m, v) for m, v in info["vals"].items() if v is not None),
            key=lambda kv: -kv[1],
        )
        if len(present) < 3:
            continue
        gv, sv, bv = present[0][1], present[1][1], present[2][1]
        podium[t] = {
            "category": TASK_CATEGORY.get(t, "?"),
            "baseline": info["baseline"],
            "gold": {"score": gv, "models": [m for m, v in present if v == gv]},
            "silver": {"score": sv, "models": [m for m, v in present if v == sv]},
            "bronze": {"score": bv, "models": [m for m, v in present if v == bv]},
            "model_points": {},
        }
        for m, v in present:
            pts = GOLD if v >= gv else SILVER if v >= sv else BRONZE if v >= bv else 0.0
            podium[t]["model_points"][m] = pts
    return podium


def leaderboard_for(podium, tasks):
    """Normalized Medal Score over a task set: mean per-task podium credit in
    [0, 1]. gold/silver/bronze columns count podium finishes within the set."""
    n = len(tasks)
    total = {m: 0.0 for m in MODELS}
    counts = {m: {"gold": 0, "silver": 0, "bronze": 0} for m in MODELS}
    for t in tasks:
        for m, pts in podium[t]["model_points"].items():
            total[m] += pts
            if pts == GOLD:
                counts[m]["gold"] += 1
            elif pts == SILVER:
                counts[m]["silver"] += 1
            elif pts == BRONZE:
                counts[m]["bronze"] += 1
    board = sorted(
        ({"model": m, "medal": round(total[m] / n, 4),
          "medal_raw": round(total[m], 2), **counts[m]} for m in MODELS),
        key=lambda d: -d["medal"],
    )
    for i, d in enumerate(board, 1):
        d["rank"] = i
    return board


def graduality(rows):
    """Score each task for v1-lite eligibility.

    We want tasks whose best-feasible scores climb gradually with the search
    budget, rather than (a) being one-shot saturated (most models pinned at the
    ceiling) or (b) all-or-nothing (scores split between baseline and ceiling).
    Using only released best scores, we proxy this by how the 8 models' final
    scores spread across the baseline -> best improvement axis: a task that
    spreads models across many distinct *intermediate* levels is one where
    incremental effort keeps paying off.
    """
    stats = {}
    for t, info in rows.items():
        vals = [v for v in info["vals"].values() if v is not None]
        base = info["baseline"]
        if len(vals) < 3 or base is None:
            continue
        best = max(vals)
        span = best - base
        if span <= 0:
            stats[t] = {"graduality": 0.0, "note": "no improvement over baseline"}
            continue
        norm = [min(1.0, max(0.0, (v - base) / span)) for v in vals]
        n = len(norm)
        # fraction landing in the informative middle band (not stuck low, not saturated high)
        mid = sum(1 for x in norm if 0.15 <= x <= 0.92) / n
        # how many distinct improvement levels the models reached
        distinct = len({round(x, 2) for x in norm}) / n
        # saturation penalty: many models clustered within 3% of the ceiling
        sat = sum(1 for x in norm if x >= 0.97) / n
        score = distinct * mid * (1.0 - sat)
        stats[t] = {
            "category": TASK_CATEGORY.get(t, "?"),
            "graduality": round(score, 4),
            "distinct_levels": round(distinct, 3),
            "mid_band": round(mid, 3),
            "ceiling_cluster": round(sat, 3),
            "baseline": base, "best": best,
        }
    return stats


def pick_v1_lite(stats, per_category=2):
    """Pick `per_category` tasks per category, maximizing graduality while
    favoring distinct benchmark families (the prefix before the first '_') so
    the subset stays diverse rather than e.g. two job-shop instances."""
    selection = []
    for cat in CATEGORY:
        cands = [(t, s) for t, s in stats.items() if s.get("category") == cat]
        cands.sort(key=lambda kv: -kv[1]["graduality"])
        picked, fams = [], set()
        for t, s in cands:                       # first pass: one per family
            fam = t.split("_")[0]
            if fam not in fams:
                picked.append((t, s)); fams.add(fam)
            if len(picked) == per_category:
                break
        for t, s in cands:                       # backfill if a category lacks families
            if len(picked) == per_category:
                break
            if (t, s) not in picked:
                picked.append((t, s))
        for t, s in picked[:per_category]:
            selection.append({"task": t, "category": cat, **s})
    return selection


def main():
    rows = load_rows()
    podium = build_podium(rows)
    stats = graduality(rows)
    v1_lite = pick_v1_lite(stats)
    v1_lite_tasks = [d["task"] for d in v1_lite]

    board_v1 = leaderboard_for(podium, list(podium))
    board_v1_lite = leaderboard_for(podium, v1_lite_tasks)

    (DATA / "medal_podium.json").write_text(
        json.dumps({"metric": "medal", "snapshot": "v1 (2026-04-14)", "n_tasks": len(podium),
                    "tiers": {"gold": GOLD, "silver": SILVER, "bronze": BRONZE},
                    "tasks": podium}, ensure_ascii=False, indent=2))
    (DATA / "medal_leaderboard.json").write_text(
        json.dumps({"metric": "medal", "normalization": "mean per-task podium credit in [0,1]",
                    "snapshot": "v1 (2026-04-14)", "models": len(MODELS),
                    "v1": {"n_tasks": len(podium), "leaderboard": board_v1},
                    "v1_lite": {"n_tasks": len(v1_lite_tasks), "leaderboard": board_v1_lite}},
                   ensure_ascii=False, indent=2))
    with open(DATA / "medal_podium.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Task", "Category", "Baseline",
                    "Gold", "Gold_model", "Silver", "Silver_model", "Bronze", "Bronze_model"])
        for t, d in podium.items():
            w.writerow([t, d["category"], d["baseline"],
                        d["gold"]["score"], "/".join(d["gold"]["models"]),
                        d["silver"]["score"], "/".join(d["silver"]["models"]),
                        d["bronze"]["score"], "/".join(d["bronze"]["models"])])
    (DATA / "v1_lite.json").write_text(
        json.dumps({"name": "v1-lite", "size": len(v1_lite),
                    "selection_rule": "top-2 graduality tasks per engineering category",
                    "tasks": v1_lite}, ensure_ascii=False, indent=2))

    print(f"medal podium: {len(podium)} tasks (podium frozen at v1 snapshot 2026-04-14)")
    for label, board, n in [("v1 (47)", board_v1, len(podium)),
                            ("v1-lite (10)", board_v1_lite, len(v1_lite_tasks))]:
        print(f"\nMedal Score · {label} — normalized in [0,1]:")
        for d in board:
            print(f"  {d['rank']:>2} {d['model']:24} {d['medal']:.3f}"
                  f"  (G{d['gold']} S{d['silver']} B{d['bronze']})")
    print(f"\nv1-lite tasks:")
    for d in v1_lite:
        print(f"  [{d['category'][:22]:22}] {d['task']:50} grad={d['graduality']}")


if __name__ == "__main__":
    main()
