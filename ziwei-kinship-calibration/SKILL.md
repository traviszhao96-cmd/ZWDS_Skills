---
name: ziwei-kinship-calibration
description: Use when the user wants 六亲生肖定位、六亲用神定位、共盘辨识、生时矫正、校时、紫微六亲互动分析, or wants to validate a Zi Wei Dou Shu chart by checking whether relatives' zodiac branches can be located through 生年四化、飞化、自化、平方 and palace/opposite-palace logic.
---

# Ziwei Kinship Calibration

Use this skill when the user wants to validate a 紫微斗数命盘 with 六亲生肖, resolve 共盘, or analyze the interaction pattern between the native and a specific relative after the relative's 用神宫位 is located.

## Workflow

1. Collect:
   - A finished 紫微命盘, or enough birth data to generate one with [$ziwei-chart](/Users/travis.zhao/.codex/skills/ziwei-chart/SKILL.md)
   - The target relative and the relative's gender
   - The relative's zodiac branch or生肖
   - Whether the task is 校时, 共盘辨识, or 关系分析
2. If the user gives only raw birth data, run `$ziwei-chart` first and work from the generated chart.
3. Read [references/method.md](references/method.md) for the polarity mapping, search order, and output rules.
4. Explain the chain explicitly:
   - which 生年四化星 was used
   - which宫位 / 对宫 / 飞化 / 平方 was followed
   - which地支 matched the relative's生肖
5. If the requested relative cannot be stably matched after exhausting the documented steps, say that the birth time is questionable rather than forcing an interpretation.

## Output Rules

- Keep the reasoning sequential and auditable.
- Distinguish 定位结论 from 关系分析.
- For 校时, compare candidate times one by one and state which candidate best satisfies the six-kin checks.
- For 关系分析, tie the conclusion back to 宫位空间意涵, 星曜特质, and the psychological direction of the relevant 四化.
- Do not invent missing飞化 chains. If the chart data is insufficient, say what is missing.

## Notes

- This skill is interpretive workflow guidance, not an automated calculator.
- Prefer using the user's own术语 when they specify a school or tradition.
- If multiple relatives are supplied, start from the most core ones for校时: typically parents, spouse, children, or the relative explicitly named by the user.
