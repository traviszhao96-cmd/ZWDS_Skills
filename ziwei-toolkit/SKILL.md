---
name: ziwei-toolkit
description: Use when the user wants 紫微斗数排盘、紫微命盘、原盘命格分析、来因宫与生年四化分析、体用法、双象、独象、自化、平方、六亲生肖定位、六亲关系分析、共盘辨识、生时矫正、校时、或大限总论, or wants one toolkit that can chart birth data first and then analyze the natal structure before extending into kinship or time calibration.
---

# Ziwei Toolkit

Use this skill as the unified entry point for Zi Wei Dou Shu work. Default to charting plus 原盘命格分析, then extend into 六亲关系分析 if the user provides kinship context. Only enter the 生时矫正 branch when the user explicitly asks to校时, mentions 共盘, or the zodiac-location chain repeatedly fails.

When the user wants to accumulate work across multiple people or revisit the same person repeatedly, persist the case as a personal archive instead of saving one-off chart files. The archive should keep the latest chart snapshot and update the same analysis report when new sections are added.

## Workflow Decision Tree

1. If the user gives only birth data, run `scripts/generate-chart.mjs` first.
2. If the user wants methodology, teaching material, or a reusable way to explain how to read an original chart, read [references/mingpan-analysis.md](references/mingpan-analysis.md) and explain the method directly.
3. If the user wants raw命盘 or运限 information, stop after chart generation unless they ask for more.
4. If the user wants 原盘命格分析:
   - Read [references/mingpan-analysis.md](references/mingpan-analysis.md).
   - Follow the fixed order `定盘 -> 命格主轴 -> 六亲 -> 体用落地 -> 核心宫位与触发点 -> 大限总论`.
   - If no 六亲信息 is supplied, omit the `六亲` section rather than filling it with guesses.
5. If the user wants 六亲关系分析:
   - Read [references/relationship-analysis.md](references/relationship-analysis.md).
   - If a relative's生肖 is supplied, also read [references/kinship-zodiac.md](references/kinship-zodiac.md) to locate the relative's 用神宫位 first.
   - If no生肖 is supplied, analyze from the relevant宫位 in the working chart and state that the reading is based on the current chart without zodiac validation.
6. If the user wants 校时 or 共盘辨识:
   - Read [references/kinship-zodiac.md](references/kinship-zodiac.md).
   - Compare candidate times and prefer the one that explains more core relatives with shorter, cleaner chains.
   - If no candidate range is supplied, work from the provided time first and say whether the chart passes or fails the zodiac checks.
7. If the user wants to save or update a person's long-term analysis report:
   - Use `scripts/save-analysis-report.mjs`.
   - Save the person once as a stable archive directory, then keep updating `report.md` and `analysis.json` instead of scattering new files.
   - Refresh the chart snapshot on every save so later analysis always reads the latest working chart.

## Commands

Generate a chart from solar birth data:

```bash
cd ~/.codex/skills/ziwei-toolkit
node scripts/generate-chart.mjs --datetime "1996-03-19 01:40" --gender male --calendar solar
```

Generate JSON for downstream analysis:

```bash
cd ~/.codex/skills/ziwei-toolkit
node scripts/generate-chart.mjs --datetime "1996-03-19 01:40" --gender male --calendar solar --json
```

Save a chart directly to a local file:

```bash
cd ~/.codex/skills/ziwei-toolkit
node scripts/generate-chart.mjs --datetime "1996-03-19 01:40" --gender male --calendar solar --json --output ./outputs/chart-1996-03-19-0140.json
```

Create or refresh one person's archive:

```bash
cd ~/.codex/skills/ziwei-toolkit
node scripts/save-analysis-report.mjs --person "张三" --datetime "1996-03-19 01:40" --gender male --calendar solar
```

Update the same person's report with a new analysis section:

```bash
cd ~/.codex/skills/ziwei-toolkit
node scripts/save-analysis-report.mjs --person "张三" --datetime "1996-03-19 01:40" --gender male --calendar solar --section "原盘命格分析" --content "先定盘，再看生年四化与来因宫。"
```

Update an existing archive by ID without retyping birth data:

```bash
cd ~/.codex/skills/ziwei-toolkit
node scripts/save-analysis-report.mjs --person-id "张三-1996-03-19-t1-male-solar" --section "六亲分析" --content-file ./notes/kinship.md
```

Calibrate nearby times with kinship zodiacs in one process:

```bash
cd ~/.codex/skills/ziwei-toolkit
node scripts/calibrate-nearby-times.mjs --datetime "1996-03-19 01:40" --gender male --calendar solar --relative "妻子:female:狗" --relative "父亲:male:蛇" --relative "母亲:female:猪"
```

Include a horoscope summary:

```bash
cd ~/.codex/skills/ziwei-toolkit
node scripts/generate-chart.mjs --datetime "1996-03-19 01:40" --gender male --calendar solar --horoscope-date "2026-03-20 07:30"
```

## Output Rules

- Keep the reasoning sequential and auditable.
- For original-chart readings, keep the order `定盘`, `命格主轴`, `六亲`, `体用落地`, `核心宫位与触发点`, and `大限总论`.
- Separate `排盘结果`, `生肖定位`, `关系分析`, and `校时结论`.
- Treat 生年四化 as the absolute starting point for生肖定位. Do not jump directly from the target生肖 palace or substitute自化 for the original体.
- If the user did not request校时, do not expand into a full candidate-hour sweep by default.
- If the chart does not pass the zodiac checks, say so clearly before offering relationship interpretations based on alternate candidate times.
- `--json` output from `generate-chart.mjs` includes derived palace data such as 对宫, 飞化落点, 自化状态, and 生年四化落宫 for downstream kinship analysis.
- `generate-chart.mjs --output <path>` can save either text output or JSON output directly to disk.
- `save-analysis-report.mjs` writes each person into a stable archive directory with `profile.json`, `analysis.json`, `chart.json`, `chart.txt`, and `report.md`.
- Re-saving the same `person + 出生资料` combination updates the existing archive instead of creating a new scattered report.
- Updating the same section title replaces the latest visible content in `report.md` while preserving prior text in `analysis.json`.
- Distinguish clearly between `体` and `用`, between `原盘格局` and `时间引动`, and between `六亲已验证` and `未验证`.

## Notes

- `react-iztro` is installed for future UI rendering work, but the CLI chart generator uses `iztro` directly because it exposes stable structured chart data.
- `react-iztro` expects a bundler that can resolve CSS imports. Do not import it from bare Node.js scripts.
- If dependencies are missing in a fresh environment, run `npm install` inside `~/.codex/skills/ziwei-toolkit`.
