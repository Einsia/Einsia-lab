# Leaderboard 数据文件说明

本目录包含 Leaderboard 系统的 YAML 数据文件。

## 文件结构

```
data/
├── overall.yaml              # 总榜数据（所有任务的综合排名）
├── tasks_index.yaml          # 任务索引（快速查找所有任务）
└── problems/                 # 各任务数据目录
    ├── MannedLunarLanding.yaml
    ├── ISCSO2023.yaml
    ├── ISCSO2015.yaml
    └── ... (共 47 个任务)
```

## 数据结构说明

### 1. 单题数据结构 (`problems/{task_name}.yaml`)

每个任务一个独立的 YAML 文件，包含：

- **metadata**: 任务元数据
  - `task_name`: 任务名称
  - `domain`: 所属领域
  - `title_zh` / `title_en`: 中英文标题
  - `status`: 状态（Completed / In Development）
  - `contributor` / `reviewer`: 贡献者和审查者
  - `normalization`: 归一化参数
    - `baseline_score`: 初始/基准分数
    - `best_score`: 理论最优或已知最好分数
    - `improvement_factor`: 当没有 best_score 时使用的改进倍数

- **statistics**: 统计信息
  - `raw_score`: 原始分值统计（max, min, baseline）
  - `normalized_score`: 归一化分值统计（max, min, baseline）
  - `best`: 最佳分数信息（raw_score, normalized_score, participant, achieved_at）
  - `last_updated`: 最后更新时间
  - `total_submissions`: 总提交数

- **participants**: 参赛者列表（按归一化分数降序排序）
  - 每个参赛者包含：
    - `name`: 参赛者名称
    - `rank`: 排名
    - `raw_score`: 原始分数
    - `normalized_score`: 归一化分数
    - `submitted_at`: 提交时间
    - `evolution`: 该参赛者的历史演进（里程碑式，只记录最佳分数变化）

- **global_evolution**: 全局分数演进（记录最佳分数的变化里程碑）
  - 每个里程碑包含：
    - `timestamp`: 时间戳
    - `best_raw_score`: 最佳原始分数
    - `best_normalized_score`: 最佳归一化分数
    - `best_participant`: 最佳参赛者
    - `note`: 备注

### 2. 总榜数据结构 (`overall.yaml`)

汇总所有题目的综合排名：

- **metadata**: 总榜元数据
  - `last_updated`: 最后更新时间
  - `total_tasks`: 总任务数

- **rankings**: 综合排名列表（按平均归一化分数排序）
  - 每个排名包含：
    - `name`: 参赛者名称
    - `rank`: 排名
    - `total_normalized_score`: 综合归一化分数
    - `total_raw_score`: 综合原始分数
    - `task_scores`: 各题分数详情
    - `evolution`: 总榜演进历史（里程碑式）

- **statistics**: 全局统计
  - `normalized_score`: 归一化分数统计（max, min）
  - `raw_score`: 原始分数统计（max, min）

### 3. 任务索引 (`tasks_index.yaml`)

快速索引所有任务：

- **tasks**: 任务列表
  - 每个任务包含：
    - `task_name`: 任务名称
    - `domain`: 所属领域
    - `file`: 文件名
    - `status`: 状态
    - `statistics`: 统计信息（best_normalized_score, total_participants, last_updated）

## 归一化分数计算

归一化分数计算公式：

```python
if best_score is None:
    # 使用 improvement_factor 推算
    if baseline_score < 0:
        best_score = baseline_score / improvement_factor  # 最小化问题
    else:
        best_score = baseline_score * improvement_factor  # 最大化问题

normalized_score = (raw_score - baseline_score) / (best_score - baseline_score)
normalized_score = max(0.0, min(1.0, normalized_score))  # 限制在 [0, 1]
```

## 更新数据

使用 `scripts/generate_leaderboard_yaml.py` 脚本可以：
- 生成初始 YAML 文件
- 更新任务列表和元数据

未来可以扩展脚本以：
- 从评估结果自动更新分数
- 自动计算归一化分数
- 记录分数演进历史

## 任务列表

当前 v1 共 47 个任务，分为 5 大类（v1-lite 为其中 10 题代表性子集）。早期文件中列出的 25 题为历史快照：

1. MannedLunarLanding (Astrodynamics)
2. CarAerodynamicsSensing (Aerodynamics)
3. ISCSO2015 (StructuralOptimization)
4. ISCSO2023 (StructuralOptimization)
5. denoising (Single Cell Analysis)
6. perturbation_prediction (Single Cell Analysis)
7. predict_modality (Single Cell Analysis)
8. RobotArmCycleTime (Robotics)
9. QuadrupedGait (Robotics)
10. DynamicObstacleNavigation (Robotics)
11. TriMul (Kernel Engineering)
12. MLA (Kernel Engineering)
13. MallocLab (Computer Systems)
14. HighReliableSimulation (WirelessChannelSimulation)
15. crypto_aes128 (Cryptographic)
16. crypto_sha256 (Cryptographic)
17. crypto_sha3_256 (Cryptographic)
18. CY_03 (EngDesign)
19. WJ_01 (EngDesign)
20. XY_05 (EngDesign)
21. AM_02 (EngDesign)
22. AM_03 (EngDesign)
23. YJ_02 (EngDesign)
24. YJ_03 (EngDesign)
25. IntegrationPhysicalDesignOptimization (ElectronicDesignAutomation) - 开发中

## 新题目提交

新题目只需提供**一份 YAML 元数据**即可整合。请使用模板 `task_metadata_template.yaml` 填写后发送至 **yks23@mails.tsinghua.edu.cn**。格式说明见 [TASK_SUBMISSION.md](TASK_SUBMISSION.md)，网站 Contact 页面亦有说明。

