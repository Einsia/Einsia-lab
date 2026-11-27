# Navers Lab 设计规范

当前生产规范为已评审的 Einsia UI v0.4：

- [正式 Agent 规范](AGENT-GUIDELINE.md)：全站页面、组件与交互的执行规则。
- [评审原件](approved-v0.4.html)：用户批准的原始文件，原样保留。
- [实施与验收记录](IMPLEMENTATION.md)：改造范围、实际验证结果与验证边界。

生产 token 源位于 `src/design/tokens.json`，共享资源位于 `public/design/`。
更新 token 后运行 `npm run design:tokens`；独立页面同步运行 `npm run design:sync`。
不要手工编辑生成的 token CSS 或字体文件。

## 历史 v0.1 评审材料

`lab-design-guideline.html`、`review-notes.md`、本目录的 `tokens.json`、
`components.css`、`specimens.html`、`preview.js`、`document.css` 和 `document.js`
属于早期提案，不接入生产页面，也不再指导新 UI。其 Georgia／Inter 方案已被 v0.4 取代。

仅在需要重现旧评审材料时运行：

```sh
python3 docs/design/build.py
```

`build.py` 只生成本目录的历史 `tokens.css` 和 `lab-design-guideline.html`，
不会更新 v0.4 生产资源。
