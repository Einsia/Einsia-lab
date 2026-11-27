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
