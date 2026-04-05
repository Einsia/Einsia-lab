#!/usr/bin/env python3
"""
生成 Leaderboard YAML 数据结构
基于 README.md 中的真实任务列表
"""

from pathlib import Path
from datetime import datetime
import yaml

# 任务列表（从 README.md 提取）
TASKS = [
    {
        "task_name": "MannedLunarLanding",
        "domain": "Astrodynamics",
        "title_zh": "登月软着陆轨迹优化",
        "title_en": "Lunar soft landing trajectory optimization",
        "status": "Completed",
        "contributor": "@jdp22",
        "reviewer": "@jdp22",
        "baseline_score": None,  # 需要从实际运行获取
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "CarAerodynamicsSensing",
        "domain": "Aerodynamics",
        "title_zh": "3D 汽车表面传感器布局优化，用于压力场重建",
        "title_en": "Sensor placement on 3D car surface for pressure field reconstruction",
        "status": "Completed",
        "contributor": "@LeiDQ, @llltttwww",
        "reviewer": "@llltttwww",
        "baseline_score": 0.0,
        "best_score": 1.0,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "ISCSO2015",
        "domain": "StructuralOptimization",
        "title_zh": "45 杆 2D 桁架尺寸+形状优化",
        "title_en": "45-bar 2D truss size + shape optimization",
        "status": "Completed",
        "contributor": "@yks23",
        "reviewer": "@yks23",
        "baseline_score": -2473.82,  # 从 README 获取
        "best_score": -1751.5,  # Human best
        "improvement_factor": 1.5,
    },
    {
        "task_name": "ISCSO2023",
        "domain": "StructuralOptimization",
        "title_zh": "284 杆 3D 桁架尺寸优化",
        "title_en": "284-member 3D truss sizing optimization",
        "status": "Completed",
        "contributor": "@yks23",
        "reviewer": "@yks23",
        "baseline_score": -77813.0,  # 从 README 获取
        "best_score": -6619.66,  # Human best
        "improvement_factor": 1.5,
    },
    {
        "task_name": "denoising",
        "domain": "Single Cell Analysis",
        "title_zh": "Open Problems 单细胞分析",
        "title_en": "Open Problems in Single-Cell Analysis",
        "status": "Completed",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": 0.0,  # no_denoising
        "best_score": 1.0,  # perfect_denoising
        "improvement_factor": 1.5,
    },
    {
        "task_name": "perturbation_prediction",
        "domain": "Single Cell Analysis",
        "title_zh": "OpenProblems 扰动响应预测（NeurIPS 2023 scPerturb）",
        "title_en": "NeurIPS 2023 scPerturb",
        "status": "Completed",
        "contributor": "@llltttwww",
        "reviewer": "@llltttwww",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "predict_modality",
        "domain": "Single Cell Analysis",
        "title_zh": "OpenProblems 模态预测（NeurIPS 2021，RNA→ADT）",
        "title_en": "NeurIPS 2021, RNA→ADT",
        "status": "Completed",
        "contributor": "@llltttwww",
        "reviewer": "@llltttwww",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "RobotArmCycleTime",
        "domain": "Robotics",
        "title_zh": "机器人臂周期时间优化",
        "title_en": "Robot arm cycle time optimization",
        "status": "Completed",
        "contributor": None,
        "reviewer": None,
        "baseline_score": 0.292,  # 1.0 / (1.0 + 2.4224)
        "best_score": 1.0,  # 理论最优
        "improvement_factor": 1.5,
    },
    {
        "task_name": "QuadrupedGait",
        "domain": "Robotics",
        "title_zh": "四足机器人步态优化",
        "title_en": "Quadruped gait optimization",
        "status": "Completed",
        "contributor": None,
        "reviewer": None,
        "baseline_score": 0.02215,  # raw speed
        "best_score": 2.0,  # 假设最优速度
        "improvement_factor": 1.5,
    },
    {
        "task_name": "DynamicObstacleNavigation",
        "domain": "Robotics",
        "title_zh": "动态障碍物导航",
        "title_en": "Dynamic obstacle navigation",
        "status": "Completed",
        "contributor": None,
        "reviewer": None,
        "baseline_score": 0.072,  # 1.0 / (1.0 + 12.85)
        "best_score": 1.0,  # 理论最优
        "improvement_factor": 1.5,
    },
    {
        "task_name": "TriMul",
        "domain": "Kernel Engineering",
        "title_zh": "GPUMode 三角乘法",
        "title_en": "GPUMode Triangle Multiplication",
        "status": "Completed",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "MLA",
        "domain": "Kernel Engineering",
        "title_zh": "GPUMode MLA 解码内核",
        "title_en": "GPUMode MLA Decode Kernel",
        "status": "Completed",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "MallocLab",
        "domain": "Computer Systems",
        "title_zh": "动态内存分配实验",
        "title_en": "Dynamic memory allocation",
        "status": "Completed",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": 0.0,
        "best_score": 100.0,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "HighReliableSimulation",
        "domain": "WirelessChannelSimulation",
        "title_zh": "使用重要性采样估计 Hamming(127,120) 的误码率",
        "title_en": "BER estimation with importance sampling for Hamming(127,120)",
        "status": "Completed",
        "contributor": "@tonyhaohan",
        "reviewer": "@yks23, @ahydchh",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "crypto_aes128",
        "domain": "Cryptographic",
        "title_zh": "Advanced Encryption Standard, 128-bit key, Counter mode",
        "title_en": "AES-128 CTR",
        "status": "Completed",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "crypto_sha256",
        "domain": "Cryptographic",
        "title_zh": "Secure Hash Algorithm 256-bit",
        "title_en": "SHA-256",
        "status": "Completed",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "crypto_sha3_256",
        "domain": "Cryptographic",
        "title_zh": "Secure Hash Algorithm 3 256-bit",
        "title_en": "SHA3-256",
        "status": "Completed",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    # EngDesign 子任务
    {
        "task_name": "CY_03",
        "domain": "EngDesign",
        "title_zh": "EngDesign CY_03",
        "title_en": "EngDesign CY_03",
        "status": "Completed",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "WJ_01",
        "domain": "EngDesign",
        "title_zh": "EngDesign WJ_01",
        "title_en": "EngDesign WJ_01",
        "status": "Completed",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "XY_05",
        "domain": "EngDesign",
        "title_zh": "EngDesign XY_05",
        "title_en": "EngDesign XY_05",
        "status": "Completed",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "AM_02",
        "domain": "EngDesign",
        "title_zh": "EngDesign AM_02",
        "title_en": "EngDesign AM_02",
        "status": "Completed",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "AM_03",
        "domain": "EngDesign",
        "title_zh": "EngDesign AM_03",
        "title_en": "EngDesign AM_03",
        "status": "Completed",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "YJ_02",
        "domain": "EngDesign",
        "title_zh": "EngDesign YJ_02",
        "title_en": "EngDesign YJ_02",
        "status": "Completed",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "YJ_03",
        "domain": "EngDesign",
        "title_zh": "EngDesign YJ_03",
        "title_en": "EngDesign YJ_03",
        "status": "Completed",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
    {
        "task_name": "IntegrationPhysicalDesignOptimization",
        "domain": "ElectronicDesignAutomation",
        "title_zh": "芯片宏单元布局优化",
        "title_en": "Chip macro placement optimization",
        "status": "In Development",
        "contributor": "@ahydchh",
        "reviewer": "@ahydchh",
        "baseline_score": None,
        "best_score": None,
        "improvement_factor": 1.5,
    },
]

def normalize_score(raw_score, baseline_score, best_score, improvement_factor=1.5):
    """计算归一化分数"""
    if baseline_score is None:
        return None
    
    if best_score is None:
        # 使用 improvement_factor 推算 best_score
        if baseline_score < 0:
            # 最小化问题
            best_score = baseline_score / improvement_factor
        else:
            # 最大化问题
            best_score = baseline_score * improvement_factor
    
    if abs(best_score - baseline_score) < 1e-9:
        if abs(raw_score - baseline_score) < 1e-9:
            return 1.0
        return 0.0
    
    normalized = (raw_score - baseline_score) / (best_score - baseline_score)
    return max(0.0, min(1.0, normalized))

def create_task_yaml(task_info, output_dir):
    """为单个任务创建 YAML 文件"""
    task_name = task_info["task_name"]
    baseline = task_info["baseline_score"]
    best = task_info["best_score"]
    
    # 计算统计信息
    if baseline is not None:
        raw_max = best if best is not None else (baseline * 1.5 if baseline >= 0 else baseline / 1.5)
        raw_min = baseline
        norm_max = 1.0
        norm_min = 0.0
    else:
        raw_max = None
        raw_min = None
        norm_max = None
        norm_min = None
    
    yaml_data = {
        "metadata": {
            "task_name": task_name,
            "domain": task_info["domain"],
            "title_zh": task_info["title_zh"],
            "title_en": task_info["title_en"],
            "status": task_info["status"],
            "contributor": task_info["contributor"],
            "reviewer": task_info["reviewer"],
            "normalization": {
                "baseline_score": baseline,
                "best_score": best,
                "improvement_factor": task_info["improvement_factor"],
            },
        },
        "statistics": {
            "raw_score": {
                "max": raw_max,
                "min": raw_min,
                "baseline": baseline,
            },
            "normalized_score": {
                "max": norm_max,
                "min": norm_min,
                "baseline": 0.0,
            },
            "best": {
                "raw_score": best,
                "normalized_score": 1.0 if best is not None else None,
                "participant": None,
                "achieved_at": None,
            },
            "last_updated": datetime.now().isoformat() + "Z",
            "total_submissions": 0,
        },
        "participants": [],
        "global_evolution": [],
    }
    
    file_path = output_dir / f"{task_name}.yaml"
    with open(file_path, "w", encoding="utf-8") as f:
        yaml.dump(yaml_data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    
    return yaml_data

def create_tasks_index(tasks, output_dir):
    """创建任务索引文件"""
    index_data = {
        "tasks": []
    }
    
    for task in tasks:
        task_data = {
            "task_name": task["task_name"],
            "domain": task["domain"],
            "file": f"{task['task_name']}.yaml",
            "status": task["status"],
            "statistics": {
                "best_normalized_score": None,
                "total_participants": 0,
                "last_updated": datetime.now().isoformat() + "Z",
            },
        }
        index_data["tasks"].append(task_data)
    
    file_path = output_dir / "tasks_index.yaml"
    with open(file_path, "w", encoding="utf-8") as f:
        yaml.dump(index_data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

def create_overall_yaml(tasks, output_dir):
    """创建总榜文件"""
    overall_data = {
        "metadata": {
            "last_updated": datetime.now().isoformat() + "Z",
            "total_tasks": len([t for t in tasks if t["status"] == "Completed"]),
        },
        "rankings": [],
        "statistics": {
            "normalized_score": {
                "max": None,
                "min": None,
            },
            "raw_score": {
                "max": None,
                "min": None,
            },
        },
    }
    
    file_path = output_dir / "overall.yaml"
    with open(file_path, "w", encoding="utf-8") as f:
        yaml.dump(overall_data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

def main():
    repo_root = Path(__file__).parent.parent
    data_dir = repo_root / "data"
    problems_dir = data_dir / "problems"
    
    problems_dir.mkdir(parents=True, exist_ok=True)
    
    # 为每个任务创建 YAML 文件
    for task in TASKS:
        create_task_yaml(task, problems_dir)
    
    # 创建索引文件
    create_tasks_index(TASKS, data_dir)
    
    # 创建总榜文件
    create_overall_yaml(TASKS, data_dir)
    
    print(f"Generated {len(TASKS)} task YAML files in {problems_dir}")
    print(f"Generated tasks_index.yaml and overall.yaml in {data_dir}")

if __name__ == "__main__":
    main()

