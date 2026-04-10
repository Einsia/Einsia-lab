<div align="center">

# ⚙️ Frontier-Engineering Bench

**用真实工程优化题目评测前沿 AI 的基准榜单**

[![任务数](https://img.shields.io/badge/任务-35+个-blue?style=flat-square)](data/problems/)
[![在线地址](https://img.shields.io/badge/在线-GitHub%20Pages-brightgreen?style=flat-square&logo=github)](https://einsia.github.io/Einsia-lab/frontier-eng/)
[![数据格式](https://img.shields.io/badge/格式-YAML-orange?style=flat-square)]()

[🏆 完整榜单](leaderboard.html) · [📋 任务列表](index.html) · [📖 数据文档](data/README.md)

</div>

---

## 这是什么？

Frontier-Engineering Bench 在**真实工程优化问题**上评测前沿 AI——结构设计、化学合成、机器人控制、调度优化等。和数学/代码题不同，这里没有捷径：要么找到更优解，要么没有。

| | |
|---|---|
| **题目** | 35+ 道，覆盖 6 个领域 |
| **评分** | 0–1 归一化分数，保留原始分值 |
| **参赛方** | 前沿大模型 + Agent 框架 |

## 快速启动

```bash
python -m http.server 8000
# → http://localhost:8000
```

## 更新数据

```bash
python scripts/generate_leaderboard_yaml.py
```

提交后推送到 `main`，GitHub Pages 自动部署。

<details>
<summary>📁 项目结构</summary>

```
frontier-eng/
├── index.html          # 任务列表 & 简明榜单
├── leaderboard.html    # 完整榜单（柱状图 + 热力图）
├── problem.html        # 单题详情页
├── css/                # 样式文件
├── js/                 # scripts.js, utils.js, js-yaml.min.js
└── data/
    ├── overall-model.yaml      # 模型榜单数据
    ├── overall-framework.yaml  # 框架榜单数据
    ├── tasks_index.yaml        # 任务索引
    └── problems/               # 单题 YAML（35+ 个）
```

</details>

<details>
<summary>🚀 部署到 GitHub Pages</summary>

1. **Settings → Pages → Source**：选择 `GitHub Actions`
2. 推送到 `main` 即自动部署

手动触发：**Actions → "Deploy Leaderboard to GitHub Pages" → Run workflow**

</details>
