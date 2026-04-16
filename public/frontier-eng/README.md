<div align="center">

# ⚙️ Frontier-Engineering Bench

**A rigorous leaderboard for frontier AI on real engineering tasks**

English | <a href="./README_zh-CN.md">简体中文</a>

<a href="https://lab.einsia.ai/frontier-eng/"><img src="https://img.shields.io/badge/Homepage-lab.einsia.ai-0969DA?style=flat-square&amp;logo=homepage&amp;logoColor=white"></a>
<a href="http://arxiv.org/abs/2604.12290"><img src="https://img.shields.io/badge/arXiv-2604.12290-b31b1b?style=flat-square&amp;logo=arxiv&amp;logoColor=white"></a>
<a href="https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=21ak5858-60ba-44fd-9085-01f165c8771c"><img src="https://img.shields.io/badge/Feishu-Join-3370FF?style=flat-square"></a>
<a href="https://discord.gg/hxeVhZNN"><img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&amp;logo=discord&amp;logoColor=white"></a>

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
