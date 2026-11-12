# Visual Cipher Bench：发布容量记录

2026-11-13，基于官网 `main` 的 `8a3b400e8cee569077c9f11436d5c91d9ed7caff`；分支 `site/visual-cipher-bench`。

## 本次处理

| 指标 | 字节 / 十进制 MB |
| --- | --- |
| 处理前完整构建 | 999,849,792 / 999.85 MB |
| 处理后完整构建 | 994,867,587 / 994.87 MB |
| 公司 CI 检查线 | 995,000,000 / 995 MB |
| 距公司检查线剩余 | 132,413 / 0.132 MB |
| 距 GitHub Pages 1 GB 限制剩余 | 5,132,413 / 5.13 MB |
| 本页路由文件（不含共享 bundle） | 116,883 / 0.117 MB |
| 分离的 68 张图片 | 3,397,644 / 3.398 MB |
| 不再发布的本地论文 PDF | 1,579,079 / 1.579 MB |

- 67 张题图及 framework 完整移入 `resources/visual-cipher-bench/media/`，由同仓库 GitHub Raw 加载；图像字节与调整前一致，未再次压缩、裁剪或删题。
- 厂商 SVG、CSV、分享图仍在 `public/visual-cipher-bench/`。可编辑 PPT 源文件仍在 `resources/visual-cipher-bench/`。
- 论文入口暂留空，保留 disabled Paper 按钮；Research 卡片使用 `pending: true`。用户提供的稿件仅留在本地工作区，不放入可发布仓库。
- 构建时核对图片 SHA-256、40 题图片映射和链接；统一执行 995 MB 容量预算，新增本分支 / PR 的 CI。未上调任何容量限制。
- 本地暂存构建中的两份 Finder `.DS_Store` 已移除；这些文件本来就不应提交。其他项目媒体未改变。

## 校验与发布注意

已通过完整 Astro 构建（402 页）、Physics 的 public/dist 全部资源校验、EmbodiedEvo 完整数据校验、WorkflowArena 校验、VCB 图片完整性检查，以及 29 配置 × 5 视图、40 题浏览相关交互和 390/768/1440px 布局检查。离线预览仍打包全部图片，不依赖 Raw 网络。

生产素材基址在 `src/data/visual-cipher-bench/media.json`：`https://raw.githubusercontent.com/Einsia/Einsia-lab/main/resources/visual-cipher-bench/media/`。仓库已核实为 public。素材和页面必须一并进入 main；合并前这些新增生产 URL 尚不存在。当前验证是本地文件与生产引用映射验证，不代表新增 Raw URL 已在线验证。当地 Raw 直连探测超时，网络可达性仍应在正式上线后复查。

Paper 正式地址确定后，填写 `src/lib/visual-cipher-bench-assets.ts` 的 `paperUrl`，并更新 Research 内容项的 Paper href / pending 状态。同步调整本页发布检查中的 pending 断言。

## 下一步容量治理建议

本次已满足当前检查，但约 132 KB 的余量只够当前改动；并行 PR 合并前应重新构建。Raw 分离是现有 WorkflowArena 方案的延续，没有扩大 Pages 容量。

| 现有目录 | 完整构建约占用 |
| --- | --- |
| `phys-last-exam/` | 710.7 MB（视频约 533.9 MB） |
| `embodied-rsi/` | 183.4 MB（视频约 140.2 MB） |
| 两者合计 | 894.1 MB，接近九成 |

建议由 Youjie 或站点维护者协调这两个项目的负责人，把视频及大型数据迁至公司对象存储/CDN；保留原资源，逐页核对加载后再移除 Pages 副本。此次未动这些项目的数据或发布方式，也未替用户联系任何人。

GitHub 官方规则：https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
