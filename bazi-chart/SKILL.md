---
name: bazi-chart
description: Use when the user wants to calculate BaZi, Four Pillars, 八字, 四柱, 干支, 五行, 十神, or 起运 information from a birth date or birth datetime. Parse the birthday first, clarify whether it is solar or lunar if ambiguous, then run scripts/paipan.py to produce the chart.
---

# BaZi Chart

Use this skill when the user wants a birthday-based 八字排盘.

## Workflow

1. Collect:
   - Birth date or datetime
   - `solar` or `lunar` calendar if the user states it
   - Gender if the user wants 起运/大运
   - Whether the lunar month is leap month when relevant
2. Run the bundled script instead of manually deriving stems and branches.
3. Return the chart in concise Chinese unless the user asks for more interpretation.

## Commands

Solar birthday:

```bash
python3 ~/.codex/skills/bazi-chart/scripts/paipan.py "1990-01-01 12:30"
```

Lunar birthday:

```bash
python3 ~/.codex/skills/bazi-chart/scripts/paipan.py "1990-01-01 12:30" --calendar lunar
```

Include gender for 起运:

```bash
python3 ~/.codex/skills/bazi-chart/scripts/paipan.py "1990-01-01 12:30" --gender male
```

## Notes

- If the user gives only a date, the script will keep 年柱、月柱、日柱 and mark 时柱 as unknown.
- If the user does not say solar or lunar and the wording is ambiguous, ask once before running.
- If the user only wants the raw chart, do not add fortune-telling commentary beyond the computed output.
