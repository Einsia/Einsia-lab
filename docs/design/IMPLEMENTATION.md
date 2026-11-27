# Einsia UI v0.4 实施记录

日期：2026-11-27。范围：Navers Lab 主站、13 个 Research 项目入口、各项目的结果与任务页，以及 RoboUniverse、WorkflowArena 独立 HTML。

## 设计依据与维护入口

- `approved-v0.4.html` 原样保存用户提供的评审文件，SHA-256 与下载目录原件一致：`e3cf6141b66184a799b7ce3631a68e20bb5a6ac8131f12e8b21c331cf5d838c1`。
- `AGENT-GUIDELINE.md` 是正式 Agent 规范，覆盖字体、颜色、布局、控件状态、表单、Tabs、弹窗、表格、媒体、错误状态和验收。
- 根目录 `AGENTS.md` 和 `.cursor/rules/lab-design.mdc` 均指向正式规范。旧 v0.1 文件仅作历史记录。
- `src/design/tokens.json` 是 83 个生产 token 的唯一编辑源。`scripts/design-tokens.mjs` 生成共享 CSS 和评审文件中的两套本地标题字体。
- `public/design/site.css`、`site.js` 提供共享基础样式与行为；`DesignAssets.astro` 接入 Astro 和独立 EmbodiedEvo 文档。10 个静态 HTML 通过同步脚本接入同一套资源。

## 已完成的改造

全站采用纸色背景、深绿色操作、Hanken Grotesk 英文标题、Noto Sans SC 中文标题和系统正文字体。共享容器、移动导航、控件尺寸、可见焦点、标题换行和最小 HTML 字号统一；移除了 Inter 和 Google Fonts 的运行时加载。

Research 改成一致的项目行，保留 13 个项目、日期、摘要、真实缩略图及各自资源链接。各项目继续使用其研究内容所需的信息结构，绘图数据和系列颜色保持原有含义。

Frontier3D 与 RoboUniverse 的视频移到摘要和资源之后，使用海报、原生播放控件与 metadata 预加载，默认暂停。Frontier3D 的模拟编辑器组件改成真实输入参考图与生成结果比较；保留交互 3D 查看器、静态预览和模型资源。视频和论文图不再按页面主题裁切或混色。

自动图集改成可手动滚动、可键盘进入的证据集合。取消图表滚动入场和分数揭示效果。EmbodiedEvo 方法动画有显式播放／暂停控件；WorkflowArena 默认暂停建造过程和自动旋转，取消跨模型后台预取，暂停时扫描效果也停止推进。

主站图片预览使用原生 dialog，支持键盘打开、焦点约束、Escape、关闭按钮和焦点返回。Astro 与静态站点共用带 `aria-expanded` 的移动菜单，支持 Escape，禁用 JavaScript 时仍可访问导航。AI4AI 筛选补上明确空状态、状态播报及 Back／刷新恢复。

共享兼容样式负责现有页面的迁移。新组件应直接使用 token，不能以旧页面中遗留的局部 CSS 数值建立新主题。

## 构建与内容验证

- `npm run build`：通过，生成 402 个 Astro 页面；完整站点输出约 771.0 MB。
- `npm run validate:design`：83 个 token、2 个本地字体及 10 个独立 HTML 接入检查通过。
- 构建内 WorkflowArena 验证：通过，42 个发布文件，约 0.603 MB；媒体和数据保留在原有资源体系中。
- 构建内 Visual Cipher Bench 验证：通过，40 个任务、67 张原始谜题图，论文链接有效。
- `npm run validate:embodiedevo`：通过，54 个 gallery task、162 条轨迹、486 个视频、4,566 次执行、22,967 个公开事件；完整评估仍为 44.48 Score / 37.82% SR。
- `npm run validate:phys-last-exam`：通过，7,823 个资产校验，1,278 个原始视频、1,272 个叠加视频、191 个初始化记录。
- `npm run validate:ai4ai`：通过，290 个配置、792 个 artifact。
- `npm run validate:ai4ai-site`：通过，290 个案例路由、首页、Explorer、checkpoint 规则、诊断限定和公开内容检查。
- `git diff --check`：通过。已跟踪的研究 JSON／CSV、图片、视频、PDF、模型和压缩数据文件没有改动；WorkflowArena 发布 manifest 按源码同步更新。

AI4AI 的旧站点校验曾要求早先首页的统计文案和 teaser 文件名。当前首页和 Research 元数据在本次改造前已使用新的叙述和 logo-banner；校验已对齐当前生产数据和路由，并同时支持 Astro 内联或外置脚本。案例诊断和公开内容检查继续保留。

## 浏览器验收

环境：macOS 系统 Chrome、隔离安装的 Playwright、Astro 构建产物预览 `http://127.0.0.1:4322`。

`scripts/validate-design-browser.mjs` 对 48 个代表路由逐一检查 320 / 390 / 768 / 1024 / 1440px，共 **240 次，通过**。包含所有项目首页、结果／列表页、独立子站、别名入口，以及 AI4AI、Frontier Engineering、SWE Refactor 的动态任务／案例模板。

检查结果：无整页横向溢出、无脚本异常、无默认播放的视频、无持续运行的 CSS 动画；可见 HTML 文字没有低于 12px 的标签或旧 Georgia／Inter Variable 字体。这里的文字统计排除论文图片、SVG、Canvas、隐藏内容、上标和下标。

`scripts/validate-design-interactions.mjs` 的 **15 组交互检查全部通过**：

- 主站、EmbodiedEvo、WorkflowArena、RoboUniverse 移动菜单展开、Escape、焦点返回和桌面导航。
- 通用图片预览的键盘打开、焦点约束、关闭及焦点返回；Visual Cipher 谜题预览。
- AI4AI 筛选、Matrix、空结果、Reset、Back、刷新恢复。
- EmbodiedEvo 表格排序、指标切换、类型筛选、Reset；方法动画手动播放与暂停。
- 轨迹相机和记录 Tabs 的方向键／Home／End；真实剪贴板写入及成功反馈；视频手动播放／暂停。
- 人为拦截轨迹请求得到 503，显示错误后解除拦截并重试成功。
- WorkflowArena 3D 初始暂停、自动旋转关闭，Play／Pause 可用。
- 减少动态效果、粗指针下 44px 控件；200% 桌面重排等效检查（720 CSS px、DPR 2）；无 JavaScript 时核心内容与导航。

共享调色板的计算对比度：正文／背景 10.18:1；次要文字在背景、面板和选中底色上分别为 5.26:1、5.02:1、4.83:1；主按钮文字 10.18:1；控件边界／面板 3.11:1。

机器结果和截图保留在忽略目录 `.local/design-check/final/`，构建输出记录在 `.local/design-check/build.log`。最后对媒体预加载和图集边缘遮罩的调整，又复测了受影响的 5 个路由 × 5 档宽度，**25 次全部通过**，结果位于 `.local/design-check/final-followup/`。

## 验证边界与保留例外

- SVG、Canvas、论文图、真实模型、语法高亮和品牌标识保留其证据配色与原始几何。画布内部的密集标注未计入 HTML 字号统计；这不是对所有科研图的可访问性认证。
- 已测的是 macOS Chrome。Windows／Android 系统字体、Safari／Firefox、屏幕阅读器和浏览器菜单中的实际 200% 缩放尚未实机覆盖；缩放验收使用等效 CSS 视口重排。
- Frontier3D 的按需 Three.js chunk 仍有大于 500 kB 的构建提示（约 630 kB，gzip 约 160 kB）。未宣称生产 LCP、INP 或 CDN 性能达标。
- 本记录覆盖本地实现与构建验收。生产部署由仓库发布流程执行；生产 HTTP 状态、缓存和远端媒体网络行为不属于此次本地验证结果。

## 后续维护命令

修改 token 后运行 `npm run design:tokens`；修改独立 HTML 或 WorkflowArena 源码后运行 `npm run design:sync`，然后 `npm run build`。

浏览器脚本使用外置 Playwright，不把测试浏览器包加入生产依赖：

```sh
npm run preview -- --host 127.0.0.1 --port 4322
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  DESIGN_CHECK_URL=http://127.0.0.1:4322 \
  node scripts/validate-design-browser.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  DESIGN_CHECK_URL=http://127.0.0.1:4322 \
  node scripts/validate-design-interactions.mjs
```

宽度脚本支持在命令后追加路由做定向检查；`DESIGN_CHECK_OUT` 可指定独立结果目录。当前启动器使用 macOS 的系统 Chrome 路径。

## Research 缩略图加载修复（2026-11-27）

线上反馈：Research 列表图片加载慢，未加载或失败时外框塌成细条。原先 13 个列表预览直接引用约 7.47 MB 的研究原图，其中 WorkflowArena 使用 GitHub Raw 地址；图片缺少宽高属性，外框依赖图片内容撑开。

- `scripts/build-research-images.mjs` 从原图生成 240 / 480 / 960px WebP，保留完整画面和比例，文件名带内容哈希。WorkflowArena 从仓库内资源生成，列表不再依赖外部图片请求。
- `npm run dev`、`npm start` 和 `npm run build` 自动先生成缩略图；生成目录 `public/research/thumbnails/` 已忽略，不将这些派生文件加入 Git。修改原图或 banner 配置后可运行 `npm run build:research-images` 刷新。
- 列表使用 `srcset` / `sizes` 选择图片尺寸；首图优先加载，其余懒加载。Quant-Arena 的 teaser 配置提取为独立模块，供项目页、列表和 Node 生成脚本共用。
- 外框固定 8:5 比例，图片声明宽高并使用 `object-fit: contain`。加载前已有完整边框，失败时显示 “Preview unavailable”；项目链接继续可用，无 JavaScript 时也保留占位高度。
- 补齐列表资源链接在粗指针下的 44×44px 点击区域。

本地 Chrome 实际选择的 13 张缩略图：768 / 1024 / 1440px、DPR 2 下共 **271.1 kB**，相比原图减少约 **96.4%**；320 / 390px、DPR 2 下共 **717.4 kB**，减少约 **90.4%**。这些数值是滚动遍历完整列表后所选图片的文件字节数，不是首屏下载量或生产网络耗时。全部 39 个派生文件共约 1.08 MB；研究原图保持原样。

验证记录：

- `npm run build` 和 `npm run validate:ai4ai-site` 通过；构建仍生成 402 个 Astro 页面，内置设计、WorkflowArena 和 Visual Cipher Bench 检查通过。
- `scripts/validate-research-images.mjs` 在 320 / 390 / 768 / 1024 / 1440px 下分别阻塞图片请求、放行请求和返回 404，13 个预览外框与项目行的尺寸、位置在加载前后及失败时一致；禁用 JavaScript 的 390px 失败场景通过。
- 720 CSS px / DPR 2 的 200% 桌面重排等效场景通过，覆盖长中英标题、粗指针下 44px 资源链接，以及缩略图的 Tab / Shift+Tab 焦点与 Enter 跳转；未操作浏览器原生缩放菜单。
- Research 与 Quant-Arena 的通用浏览器检查共 10 次通过，无整页溢出或脚本异常。人工复核了 390 / 1440px 的加载成功和失败截图。
- 结果与截图：`.local/design-check/research-images/`；通用检查：`.local/design-check/research-fix-responsive/`；构建日志：`.local/design-check/research-fix-build.log`。

运行专项复测：

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  DESIGN_CHECK_URL=http://127.0.0.1:4322 \
  node scripts/validate-research-images.mjs
```

延迟场景通过拦截并释放图片请求复现；未据此宣称生产 CDN、慢网耗时或 Core Web Vitals 已达标。浏览器范围仍为 macOS Chrome。

## 表头排版与统一图片预览（2026-11-27）

针对后续截图反馈，修复 RoboUniverse 分类表头文字重叠，以及 Visual Cipher 图片预览贴在视口左上角；同时将独立子站的原图链接接入统一预览。

- RoboUniverse 的全分类表此前给每个分类约 77px，而共享 14px 字号下的长标题超过可用宽度。现在给表格保留足够的最小宽度，并限制标题按钮在本列内换行；使用已有的表内横向滚动。手机端不固定模型列，避免其遮住大部分可滚动区域。三个结果视图和两个站点入口使用同一份 CSS，数据与列顺序未修改。
- `.lab-lightbox` 显式设置固定定位、四边定位和自动外边距，覆盖样式重置对原生 dialog 居中的影响；四周至少保留 20px，限制弹窗高度。
- `public/design/site.js` 统一创建和控制图片预览。普通配图、直接指向原图的链接，以及带 `data-lab-preview="原图地址"` 的控件使用同一个居中原生 dialog。Visual Cipher 图集通过这个声明式入口加载原图；Astro Layout 不再维护第二份弹窗逻辑。
- WorkflowArena、RoboUniverse、EmbodiedEvo 等已接入共享设计脚本的独立文档同样生效。普通点击图片链接不会导航或新开标签页；真实项目导航、下载链接和已有媒体操作保留各自含义。禁用 JavaScript 时原图链接仍可使用。
- 预览包含加载提示、失败提示与重试，支持键盘打开、焦点约束、Escape、关闭按钮、点击遮罩关闭和焦点返回。快速关闭后重新打开时，旧的异步 close 事件不会清除新图片。

专项复测命令：

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  DESIGN_CHECK_URL=http://127.0.0.1:4322 \
  node scripts/validate-research-layout.mjs
```

结果与截图写入 `.local/design-check/research-layout/`，构建日志为 `.local/design-check/research-layout-build.log`。

实际验收：`npm run build` 通过，生成 402 个 Astro 页面，内置设计、WorkflowArena、Visual Cipher 校验通过。专项脚本通过 30 个表格场景（2 个入口 × 3 个结果视图 × 5 档宽度）和 10 个配图弹窗居中场景（2 个页面 × 5 档宽度），另验证谜题预览、打开时调整视口到 720×450、4 个独立文档入口的原图弹窗、503 失败后重试、遮罩关闭和无 JS 原图链接。表头文字未超出单元格，表头与数据列对齐，所有末列均能通过横向滚动访问；桌面和手机截图已人工复核。

既有 `scripts/validate-design-interactions.mjs` 的 **15/15 组通过**，结果位于 `.local/design-check/research-layout-interactions/`。包括焦点返回、菜单、筛选、轨迹、3D、减少动态效果、粗指针与 200% 桌面重排等效场景。检查环境为本地构建产物、macOS Chrome；未据此宣称跨浏览器、原生缩放或生产网络性能已覆盖。

## EmbodiedEvo 与 PhysLastExam 排版补充修复（2026-11-27）

- EmbodiedEvo 的 `Generalization` 和 `Long-Horizon` 表头原先分别超出单元格约 22px、11px。表格最小宽度调整为桌面 1400px、手机 1200px，指标列约 170px，保留标题、排序箭头和 Score / SR 的间距。类型列加宽，长标题有换行保护；当前六个指标标题在验收宽度下均保持一行。
- 固定模型列的宽度与横向滚动避让使用同一个 CSS 变量，滚动定位到排序按钮时避免被固定列覆盖。键盘聚焦时将按钮完整滚入视口，并为焦点轮廓保留空间，解决浏览器原生聚焦只露出部分末列按钮的问题。手机端模型列随表格滚动；横向滚动提示始终可见，粗指针下排序按钮至少 44px 高。
- PhysLastExam 的模型名和分数／一致性标记保持单行，由表格的固有宽度与局部横向滚动容纳，研究数值没有改变。
- 任务目录底部原有最后一行底边、目录底边和章节底边。改用任务行上边界，目录负责唯一的收尾分隔线；删除任务章节的重复底边与底部内边距，保持下一节的正常间距。筛选为空时仍保留目录边界。

专项脚本 `scripts/validate-results-layout.mjs` 检查标题实际行数和边界、数据对齐、触控与键盘排序控件可见性、全部指标与列的双向排序、任务筛选以及目录收尾。结果与截图目录：`.local/design-check/results-layout/`；构建日志：`.local/design-check/results-layout-build.log`。运行方式与其他浏览器脚本相同，传入 `PLAYWRIGHT_MODULE` 和 `DESIGN_CHECK_URL`。

实际验收：402 页生产构建及内置校验通过；`npm run validate:embodiedevo` 和 `npm run validate:phys-last-exam` 通过。专项检查覆盖两个 EmbodiedEvo 入口与 PhysLastExam 在 320/390/768/1024/1440px 的 15 个页面宽度场景，标题均单行且未超出单元格，数据列对齐、无页面级横向溢出。两个榜单入口的六列、两项指标双向排序、筛选与重置均通过；720/1440px 下 Tab/Shift+Tab 的按钮与焦点框可见，Enter 正常排序。任务目录在完整、筛选、空结果、展开任务和收起目录时均只有一个收尾分隔线。390/1440px 截图已人工复核。

两页另通过 720 CSS px、DPR 2 的无 JS 表头与重排检查，结果保存为 `no-js-reflow.json`；该场景是 200% 桌面重排等效验证，未测试浏览器原生缩放。环境为本地生产预览、macOS Chrome，未验证跨浏览器或生产部署；构建保留既有 Three.js 大 chunk 提示。

## 主导航页面容器对齐（2026-11-27）

状态：此节记录 PR #57 的历史实现与验收；用户随后确认 About 应保留居中文章布局，以下对齐改动已撤回，当前规则见下一节。

About 的外层已经是统一 1120px 容器，但内部仍有 `max-w-3xl mx-auto pt-20`：在 1440px 视口下，Home / Research 的标题坐标为 `(192, 133)`，About 为 `(336, 149)`。问题来自内层 768px 文章再次居中与旧顶部间距，不是外层容器宽度。

- About 文章改为占满外层内容区，使用共享 `lab-hero` 顶部间距；标题和正文分区左对齐，各自使用 `lab-prose` 的 720px 阅读宽度。
- Research 的 `Sectionhead` 原有固定 64px 顶部 margin，手机端比 Home 多 24px；改用共享 `--lab-section-gap` 顶部 padding，桌面 64px、手机 40px。
- Guideline 第 5 节明确区分外层容器和正文阅读宽度，并要求对比同级页面标题坐标、边距和文字宽度；仅检查没有横向溢出无法发现此问题。

实际验收：`npm run build` 通过，生成 402 页及内置设计／集合校验通过。`validate-design-browser.mjs / /research/ /about/` 的 15 个视口场景全部通过。另测量三个页面在 320/390/768/1024/1440px 和 720 CSS px / DPR 2 的 18 个页面宽度场景，标题 x/y 坐标、外层容器宽度与导航左边缘一致；About 文章填满内容区，五个正文分区左对齐且不超过 720px。1440px 下三个标题坐标均为 `(192, 133)`。390/1440px 全页截图已人工复核。

结果目录 `.local/design-check/about-alignment/`，坐标记录 `alignment.json`，构建日志 `.local/design-check/about-alignment-build.log`。检查范围为本地生产预览、macOS Chrome；720px / DPR 2 是 200% 桌面重排等效场景，未验证浏览器原生缩放、跨浏览器与生产部署。

## 恢复 About 居中文章布局（2026-11-27）

根据用户对文章页形式的确认，撤回 PR #57 的页面样式改动。About 恢复 `max-w-3xl mx-auto pt-20 pb-24`，文章整体最大 768px、水平居中、顶部 80px；移除分区新增的 `lab-prose`，恢复原有文字排版。Research 的 Sectionhead 同时恢复原有间距。两个组件源码与 PR #57 之前一致。

Guideline 第 5 节改为允许文章页在共享外层容器中使用居中阅读栏，并明确 About 是 768px 宽度与 80px 顶部间距的已确认例外；不再要求其标题与 Home / Research 左边缘一致。

实际验收：两个组件与 `fad06bb6` 的文件差异为空；402 页生产构建与内置校验通过。About / Research 在 320/390/768/1024/1440px 的 10 个通用浏览器场景通过。另对 About 五档宽度测量居中与文章尺寸，左右留白相等、顶部内边距 80px；1440px 下恢复为 768px 宽、标题坐标 `(336, 149)`。390/1440px 截图已复核。结果位于 `.local/design-check/restore-about/`，构建日志 `.local/design-check/restore-about-build.log`；环境为本地生产预览、macOS Chrome，未验证线上部署和跨浏览器表现。
