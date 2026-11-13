# Visual Cipher Bench：发布与图片托管

2026-11-13 更新，分支 `site/visual-cipher-bench`，已合入 `main` 的 `3ff19558`（Physics overlay 视频重新压缩后，整站约 716 MB，995 MB 检查线下余量约 280 MB）。

## 图片

- 67 张题图随 Pages 发布，不再依赖 GitHub Raw（Raw 在国内常无法访问，且合并前生产 URL 为 404）。
  - `public/visual-cipher-bench/media/`：原图，字节与 PR 初版一致（约 3.3 MB），供点击放大。
  - `public/visual-cipher-bench/thumbs/`：滚动画廊缩略图，最长边不超过 360×400，WebP q80，合计约 0.6 MB，单张不超过 20 KB。
  - `src/data/visual-cipher-bench/media.json` 记录两种尺寸的字节数、SHA-256 和宽高。
- 页面主图与 Research 卡片都用 [Einsia/Visual-Cipher-Bench](https://github.com/Einsia/Visual-Cipher-Bench) README 顶部主图（`docs/assets/framework.png`），转为 2000 px WebP（约 178 KB）：`public/visual-cipher-bench/overview.webp`。
- 厂商 SVG、CSV、分享图在 `public/visual-cipher-bench/`；可编辑 PPT 源文件在 `resources/visual-cipher-bench/`。

## 校验

`npm run build` 末尾运行 `scripts/validate-visual-cipher-bench.mjs`：核对 40 题与 67 张图的映射、原图与缩略图的 SHA-256、缩略图大小上限、dist 中的本地资源链接，并确保页面不再引用 Raw 上的本项目图片。论文入口保持 pending 的检查仍在。

## 论文链接

正式地址确定后，填写 `src/lib/visual-cipher-bench-assets.ts` 的 `paperUrl`，更新 Research 内容项的 Paper href / pending 状态，并同步调整校验中的 pending 断言。

GitHub Pages 容量规则：https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
