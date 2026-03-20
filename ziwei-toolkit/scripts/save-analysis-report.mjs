#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { renderChartText, serializeChart } from './lib/chart-output.mjs';
import { buildChart } from './lib/kinship.mjs';

const DEFAULT_ARCHIVE_ROOT = fileURLToPath(new URL('../records/people', import.meta.url));

const HELP_TEXT = `用法:
  node scripts/save-analysis-report.mjs --person "张三" --datetime "1996-03-19 01:40" --gender male --calendar solar
  node scripts/save-analysis-report.mjs --person "张三" --datetime "1996-03-19 01:40" --gender male --calendar solar --section "原盘命格分析" --content "命宫在寅..."
  node scripts/save-analysis-report.mjs --person-id "张三-1996-03-19-t1-male-solar" --section "六亲分析" --content-file ./notes/kinship.md

参数:
  --person                 人员姓名或标识；新建档案时必传
  --person-id              指定已有档案 ID；传入后可直接更新同一份报告
  --datetime               出生日期时间，格式如 "1996-03-19 01:40" 或 "1996-03-19T01:40"
  --date                   出生日期，格式 YYYY-MM-DD
  --time                   出生时刻，格式 HH:mm；与 --date 搭配使用
  --time-index             iztro 时辰索引，0=早子时，1=丑时，...，12=晚子时
  --gender                 male|female|男|女
  --calendar               solar|lunar|阳历|公历|农历|阴历
  --leap-month             农历闰月
  --no-fix-leap            禁用 iztro 的闰月修正逻辑
  --language               语言，默认 zh-CN
  --section                要更新的分析章节标题，如 "原盘命格分析"
  --content                章节正文
  --content-file           从文件读取章节正文
  --root                   报告根目录；默认保存到 skill 内 records/people
  --json                   输出结构化 JSON
  --help                   显示帮助
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    person: { type: 'string' },
    'person-id': { type: 'string' },
    datetime: { type: 'string' },
    date: { type: 'string' },
    time: { type: 'string' },
    'time-index': { type: 'string' },
    gender: { type: 'string' },
    calendar: { type: 'string' },
    'leap-month': { type: 'boolean' },
    'no-fix-leap': { type: 'boolean' },
    language: { type: 'string' },
    section: { type: 'string' },
    content: { type: 'string' },
    'content-file': { type: 'string' },
    root: { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  },
});

if (values.help) {
  console.log(HELP_TEXT);
  process.exit(0);
}

try {
  const archiveRoot = resolve(values.root ?? DEFAULT_ARCHIVE_ROOT);
  const sectionInput = await loadSectionInput(values);
  const birthInput = maybeNormalizeBirthInput(values, positionals);
  const explicitPersonId = normalizeExplicitId(values['person-id']);

  let personId = explicitPersonId;
  let existingProfile;

  if (!personId) {
    if (!values.person) {
      throw new Error('新建档案需要 --person。更新已有档案可改用 --person-id。');
    }
    if (!birthInput) {
      throw new Error('新建档案需要完整出生资料。请传 --datetime，或传 --date 搭配 --time / --time-index。');
    }
    personId = buildPersonId(values.person, birthInput);
  }

  const paths = buildArchivePaths(archiveRoot, personId);
  existingProfile = await readJsonIfExists(paths.profile);

  const person = values.person ?? existingProfile?.person;
  if (!person) {
    throw new Error('找到了档案 ID，但缺少人物名称。请补 --person，或先用完整出生资料创建档案。');
  }

  const workingBirthInput = birthInput ?? existingProfile?.birth;
  if (!workingBirthInput) {
    throw new Error('当前档案没有可用出生资料。请补充 --datetime 或 --date/--time-index。');
  }

  const chart = buildChart({
    calendar: workingBirthInput.calendar,
    date: workingBirthInput.date,
    timeIndex: workingBirthInput.timeIndex,
    gender: workingBirthInput.gender,
    isLeapMonth: workingBirthInput.isLeapMonth,
    fixLeap: workingBirthInput.fixLeap,
    language: workingBirthInput.language,
  });
  const chartText = renderChartText(workingBirthInput, chart, undefined);
  const chartJson = {
    input: {
      calendar: workingBirthInput.calendar,
      gender: workingBirthInput.gender,
      date: workingBirthInput.date,
      timeIndex: workingBirthInput.timeIndex,
      isLeapMonth: workingBirthInput.isLeapMonth,
      fixLeap: workingBirthInput.fixLeap,
      language: workingBirthInput.language,
    },
    chart: serializeChart(chart),
  };

  const now = new Date().toISOString();
  const profile = buildProfile(existingProfile, {
    person,
    personId,
    birth: workingBirthInput,
    paths,
    now,
  });
  const analysis = buildAnalysisState(await readJsonIfExists(paths.analysis), sectionInput, now);
  const report = renderReport(profile, chartJson.chart, analysis);

  await mkdir(paths.directory, { recursive: true });
  await writeFile(paths.profile, JSON.stringify(profile, null, 2), 'utf8');
  await writeFile(paths.analysis, JSON.stringify(analysis, null, 2), 'utf8');
  await writeFile(paths.chartJson, JSON.stringify(chartJson, null, 2), 'utf8');
  await writeFile(paths.chartText, chartText, 'utf8');
  await writeFile(paths.report, report, 'utf8');

  const result = {
    person,
    personId,
    archiveRoot,
    directory: paths.directory,
    files: paths,
    section: analysis.lastAction,
  };

  if (values.json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  console.log(renderSummary(result));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function loadSectionInput(rawValues) {
  const section = rawValues.section?.trim();
  const inlineContent = rawValues.content;
  const contentFile = rawValues['content-file'];

  if (inlineContent && contentFile) {
    throw new Error('--content 和 --content-file 不能同时使用。');
  }
  if ((inlineContent || contentFile) && !section) {
    throw new Error('传入分析正文时，必须同时提供 --section。');
  }
  if (section && !inlineContent && !contentFile) {
    throw new Error('传入 --section 时，必须同时提供 --content 或 --content-file。');
  }
  if (!section) {
    return undefined;
  }

  const rawContent = contentFile
    ? await readFile(resolve(contentFile), 'utf8')
    : inlineContent ?? '';
  const content = rawContent.trim();
  if (!content) {
    throw new Error('分析正文不能为空。');
  }

  return {
    key: normalizeSectionKey(section),
    title: section,
    content,
  };
}

function maybeNormalizeBirthInput(rawValues, positionalsList) {
  const firstPositional = positionalsList[0];
  const birthInput = parseDateOrDatetime(rawValues.datetime ?? firstPositional);
  const explicitDate = rawValues.date ?? birthInput?.date;
  if (!explicitDate) {
    return undefined;
  }

  const explicitTime = rawValues.time ?? birthInput?.time;
  const timeIndex =
    rawValues['time-index'] !== undefined
      ? parseTimeIndex(rawValues['time-index'], '--time-index')
      : inferTimeIndex(explicitTime);
  if (timeIndex === undefined) {
    throw new Error('缺少出生时辰。请传 --time-index，或在 --datetime / --time 中提供具体时间。');
  }

  return {
    date: explicitDate,
    time: explicitTime,
    timeIndex,
    calendar: normalizeCalendar(rawValues.calendar),
    gender: normalizeGender(rawValues.gender),
    isLeapMonth: Boolean(rawValues['leap-month']),
    fixLeap: !Boolean(rawValues['no-fix-leap']),
    language: rawValues.language ?? 'zh-CN',
  };
}

function buildPersonId(person, birthInput) {
  const slug = slugify(person);
  return `${slug}-${birthInput.date}-t${birthInput.timeIndex}-${birthInput.gender}-${birthInput.calendar}`;
}

function normalizeExplicitId(value) {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('--person-id 不能为空。');
  }
  return normalized.replace(/[\\/]+/g, '-');
}

function buildArchivePaths(rootDir, personId) {
  const directory = resolve(rootDir, personId);
  return {
    directory,
    profile: resolve(directory, 'profile.json'),
    analysis: resolve(directory, 'analysis.json'),
    chartJson: resolve(directory, 'chart.json'),
    chartText: resolve(directory, 'chart.txt'),
    report: resolve(directory, 'report.md'),
  };
}

function buildProfile(existingProfile, { person, personId, birth, paths, now }) {
  const createdAt = existingProfile?.createdAt ?? now;
  return {
    person,
    personId,
    createdAt,
    updatedAt: now,
    birth,
    files: {
      profile: paths.profile,
      analysis: paths.analysis,
      chartJson: paths.chartJson,
      chartText: paths.chartText,
      report: paths.report,
    },
  };
}

function buildAnalysisState(existingAnalysis, sectionInput, now) {
  const base = existingAnalysis ?? {
    createdAt: now,
    updatedAt: now,
    sections: [],
  };
  const sections = Array.isArray(base.sections) ? [...base.sections] : [];
  let lastAction = sectionInput
    ? { type: 'skipped', title: sectionInput.title }
    : { type: 'none', title: undefined };

  if (sectionInput) {
    const index = sections.findIndex((section) => section.key === sectionInput.key);
    if (index === -1) {
      sections.push({
        key: sectionInput.key,
        title: sectionInput.title,
        content: sectionInput.content,
        createdAt: now,
        updatedAt: now,
        history: [],
      });
      lastAction = { type: 'created', title: sectionInput.title };
    } else {
      const current = sections[index];
      if (current.content === sectionInput.content && current.title === sectionInput.title) {
        lastAction = { type: 'unchanged', title: sectionInput.title };
      } else {
        sections[index] = {
          ...current,
          title: sectionInput.title,
          content: sectionInput.content,
          updatedAt: now,
          history: [
            ...(Array.isArray(current.history) ? current.history : []),
            {
              archivedAt: now,
              previousUpdatedAt: current.updatedAt,
              content: current.content,
            },
          ],
        };
        lastAction = { type: 'updated', title: sectionInput.title };
      }
    }
  }

  return {
    createdAt: base.createdAt,
    updatedAt: now,
    sections,
    lastAction,
  };
}

function renderReport(profile, chart, analysis) {
  const lines = [];

  lines.push(`# ${profile.person}`);
  lines.push('');
  lines.push(`- 档案ID: \`${profile.personId}\``);
  lines.push(`- 创建时间: ${profile.createdAt}`);
  lines.push(`- 最近更新: ${profile.updatedAt}`);
  lines.push('');
  lines.push('## 基本资料');
  lines.push(`- 历法: ${formatCalendar(profile.birth.calendar)}`);
  lines.push(`- 性别: ${formatGender(profile.birth.gender)}`);
  lines.push(`- 出生日期: ${profile.birth.date}`);
  if (profile.birth.time) {
    lines.push(`- 原始时间: ${profile.birth.time}`);
  }
  lines.push(`- 时辰: ${chart.time} (${chart.timeRange}, index ${profile.birth.timeIndex})`);
  if (profile.birth.calendar === 'lunar') {
    lines.push(`- 闰月: ${profile.birth.isLeapMonth ? '是' : '否'}`);
  }
  lines.push('');
  lines.push('## 最新命盘摘要');
  lines.push(`- 阳历: ${chart.solarDate}`);
  lines.push(`- 农历: ${chart.lunarDate}`);
  lines.push(`- 干支: ${chart.chineseDate}`);
  lines.push(`- 星座: ${chart.sign}`);
  lines.push(`- 生肖: ${chart.zodiac}`);
  lines.push(`- 五行局: ${chart.fiveElementsClass}`);
  lines.push(`- 命主: ${chart.soul}`);
  lines.push(`- 身主: ${chart.body}`);
  lines.push(`- 命宫地支: ${chart.earthlyBranchOfSoulPalace}`);
  lines.push(`- 身宫地支: ${chart.earthlyBranchOfBodyPalace}`);
  lines.push('');
  lines.push('## 档案文件');
  lines.push('- `profile.json`: 人物与出生资料');
  lines.push('- `analysis.json`: 章节与更新历史');
  lines.push('- `chart.json`: 最新结构化命盘');
  lines.push('- `chart.txt`: 最新文本排盘');
  lines.push('- `report.md`: 当前汇总报告');
  lines.push('');
  lines.push('## 分析章节');

  if (!analysis.sections.length) {
    lines.push('- 暂无分析内容。后续可用 `--section` 搭配 `--content` 或 `--content-file` 更新。');
    return lines.join('\n');
  }

  for (const section of orderSections(analysis.sections)) {
    lines.push('');
    lines.push(`### ${section.title}`);
    lines.push('');
    lines.push(`_最近更新：${section.updatedAt}_`);
    lines.push('');
    lines.push(section.content);
  }

  return lines.join('\n');
}

function renderSummary(result) {
  const lines = [];
  lines.push('已更新个人分析档案');
  lines.push(`  人物: ${result.person}`);
  lines.push(`  档案ID: ${result.personId}`);
  lines.push(`  目录: ${result.directory}`);
  lines.push(`  报告: ${result.files.report}`);
  lines.push(`  命盘 JSON: ${result.files.chartJson}`);
  lines.push(`  命盘文本: ${result.files.chartText}`);

  if (result.section.type === 'none') {
    lines.push('  分析章节: 本次未传入新内容，仅刷新档案与命盘快照');
  } else {
    lines.push(
      `  分析章节: ${result.section.title} (${describeSectionAction(result.section.type)})`,
    );
  }

  return lines.join('\n');
}

function describeSectionAction(type) {
  switch (type) {
    case 'created':
      return '新增';
    case 'updated':
      return '已更新';
    case 'unchanged':
      return '内容未变';
    case 'skipped':
      return '未处理';
    default:
      return '未提供';
  }
}

function orderSections(sections) {
  const preferredOrder = [
    '定盘',
    '命格主轴',
    '原盘命格分析',
    '六亲',
    '六亲分析',
    '体用落地',
    '核心宫位与触发点',
    '校时结论',
    '大限总论',
  ];
  const orderMap = new Map(preferredOrder.map((title, index) => [title, index]));
  return [...sections].sort((left, right) => {
    const leftRank = getSectionRank(orderMap, left.title);
    const rightRank = getSectionRank(orderMap, right.title);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.createdAt.localeCompare(right.createdAt);
  });
}

function getSectionRank(orderMap, title) {
  for (const [key, rank] of orderMap.entries()) {
    if (title === key || title.includes(key)) {
      return rank;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

async function readJsonIfExists(path) {
  try {
    const content = await readFile(path, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

function normalizeSectionKey(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugify(value) {
  const normalized = value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'person';
}

function formatCalendar(value) {
  return value === 'solar' ? '阳历' : '农历';
}

function formatGender(value) {
  return value === 'male' ? '男' : '女';
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
