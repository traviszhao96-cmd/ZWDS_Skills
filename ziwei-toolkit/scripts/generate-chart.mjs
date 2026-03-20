#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { renderChartText, serializeChart, serializeHoroscope } from './lib/chart-output.mjs';
import {
  buildChart,
} from './lib/kinship.mjs';

const HELP_TEXT = `用法:
  node scripts/generate-chart.mjs --datetime "2003-10-12 01:30" --gender male --calendar solar
  node scripts/generate-chart.mjs --date 2003-10-12 --time-index 1 --gender 男 --calendar 阳历
  node scripts/generate-chart.mjs --date 2003-09-17 --time-index 1 --gender female --calendar lunar --json

参数:
  --datetime               出生日期时间，格式如 "2003-10-12 01:30" 或 "2003-10-12T01:30"
  --date                   出生日期，格式 YYYY-MM-DD
  --time                   出生时刻，格式 HH:mm；与 --date 搭配使用
  --time-index             iztro 时辰索引，0=早子时，1=丑时，...，12=晚子时
  --gender                 male|female|男|女
  --calendar               solar|lunar|阳历|公历|农历|阴历
  --leap-month             农历闰月
  --no-fix-leap            禁用 iztro 的闰月修正逻辑
  --horoscope-date         额外输出运限信息，可传 YYYY-MM-DD 或 YYYY-MM-DD HH:mm
  --horoscope-time-index   指定流时索引；未提供时会从 --horoscope-date 推断
  --language               语言，默认 zh-CN
  --output                 将排盘结果保存到指定文件；父目录不存在时会自动创建
  --json                   输出结构化 JSON
  --help                   显示帮助
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    datetime: { type: 'string' },
    date: { type: 'string' },
    time: { type: 'string' },
    'time-index': { type: 'string' },
    gender: { type: 'string' },
    calendar: { type: 'string' },
    'leap-month': { type: 'boolean' },
    'no-fix-leap': { type: 'boolean' },
    'horoscope-date': { type: 'string' },
    'horoscope-time-index': { type: 'string' },
    language: { type: 'string' },
    output: { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  },
});

if (values.help) {
  console.log(HELP_TEXT);
  process.exit(0);
}

try {
  const input = normalizeInput(values, positionals);
  const chart = buildChart(input);

  const horoscope = input.horoscope
    ? chart.horoscope(
        input.horoscope.date,
        input.horoscope.timeIndex === undefined ? undefined : input.horoscope.timeIndex,
      )
    : undefined;

  const output = values.json
    ? JSON.stringify(
        {
          input: {
            calendar: input.calendar,
            gender: input.gender,
            date: input.date,
            timeIndex: input.timeIndex,
            isLeapMonth: input.isLeapMonth,
            fixLeap: input.fixLeap,
            language: input.language,
            horoscope: input.horoscope,
          },
          chart: serializeChart(chart),
          horoscope: horoscope ? serializeHoroscope(horoscope) : undefined,
        },
        null,
        2,
      )
    : renderChartText(input, chart, horoscope);

  if (values.output) {
    const outputPath = resolve(values.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, 'utf8');
  }

  if (values.json) {
    console.log(output);
    process.exit(0);
  }

  console.log(output);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function normalizeInput(rawValues, positionalsList) {
  const firstPositional = positionalsList[0];
  const birthInput = parseDateOrDatetime(rawValues.datetime ?? firstPositional);
  const explicitDate = rawValues.date ?? birthInput?.date;
  if (!explicitDate) {
    throw new Error('缺少出生日期。请传 --datetime，或传 --date 搭配 --time / --time-index。');
  }

  const explicitTime = rawValues.time ?? birthInput?.time;
  const timeIndex =
    rawValues['time-index'] !== undefined
      ? parseTimeIndex(rawValues['time-index'], '--time-index')
      : inferTimeIndex(explicitTime);
  if (timeIndex === undefined) {
    throw new Error('缺少出生时辰。请传 --time-index，或在 --datetime / --time 中提供具体时间。');
  }

  const calendar = normalizeCalendar(rawValues.calendar);
  const gender = normalizeGender(rawValues.gender);

  const horoscopeInput = parseDateOrDatetime(rawValues['horoscope-date']);
  const horoscopeTimeIndex =
    rawValues['horoscope-time-index'] !== undefined
      ? parseTimeIndex(rawValues['horoscope-time-index'], '--horoscope-time-index')
      : inferTimeIndex(horoscopeInput?.time);

  return {
    date: explicitDate,
    timeIndex,
    calendar,
    gender,
    isLeapMonth: Boolean(rawValues['leap-month']),
    fixLeap: !Boolean(rawValues['no-fix-leap']),
    language: rawValues.language ?? 'zh-CN',
    horoscope: horoscopeInput
      ? {
          date: horoscopeInput.date,
          timeIndex: horoscopeTimeIndex,
        }
      : undefined,
  };
}

function parseDateOrDatetime(value) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().replace('T', ' ');
  const match = normalized.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2})(?::(\d{1,2}))?)?$/,
  );
  if (!match) {
    throw new Error(`无法识别日期格式: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  validateDate(year, month, day, value);

  let time;
  if (match[4] !== undefined) {
    const hour = Number(match[4]);
    const minute = Number(match[5] ?? '0');
    validateClock(hour, minute, value);
    time = `${pad2(hour)}:${pad2(minute)}`;
  }

  return {
    date: `${year}-${pad2(month)}-${pad2(day)}`,
    time,
  };
}

function inferTimeIndex(time) {
  if (!time) {
    return undefined;
  }
  const match = time.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) {
    throw new Error(`无法识别时间格式: ${time}`);
  }

  const hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  validateClock(hour, minute, time);

  if (hour === 0) return 0;
  if (hour === 23) return 12;
  return Math.floor((hour + 1) / 2);
}

function parseTimeIndex(value, flagName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 12) {
    throw new Error(`${flagName} 必须是 0 到 12 之间的整数。`);
  }
  return parsed;
}

function normalizeCalendar(value) {
  const normalized = (value ?? 'solar').trim().toLowerCase();
  const mapping = new Map([
    ['solar', 'solar'],
    ['gregorian', 'solar'],
    ['阳历', 'solar'],
    ['阳历生日', 'solar'],
    ['公历', 'solar'],
    ['lunar', 'lunar'],
    ['农历', 'lunar'],
    ['阴历', 'lunar'],
  ]);
  const calendar = mapping.get(normalized);
  if (!calendar) {
    throw new Error(`无法识别历法类型: ${value}`);
  }
  return calendar;
}

function normalizeGender(value) {
  if (!value) {
    throw new Error('缺少性别。请传 --gender male|female|男|女。');
  }

  const normalized = value.trim().toLowerCase();
  const mapping = new Map([
    ['male', 'male'],
    ['m', 'male'],
    ['男', 'male'],
    ['female', 'female'],
    ['f', 'female'],
    ['女', 'female'],
  ]);
  const gender = mapping.get(normalized);
  if (!gender) {
    throw new Error(`无法识别性别: ${value}`);
  }
  return gender;
}

function validateDate(year, month, day, source) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`无效日期: ${source}`);
  }
}

function validateClock(hour, minute, source) {
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(`无效时间: ${source}`);
  }
}

function pad2(value) {
  return String(value).padStart(2, '0');
}
