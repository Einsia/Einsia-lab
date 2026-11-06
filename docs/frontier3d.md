# Frontier3D gallery

## Page

Official route: `/frontier3dbench/`. `/frontier3d/` also serves the page. Benchmark counts: **145 tasks, 9 categories, L1 65 / L2 65 / L3 15**.

The page presents an aerial video masthead, a color-coded total-score chart with expandable full results, benchmark composition and task coverage, an input/output diagram, a method diagram, paper result figures, and the gallery. The masthead contains one selected submission per L3 task in a 5 × 3 mosaic. Paper links to `Einsia/Frontier3D/blob/main/papers/Frontier3DBench.pdf`; Code links to `Einsia/Frontier3D/tree/main`. The Dataset link is unconfigured. The gallery compares GPT-6 Astra, GPT-6.1 Sol, and Claude Opus 5.5 at `max` effort.

| Level | Cases | Motion |
| --- | --- | --- |
| L1 | Typewriter, microscope, sneaker | Interactive centered 3D meshes with drag, zoom, and expanded viewing |
| L2 | Museum hall, antique shop, classroom | Forward movement through complete interiors |
| L3 | Frontier town, Minecraft village, workshop | Continuous camera routes with object interactions in the same clip |

The sneaker and antique-shop comparisons include conspicuous weaknesses alongside stronger results. Selection considers scene complexity, spatial detail, visual quality, and variation between models.

Leaderboard values follow Table 3 (page 7) of the supplied 3DBench-2 paper: eleven complete configurations, including Qwen xhigh (L2 50.64, total 46.03). Total scores use 30% L1, 30% L2, and 40% L3. `src/data/frontier3d-paper.json` records the paper SHA256, counts, weights, scores, and harnesses. Task coverage follows Table 1: L1 has 3 families (15/25/25 tasks), L2 has 4 (20/10/25/10), and L3 has 2 (5 Text2Env / 10 Img2Env). The input/output diagram presents three image-reference workflows: object (L1), scene (L2), and interactive environment (L3), each with a coding-agent robot and its own editable Blender or UE5 project window. Viewport images are actual generated assets; editor chrome and object lists are schematic, not captured application screenshots.

## Files and behavior

- `src/pages/frontier3d/index.astro`: page structure.
- `src/styles/frontier3d.css`: scoped responsive styling.
- `src/data/frontier3d.ts`: cases, model labels, release links.
- `src/scripts/frontier3d.ts`: level sections, visible-row video loading, playback toggle, expanded preview, deep links, reduced motion, background playback, and row synchronization.
- `public/frontier3d/media/`: 18 gallery H.264 MP4 loops, one 15-task mosaic, and their JPEG posters.
- `public/frontier3d/models/`: nine real 3D assets and their provenance manifest.
- `src/pages/frontier3dbench/evaluation/index.astro`: detailed metrics and human agreement.
- `public/frontier3d/media-manifest.json`: exact source identities, hashes, capture parameters, interaction measurements, and output hashes.

Each level displays all three cases as rows and the three models as columns, forming a 3 × 3 gallery. The borderless three-column comparison grid is retained on mobile. Model names appear once above each level. L1, L2, and L3 appear consecutively on one page. Visible clips play silently and loop; hidden or offscreen clips pause. Motion off pauses on the current frame. Reduced-motion preferences show posters by default, with explicit playback available in the expanded player. Deep links follow `#showcase-L3`, with case-specific links also supported. Asset URLs support the repository's `BASE_PATH`.

## Rendering and evidence

L1 previews use evaluated meshes from the submitted `.blend` files, with modifiers applied and source hashes verified. Original shader base colors are baked into mesh color attributes for browser rendering. Metalness and roughness retain glTF PBR material parameters. Geometry is centered in the browser without modifying the source artifact.

L2 cameras travel into the museum, shop, and classroom. Captures use Cycles with 64 samples, a fixed noise seed, denoising, and 216 native frames at 24 fps. Geometry, materials, lights, and the continuous route follow the selected submission.

Unreal captures use isolated submission copies and dedicated engine slots. Candidate `Source`, `Content`, and `Config` hashes must match the frozen submission manifest. Camera routes pass through open entrances to an interior interaction point, where the generated game's existing action opens a chest or drawer. Before/after snapshots verify visible mesh translation or rotation. Camera paths and actions are presentation captures, not real-time agent playthroughs. Original projects and scoring results are not modified.

L2 videos use 512 × 320 H.264 with native 24 fps captures. L3 gallery clips contain 240 native rendered frames at 640 × 400, played at 24 fps for ten seconds. Each clip follows a single continuous route from an outdoor overview, along a road or yard passage, through an open doorway, and into the interior. Doors open during the approach. Chests and drawers open while the camera keeps moving. Entrance-relative framing follows each submission’s architecture; the ten-second duration and entrance/interaction timing are shared across the three models. Every camera step is checked with seven collision rays spanning a 15 cm clearance margin, together with visual inspection of the complete route. The banner contains 144 native frames per task and plays at 24 fps over six seconds at 1920 × 768. Its elevated camera tracks continuously along each environment’s primary circulation axis. The lighting and submitted assets are preserved. Source-frame counts and processing are recorded per clip in the manifest. Full-resolution PNG sequences and capture logs remain on the server. Gallery animations represent actual model-generated artifacts. Input images are the original typewriter, Hintze Hall, and workshop task references. Image credits and output-frame provenance are recorded in `public/frontier3d/workflow/CREDIT.txt`.

## Capture provenance

The media manifest records the submitted model, task, harness, effort, source hashes, camera parameters, and interaction evidence for each gallery clip. Full-resolution frame sequences and capture logs belong to the benchmark's source archive. Reproduction requires the submitted Blender and Unreal projects, Blender 5.2.1, Unreal Engine 5.8.3, FFmpeg, and the benchmark's public preview interface.

The L3 capture pipeline uses 240-frame continuous paths with architecture-specific waypoints and bounded camera turns. Before/after snapshots record physical interaction changes. Seven collision rays at each camera step check a 15 cm clearance margin. The 15-task banner selects the highest final v5-scoring submission per task, with source identities and report hashes retained in the manifest.

## Verification

```sh
node scripts/validate-frontier3d.mjs
npm run build
npm run dev -- --host 127.0.0.1
```

`media-video24/decode-check.json` records a complete error-free decode of every video and 24 distinct decoded frames in a one-second motion sample. Browser playback is measured with `requestVideoFrameCallback`.

The gallery validator checks all 18 videos, output frame counts, dimensions, timing, codec, output hashes, source provenance, centered camera targets, continuous-route timing, continuous camera motion, and physical interaction evidence. Browser checks cover all nine case rows, visible playback, pause mode, keyboard navigation, deep links, mobile layout, and reduced motion, background playback, and row synchronization. The full-site validator enforces the deployment size limit and excludes signature-verified AppleDouble resource-fork files from generated output.

## Gallery scores and playback

Each of the 27 tiles displays its 0–100 evaluated task score. `src/data/frontier3d-gallery-scores.json` preserves release IDs, original task IDs, scoring versions, and report SHA256 values. All source-report hashes are verified against the evaluation export. Row synchronization uses bounded playback-rate correction without seeking during playback. The castle, palace, and ferry-market banner tiles use 1280 × 720 native UE5 captures with TSR, 200% history resolution, 32 history samples, and a one-second settling interval at each camera position. Area-filtered downsampling produces the banner tiles. The other twelve tiles retain their released footage. A 960-pixel rendition serves smaller viewports.

## Interactive objects and research

Nine L1 previews use Draco-compressed glTF meshes derived from the submitted Blender files. The model manifest records source, geometry, and output hashes. The Three.js viewer centers evaluated geometry, batches static meshes by material, and renders on demand. It supports pointer rotation, wheel and button zoom, arrow-key rotation, reset, and an expanded dialog. Browser dependencies and Draco decoders are served from the same origin.

`src/data/frontier3d-research.json` records the supplied November 5 paper (`3DBench-2.pdf`, SHA256 `15112d63a580e124eb69116d1976d84ec5b363e36a62127a868a44574208bbae`). Paper Figures 3–5 present task-family radar profiles, capability profiles, and estimated API cost versus benchmark quality. Figure 5 uses cost-range midpoints; Luna, DeepSeek, and Sol form its estimated cost frontier.

The dedicated `/frontier3dbench/evaluation/` page presents the four task rubrics, 30/30/40 level aggregation, execution and visual measurements, continuous world workflows, and human agreement. Rubrics follow Appendix A, pages 16–17; human agreement follows Table 4, page 11.
