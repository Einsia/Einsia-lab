# EmbodiedEvo website

English research project website for **EmbodiedEvo: Self-improving Code Agents for Physical Intelligence**, built with Astro 5. Both `/` and `/embodied-rsi/` render the project page.

The page follows the current `paper/` manuscript: code-based control, autonomous Playground interaction, frozen Skills and Lessons, paired RoboDojo results, cross-model and cross-task transfer, experience representation, and acquisition/Test expense. Existing RoboTwin and RoboCasa videos remain interactive demonstrations with synchronized code and feedback.

## Run locally

Node.js 22+ recommended.

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 4321
```

## Build

```sh
npm run build:embodiedrsi
npm run preview:embodiedrsi -- --host 0.0.0.0 --port 4321
```

`dist-embodiedrsi/` contains the isolated project site and all required assets. Serve it with a static host supporting HTTP byte-range requests for video seeking. The ordinary `npm run build` output also includes the inherited template's other research pages.

## Content and evidence

- `src/components/embodiedrsi/ProjectPage.astro`: copy and layout.
- `src/styles/embodiedrsi.css`: responsive styles.
- `src/scripts/embodiedrsi.ts`: replay and accessible tab interactions.
- `public/embodied-rsi/data/results.json`: shared, downloadable manuscript result snapshot.
- `public/embodied-rsi/figures/`: optimized copies of manuscript figures.
- `public/embodied-rsi/media/` and `data/`: recorded demonstrations and exact trace data.
- `docs/embodiedrsi/CONTENT.md`: source mapping, protocols, figure provenance, and update instructions.

The website must stay entirely in English. Public paper and code URLs remain forthcoming, and preview pages retain `noindex,nofollow`. No website deployment is part of the local build.

## Verification

```sh
uv run --with playwright python scripts/verify-embodiedrsi.py \
  --url http://localhost:4321 --chromium /path/to/chromium
```

Checks cover published numerical values, result selection with keyboard navigation, English-only page and trace content, video seeking and code alignment, copy/playback controls, rapid episode switching, error recovery, no-JavaScript result visibility, both project routes, and mobile/tablet/desktop layouts. Screenshots and the check report are stored in `.work/embodiedrsi/`.

To regenerate the original demonstration videos from completed experiment artifacts, use an environment with `imageio`, `imageio-ffmpeg`, `numpy`, and `Pillow`:

```sh
python scripts/prepare-embodiedrsi.py --source /path/to/EAHarness
```

Normal builds are independent of the experiment checkout and use local assets only.
