# EmbodiedEvo website: content and evidence

## Current source and scope

The English project page at `/` and `/embodied-rsi/` follows the current local `paper/` manuscript, synchronized on October 12, 2026. The manuscript supersedes the earlier proposal as the source for the title, method, experimental results, and conclusions. Website copy, image text, interaction labels, and recorded trace content must remain entirely in English.

The title is **EmbodiedEvo: Self-improving Code Agents for Physical Intelligence**. The project page omits the author, affiliation, and contribution block at the project owner's request. Public paper and code links are still unavailable, so the page labels those links forthcoming and retains `noindex,nofollow`.

## Page narrative

1. Physical interaction produces reusable control knowledge with fixed model weights and robot interfaces.
2. A coding agent autonomously develops programs in Playground, revises Skills and Lessons, and freezes those artifacts for independent Test agents.
3. Paired RoboDojo comparisons hold the executor and Test scenes fixed; the separate full evaluation uses task descriptions plus wiki recipes.
4. Capability gains include multi-stage and memory-dependent behavior, alongside regressions and remaining contact-control difficulties.
5. A capable producer supplies experience to other executors and, in a separate fixed-target study, to other tasks.
6. Raw history achieves similar observed success. Skills and Lessons reduce the expense of consulting the acquired experience.
7. Recorded RoboTwin and RoboCasa demonstrations illustrate the interaction interface separately from the RoboDojo numerical study.

The study evaluates one generation of experience acquisition and inheritance. The page makes no claim of demonstrated improvement across repeated generations, broad unseen-task generalization, or real-hardware performance.

## Result sources

`public/embodied-rsi/data/results.json` is the website's shared, downloadable result snapshot. The Astro component imports it at build time; rendering the key results does not require a client request.

| Website content | Manuscript source |
| --- | --- |
| Title | `paper/main.tex` |
| Main mechanism and phase permissions | `paper/Sections/2_method.tex` |
| Task-description and wiki comparisons | `paper/Tables/task_knowledge.tex` |
| Self-generated and transferred harnesses | `paper/Tables/paired_results.tex` |
| Full evaluation and category values | `paper/Tables/full_results.tex` |
| Twelve-target cross-task comparison | `paper/Tables/cross_task_results.tex` |
| Acquisition and Test expense | `paper/Tables/cost_results.tex` |
| Raw-history expense, uncertainty, case studies | `paper/Sections/3_experiments.tex` |
| Evaluation boundaries | `paper/Sections/6_discussion.tex` |

### Interpretation to preserve

- Paired evaluation: 42 tasks, five scenes per task, 210 episodes per condition. The task-description comparison raises Astra/xhigh SR from 8.50% to 30.17%, a 21.67-point gain with a 95% task-bootstrap interval of 12.33–31.39 points.
- Generalization variants, tasks within categories, and the five categories receive equal weight at their respective levels. Intervals use 10,000 paired task-bootstrap draws stratified by category, conditional on frozen harnesses.
- Wiki is supplied during both Playground and Test, with independently acquired harnesses. The setting was selected after earlier outcomes were inspected.
- Full evaluation: 2,100 episodes, 50 per task, one seed; 44.48 Score and 37.82% SR. It includes task-specific Playground exploration even for Open tasks, and its scene pool can overlap development scenes. External leaderboard entries retain different resource conditions.
- Sol and Luna gain no task-completion benefit from their own harnesses. Astra-produced experience improves their SR by 8.86 and 5.50 points over no experience.
- Cross-task results average twelve fixed targets, separately from the 42-task benchmark average. Neither related nor mismatched transfer runs a target-task Playground. A fixed assignment is not an unseen-task distribution.
- Raw history and Skills/Lessons share a Playground source and achieve 29.78% and 30.17% SR. Their 0.39-point difference has a 95% interval of −5.11–5.94 points.
- Skills/Lessons cost $5.732 per Test episode versus $12.203 for raw history, a 53.0% reduction. No experience costs $4.058; structured experience therefore increases Test expense relative to this baseline.
- Retained Astra/xhigh acquisition costs $1,213.84, plus $1,014.01 in recorded archived attempts. These are token-based estimates using the recorded rate schedule, not invoices; missing historical usage leaves campaign totals incomplete.

## Paper figures

The website reuses existing manuscript figures without changing their scientific content. The web copies are in `public/embodied-rsi/figures/`:

| Web image | Source |
| --- | --- |
| `embodied-rsi-overview.webp` | `paper/Figures/embodied-rsi-overview.png` |
| `embodied-rsi-method.webp` | `paper/Figures/embodied-rsi-method.png` |
| `experiment-qualitative.webp` | `paper/Figures/experiment-qualitative.pdf`, page 1 |
| `experiment-experience-trace.webp` | `paper/Figures/experiment-experience-trace.pdf`, page 1 |

PNG sources are encoded as RGB WebP at quality 92. PDF pages are rendered with PyMuPDF at 2.5× scale, then encoded as WebP at quality 92. The source images remain untouched. Image dimensions are taken from the generated files. The overview and framework contain schematic scenes; the qualitative and experience-trace figures contain the recorded evidence and annotations described in the manuscript. Full-resolution images open from each figure.

## Recorded demonstrations

Both replays are successful, completed **Debug / Test** episodes. They are interface demonstrations, not aggregate results or evidence of a Playground improvement effect.

| Asset | Source | Presentation |
| --- | --- | --- |
| RoboTwin / Stack two blocks | `EAHarness/analysis/202609251602_test_trace/` export of `202609221821_debug/RoboTwin_stack_blocks_two_r1/test/scene_0003` | 40-second four-camera video, 12 executions, 73 native control steps |
| RoboCasa / Open the right drawer | `EAHarness/runs/debug/202609221821_debug/tasks/RoboCasa_OpenDrawer_r1/test/scene_0001/workspace/observations/` | 32.9-second three-camera composite, 12 executions, 284 native control steps |

RoboCasa preserves source clip frames in order, with holds for observation-only executions. Its right external camera is large; left external and wrist cameras are stacked on the right. RoboTwin uses head/front/left/right quadrants. Timing is a presentation timeline, not model inference speed. Comments and feedback are preserved from submitted code and the corresponding execution; editorial chapter titles are separate. No hidden reasoning is reconstructed.

RoboDojo's replay selector links to the paper's recorded stacking case study. It does not imply that quantitative results are pending or fabricate an unavailable synchronized video.

`scripts/prepare-embodiedrsi.py` recreates the existing replay assets from completed source artifacts. Normal builds need only the copied assets and do not depend on the experiment checkout.

## Updating and checking

- Copy, section order, semantic markup: `src/components/embodiedrsi/ProjectPage.astro`.
- Numerical content: `public/embodied-rsi/data/results.json`; update from the corresponding manuscript tables and prose.
- Styles: `src/styles/embodiedrsi.css`.
- Replay, keyboard tabs, and result-input selection: `src/scripts/embodiedrsi.ts`.
- Verification: `scripts/verify-embodiedrsi.py`, covering numerical display, result switching, English-only text and traces, replay behavior, fallback states, no-JavaScript results, alias routing, and 320–1440 px layouts.
- Build: `npm run build:embodiedrsi`; isolated output is `dist-embodiedrsi/`.
- Final public release still needs real paper/code URLs and deployment metadata before removing the preview robots directive.
