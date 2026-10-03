# Native evaluator localization videos

Install into the supplied V3 package:

```sh
python scripts/physscope/install-debug-video.py /path/to/vdmbench2/vdmbench/v3
```

The installer is idempotent and makes explicit calls at evaluator return sites.
It does not use tracing, replace scoring functions, change thresholds, or rewrite
measurement expressions. Only the visualization module is copied from this
folder; callers and the result schema receive small edits. Existing G2/G3/G5/G8/G9
native overlays are retained. The added output covers G1/G4/G6/G7 (17 tasks).

When debug output is enabled, each sample gets:

- `localization.mp4`: H.264 at up to 8 fps, actual source duration, no interpolation.
- `localization.json`: source frame indices, timestamps, coordinate-system size,
  detection geometry, and visualization scope.
- Existing figures and measurements remain available.

The rendering follows G2's `draw_debug`: detections appear on the corresponding
source frame. Tracks use only the observed prefix, with no lines across missing
observations. Outlines, fitted circles, centroids, pivots, axes, waterlines,
submerged heights, ray intersections, and ice masks are task-specific.
P12 uses its own optical overlay renderer. Liquid and shadow detectors are
reapplied to preview frames; these extra readings do not enter the scores.
Geometry coordinates refer to the evaluator's work-frame size in each JSON record,
not to the resized video canvas with its header.

Missing geometry produces a clearly labelled unmarked frame, not an invented
trajectory. This makes tracking failures visible; drawn detections are not a
claim that the model satisfies the physical rule. Missing runtime inputs for
other groups (especially hash-bound annotations) remain explicit catalogue
limitations, rather than being replaced with unrelated object tracking.

Requirements: the evaluator's dependencies, pinned website extraction environment,
ffmpeg/ffprobe, and existing SAM2 weights for liquid tasks. CUDA autocast matches
the SAM2 bf16 weights; CPU inference retains fp32. No new model is downloaded.

Regenerate and publish the existing collection:

```sh
python scripts/physscope/generate-localization-videos.py \
  --package /path/to/vdmbench2/vdmbench/v3 \
  --source /path/to/vdmbench/data/videos/all_test --workers 8
python scripts/physscope/prepare-localization-gallery.py
python scripts/physscope/validate-video-gallery.py \
  --catalogue public/physscope/all_test/localization-catalogue.json \
  --source /path/to/vdmbench/data/videos/all_test --decode
python scripts/physscope/prepare-localization-gallery.py --publish
```

Preparation requires every targeted sample, verifies extraction flags, and audits
old/new metric values. Re-inference differences are recorded separately; historical
measurements are preserved rather than overwritten.
Original media and prior debug exports remain intact. The active manifest is
replaced only after the candidate is validated.

Resource and canonical filename adaptation is documented in
[RESOURCE_ADAPTATION.md](RESOURCE_ADAPTATION.md).

Per-video first-frame initialization, fresh measurements and native debug-video
export are documented in [INITIALIZATION_RERUN.md](INITIALIZATION_RERUN.md).
