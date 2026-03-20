#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { astro } from 'iztro';

const MUTAGEN_LABELS = ['禄', '权', '科', '忌'];
const SCOPE_LABELS = {
  decadal: '大限',
  age: '小限',
  yearly: '流年',
  monthly: '流月',
  daily: '流日',
  hourly: '流时',
};

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
  const chart = astro.withOptions({
    type: input.calendar,
    dateStr: input.date,
    timeIndex: input.timeIndex,
    gender: input.gender,
    isLeapMonth: input.isLeapMonth,
    fixLeap: input.fixLeap,
    language: input.language,
  });

  const horoscope = input.horoscope
    ? chart.horoscope(
        input.horoscope.date,
        input.horoscope.timeIndex === undefined ? undefined : input.horoscope.timeIndex,
      )
    : undefined;

  if (values.json) {
    console.log(
      JSON.stringify(
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
      ),
    );
    process.exit(0);
  }

  console.log(renderText(input, chart, horoscope));
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

function renderText(input, chart, horoscope) {
  const parts = [];

  parts.push('输入');
  parts.push(`  历法: ${input.calendar === 'solar' ? '阳历' : '农历'}`);
  parts.push(`  性别: ${chart.gender}`);
  parts.push(`  出生日期: ${input.date}`);
  parts.push(`  时辰: ${chart.time} (${chart.timeRange}, index ${input.timeIndex})`);
  if (input.calendar === 'lunar') {
    parts.push(`  闰月: ${input.isLeapMonth ? '是' : '否'}`);
  }

  parts.push('');
  parts.push('命盘概览');
  parts.push(`  阳历: ${chart.solarDate}`);
  parts.push(`  农历: ${chart.lunarDate}`);
  parts.push(`  干支: ${chart.chineseDate}`);
  parts.push(`  星座: ${chart.sign}`);
  parts.push(`  生肖: ${chart.zodiac}`);
  parts.push(`  五行局: ${chart.fiveElementsClass}`);
  parts.push(`  命主: ${chart.soul}`);
  parts.push(`  身主: ${chart.body}`);
  parts.push(`  命宫地支: ${chart.earthlyBranchOfSoulPalace}`);
  parts.push(`  身宫地支: ${chart.earthlyBranchOfBodyPalace}`);

  parts.push('');
  parts.push('十二宫');
  chart.palaces.forEach((palace, index) => {
    parts.push(renderPalaceLine(palace, index + 1));
  });

  if (horoscope) {
    parts.push('');
    parts.push('运限');
    parts.push(`  参考阳历: ${horoscope.solarDate}`);
    parts.push(`  参考农历: ${horoscope.lunarDate}`);
    Object.entries(SCOPE_LABELS).forEach(([scopeKey, label]) => {
      const line = renderHoroscopeScope(horoscope, scopeKey, label);
      parts.push(...line);
    });
  }

  return parts.join('\n');
}

function renderPalaceLine(palace, order) {
  const tags = [];
  if (palace.isBodyPalace) tags.push('身宫');
  if (palace.isOriginalPalace) tags.push('来因宫');
  const tagText = tags.length ? ` [${tags.join(' / ')}]` : '';
  const range = palace.decadal?.range ? `${palace.decadal.range[0]}-${palace.decadal.range[1]}` : '未知';
  const palaceName = displayPalaceName(palace.name);

  return [
    `${order}. ${palaceName}（${palace.heavenlyStem}${palace.earthlyBranch}）${tagText} 大限 ${range}`,
    `   主星: ${formatStars(palace.majorStars)}`,
    `   辅星: ${formatStars(palace.minorStars)}`,
    `   杂耀: ${formatStars(palace.adjectiveStars)}`,
    `   12长生/博士/将前/岁前: ${palace.changsheng12} / ${palace.boshi12} / ${palace.jiangqian12} / ${palace.suiqian12}`,
    `   小限岁数: ${palace.ages.join(', ')}`,
  ].join('\n');
}

function renderHoroscopeScope(horoscope, scopeKey, label) {
  const scopeData = horoscope[scopeKey];
  if (!scopeData) {
    return [`  ${label}: 无数据`];
  }

  const activePalace = horoscope.palace('命宫', scopeKey);
  const mutagen = formatMutagen(scopeData.mutagen);
  const activePalaceName = activePalace ? displayPalaceName(activePalace.name) : '未知';
  return [
    `  ${label}: 命宫落在${activePalaceName}（${scopeData.heavenlyStem}${scopeData.earthlyBranch}）`,
    `    四化: ${mutagen}`,
  ];
}

function formatStars(stars = []) {
  if (!stars.length) {
    return '无';
  }
  return stars
    .map((star) => {
      const extras = [];
      if (star.brightness) extras.push(star.brightness);
      if (star.mutagen) extras.push(`化${star.mutagen}`);
      return extras.length ? `${star.name}(${extras.join(',')})` : star.name;
    })
    .join('、');
}

function formatMutagen(mutagen = []) {
  if (!mutagen.length) {
    return '无';
  }
  return mutagen
    .map((star, index) => `${MUTAGEN_LABELS[index] ?? `化${index + 1}`}:${star}`)
    .join('，');
}

function displayPalaceName(name) {
  return name.endsWith('宫') ? name : `${name}宫`;
}

function serializeChart(chart) {
  return {
    gender: chart.gender,
    solarDate: chart.solarDate,
    lunarDate: chart.lunarDate,
    chineseDate: chart.chineseDate,
    time: chart.time,
    timeRange: chart.timeRange,
    sign: chart.sign,
    zodiac: chart.zodiac,
    earthlyBranchOfSoulPalace: chart.earthlyBranchOfSoulPalace,
    earthlyBranchOfBodyPalace: chart.earthlyBranchOfBodyPalace,
    soul: chart.soul,
    body: chart.body,
    fiveElementsClass: chart.fiveElementsClass,
    palaces: chart.palaces.map((palace) => ({
      index: palace.index,
      name: palace.name,
      isBodyPalace: palace.isBodyPalace,
      isOriginalPalace: palace.isOriginalPalace,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      majorStars: serializeStars(palace.majorStars),
      minorStars: serializeStars(palace.minorStars),
      adjectiveStars: serializeStars(palace.adjectiveStars),
      changsheng12: palace.changsheng12,
      boshi12: palace.boshi12,
      jiangqian12: palace.jiangqian12,
      suiqian12: palace.suiqian12,
      decadal: palace.decadal,
      ages: palace.ages,
    })),
  };
}

function serializeStars(stars = []) {
  return stars.map((star) => ({
    name: star.name,
    type: star.type,
    scope: star.scope,
    brightness: star.brightness ?? '',
    mutagen: star.mutagen ?? '',
  }));
}

function serializeHoroscope(horoscope) {
  return {
    solarDate: horoscope.solarDate,
    lunarDate: horoscope.lunarDate,
    scopes: Object.fromEntries(
      Object.keys(SCOPE_LABELS).map((scopeKey) => [
        scopeKey,
        serializeHoroscopeScope(horoscope, scopeKey),
      ]),
    ),
  };
}

function serializeHoroscopeScope(horoscope, scopeKey) {
  const scopeData = horoscope[scopeKey];
  if (!scopeData) {
    return undefined;
  }

  const activePalace = horoscope.palace('命宫', scopeKey);
  return {
    label: SCOPE_LABELS[scopeKey],
    index: scopeData.index,
    heavenlyStem: scopeData.heavenlyStem,
    earthlyBranch: scopeData.earthlyBranch,
    mutagen: Object.fromEntries(
      scopeData.mutagen.map((starName, index) => [MUTAGEN_LABELS[index] ?? String(index), starName]),
    ),
        activePalace: activePalace
          ? {
              index: activePalace.index,
              name: activePalace.name,
          heavenlyStem: activePalace.heavenlyStem,
          earthlyBranch: activePalace.earthlyBranch,
        }
      : undefined,
  };
}
