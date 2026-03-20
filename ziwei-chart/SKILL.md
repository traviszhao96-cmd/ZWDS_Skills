---
name: ziwei-chart
description: Use when the user wants 紫微斗数、紫微排盘、紫微命盘、宫位、主星、辅星、四化、流年、流月、流日、流时 or other Zi Wei Dou Shu chart information from birth data. Parse the birth input first, clarify solar vs lunar when ambiguous, ask about leap month only for lunar leap months, then run scripts/generate-chart.mjs to produce the chart.
---

# Ziwei Chart

Use this skill when the user wants a birthday-based 紫微斗数排盘。

## Workflow

1. Collect:
   - Birth date or datetime
   - Birth time or the corresponding `time-index`
   - `solar` or `lunar` calendar if the user states it
   - Gender
   - Whether the lunar month is a leap month when relevant
2. If the user gives a clock time, let the script convert it to `iztro`'s time index instead of doing it manually.
3. Run the bundled script instead of manually deriving palaces, stars, or 四化.
4. Return concise chart information unless the user explicitly asks for interpretation.

## Commands

Solar birthday with clock time:

```bash
cd ~/.codex/skills/ziwei-chart
node scripts/generate-chart.mjs --datetime "2003-10-12 01:30" --gender male --calendar solar
```

Lunar birthday with explicit time index:

```bash
cd ~/.codex/skills/ziwei-chart
node scripts/generate-chart.mjs --date 2003-09-17 --time-index 1 --gender female --calendar lunar
```

Include 运限摘要 for a target date:

```bash
cd ~/.codex/skills/ziwei-chart
node scripts/generate-chart.mjs --datetime "2003-10-12 01:30" --gender male --calendar solar --horoscope-date "2026-03-20 07:30"
```

Get structured JSON:

```bash
cd ~/.codex/skills/ziwei-chart
node scripts/generate-chart.mjs --datetime "2003-10-12 01:30" --gender male --calendar solar --json
```

## Notes

- `react-iztro` is installed in this skill directory for future UI/chart rendering work, but the CLI script uses `iztro` directly because it exposes stable structured chart data.
- `react-iztro` is a React UI package and expects a bundler that can handle CSS imports. Do not import it from bare Node.js scripts.
- If the user gives only a date and no birth time, ask once before running because 紫微排盘 needs a 时辰.
- `time-index` uses `0=早子时`, `1=丑时`, ..., `12=晚子时`.
- If dependencies are missing in a fresh environment, run `npm install` inside `~/.codex/skills/ziwei-chart`.
