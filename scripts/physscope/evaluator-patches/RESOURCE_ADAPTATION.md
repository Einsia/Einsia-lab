# Current input filenames and local model resources

The source collection is `vdmbench/data/videos/all_test`.
`adapt-evaluator-resources.py` installs explicit resource paths in the V3
package's `local_resources.json` and adapts G3 filename resolution. The supplied
checkpoint directory contains SAM2.1 Hiera Large (native `.pt` and Hugging Face
weights). CoTracker3, SAM2 native source and Grounding DINO use the previously
validated local installation; those weights were not found in the supplied root.
No downloads are performed. The model/config pair is switched together.

P3/P9 in `all_test` have different first-frame geometry from the task package's
old `gpt_01_modern` images. **Do not alias them directly to that old geometry.**
`review-canonical-first-frames.py` installs a separate `gpt_current` initialization:

- P3: upper blue and lower red projectile centers/radii from the actual input.
- P9: short red and long blue bob centers/radii; visually reviewed fixed string
  attachment points on the current support bar.
- P6 retains its matching `gpt_01_modern` input and existing resolution scaling.

All 64 P3/P9 videos passed an independent initial-color-landmark correspondence
check. Its results, reference image, source hashes and initialization coordinates
are saved under each task's `canonical_inputs/`. These annotate initial identity
and geometry only; no trajectory, measurement outcome or score is supplied.
The runtime verifies the reference image hash and initial object correspondence,
then scales coordinates into the actual video resolution. Legacy input names and
all original metric thresholds remain supported unchanged.

```sh
python scripts/physscope/adapt-evaluator-resources.py \
  --package /path/to/vdmbench2/vdmbench/v3 \
  --checkpoints /path/to/vdmbench/checkpoints
python scripts/physscope/review-canonical-first-frames.py \
  --package /path/to/vdmbench2/vdmbench/v3 \
  --source /path/to/vdmbench/data/videos/all_test
python scripts/physscope/retry-adapted-evaluators.py \
  --package /path/to/vdmbench2/vdmbench/v3 \
  --source /path/to/vdmbench/data/videos/all_test --workers 4
```

The retry creates `adapted-catalogue.json`. If P3 overlay encoding fails on
odd half-resolution dimensions, `fix-g3-video-export.py` pads a single border
pixel and reuses validated tracks. `publish-adapted-gallery.py` prepares or
publishes the candidate; validate it before passing `--publish`. Old
measurement files remain intact and their URLs are retained as
`previousMeasurement`. New videos/results are in `debug-adapted/`, with actual
resource paths and code/input hashes. The leaderboard is never recomputed.

P37/P38/P39/P41/P43/P49 can now resolve their weights, but still require reviewed
annotations matching individual video hashes, image hashes and dimensions.
A correct weight path cannot replace those input annotations. The active logs
must state that actual missing input instead of retaining the old weight error.
