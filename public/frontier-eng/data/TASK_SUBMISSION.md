# 题目元数据提交格式

## 参与方式概览

- **提交 Baseline 成绩**：将您的方法/模型在某任务上的得分发送至 **yks23@mails.tsinghua.edu.cn**，注明方法名、任务名、得分等，我们会更新排行榜。
- **贡献题目**：除邮件提交元数据外，也可通过 **GitHub** Fork 本仓库，在 `data/problems/` 下新增题目 YAML 并更新 `data/tasks_index.yaml`，再提交 Pull Request。可参考 [Graph-of-Agent](https://github.com/yks23/Graph-of-Agent) 的 README 了解类似协作流程。

---

为便于提交与整合，新题目只需提供**一份 YAML 元数据**即可。维护方会将此数据合并进 `tasks_index.yaml` 并生成 `problems/{task_name}.yaml`。

## 提交方式（邮件）

将填写好的 YAML 以**附件**或**正文**形式发送至：

**yks23@mails.tsinghua.edu.cn**

邮件主题建议：`[Frontier-Engineering] 新题目提交: 任务名`

---

## 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `task_name` | ✓ | 英文标识，用于文件名与 URL，建议 PascalCase 或 snake_case |
| `domain` | ✓ | 所属领域（如 Astrodynamics, Robotics, Cryptographic） |
| `contributor` | ✓ | 贡献者，建议 `@id` 或 姓名/单位 |
| `title_zh` | 推荐 | 中文标题 |
| `title_en` | 推荐 | 英文标题（无 title_zh 时用于展示） |
| `status` | 推荐 | `Completed` 或 `In Development` |
| `reviewer` | 可选 | 审查者 |
| `normalization` | 可选 | 见下表 |
| `description_md` | 可选 | 任务说明（Markdown），展示在任务页与 Evolution |

### normalization（可选）

| 子字段 | 说明 |
|--------|------|
| `baseline_score` | 基准分数（最小化问题常用负值） |
| `best_score` | 理论或已知最优分数 |
| `improvement_factor` | 无 best_score 时用于估算，常用 1.5 |

---

## 示例

```yaml
task_name: MyNewTask
domain: Robotics
contributor: "@author"
title_zh: 我的新任务
title_en: My New Task
status: In Development
reviewer: "@author"
normalization:
  baseline_score: null
  best_score: null
  improvement_factor: 1.5
description_md: |
  ## 任务说明
  本任务要求……
```

---

## 模板文件

仓库内提供空模板：`data/task_metadata_template.yaml`，复制后按需填写即可提交。
