#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { buildChart, traceRelative } from './lib/kinship.mjs';

const HELP_TEXT = `用法:
  node scripts/calibrate-nearby-times.mjs --datetime "1996-03-19 01:40" --gender male --calendar solar --relative "妻子:female:狗" --relative "父亲:male:蛇" --relative "母亲:female:猪"
  node scripts/calibrate-nearby-times.mjs --date 1996-03-19 --time-index 1 --gender 男 --calendar 公历 --time-indexes 0,1,2 --relative "妻子:女:狗" --relative "父亲:男:蛇"

参数:
  --datetime        出生日期时间，格式如 "1996-03-19 01:40" 或 "1996-03-19T01:40"
  --date            出生日期，格式 YYYY-MM-DD
  --time            出生时刻，格式 HH:mm；与 --date 搭配使用
  --time-index      iztro 时辰索引，0=早子时，1=丑时，...，12=晚子时
  --time-indexes    候选时辰列表，如 0,1,2；不传时默认取基准时辰及相邻一档
  --neighbor-range  自动展开相邻时辰档数，默认 1
  --gender          male|female|男|女
  --calendar        solar|lunar|阳历|公历|农历|阴历
  --relative        六亲定义，格式 "称呼:性别:生肖"，可重复传入
  --language        语言，默认 zh-CN
  --json            输出结构化 JSON
  --help            显示帮助
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    datetime: { type: 'string' },
    date: { type: 'string' },
    time: { type: 'string' },
    'time-index': { type: 'string' },
    'time-indexes': { type: 'string' },
    'neighbor-range': { type: 'string' },
    gender: { type: 'string' },
    calendar: { type: 'string' },
    relative: { type: 'string', multiple: true },
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
  const relatives = parseRelatives(values.relative);
  const candidates = input.timeIndexes.map((timeIndex) => evaluateCandidate(input, relatives, timeIndex));
  const ranking = [...candidates].sort(compareCandidates).map((candidate, index) => ({
    rank: index + 1,
    timeIndex: candidate.timeIndex,
    time: candidate.time,
    timeRange: candidate.timeRange,
    matchedCount: candidate.summary.matchedCount,
    directHits: candidate.summary.directHits,
    score: candidate.summary.score,
  }));

  if (values.json) {
    console.log(
      JSON.stringify(
        {
          input: {
            ...input,
            timeIndexes: undefined,
            requestedTimeIndexes: input.timeIndexes,
          },
          relatives,
          candidates,
          ranking,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  console.log(renderText(input, relatives, candidates, ranking));
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
  const baseTimeIndex =
    rawValues['time-index'] !== undefined
      ? parseTimeIndex(rawValues['time-index'], '--time-index')
      : inferTimeIndex(explicitTime);
  if (baseTimeIndex === undefined) {
    throw new Error('缺少出生时辰。请传 --time-index，或在 --datetime / --time 中提供具体时间。');
  }

  const calendar = normalizeCalendar(rawValues.calendar);
  const gender = normalizeGender(rawValues.gender);
  const neighborRange =
    rawValues['neighbor-range'] === undefined
      ? 1
      : parseNonNegativeInt(rawValues['neighbor-range'], '--neighbor-range');

  return {
    date: explicitDate,
    time: explicitTime,
    baseTimeIndex,
    timeIndexes:
      rawValues['time-indexes'] !== undefined
        ? parseTimeIndexes(rawValues['time-indexes'])
        : expandNearbyTimeIndexes(baseTimeIndex, neighborRange),
    calendar,
    gender,
    isLeapMonth: false,
    fixLeap: true,
    language: rawValues.language ?? 'zh-CN',
  };
}

function parseRelatives(rawRelatives = []) {
  if (!rawRelatives.length) {
    throw new Error('至少需要一个 --relative，格式如 "妻子:female:狗"。');
  }

  return rawRelatives.map((relative) => {
    const parts = relative.split(/[:：,，]/).map((part) => part.trim()).filter(Boolean);
    if (parts.length !== 3) {
      throw new Error(`无法识别六亲参数: ${relative}`);
    }

    return {
      label: parts[0],
      sex: parts[1],
      zodiac: parts[2],
    };
  });
}

function evaluateCandidate(input, relatives, timeIndex) {
  const chart = buildChart({
    calendar: input.calendar,
    date: input.date,
    timeIndex,
    gender: input.gender,
    isLeapMonth: input.isLeapMonth,
    fixLeap: input.fixLeap,
    language: input.language,
  });

  const traces = relatives.map((relative) => traceRelative(chart, relative));
  return {
    timeIndex,
    time: chart.time,
    timeRange: chart.timeRange,
    traces,
    summary: summarizeTraces(traces),
  };
}

function summarizeTraces(traces) {
  const matchedCount = traces.filter((trace) => trace.matched).length;
  const directHits = traces.filter((trace) => trace.bestCandidate?.matchedGate === 1).length;
  const secondHits = traces.filter((trace) => trace.bestCandidate?.matchedGate === 2).length;
  const thirdHits = traces.filter((trace) => trace.bestCandidate?.matchedGate === 3).length;
  const score = traces.reduce((total, trace) => total + (trace.bestCandidate?.score ?? 0), 0);

  return {
    matchedCount,
    directHits,
    secondHits,
    thirdHits,
    score,
  };
}

function compareCandidates(left, right) {
  if (right.summary.matchedCount !== left.summary.matchedCount) {
    return right.summary.matchedCount - left.summary.matchedCount;
  }
  if (right.summary.directHits !== left.summary.directHits) {
    return right.summary.directHits - left.summary.directHits;
  }
  if (right.summary.secondHits !== left.summary.secondHits) {
    return right.summary.secondHits - left.summary.secondHits;
  }
  if (right.summary.thirdHits !== left.summary.thirdHits) {
    return right.summary.thirdHits - left.summary.thirdHits;
  }
  if (right.summary.score !== left.summary.score) {
    return right.summary.score - left.summary.score;
  }

  return left.timeIndex - right.timeIndex;
}

function renderText(input, relatives, candidates, ranking) {
  const lines = [];

  lines.push('输入');
  lines.push(`  历法: ${input.calendar === 'solar' ? '阳历' : '农历'}`);
  lines.push(`  性别: ${input.gender === 'male' ? '男' : '女'}`);
  lines.push(`  出生日期: ${input.date}`);
  if (input.time) {
    lines.push(`  原始时间: ${input.time}`);
  }
  lines.push(`  基准时辰 index: ${input.baseTimeIndex}`);
  lines.push(`  候选时辰: ${input.timeIndexes.join(', ')}`);
  lines.push(`  六亲样本: ${relatives.map((relative) => `${relative.label}${relative.sex}/${relative.zodiac}`).join('、')}`);

  lines.push('');
  lines.push('候选盘排名');
  ranking.forEach((item) => {
    lines.push(
      `  ${item.rank}. ${item.time} (${item.timeRange}, index ${item.timeIndex}) 命中 ${item.matchedCount}/${relatives.length}，直接 ${item.directHits}，总分 ${item.score}`,
    );
  });

  for (const candidate of candidates) {
    lines.push('');
    lines.push(
      `${candidate.time} (${candidate.timeRange}, index ${candidate.timeIndex}) 命中 ${candidate.summary.matchedCount}/${relatives.length}，直接 ${candidate.summary.directHits}`,
    );
    for (const trace of candidate.traces) {
      const best = trace.bestCandidate;
      if (!best) {
        lines.push(`  ${trace.label}${trace.zodiac}: 无可用生年四化体星`);
        continue;
      }

      const hitText = best.matched
        ? `命中关${best.matchedGate} ${formatPalace(best.gates.find((gate) => gate.hit)?.hitPalace)}`
        : '未命中';
      const squareText = best.squareDetected ? '，含平方' : '';
      lines.push(`  ${trace.label}${trace.zodiac}: ${best.star}化${best.mutagen}，${hitText}${squareText}`);
      best.gates.forEach((gate) => {
        lines.push(
          `    关${gate.gate} ${gate.rule}: ${formatPalace(gate.toPalace)} / 对宫 ${formatPalace(gate.oppositePalace)}${gate.hit ? ` => ${formatPalace(gate.hitPalace)}` : ''}`,
        );
      });
    }
  }

  return lines.join('\n');
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

function parseTimeIndexes(value) {
  const indexes = value
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => parseTimeIndex(item, '--time-indexes'));

  if (!indexes.length) {
    throw new Error('--time-indexes 不能为空。');
  }

  return [...new Set(indexes)].sort((left, right) => left - right);
}

function expandNearbyTimeIndexes(baseTimeIndex, neighborRange) {
  const indexes = [];
  for (let timeIndex = baseTimeIndex - neighborRange; timeIndex <= baseTimeIndex + neighborRange; timeIndex += 1) {
    if (timeIndex < 0 || timeIndex > 12) {
      continue;
    }
    indexes.push(timeIndex);
  }
  return indexes;
}

function parseTimeIndex(value, flagName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 12) {
    throw new Error(`${flagName} 必须是 0 到 12 之间的整数。`);
  }
  return parsed;
}

function parseNonNegativeInt(value, flagName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flagName} 必须是非负整数。`);
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
  const normalized = String(value ?? '').trim().toLowerCase();
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

function formatPalace(palace) {
  if (!palace) {
    return '无';
  }

  return `${palace.name}(${palace.heavenlyStem}${palace.earthlyBranch})`;
}
