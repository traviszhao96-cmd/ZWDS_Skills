# ZWDS Skills

这个仓库存放我在 Codex 本地使用的技能目录，主要用于紫微斗数、八字排盘，以及相关分析工作流的固化和备份。

仓库路径：

`/Users/travis.zhao/.codex/skills`

## 仓库用途

- 备份本地 skill 的说明、脚本、参考资料和依赖声明。
- 把常用分析流程固化成可复用工具，避免每次重复搭建。
- 用 Git 跟踪 skill 的演化过程，方便回滚、迁移和多机同步。

## 当前技能目录

- `bazi-chart`
  - 八字 / 四柱排盘。
- `doc`
  - 处理 `.docx` 文档相关任务。
- `ziwei-chart`
  - 紫微斗数基础排盘。
- `ziwei-kinship-calibration`
  - 六亲生肖定位、校时、共盘辨识。
- `ziwei-toolkit`
  - 紫微斗数统一工具箱，包含排盘、原盘分析、六亲定位、校时和报告归档。

## 重点说明

目前最常用的是 `ziwei-toolkit`，它已经支持：

- 命盘生成
- 原盘命格分析方法固化
- 六亲生肖定位与邻近时辰校对
- 个人分析档案保存与更新

个人档案默认会写到：

`ziwei-toolkit/records/people/<person-id>/`

其中通常包含：

- `profile.json`
- `analysis.json`
- `chart.json`
- `chart.txt`
- `report.md`

## Git 备份策略

这个仓库默认只备份 skill 本身，不备份本地缓存和人物隐私数据。

当前 `.gitignore` 会忽略：

- `.system/`
- `__pycache__/`
- `node_modules/`
- `outputs/`
- `records/people/`

这意味着：

- skill 代码、说明和参考资料会进入 Git
- 真实人物分析档案默认不会上传

如果你以后想把某些分析案例也纳入版本管理，需要单独调整 `.gitignore`

## 常用操作

查看当前状态：

```bash
git -C /Users/travis.zhao/.codex/skills status
```

提交本地改动：

```bash
git -C /Users/travis.zhao/.codex/skills add .
git -C /Users/travis.zhao/.codex/skills commit -m "Update skills"
```

推送到远程：

```bash
git -C /Users/travis.zhao/.codex/skills push
```

拉取最新版本：

```bash
git -C /Users/travis.zhao/.codex/skills pull --rebase
```

## 维护建议

- 每次修改 skill 说明、脚本或参考资料后，尽量及时提交。
- 不要把 GitHub token、账号密码、真实隐私案例直接写进仓库。
- 如果 `ziwei-toolkit` 的分析方法继续扩展，优先沿着现有目录补脚本和参考文档，不要重复造平行 skill。

## 备注

这个仓库是本地 Codex skill 的工作仓库，不是业务代码仓库。它的目标不是发布软件，而是稳定保存和演化我的分析工具链。
