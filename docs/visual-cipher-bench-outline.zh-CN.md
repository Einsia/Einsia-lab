# Visual Cipher Bench 网页初版大纲

版本：2026-11-13（Leaderboard 视觉与交互、framework 标题更新）。目标路由：`/visual-cipher-bench/`。页面语言沿用官网英文；本文供中文编辑讨论。

## 核心故事

**当题目没有文字规则，也没有即时正确性反馈时，agent 能否从图中发现机制，并把长程推理做完？**

叙事顺序：理解挑战 → 看到真实题目 → 看到能力上限 → 用机制提示实验解释瓶颈 → 用一道完整案例理解“局部合理不等于全局正确” → 理解评测可信度 → 获取论文和代码。

页面标题采用论文正式名称 Visual Cipher Bench；首屏用问题句解释任务。数据以用户提供的 `Visual_Cipher_Bench-17.pdf` 为准，不能把补充实验的准确率当作整个 benchmark 的结果。

## 页面结构

| 顺序 / 锚点 | 标题与内容 | 希望读者记住什么 | 当前呈现 | 后续可调整 |
| --- | --- | --- | --- | --- |
| 1 / 首屏 | Visual Cipher Bench；问题句；机构；Paper（链接待补）、GitHub、Leaderboard、Tasks、Case study | 不只看懂图，还要自行发现规则并完成推理 | 与官网共用导航、Georgia/Inter、暖纸底、深绿文字、按钮；40 题、60 分钟、29 配置、26.7% 四项事实；首屏下方展示论文 Figure 1 framework，基于可编辑 PPT 补充总标题 | 确认正式 arXiv / 会议 / 期刊地址后填写 Paper 链接；可增加作者折叠区 |
| 2 / `#benchmark` | The image is the specification. | 图就是题目说明，规则发现、执行、自我验证缺一不可 | 简短对比编码任务的文字规格与测试反馈；三步推理过程 | 可改为一条小型视觉循环图 |
| 3 / `#tasks` | Four ways to get stuck. | 四类各 10 题，所有题目都是真实、可查看的 | 四类切换；每类 10 题下拉；67 张完整题图分页；新标签页放大；原仓库入口 | 可拆分独立任务页；挑选空间题加入交互演示 |
| 4 / `#leaderboard` | Even the best solves about a quarter. | 最强配置 26.7%，其余五个模型最佳配置仍低于 1% | 8 模型最佳配置彩色横条图，统一 0–100%，模型左侧配厂商图标；29 配置分组柱状图支持 Overall / P1–P4 切换；悬停、键盘或点击查看精确数值；可下载 CSV | 后续数据有原始记录后，可加误差条、各次运行、轨迹与成本 |
| 5 / `#findings` | The hard part is finding the rule. | 机制发现是主要瓶颈；提示实验给出更直接的证据 | 左侧全量分类型准确率；右侧同组 10 题 7.8%→55.6% 对照；错误答案与超时两类观察 | 可加入同一模型无提示/有提示轨迹比较 |
| 6 / `#case-study` | Closed Stock: local clues, global proof. | 应保留歧义，再用跨页线索与全局闭环排除错误假设 | 两张原题；解法默认折叠；三个可切换步骤：局部歧义、交叉线索、全局闭环 | 可将三步面板升级为 SVG 动画或讲解视频，保持此锚点 |
| 7 / `#evaluation` | Fixed evidence. Tools allowed. One final answer. | 离线工具可用；无中途正确性反馈；最终确定性评分 | 输入、求解、评分三栏；60 分钟/2 CPU/4GB；3,480 次尝试；双人专家检查与 oracle 40/40 | 可展开运行环境版本、提交格式和标准化细节 |
| 8 / `#resources` | Explore, reproduce, and build on it. | 能读论文、查任务、复现评测 | Setup、Scoring protocol、完整任务目录、BibTeX；Paper 入口待正式地址；回 Research | 仓库公开后复查全部外链；正式论文发布后更新引用 |

## 统计口径与出处

| 内容 | 数值 / 范围 | 来源 |
| --- | --- | --- |
| 数据规模 | 40 题 / 67 张图 / 4 类各 10 题 | 论文 §2.2；release `docs/task-manifest.json` |
| 主实验 | 8 模型 / 29 配置 / 各 40 题 × 3 次 = 3,480 attempts | 论文 §3.1、Table 1 |
| 主榜 | GPT-6 Astra max 26.7%；GPT-6.1 Sol max 与 Claude Opus 5.5 xhigh 均 21.7% | Table 1；保留论文一位小数 |
| 分类统计 | P1 22.8%，P2 2.4%，P3 0.6%，P4 3.3% | §3.3.1；所有配置聚合，每类 870 attempts，不是最佳配置的分类型成绩 |
| 提示消融 | 7.8%→55.6%，超时 51→18 | §3.3.1、Table 2；10 题子集，Astra/Sol/Luna max，各 3 次；每个条件 90 attempts |
| 评分 | 标准化后的 exact match；超时与无效输出为 0；不使用模型裁判 | §2.1；release `docs/EVALUATION.md` |
| 案例 | Closed Stock，局部 SHOE/POST 歧义 → STONE 交叉约束 → 唯一闭环 | §3.4.2、Figure 2；release 原题与解法 |

主榜是独立运行的 mean accuracy，不是 pass@3。主榜只展示每个模型最佳配置；下方交互柱状图保留所有 effort。Sonnet 的 max 和 low 均为 0.8%，图中按论文概览显示 max，交互图保留平局。所有结果标明 2026-11-12 论文快照，不冒充实时排行榜。

## 下一轮媒体制作建议

### A. 空间题交互：Prism Camera

推荐原因：只有一张原图，具有明确的“二维纸片 → 折叠 → 组合 → 视角与字母方向 → 读答案”过程。其复杂性也适合说明仅凭字母袋猜词为什么不够。

建议分镜：

1. 原题模式：显示完整图，允许缩放，不提示答案。
2. 解法模式（显式打开剧透）：高亮不同纸片和折线类型。
3. 拖动滑块折叠：保持每个字母的朝向与字脚随面移动；不要将几何折叠简化为图片变形。
4. 组合体：展示端件与中间两块，区分多个合法装配方案。
5. 切换前/后视角：说明为什么正面、整个背面都不能直接读。
6. 标出正确 4×2 阅读区域，最后才展示答案。

制作前需从 reference solver 核对几何、折线方向、遮挡与字母定位；完整纸模型尚未实现，本版只提供真实原图浏览。建议采用 Three.js 或预渲染视频，具体取决于能否导出可靠几何，不先承诺未经核验的折叠动画。

### B. 规则发现故事：Closed Stock

当前分步面板可直接作为视频脚本。先并列展示两种局部可行读法，再逐条点亮 STONE 的五条交叉关系，最后构建唯一闭环。建议旁白和字幕强调“保留歧义—传播约束—全局验证”，不要把主题相关的猜词当作推理解法。

视频建议 60–90 秒，支持暂停、拖动和字幕；默认不自动播放解法。若改为 agent 轨迹视频，必须绑定真实 run ID 与时间戳，区分原始过程、剪辑过程和说明动画。

### C. 提示消融对照

在同一模型、同一题上并排展示无提示/有提示过程，标注提示原文及其不包含答案的范围。选择代表轨迹前，需要回查原始记录，不能根据最终分数编造推理过程。

## 风格与全站参考

已检查官网 Research 索引及 11 个项目入口，同时阅读本地 Astro 实现。统一沿用站内设计系统，无新增设计框架。

| 页面 | 参考内容 |
| --- | --- |
| [PPTBench](https://lab.einsia.ai/pptbench/) | 标题与 CTA、榜单、任务画廊、演示、评分流程、发现 |
| [SWE Refactor Bench](https://lab.einsia.ai/swe-refactor-bench/) | 问题驱动的叙事、事实条、关键失败点、分阶段评测、资源与引用 |
| [Frontier-Engineering](https://lab.einsia.ai/frontier-eng/) | 总览、动机案例、榜单、关键发现 |
| [Frontier3DBench](https://lab.einsia.ai/frontier3dbench/) | 任务输入输出、榜单、可执行结果展示；`/frontier3d/` 同一项目 |
| [Physics](https://lab.einsia.ai/phys-last-exam/) | 任务分类、具体案例、测量过程 |
| [AI4AI-Bench](https://lab.einsia.ai/ai4ai/) | 研究问题先行，结果与解读相连 |
| [Quant-Arena](https://lab.einsia.ai/quant-arena/) | 任务协议、发现、榜单、案例 |
| [WorkflowArena](https://lab.einsia.ai/workflowarena/home.html) | 研究问题、发现、任务、协议、结果与案例回放；沿用全站共同风格 |
| [EmbodiedEvo](https://lab.einsia.ai/embodiedevo/) | Method、Results、Key Findings、视频轨迹 |
| [BrowserBC](https://lab.einsia.ai/browserbc/) | Core Idea、Method、Results、Live Case Demos、Citation |
| [OpenChronicle](https://lab.einsia.ai/openchronicle/) | 同站项目的介绍与亮点；非本页榜单叙事的主模板 |

## 实现与后续维护

- 页面：`src/pages/visual-cipher-bench/index.astro`。
- 数据：`src/data/visual-cipher-bench/results.ts` 与 `tasks.json`。
- 行为：`src/scripts/visual-cipher-bench.ts` 与 `visual-cipher-bench-results.ts`。
- 分类成绩组件：`src/components/visual-cipher-bench/ResultExplorer.astro`，默认显示全部 29 配置。
- 样式：`src/styles/visual-cipher-bench.css`，使用官网颜色与字体 token。
- 资源：`public/visual-cipher-bench/` 仅放厂商图标、CSV 与分享图；67 张题图及框架图位于 `resources/visual-cipher-bench/media/`，通过公开 Raw 链接加载，不进入 Pages 产物。论文链接暂留空，不发布用户提供的本地 PDF。
- 导航与 SEO：新增 Research 内容项，首页/Research 的内容集合自动纳入；新增路由 SEO。
- 所有题图使用 `object-fit: contain` 展示整幅，不裁掉线索；高分辨率图可在新标签页查看。
- 初版按公司现有 Astro 项目实现；未发布到生产环境。
- 全站已接近 GitHub Pages 的 1 GB 上限；部署实际执行 995 MB 安全预算。题图及框架图约 3.40 MB 从 Pages 产物分离，后续视频与大型 3D 资源宜使用对象存储/CDN，避免放入 `public/`。

GitHub 公开链接在本次检查中返回 404；本版素材来自本地 `Visual-Cipher-Bench-release`，其 origin 与用户给定仓库一致。需在公开发布时确认仓库可访问，或提供经过验证的新地址。论文数据以用户提供的 PDF 为依据；Paper 链接留空，待填写正式 arXiv / 会议 / 期刊地址，不发布该本地 PDF。


## 2026-11-13 Leaderboard 调整

1. 标题区之后、benchmark 定义之前加入 framework 图，可点击打开大图；基于用户提供的 PPT 副本补充 Visual Cipher Bench 总标题，保留原有主体布局与配色。
2. 主榜、分组柱状图及配置详情共用 `results.ts` 中的 `modelStyles`。同模型使用同一基色，同一 effort 使用同一不透明度，不随排名或所选分类变化。
3. 八模型依次使用蓝、紫、橙、绿、金、青、玫红、灰蓝；厂商 SVG 从 `public/swe-refactor-bench/img/logos/` 复制到本项目 `logos/`。
4. 大表替换为按模型分组、按 effort 从低到高排列的柱状图。支持 Overall / P1 / P2 / P3 / P4；详情区同时列出该配置总体与四类准确率，避免反复查表。
5. 默认纵轴从零开始并适应结果（总体 0–30%、P1 0–100%、P2/P4 0–20%、P3 0–5%），始终显式显示刻度。可切换到固定 0–100% 便于跨分类比较。零分柱高度为零，仍可点击基线对应区域查看。
6. 桌面悬停、点击与键盘焦点均更新详情；左右方向键切换配置。手机端在图表容器内部横向浏览，页面本身不横向溢出。CSV 保留全部 29 行和原有数值精度。

## Framework 可编辑源文件

基于用户提供的 `framework_clean.pptx` 创建副本，在上方增加居中的 **Visual Cipher Bench** 标题，并扩展画布为标题留白；原有三栏内容、数据及图片保留。网站使用导出的 WebP；可编辑源文件保存在 `resources/visual-cipher-bench/framework_visual_cipher_bench.pptx`，不进入公开静态资源目录。

## 2026-11-13 容量与发布调整

- 沿用 WorkflowArena 的资源分离方案：图片完整移入 `resources/visual-cipher-bench/media/`，无重新压缩、裁剪或删题。生产 URL 统一在 `src/data/visual-cipher-bench/media.json`。
- `src/lib/visual-cipher-bench-assets.ts` 中 `paperUrl` 暂为空；页面使用站内已有的 disabled Paper 样式，Research 卡片使用 `pending: true`。正式论文地址确定后同步更新这两个入口。
- `npm run build` 同时核对 68 张图片的 SHA-256、40 题资源引用、Pages 产物中无重复素材和无本地 PDF 链接；完整构建容量检查统一执行 995 MB，避免本地 build 通过而部署失败。
- `site/visual-cipher-bench` 分支与 PR 增加完整 CI 检查。Raw URL 指向 main；合并 main 后图片才具备线上地址。合并前使用本地离线预览检查，不把尚不存在的线上文件说成已验证。
- GitHub Raw 与站内 WorkflowArena 相同，适合作为本次过渡；它并未扩大 Pages 配额，也不能替代公司对象存储/CDN。应由维护者规划 Physics / EmbodiedEvo 的大媒体迁移。

## 2026-11-13 精简改版

按 SWE Refactor Bench 页面结构精简，以下内容取代上文中已删除的部分：

1. 首屏：问题句（coding agent）、四个关键数字（40 题、29 个配置、最佳 26.7%、3,480 次评测运行）。
2. 题目滚动画廊（`#tasks`）：67 张题图分两行反向缓慢滚动，悬停暂停，点击打开原图；不再有分类选项卡和分页浏览。
3. Overview：任务说明与 README 主图。
4. Leaderboard（`#leaderboard`）：只保留一张图，每个配置一根柱，按模型分组、颜色深浅表示 reasoning effort，悬停显示 P1–P4 分项；原先的“各模型最佳”条形图和交互式配置图已合并到这里。
5. Key findings：分类汇总准确率与机制提示消融，同一 0–60% 刻度。
6. Evaluation setup：评测设置表（输入、环境、时限、反馈、评分、失败、运行次数），不再放 GitHub 文档链接；最后是引用。

已删除：Closed Stock 案例分析、图注与各类小字说明、页内导航条。

论文已发布：https://arxiv.org/abs/2611.16861 ，接入首屏 arXiv 按钮、Research 卡片和引用；不再保留 disabled 的 Paper 按钮。
