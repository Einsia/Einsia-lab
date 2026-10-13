# Navers lab · EmbodiedEvo

The Astro lab website includes **EmbodiedEvo: Self-improving Code Agents for Physical Intelligence** in its Research listing. The English EmbodiedEvo project reports **RoboDojo only**, following the October 12, 2026 EAHarnessPaper manuscript.

- `/`: the Navers lab homepage.
- `/research/`: all research entries, with EmbodiedEvo first and links to its overview, results, and GitHub repository.
- `/embodiedevo/` and `/embodied-rsi/`: project overview with the overview illustration, a two-stage Method GIF, Results with the interactive leaderboard, three Key Findings, and three video previews, in that order.
- `/embodiedevo/details/`: complete method diagrams, protocols, five experimental findings with supporting evidence, the interactive leaderboard, and resources. `/embodied-rsi/details/` is an alias. All project pages share the paper-inspired robot-arm logo and resource buttons.
- `/embodiedevo/trajectories/`: a project subpage sharing its header, navigation, and visual identity. 54 tasks × 6 complete examples × 1 seed (42 base tasks, with Standard/Random variants displayed separately), with three camera views, submitted Python, feedback, public agent interactions, and frozen Skills/Lessons. `/embodied-rsi/trajectories/` is an alias.

All 972 videos, 324 trace records, original selected official reports, posters, paper figures, and result data are **ordinary files in this repository**. There are no runtime links to the experiment checkout, monitor APIs, remote video storage, or symlinks. Normal builds need Node.js and the committed files only.

## Local development and build

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 4321
npm run validate:embodiedevo
npm run build
npm run preview -- --host 0.0.0.0 --port 4323
```

Node.js 22 is used in CI. `dist/` contains the complete lab site, including Research, the project overview, and all trajectories. The previous `build:embodiedrsi` and `preview:embodiedrsi` commands are aliases for the full-site build and preview. The build rejects output at or above the GitHub Pages 1 GB limit. Serve videos with HTTP byte-range support for seeking.

For a temporary public preview, keep the preview running and start Cloudflare Tunnel in another terminal:

```sh
cloudflared tunnel --url http://127.0.0.1:4323 --http-host-header localhost:4323
```

Open the generated `https://…trycloudflare.com/research/` URL. The temporary URL lasts while the tunnel process runs. The existing physics project entry links to its published lab page; its Research thumbnail is included locally.

## GitHub Pages

The existing Pages workflow supports pushes to `main` and `EmbodiedEvo`, plus manual runs. It validates the copied collection, builds the complete lab site, and uploads `dist/` with GitHub Actions. Choose **GitHub Actions** as the repository’s Pages source; an environment protection rule may require the repository owner to allow the branch.

The workflow derives `SITE` and `BASE_PATH` from Pages configuration. The lab navigation, Research entries, and EmbodiedEvo assets honor the configured base path. Legacy projects retain their existing routing. To verify a subpath locally:

```sh
SITE=https://einsia.github.io BASE_PATH=/Einsia-lab npm run build
```

Local builds do not publish a deployment; pushing a supported branch triggers the Pages workflow. EmbodiedEvo pages retain `noindex,nofollow`; the paper link remains forthcoming. GitHub buttons link to [Einsia/EmbodiedEvo](https://github.com/Einsia/EmbodiedEvo).

## Evidence and selection

The full evaluation is **2,100 scenes / 42 tasks / seed 1**, with **44.48 Score / 37.82% SR**. The paired study has 210 episodes per condition and is shown separately. Category weighting matches the paper.

The gallery follows the official 54-task display, listing Generalization Standard and Random variants separately. Every displayed task has **6 examples**, selected from the first six official records without outcome filtering (324 episodes total). Task metrics use all 25 evaluated scenes per Generalization variant, or all 50 scenes for other tasks; the six videos are examples, not a new evaluation. Paper aggregates still group variants into 42 base tasks. Failed examples keep their actual reports and scores.

Videos are H.264 web encodings of finalized official movies. Every source frame, resolution (640 × 480), frame rate, and duration is preserved; CRF 30 reduces file size. Every copied report is byte-identical to the official original. Source and web SHA-256 hashes are retained in each trace. Movies use the evaluator clock, so the execution selector and public agent log are explicitly independent of video timestamps.

The right panel includes exact submitted snapshots and their constituent files, stdout/stderr, every recorded execution including errors and observation-only calls, public assistant messages/tool interactions, and inherited Skills/Lessons. System prompts and encrypted/private reasoning payloads are excluded. Original recorded text is not rewritten.

See [content and provenance](docs/embodiedrsi/CONTENT.md) and the committed [asset inventory](public/embodied-rsi/replays/inventory.json).

## Verification

```sh
npm run validate:embodiedevo
python scripts/verify-embodiedrsi.py --url http://localhost:4323
```

The browser check requires Playwright and Chromium. It covers paper values, keyboard tabs, task/category/outcome filtering, six-example grouping, camera switching and seeking, code/feedback/knowledge/agent-log views, rapid scene changes, retry states, all project routes, no-JavaScript results, and mobile/tablet/desktop layouts. Screenshots are written to `.work/embodiedrsi/`.

## Optional one-time asset regeneration

This is **not part of deployment**. Requires Pillow and ffmpeg/ffprobe, and completed source artifacts from the EAHarness repository:

```sh
python scripts/export-robodojo.py --source /path/to/EAHarness \
  --ffmpeg /path/to/ffmpeg --ffprobe /path/to/ffprobe --workers 4
```

The exporter reads only the official provenance-selected records and public episode artifacts. It verifies all 2,100 outcome report hashes and, for each selected movie, verifies source hash, output frame count, resolution, frame rate, and duration. It does not run a simulator or alter experiment records. Commit the generated `public/embodied-rsi/replays/` files with the website changes.
