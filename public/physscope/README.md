# PhysScope resources for GitHub Pages

The repository's `README.md` places static project resources under `public/`.
The existing `.github/workflows/deploy.yml` builds Astro and deploys `dist/` on
pushes to `main`. PhysScope follows that layout and uses ordinary Git files;
no LFS pointers, external video host, local dataset mount or model weights are
needed to build or browse the published website.

> note:still under development

## Commit these resources

```text
public/physscope/
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
.local/physscope/source-public/physscope/
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
python scripts/physscope/prepare-web-release.py \
  --source-public .local/physscope/source-public
node scripts/physscope/validate-web-release.mjs \
  --root .local/physscope/release-public
python scripts/physscope/prepare-web-release.py \
  --source-public .local/physscope/source-public --install-only
npm run validate:physscope
npm run build
npm run validate:physscope -- --root dist
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
The package contains approximately 702 MB of PhysScope resources. Normal Git
pushes include the actual video files; CI performs no transcoding or inference.

Follow the root README's branch → commit → push → pull request workflow.
Commit the generated `public/physscope/` resources together with the page code,
packaging/validation scripts, `.gitignore`, `package.json` and CI workflow.
Merge to `main` to trigger production deployment. Preparing this snapshot does
not itself push commits or trigger a remote deployment.
