# Frontier-Engineering Bench Evolution 数据格式说明

用于「演化视图」站点的 JSON 数据格式，支持按领域 → 任务 → 测试的层级展示各方法的得分随迭代步数的变化。

## 文件

- **数据文件**: `bench_evolution.json`
- **扩展**: 新增领域/任务/测试/方法时，在对应数组或对象中追加条目，并在 `evolution` 中补充对应 key 的曲线数据即可。

## 根级字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `meta` | object | 元信息（版本、描述等） |
| `methods` | array | 方法列表（如 GPT-4、Claude 等） |
| `domains` | array | 领域列表 |
| `tasks` | array | 任务列表 |
| `tests` | array | 测试列表（最细粒度） |
| `evolution` | object | 各层级的演化数据 |

## methods

```json
{
  "id": "gpt4",
  "name": "GPT-4",
  "color": "#10b981"
}
```

- `id`: 唯一标识，与 `evolution` 中的 key 对应。
- `name`: 展示名称。
- `color`: 可选，图表线条颜色（十六进制）。

## domains

```json
{
  "id": "astrodynamics",
  "name": "Astrodynamics",
  "name_zh": "航天动力学",
  "description_md": "可选，Markdown 描述",
  "task_ids": ["manned_lunar_landing"]
}
```

- `task_ids`: 该领域下的任务 id 列表。

## tasks

```json
{
  "id": "manned_lunar_landing",
  "domain_id": "astrodynamics",
  "name": "MannedLunarLanding",
  "name_zh": "登月软着陆轨迹优化",
  "readme_md": "可选，任务说明 Markdown",
  "test_ids": ["test_fuel", "test_landing_error"]
}
```

- `domain_id`: 所属领域 id。
- `test_ids`: 该任务下的测试 id 列表。

## tests

```json
{
  "id": "test_fuel",
  "task_id": "manned_lunar_landing",
  "name": "Fuel Consumption"
}
```

- `task_id`: 所属任务 id。

## evolution

各层级的演化均为「方法 id → 步数-得分序列」。

- **overall**: 全 benchmark 平均归一化得分随步数变化。
- **by_domain**: 按领域聚合的任务平均得分。key 为 `domain_id`。
- **by_task**: 按任务聚合的测试平均得分。key 为 `task_id`。
- **by_test**: 单个测试的得分。key 为 `test_id`。

得分建议为归一化分数，范围 `[0, 1]`。步数从 0 开始递增。

### overall

```json
{
  "evolution": {
    "overall": {
      "gpt4": [
        { "step": 0, "score": 0.12 },
        { "step": 1, "score": 0.35 },
        { "step": 2, "score": 0.58 }
      ],
      "claude": [
        { "step": 0, "score": 0.18 },
        { "step": 1, "score": 0.42 }
      ]
    }
  }
}
```

### by_domain

```json
"by_domain": {
  "astrodynamics": {
    "gpt4": [ { "step": 0, "score": 0.2 }, { "step": 1, "score": 0.5 } ],
    "claude": [ { "step": 0, "score": 0.25 }, { "step": 1, "score": 0.48 } ]
  }
}
```

### by_task

```json
"by_task": {
  "manned_lunar_landing": {
    "gpt4": [ { "step": 0, "score": 0.22 }, { "step": 1, "score": 0.52 } ],
    "claude": [ { "step": 0, "score": 0.28 }, { "step": 1, "score": 0.55 } ]
  }
}
```

### by_test

```json
"by_test": {
  "test_fuel": {
    "gpt4": [ { "step": 0, "score": 0.15 }, { "step": 1, "score": 0.45 } ],
    "claude": [ { "step": 0, "score": 0.20 }, { "step": 1, "score": 0.50 } ]
  }
}
```

## 动态扩展

- 新增方法：在 `methods` 中增加一项，并在 `evolution.overall`、各 `evolution.by_domain[id]`、`evolution.by_task[id]`、`evolution.by_test[id]` 中为该 `method_id` 增加 `{ step, score }[]`。
- 新增领域：在 `domains` 中增加一项，并增加 `evolution.by_domain[domain_id]`。
- 新增任务：在 `tasks` 中增加一项，在对应 `domain.task_ids` 中加入该任务 id，并增加 `evolution.by_task[task_id]`。
- 新增测试：在 `tests` 中增加一项，在对应 `task.test_ids` 中加入该测试 id，并增加 `evolution.by_test[test_id]`。
