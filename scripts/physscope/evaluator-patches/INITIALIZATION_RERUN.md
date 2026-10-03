# Reviewed initialization and fresh measurements

This run addresses the 191 samples blocked by missing per-video initialization
in P37, P38, P39, P41, P43 and P49. The input remains
`vdmbench/data/videos/all_test`. Historical leaderboard scores are not replaced.

## Initialization evidence

The V3 task package contains reviewed task-level object identities and initial
geometry. `scripts/prepare_all_test_annotations.py` registers those coordinates
to each decoded video size and compares the source still against frame zero.
For these six tasks, 167 of 192 samples passed the original pixel-correspondence
check; 25 did not. The complete six contact sheets and enlarged crops of all
25 rejected samples were visually inspected. The actual frame-zero objects
retained the required identities. Lingbot P38 plate boxes needed adjustment.

`public/physscope/all_test/initialization/input_review/agent-review.json` records
the reviewed candidate and video hashes. `prepare-reviewed-initialization.py`
consumes that explicit review. It saves a lossless PNG of each video's actual
decoded first frame and binds the final annotation to its image and video hashes.
P38 boxes are fitted to the observed copper component within each reviewed ROI;
positive points are moved to interior copper pixels and negative points on
copper are removed. The other task geometry is scaled from the reviewed task
reference. The rejected source-still checks are preserved as provenance; the
measurement runtime's validation thresholds are unchanged.

192 inputs are prepared, while 191 previously blocked samples are rerun. One
sample already had a visualization. No trajectory, time window, velocity, peak,
physical quantity or score is copied from the task template.

## Measurement and video export

`rerun-initialized-gallery.py` runs the existing refined evaluator on each video
with explicit `--annotation` and `--image_path`, SAM2.1 Hiera Large and CoTracker3.
The initial seven pilots cover all six task types and include the displaced
Lingbot P38 and pixel-different CogVideoX P49 samples. Each GPU processes one
video at a time. Hash-validated SAM2/CoTracker caches allow interrupted work to
resume; completed entries require matching video, annotation, code and resource
signatures.

Each sample's `debug-initialized` directory contains fresh measurement JSON,
logs, masks, tracks, frame-zero identity evidence and native overlay videos.
`annotated.mp4` is a browser-compatible transcode of `tracking_overlay.mp4`,
falling back to the native segmentation overlay only if needed.
The website links the initialization JSON and exact frame-zero PNG.

An exported visualization does not imply that a physical metric was measurable.
Missing visible tracks, static reference loss, incomplete cycles or insufficient
flow observations retain their extraction-failure status and their actual
intermediate visualization. No measurement thresholds are relaxed.

## Commands (from the website repository)

```sh
PY=/tmp/physscope-extract-venv/bin/python
V3=/mnt/einsia/aws01-nvme/einsia-shared/homes/linxinjie/vdmbench2/vdmbench/v3
VIDEOS=/mnt/einsia/aws01-nvme/einsia-shared/homes/linxinjie/vdmbench/data/videos/all_test

# For a new dataset, regenerate candidates and visually review them first.
# Existing review hashes deliberately reject changed candidate files.
$PY scripts/physscope/prepare-reviewed-initialization.py \
  --review public/physscope/all_test/initialization/input_review/agent-review.json
$PY scripts/physscope/rerun-initialized-gallery.py --package "$V3" --source "$VIDEOS" --pilot
$PY scripts/physscope/rerun-initialized-gallery.py --package "$V3" --source "$VIDEOS"
$PY scripts/physscope/validate-video-gallery.py \
  --catalogue public/physscope/all_test/initialized-catalogue.json --source "$VIDEOS" --decode-initialized
$PY scripts/physscope/publish-initialized-gallery.py --publish
```

The candidate catalogue is published only after validation. The previous active
catalogue is archived as `catalogue-before-initialization-rerun.json`.
`initialization-rerun-summary.json` provides the final task and extraction counts.
