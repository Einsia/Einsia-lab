# EmbodiedEvo: content and evidence

## Manuscript scope

Synchronized against the local **EAHarnessPaper** working manuscript on October 13, 2026, including its current `Tables/unfinished_experience.tex`. The title is *EmbodiedEvo: Self-improving Code Agents for Physical Intelligence*. All website reporting, examples, and videos concern **RoboDojo simulation**. The previous RoboTwin/RoboCasa demonstration data and media have been removed.

Project routes: `/embodiedevo/`, `/embodied-rsi/`; `/` is the lab homepage. Detailed method and results: `/embodiedevo/details/`, with `/embodied-rsi/details/` as an alias. Explorer: `/embodiedevo/trajectories/`, with `/embodied-rsi/trajectories/` as an alias. User-facing copy, controls, and explanatory notes are English. The project retains the existing omission of the author block and a forthcoming paper link. GitHub links use the user-supplied `https://github.com/Einsia/EmbodiedEvo` address.

## Result sources

The overview presents the overview illustration, a Method section with
a two-stage animation of the paper’s framework, a Results section with the
interactive paper-snapshot leaderboard, and then three Key Findings:
paired execution gains, cross-model transfer, and useful experience from
unfinished exploration. The last is explicitly a five-scene conveyor-pickup
case, not an aggregate result across tasks. Cost and token comparisons remain
in the details page's collapsed evidence.
The three video previews link to the full gallery. Detailed protocols, diagrams,
tables, limitations, and resources live on the Method & Results subpage.

The details page selects five experimental Insights: gains with and without
wiki, reusable operations and contact limits, transfer across models and tasks,
useful operations from unfinished exploration, and the cost of structured reuse. Each finding
shows a short conclusion and a selected result. Native disclosure panels retain
the supporting charts, exact conditions, uncertainty, and limitations. The full
evaluation and interactive leaderboard are a separate collapsed panel. Existing
overview evidence links forward to the details page (Method and Leaderboard anchors stay on
the overview), where section and leaderboard
links expand their evidence automatically. All panels
can also be opened without JavaScript. Repeated hero result cards are omitted.

`public/embodied-rsi/data/results.json` is the shared, downloadable result snapshot, rendered at build time.

| Content | EAHarnessPaper source |
| --- | --- |
| Title | `main.tex` |
| Method and phase permissions | `Sections/2_method.tex` |
| Input knowledge comparison | `Tables/task_knowledge.tex` |
| Self and transferred harnesses | `Tables/paired_results.tex` |
| Full evaluation and external snapshot | `Tables/full_results.tex` |
| Twelve-target transfer | `Tables/cross_task_results.tex` |
| Selected capability changes | `Tables/capability_results.tex` |
| Unfinished Playground case | `Tables/unfinished_experience.tex` |
| Test expense | `Tables/cost_results.tex` |
| Representation, uncertainty and case studies | `Sections/3_experiments.tex` |
| Token accounting and evaluation boundaries | `Sections/7_appendix.tex` |

The full evaluation uses task descriptions + wiki, 50 scenes per task, and one seed: **44.48 Score / 37.82% SR** across 2,100 episodes. Generalization variants, tasks within categories, and the five categories are equally weighted at their respective levels. It includes target-task Playground exploration even for Open tasks; development and Full Evaluation scene pools can overlap. External rows reproduce the paper’s October 9, 2026 leaderboard snapshot and retain their own resource conditions.

The 210-episode paired evaluation is separate: pure task description yields Astra/xhigh 8.50% → 30.17% SR; wiki yields 13.36% → 35.08%. The 21.67-point pure-description gain has a 95% interval of 12.33–31.39 points from 10,000 stratified task-bootstrap draws, conditional on frozen harnesses.

Sol and Luna’s own harnesses do not improve completion; Astra’s harness improves their SR by 8.86 and 5.50 points over no experience. Cross-task means weight twelve fixed targets separately from the benchmark average. Raw history and Skills/Lessons reach 29.78% and 30.17% SR; their 0.39-point difference has an interval spanning zero. Structured experience costs $5.732 per Test episode versus $12.203 for raw history (53.0% lower), but exceeds the $4.058 no-experience baseline. These are token-based estimates, not invoices. Acquisition and archived attempts are reported separately.

The updated selection foregrounds the main manuscript's matched tic-tac-toe
and imitation-sorting examples: success rises from 0 to 100% and 0 to 80%,
respectively. Tube and key insertion still have zero dev-set success despite
partial Score gains. The cases illustrate actual reuse, without isolating an
individual Skill or Lesson's causal effect.

Related-task and mismatched-task experience improve success by 14.72 and 16.67
points on the twelve-target subset, with no target-task exploration. Gains use
the manuscript's unrounded source means before rounding; subtracting the
displayed two-decimal absolute means can differ by 0.01 point. The results do
not establish that mismatched sources are generally better.

For image-conditioned conveyor pickup, Playground has no task success after
100 executions, but execution 74 establishes a tracked grasp and test lift in
31 native actions. Frozen experience raises success from 0 to 40% on five new
Test scenes. This is partial operational progress from an unfinished task,
not evidence that every unsuccessful exploration is useful.

Skills/Lessons reduce cumulative Test tokens from 4.460M to 3.958M per episode
(11.3%), including repeated context and failures. Uncached input falls 87.9%,
which explains the larger estimated monetary saving under the paper's fixed
token rates. The detailed page omits the older acquisition/archived-attempt
ledger; provenance remains in this document and the downloadable snapshot.

One acquisition/inheritance generation, simulation, and fixed source maps do not establish repeated-generation improvement, broad unseen-task generalization, or real-hardware performance.

## Paper figures

The following optimized copies in `public/embodied-rsi/figures/` come directly from the manuscript:

- `embodied-rsi-overview.webp` ← `Figures/embodied-rsi-overview.png`.
- `embodied-rsi-method.webp` ← `Figures/embodied-rsi-method.png`.
- `experiment-qualitative.webp` ← page 1 of `Figures/experiment-qualitative.pdf`.
- `experiment-experience-trace.webp` ← page 1 of `Figures/experiment-experience-trace.pdf`.
- `experiment-capability-evolution.webp` ← page 1 of `Figures/experiment-capability-evolution.pdf` (1170 × 749; refreshed October 13).

PNG sources use RGB WebP quality 92. The static framework was refreshed from the current paper on October 13, 2026 to match the robot-arm logo in the homepage animation. PDFs are rendered at 2.5× and encoded at quality 92. Sources remain unchanged. The selected capability figure replaces the older qualitative montage on the details page. The manuscript trace figures concern paired, pure-description cases; the live video examples below are from the separate wiki Full Evaluation.

## Complete-episode gallery

The reference is the [official RoboDojo rollout gallery](https://robodojo-benchmark.com/leaderboard/rollouts/VPP2?bench=sim). This site extends task/example browsing with the execution-and-experience panel from EAHarness’s Final D Recipe replay monitor. It is a standalone static implementation and needs no monitor server.

Source run, relative to the EAHarness repository:

```text
runs/final/202610061832_robodojo_D_recipe_astra_xhigh_v01_a01/
```

`submission/provenance.json` chooses each official record, including its selected attempt. The exporter does not choose the latest attempt or the best score. Every report SHA-256 is checked before extracting results. The full set is complete: 42 base tasks, 54 standard/random variants, 2,100 records, seed 1.

**Current display scope: 54 tasks × 3 examples × 1 seed = 162 examples.** Following the official gallery, the 12 Generalization tasks each have separate Standard and Random entries (24 variants), alongside 30 other tasks. Each entry selects its first three official records without outcome filtering. Each task header uses all 25 scenes of its Generalization variant, or all 50 scenes for other tasks. Paper-level aggregation still averages variants within the 42 base tasks. Capability and headline metrics use the paper’s full-evaluation weighting, never the display subset.

The homepage previews language-conditioned stacking (layout 0), cover blocks (layout 0), and unsuccessful tube insertion (layout 1). These are linked examples from the same collection; their outcomes are read from reports, not editorially assigned.

### Copied artifacts

`public/embodied-rsi/replays/` contains:

- `catalog.json`: 54 displayed task records and 162 example identities; `baseTask` maps each variant to the paper’s 42 base tasks.
- `evaluation.json`: all 2,100 recorded scores/success outcomes and report hashes for aggregation checks.
- `inventory.json`: exact file counts and bytes.
- `episodes/<variant>--<layout>/`: three complete camera MP4s, a WebP poster, the byte-identical selected `report.json`, and `trace.json`.

Each trace contains exact submitted source snapshots, source-file boundaries with verified content hashes, every execution’s public feedback, frozen Test Skills/Lessons, and public assistant/tool events in recorded order. Repeated source text is content-addressed within a trace. The exporter omits system/developer prompts, private/encrypted reasoning, token accounting, private ledgers, and sealed plans. It does not invent missing thoughts or infer decisions from video.

### Media and timing

The web copies use H.264 CRF 34 (slow preset), 480×360, YUV420P and fast-start metadata. **No scene is cut or sped up.** The exporter verifies the original frame rate, frame count, and duration for every camera. Original and web SHA-256 hashes, byte sizes, and source dimensions remain in trace provenance. These are compressed web copies of the 640×480 recordings. The playback page discloses this compression.

`scripts/compress-robodojo.py --source <previous-export/replays>` applies the approved settings to an existing web export, retaining the prior web hash and size as well as the original recording provenance. It processes only catalogued examples, verifies timing and every frame count before replacing each video, and updates the inventory. This offline tool requires FFmpeg and FFprobe; the site does not depend on the source directory.

The evaluator’s full-movie clock is different from submission timestamps and model waiting time. Code and agent events are therefore browsed independently of video time, as in the monitor’s official-movie mode. Switching cameras preserves the current video position. Choosing another episode resets playback and clears the previous record before loading the new one.

## Static deployment and checks

All runtime assets are checked into this repository as regular files. URLs respect Astro’s `BASE_PATH` and are local to the deployed site. Builds do not read EAHarnessPaper, EAHarness, a monitor API, or an external media host. The exporter script is optional offline preparation, not a build dependency.

`npm run validate:embodiedevo` checks selection, 54×3 coverage, aggregation over the 42 base tasks, all 2,100 outcome identities, exact paper/category metrics, report/content/video checksums, three cameras per episode, file sizes and absence of symlinks. `npm run build` exports the complete lab site to `dist/`, including its homepage, Research listing, and all EmbodiedEvo routes and assets, and fails at GitHub Pages’ 1 GB site limit. `build:embodiedrsi` is a compatibility alias. The Pages workflow deploys main and uses Pages-provided domain/base-path settings.

`python scripts/verify-embodiedrsi.py --url <preview>` exercises real playback, filters, all right-panel views, keyboard tabs, race/retry behavior and responsive layouts. Generated screenshots and reports are local `.work/` artifacts, not deployment dependencies.


## Paper identity and method figures

The project overview, `/embodiedevo/details/`, and `/embodiedevo/trajectories/` share `ProjectHeader.astro`,
the lab navigation, project resource buttons, and `embodiedevo-brand.css`.
The trajectory page is a project subpage with a Research → EmbodiedEvo → Video
Trajectories breadcrumb and links back to the overview, method, and results.
The Paper button remains explicitly unavailable until a release link exists.
GitHub buttons on both project pages, the resources section, and the Research
listing link to `https://github.com/Einsia/EmbodiedEvo`.

The vector robot-arm/code mark in `public/embodied-rsi/mark.svg` is a web redraw
of the mark embedded in the paper's `Figures/embodied-rsi-overview.png`.
The wordmark uses the overview's dark blue-gray and warm orange; chart series use
the paper's `render_figures.py` colors (baseline `#7A8590`, self-generated
`#C17643`, transferred `#286C98`). Text and surface colors follow
`Tables/result_style.tex` (`#315F85`, `#59616A`, `#FAF4EE`, `#F1F5FA`).

The original `embodied-rsi-method.webp` is displayed directly in the method
section. `control-paradigms.webp` is a crop of the paper's
`Figures/related-work-comparison.png` (original 4260 × 2437, crop rectangle
`0,0,4260,2250`, web size 2800 × 1479). It retains all four control paradigms,
the complete execution-feedback loop, and the simulator row; only the
illustrative multi-benchmark footer is omitted. The adjacent method section explains the four agent-facing primitives separately
from the simulator backend operations in the figure. All reported results remain RoboDojo only.
Both figures open at full resolution; all assets are repository-local.


## Full-evaluation leaderboard

`Leaderboard.astro` renders all seven paper-snapshot systems with the six
Score/SR pairs (Average and five capabilities) from `Tables/full_results.tex`.
The initial order is descending Average Score. Score/SR controls, dimension
sorting (including clickable column headers), type filters, and reset all act
on the same static rows; JavaScript is optional for reading the full table.
The Average/capability values and contributor labels are stored in
`results.json`. EmbodiedEvo values match `fullEvaluation`.

This is a selected paper comparison, not a live official ranking. No official
rank or medal is assigned to the rows. Protocol and resource differences are
recorded in this document and the downloadable result snapshot. Orange identifies our row; type tags use the
paper's blue, teal, violet, and brown palette. Model logos are copied from the
official leaderboard into `public/embodied-rsi/logos/`, with original URLs and
checksums in `sources.json`; the published site loads them locally.

## Two-stage method animation

`method-two-stages.gif` builds the paper framework element by element: the
Playground agent, Python code, environment and feedback; Skills, Lessons and
reuse; then freezing, inheritance and the independent Test loop. Nodes fade in
and connectors appear in the direction of flow. The complete diagram remains
visible at the end of the 6.67-second loop (3× original playback speed). The figure automatically plays with
no explanatory caption, banner, play/pause button or download control.

The canonical paper figure is a raster PNG, with no layered source found in
the paper directory. A byte-identical copy is kept at
`scripts/assets/method-animation/paper-framework.png`, with its SHA-256 and
27 reconstructed layer definitions in the neighboring `layers.json`.
`scripts/assets/method-animation/layers.svg` contains named raster groups and
clip masks for editing; it is a reconstructed source, not an original vector
drawing. This editable source stays outside the deployed public assets.
The source uses the paper's current logo and labels. This remains a schematic
explanation, not a recorded robot trajectory.

The GIF, layered SVG and static WebP poster are generated locally by
`scripts/render-method-animation.py` using Pillow. Normal builds use committed
assets and do not require the paper checkout, Python or fonts. Playback stops
when the figure leaves the viewport and defaults to the poster with reduced
motion or without JavaScript. Both original method figures
remain on the Method & Results subpage.

## Replay syntax highlighting

The Code, Skills and Lessons tabs highlight Python, Markdown (including fenced
code), shell and JSON files using locally bundled Prism grammars. File and
execution changes update the language automatically; feedback remains plain
text. The renderer creates text nodes and token spans, so HTML-looking source
is displayed literally and whitespace is preserved. Copy uses the original
trace text, and wrapping remains independent of highlighting. No trace data is
modified and no CDN or external highlighter is required.

## Detailed method and evidence page

The Method & Results page uses the overview's paper, orange and blue palette,
with a sticky section navigation and a shared width for the lab header and
page content. The four keyboard-accessible method steps sit in one panel;
the paper figures open at full resolution. Finding summaries foreground the
main result, with supporting charts, tables and experimental conditions kept
inside the existing disclosures. Direct evidence and leaderboard links still
open their containing disclosure. Chart labels and table values are sized for
reading on desktop and mobile; wide tables scroll within their own panels.

## Concise page annotations

Repeated episode/scope subtitles, figure captions, result-card footnotes, and
replay-panel helper footnotes are omitted from the visible pages. Experimental
provenance and conditions remain documented here and in the downloadable data;
the collection disclosure retains the gallery scope and timing explanation.
Chart labels, units, comparison conditions, confidence intervals, and the
explicit 54 tasks / 3 examples per task / 162 trajectories counts remain.
