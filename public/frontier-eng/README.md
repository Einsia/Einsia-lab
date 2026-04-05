# FE-Leaderboard · Frontier-Engineering Bench

Leaderboard site for **Frontier-Engineering Bench**: overall rankings, task-level leaderboards, and evolution charts.

## Features

- 📊 **Overall Leaderboard**: Shows comprehensive scores across all tasks
- 📈 **Evolution Dashboard**: Score-vs-iteration evolution at overall / domain / task / test levels ([evolution.html](evolution.html), data: `data/bench_evolution.json`; see [data/bench_evolution_schema.md](data/bench_evolution_schema.md))
- 📝 **Task Pages**: Individual pages for each task with descriptions and rankings
- 🎨 **Modern UI**: Clean, responsive design
- 🔄 **Auto-sorting**: Sortable columns for easy data exploration
- 🚀 **Static Deployment**: Ready for GitHub Pages

## Project Structure

```
leaderboard/
├── index.html              # Homepage
├── leaderboard.html        # Overall leaderboard page
├── problem.html            # Task template page
├── css/                    # Stylesheets
├── js/                     # JavaScript scripts
├── data/                   # Data files (YAML format)
│   ├── overall.yaml        # Overall leaderboard data
│   ├── tasks_index.yaml    # Task index
│   └── problems/           # Individual task data
│       ├── MannedLunarLanding.yaml
│       ├── ISCSO2023.yaml
│       └── ... (25 tasks total)
└── scripts/                # Data processing scripts
    └── generate_leaderboard_yaml.py
```

## Data Format

Data is stored in YAML format, supporting:

- **Raw and Normalized Scores**: Each participant has both raw scores and normalized scores (0-1 range)
- **Min/Max Statistics**: Automatically maintained score ranges for each task
- **Score Evolution**: Milestone tracking of best score improvements

For detailed data structure documentation, see [data/README.md](data/README.md).

## Local Development

```bash
# Using Python
python -m http.server 8000

# Then visit http://localhost:8000 in your browser
```

## Deploy to GitHub Pages

1. **Enable GitHub Pages** (if this repo is under an organization or user account):
   - Repo **Settings** → **Pages** → **Build and deployment**
   - Source: **GitHub Actions** (so the workflow deploys the site).

2. **Automatic deploy**: Pushing to `main`/`master` with changes under `leaderboard/` triggers the workflow `.github/workflows/deploy-leaderboard-pages.yaml`. The `leaderboard/` directory is published as the site root.

3. **URL**: After the first successful run, the site is available at:
   - `https://<owner>.github.io/<repo>/`  
   (e.g. `https://frontier-engineering.github.io/Frontier-Engineering/` if the repo is `Frontier-Engineering`).

4. **Manual run**: In the repo **Actions** tab, select "Deploy Leaderboard to GitHub Pages" and run the workflow.

The site is static (HTML/CSS/JS and `data/*`); no build step. A `.nojekyll` file is included so GitHub does not run Jekyll.

## Updating Data

Use `scripts/generate_leaderboard_yaml.py` to generate and update YAML data files.

## Tech Stack

- Pure HTML/CSS/JavaScript (no framework dependencies)
- YAML data format
- GitHub Pages static hosting
