<div align="center">

# ⚙️ Frontier-Engineering Bench

**A rigorous leaderboard for frontier AI on real engineering tasks**

[![Tasks](https://img.shields.io/badge/Tasks-35+-blue?style=flat-square)](data/problems/)
[![GitHub Pages](https://img.shields.io/badge/Live-GitHub%20Pages-brightgreen?style=flat-square&logo=github)](https://einsia.github.io/Einsia-lab/frontier-eng/)
[![Data](https://img.shields.io/badge/Format-YAML-orange?style=flat-square)]()

[🏆 Leaderboard](leaderboard.html) · [📋 All Tasks](index.html) · [📖 Data Docs](data/README.md)

</div>

---

## What is this?

Frontier-Engineering Bench evaluates state-of-the-art AI models on **real engineering optimization problems** — structural design, chemical synthesis, robotics, scheduling, and more. Unlike math/code benchmarks, these tasks have no shortcut: you either find a better solution or you don't.

| | |
|---|---|
| **Tasks** | 35+ problems across 6 domains |
| **Scoring** | Normalized 0–1, raw score preserved |
| **Models** | Frontier LLMs + agentic frameworks |

## Quick Start

```bash
python -m http.server 8000
# → http://localhost:8000
```

## Updating Scores

```bash
python scripts/generate_leaderboard_yaml.py
```

Then commit — GitHub Pages deploys automatically on push to `main`.

<details>
<summary>📁 Project structure</summary>

```
frontier-eng/
├── index.html          # Task list & compact leaderboard
├── leaderboard.html    # Full rankings (bar chart + heatmap)
├── problem.html        # Per-task detail page
├── css/                # Stylesheets
├── js/                 # scripts.js, utils.js, js-yaml.min.js
└── data/
    ├── overall-model.yaml      # Model leaderboard
    ├── overall-framework.yaml  # Framework leaderboard
    ├── tasks_index.yaml        # Task metadata
    └── problems/               # Per-task YAML files (35+)
```

</details>

<details>
<summary>🚀 GitHub Pages deployment</summary>

1. **Settings → Pages → Source**: set to `GitHub Actions`
2. Push to `main` — the workflow auto-deploys the site

Manual trigger: **Actions → "Deploy Leaderboard to GitHub Pages" → Run workflow**

</details>
