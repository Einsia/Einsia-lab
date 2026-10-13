# World Models’ Last Exam in Physics resources for GitHub Pages

The repository's `README.md` places static project resources under `public/`.
The existing `.github/workflows/deploy.yml` builds Astro and deploys `dist/` on
pushes to `main`. World Models’ Last Exam in Physics follows that layout and uses ordinary Git files;
no LFS pointers, external video host, local dataset mount or model weights are
needed to build or browse the published website.

## Commit these resources

```text
public/phys-last-exam/
  video-gallery.json          # portable model/task/seed catalogue
  release-assets.json         # file sizes and SHA-256 integrity inventory
  videos/<model>/<task>/<seed>/
    original.mp4             # unannotated web copy, H.264, at most 640 px wide
    annotated.mp4            # existing evaluator overlay, unchanged bytes
  evidence/<model>/<task>/<seed>/
    poster.webp, figure.webp
    measurement.json         # measured values preserved, JSON whitespace compacted
    features.json            # when available
    visualizationMeasurement.json
    initialization.json      # when available; exact annotation bytes retained
    frame-zero.png           # exact reviewed initialization image retained
  benchmark.json, tasks/, difficulty.webp, paper-draft.pdf
```

All 1,278 source samples and 1,273 available overlays remain selectable. Missing
overlays remain missing; no synthetic replacements are created. Web copies are
only for delivery: no evaluator is rerun on compressed video and no leaderboard
scores change. `sourceSha256` continues to identify the full-resolution input;
`delivery.originalSha256` identifies the delivered web copy.
Historical evidence JSON may contain workstation paths as provenance. Browser
links use the bundled resource URLs and never depend on those paths.

## Local files that must not be committed or deployed

The complete pre-release tree is preserved at:

```text
.local/phys-last-exam/source-public/phys-last-exam/
  all_test/                  # byte-identical originals, all evaluator outputs
  all_test_1/                # prior collection
  videos/                    # older preview collection
  video-gallery*.json        # original working catalogues
```

`.local/` is ignored by Git and is outside Astro's `public/` directory. This keeps
old datasets, backend logs, masks, tracks, caches and duplicate debug encodings
out of both Git commits and deployment artifacts. Original dataset files under
`vdmbench/data/videos/all_test` are untouched.

The older extraction scripts describe the evaluation workstation layout; use
the preserved working archive or a separate evaluation workspace for new runs.
Do not run those scripts against this compact release catalogue. Prepare a new
web snapshot from a full working catalogue when adding or replacing videos.

## Refresh the snapshot locally

With ffmpeg/ffprobe and Pillow available:

```sh
python scripts/phys-last-exam/prepare-web-release.py \
  --source-public .local/phys-last-exam/source-public
node scripts/phys-last-exam/validate-web-release.mjs \
  --root .local/phys-last-exam/release-public
python scripts/phys-last-exam/prepare-web-release.py \
  --source-public .local/phys-last-exam/source-public --install-only
npm run validate:phys-last-exam
npm run build
npm run validate:phys-last-exam -- --root dist
```

The first packaging pass can use `--source-public public` before the full working
tree is archived. Existing archives are never overwritten. Inspect new compressed
samples and verify timing before installing a new snapshot. `--install-only`
installs the previously prepared staging directory; run validation first.

## CI and Git workflow

CI validates committed assets before building, then checks the entire `dist/`
site before uploading it to Pages. Validation checks every asset hash and all
catalogue links, rejects symlinks/model caches/unresolved LFS pointers, and limits
the total site to 950 MB and individual files to 95 MB.

These guards leave headroom below [GitHub Pages' 1 GB site limit](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
The package contains approximately 702 MB of World Models’ Last Exam in Physics resources. Normal Git
pushes include the actual video files; CI performs no transcoding or inference.

Follow the root README's branch → commit → push → pull request workflow.
Commit the generated `public/phys-last-exam/` resources together with the page code,
packaging/validation scripts, `.gitignore`, `package.json` and CI workflow.
Merge to `main` to trigger production deployment. Preparing this snapshot does
not itself push commits or trigger a remote deployment.

## Updated manuscript and Table 2

`paper-results.json` is independent of `benchmark.json`: the former contains
automatic-gate results and difficulty labels from the updated manuscript; the latter
preserves the earlier report's coverage and task-package metadata. The homepage
uses Table 2 for the main leaderboard, category order and difficulty filters.
The current paper name and public URL are World Models’ Last Exam in Physics and `/phys-last-exam/`.

`sync-paper-results.py` extracts Table 2 and the eight embedded brand-logo images
from a PDF supplied with `--source /path/to/manuscript.pdf` using PyMuPDF.
The current snapshot is `VDM_Bench_Einsia (2).pdf`. `id` is the canonical P1–P40 ID for pages, task metadata, videos and evidence.
`legacyId` is provenance only. `task-index.json` is derived from the latest
repository’s task definitions and records the explicit one-to-one mapping. After updating these
assets, regenerate `release-assets.json` so CI verifies the new PDF/data/logos.
Video-only release preparation preserves the current manuscript assets.


## P1–P40 resource migration

`migrate-task-numbering.py --package ~/vdmbench_origin/vdmbench --install`
performs a one-time migration. It validates all 40 legacy/current pairs against
the new package and manuscript, copies files into an independent staging tree,
checks byte hashes and sample identity, then swaps directories. It refuses a
second migration. The complete original release and byte-transfer audit remain
in `.local/phys-last-exam/numbering-migration/` (not deployed).

Current IDs are used in all public resource names, task fields and URLs.
Legacy filesystem paths, sample names and embedded evaluator annotations are
historical evidence, not current resource links. Video bytes and physical
measurements are preserved. Initialization annotation hashes change only because
of task-ID metadata; `legacyAnnotation` retains the original signature.

CI verifies matching IDs, labels, categories, difficulties, video paths, evidence
fields and task preview filenames, preventing a mixed-numbering release.


## Seedance media refresh (2026-10-07)

P19, P25 and P37 use newly generated Seedance 2.5 videos for seeds 42–45,
with the canonical package’s first frames and prompts. Each new video was
re-evaluated locally. P19 rod and P37 transparent-bore initialization uses
reviewed decoded frame-zero geometry bound to the new video’s hash.
`render-refreshed-overlay.py` renders the current evaluator’s detections;
its flags select the package, task, video and evaluation directory.

Refreshed samples carry `refresh` provenance and `consistencyPassed`. That
sample-specific gate controls the video visualization only; the published
`paper-results.json` remains byte-identical. P37 seed 45 was rejected by the
consistency gate and has a new original video with a placeholder, not an old
debug video. The release contains 1,278 originals and 1,272 debug videos.
P6, P25 and P35 task preview images were refreshed from the canonical package.
Original downloads, full evaluator outputs and previous site resources are
kept in `.local/phys-last-exam/refresh-20261007/`, outside the deployed site.
