# Frontier3D gallery

## Page

Route: `/frontier3d/`. Benchmark counts: **145 tasks, 10 categories, L1 65 / L2 65 / L3 15**.

The page presents an aerial video masthead, a color-coded total-score chart with expandable full results, benchmark composition and task coverage, an input/output diagram, and the gallery. Key findings is an empty final section. The masthead contains one selected submission per L3 task in a 5 × 3 mosaic. Paper, Code, and Dataset links are unconfigured. The gallery compares GPT-6 Astra, GPT-6.1 Sol, and Claude Opus 5.5 at `max` effort.

| Level | Cases | Motion |
| --- | --- | --- |
| L1 | Typewriter, microscope, sneaker | Centered 360° object turntables |
| L2 | Museum hall, antique shop, classroom | Forward movement through complete interiors |
| L3 | Frontier town, Minecraft village, workshop | Continuous camera routes with object interactions in the same clip |

The sneaker and antique-shop comparisons include conspicuous weaknesses alongside stronger results. Selection considers scene complexity, spatial detail, visual quality, and variation between models. These examples are not a ranking.

Leaderboard values are transcribed from Table 2 (page 9), including ten complete max-effort configurations and one supplemental Qwen xhigh configuration. Total scores use 30% L1, 30% L2, and 40% L3. Incomplete Qwen L2 and total scores remain null. `src/data/frontier3d-paper.json` records the paper SHA256, counts, weights, scores, and confidence intervals. Task coverage follows Table 1 (page 3): L1 has 3 families (15/25/25 tasks), L2 has 4 (20/10/25/10), and L3 has 3 (6/6/3). The input/output diagram is native HTML and SVG with actual generated asset previews.

## Files and behavior

- `src/pages/frontier3d/index.astro`: page structure.
- `src/styles/frontier3d.css`: scoped responsive styling.
- `src/data/frontier3d.ts`: cases, model labels, release links.
- `src/scripts/frontier3d.ts`: level sections, visible-row video loading, playback toggle, expanded preview, deep links, reduced motion, background playback, and row synchronization.
- `public/frontier3d/media/`: 27 gallery H.264 MP4 loops, one 15-task mosaic, and their JPEG posters.
- `public/frontier3d/media-manifest.json`: exact source identities, hashes, capture parameters, interaction measurements, and output hashes.

Each level displays all three cases as rows and the three models as columns, forming a 3 × 3 gallery. The borderless three-column comparison grid is retained on mobile. Model names appear once above each level. L1, L2, and L3 appear consecutively on one page. Visible clips play silently and loop; hidden or offscreen clips pause. Motion off pauses on the current frame. Reduced-motion preferences show posters by default, with explicit playback available in the expanded player. Deep links follow `#showcase-L3`, with case-specific links also supported. Asset URLs support the repository's `BASE_PATH`.

## Rendering and evidence

Blender images come from submitted `.blend` files. Geometry, materials, and lights are preserved. L1 uses a dedicated orthographic camera aimed at the world-space object bounding-box center throughout a full revolution. L2 cameras travel into the museum, shop, and classroom. Capture uses Cycles CPU rendering, 12 samples, denoising, and 512 × 320 source frames.

Unreal captures use isolated submission copies and dedicated engine slots. Candidate `Source`, `Content`, and `Config` hashes must match the frozen submission manifest. Camera routes pass through open entrances to an interior interaction point, where the generated game's existing action opens a chest or drawer. Before/after snapshots verify visible mesh translation or rotation. Camera paths and actions are presentation captures, not real-time agent playthroughs. Original projects and scoring results are not modified.

L1/L2 videos use 512 × 320 H.264 at 24 fps. Motion-compensated interpolation operates on the original 10 fps L1 and 8 fps L2 PNG captures. Interpolated frames smooth camera motion; they do not constitute additional measured simulation steps. L3 gallery clips contain 240 native rendered frames at 640 × 400, played at 24 fps for ten seconds. Each clip follows a single continuous route from an outdoor overview, along a road or yard passage, through an open doorway, and into the interior. Doors open during the approach. Chests and drawers open while the camera keeps moving. Entrance-relative framing follows each submission’s architecture; the ten-second duration and entrance/interaction timing are shared across the three models. Every camera step is checked with seven collision rays spanning a 15 cm clearance margin, together with visual inspection of the complete route. The banner contains 144 native frames per task and plays at 24 fps over six seconds at 1920 × 768. Its elevated camera tracks continuously along each environment’s primary circulation axis. The lighting and submitted assets are preserved. Source-frame counts and processing are recorded per clip in the manifest. Full-resolution PNG sequences and capture logs remain on the server. Gallery animations represent actual model-generated artifacts. The input reference icon is a schematic illustration.

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

The gallery validator checks all 27 videos, output frame counts, dimensions, timing, codec, output hashes, source provenance, centered camera targets, continuous-route timing, continuous camera motion, and physical interaction evidence. Browser checks cover all nine case rows, visible playback, pause mode, keyboard navigation, deep links, mobile layout, and reduced motion, background playback, and row synchronization. The full-site validator enforces the deployment size limit and excludes signature-verified AppleDouble resource-fork files from generated output.
