# Leaderboard 排行榜系统

一个静态排行榜网站，展示 Frontier-Engineering 基准测试的总榜和各任务的独立排行榜。

## 功能特性

- 📊 **总榜页面**：展示所有参赛者在所有任务上的综合得分
- 📝 **任务页面**：每个任务有独立的介绍和排行榜
- 🎨 **美观界面**：现代化的 UI 设计，响应式布局
- 🔄 **自动排序**：支持按各列排序查看数据
- 🚀 **静态部署**：可直接部署到 GitHub Pages

## 项目结构

```
leaderboard/
├── index.html              # 主页
├── leaderboard.html        # 总榜页面
├── problem.html            # 任务模板页面
├── css/                    # 样式文件
├── js/                     # JavaScript 脚本
├── data/                   # 数据文件（YAML 格式）
│   ├── overall.yaml        # 总榜数据
│   ├── tasks_index.yaml    # 任务索引
│   └── problems/           # 各任务数据
│       ├── MannedLunarLanding.yaml
│       ├── ISCSO2023.yaml
│       └── ... (共 25 个任务)
└── scripts/                # 数据处理脚本
    └── generate_leaderboard_yaml.py
```

## 数据格式

数据使用 YAML 格式存储，支持：

- **原始分值和归一化分值**：每个参赛者都有原始分数和归一化分数（0-1 范围）
- **最高/最低分值统计**：自动维护每个任务的分值范围
- **过程分数演进**：记录最佳分数的变化里程碑

详细的数据结构说明请参考 [data/README.md](data/README.md)。

## 本地运行

```bash
# 使用 Python
python -m http.server 8000

# 然后在浏览器访问 http://localhost:8000
```

## 部署

可以直接部署到 GitHub Pages 或其他静态网站托管服务。

## 更新数据

使用 `scripts/generate_leaderboard_yaml.py` 脚本生成和更新 YAML 数据文件。

## 技术栈

- 纯 HTML/CSS/JavaScript（无框架依赖）
- YAML 数据格式
- GitHub Pages 静态托管

