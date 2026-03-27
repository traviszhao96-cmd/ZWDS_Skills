/**
 * 钦天诊断扫描引擎 — generate-scan-report.mjs
 *
 * 职责：纯代码仪器。读入 chart.json，输出结构化 Markdown 诊断报告（scan-report.md）。
 * AI 不参与本脚本的任何判断，仅在读取输出报告后做临床解读。
 *
 * 用法：
 *   node generate-scan-report.mjs --person-id <ID> [--zodiac 丈夫:鼠,父亲:马,母亲:鸡]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildChart } from './lib/kinship.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STEM_MUTAGENS = {
  甲: { 禄: '廉贞', 权: '破军', 科: '武曲', 忌: '太阳' },
  乙: { 禄: '天机', 权: '天梁', 科: '紫微', 忌: '太阴' },
  丙: { 禄: '天同', 权: '天机', 科: '文昌', 忌: '廉贞' },
  丁: { 禄: '太阴', 权: '天同', 科: '天机', 忌: '巨门' },
  戊: { 禄: '贪狼', 权: '太阴', 科: '右弼', 忌: '天机' },
  己: { 禄: '武曲', 权: '贪狼', 科: '天梁', 忌: '文曲' },
  庚: { 禄: '太阳', 权: '武曲', 科: '太阴', 忌: '天同' },
  辛: { 禄: '巨门', 权: '太阳', 科: '文曲', 忌: '文昌' },
  壬: { 禄: '天梁', 权: '紫微', 科: '左辅', 忌: '武曲' },
  癸: { 禄: '破军', 权: '巨门', 科: '太阴', 忌: '贪狼' },
};

const PALACE_ORDER = [
  '命宫',
  '兄弟',
  '夫妻',
  '子女',
  '财帛',
  '疾厄',
  '迁移',
  '交友',
  '官禄',
  '田宅',
  '福德',
  '父母',
];

const PEOPLE_PALACES = new Set(['命宫', '兄弟', '夫妻', '子女', '交友', '父母']);
const INNER_PALACES = new Set(['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄']);

const MALE_STARS = new Set(['太阳', '天梁', '天机', '天同', '文昌', '贪狼', '七杀']);
const FEMALE_STARS = new Set(['太阴', '巨门', '天相', '紫微', '文曲', '破军', '武曲', '天府']);

const HETU_PAIRS = [
  { pair: '1-6', palaces: ['命宫', '疾厄'], desc: '主体意志与身体机能' },
  { pair: '2-7', palaces: ['兄弟', '迁移'], desc: '人际关系与外部环境' },
  { pair: '3-8', palaces: ['夫妻', '交友'], desc: '亲密情感与社会大众' },
  { pair: '4-9', palaces: ['子女', '官禄'], desc: '产出传承与事业根基' },
  { pair: '5-10', palaces: ['财帛', '田宅'], desc: '现金流与资产储备' },
];

const BRANCH_ZODIAC = {
  子: '鼠',
  丑: '牛',
  寅: '虎',
  卯: '兔',
  辰: '龙',
  巳: '蛇',
  午: '马',
  未: '羊',
  申: '猴',
  酉: '鸡',
  戌: '狗',
  亥: '猪',
};

const BRANCH_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const PALACE_TOPICS = {
  命宫: '整体运势、自我状态与方向感',
  兄弟: '同辈、合作与平辈关系',
  夫妻: '婚姻、伴侣与合作关系',
  子女: '子女、计划、桃花与投资议题',
  财帛: '财务、资源与现金流',
  疾厄: '身体、健康与修复压力',
  迁移: '外部环境、出行与边界',
  交友: '朋友、团队与人情往来',
  官禄: '事业、职责与社会角色',
  田宅: '家宅、房产与安顿条件',
  福德: '情绪、精神与内在秩序',
  父母: '长辈、上级、文书与学习事务',
};

const DOUBLE_SYMBOL_NOTES = {
  禄权: '资源与掌控并进，主有得且有推动力',
  禄科: '资源与体面同到位，主有助力也有修饰',
  禄忌: '得失并见、起伏较大',
  权科: '推动与体面同在，主一明一暗、表里并行',
  权忌: '掌控伴随压力，主硬推、压迫与争执感增强',
  科忌: '体面与破耗并见，主名声、文书或秩序面边护边损',
};

const ZODIAC_BRANCH = Object.fromEntries(
  Object.entries(BRANCH_ZODIAC).map(([branch, zodiac]) => [zodiac, branch]),
);

const CORE_TAIJI_TOPICS = [
  {
    base: '父母',
    label: '母亲',
    logic: '父母的夫妻 = 兄弟',
    offset: 2,
    directNotes: ['母亲位受动', '先看母亲本人状态', '再看亲子与长辈互动压力'],
    returnNotes: ['父母体系的夫妻关系波动', '父母关系不合或分心', '母亲位回冲父母本体'],
  },
  {
    base: '子女',
    label: '儿媳/女婿',
    logic: '子女的夫妻 = 疾厄',
    offset: 2,
    directNotes: ['子女婚配位受动', '对象因素影响子女体系', '子女感情议题需关注'],
    returnNotes: ['子女婚配因素回冲子女本体', '子女感情与婚配压力上升'],
  },
  {
    base: '夫妻',
    label: '配偶的身体',
    logic: '夫妻的疾厄 = 交友',
    offset: 5,
    directNotes: ['配偶身体位受动', '先看健康与恢复', '再看夫妻互动受损'],
    returnNotes: ['配偶身体或健康压力回冲婚姻本体', '先看身体状态，再看夫妻关系承压'],
  },
  {
    base: '夫妻',
    label: '配偶的父母（公婆/岳父母）',
    logic: '夫妻的父母 = 兄弟',
    offset: 11,
    directNotes: ['配偶父母位受动', '长辈因素介入配偶体系', '家族议题影响婚姻'],
    returnNotes: ['配偶父母因素回冲婚姻本体', '长辈与家族议题影响夫妻关系'],
  },
];

const TIMING_WINDOW = {
  pastYears: 10,
  futureYears: 30,
  maxAge: 90,
};

function normName(name) {
  let normalized = String(name || '').replace(/宫$/, '');
  if (normalized === '命') normalized = '命宫';
  if (normalized === '仆役') normalized = '交友';
  return normalized;
}

function getIdx(name) {
  return PALACE_ORDER.indexOf(normName(name));
}

function oppositeIdx(idx) {
  return (idx + 6) % 12;
}

function oppositeName(name) {
  const idx = getIdx(name);
  return idx >= 0 ? PALACE_ORDER[oppositeIdx(idx)] : '';
}

function resolveRuntimePalaceName(name) {
  const normalized = normName(name);
  return normalized === '交友' ? '仆役' : normalized;
}

function classifyHitRelation(targetIdx, destIdx, clashIdx) {
  if (targetIdx === destIdx) return 'direct';
  if (targetIdx === clashIdx) return 'clash';
  return null;
}

function starGender(starName, mutagen) {
  if (starName === '廉贞') {
    if (mutagen === '禄' || mutagen === '权') return '男星';
    if (mutagen === '忌') return '女星';
    return '中性';
  }
  if (MALE_STARS.has(starName)) return '男星';
  if (FEMALE_STARS.has(starName)) return '女星';
  return '中性';
}

function buildStarMap(palaces) {
  const starMap = {};
  for (const palace of palaces) {
    const palaceName = normName(palace.name);
    for (const star of getAllStars(palace)) {
      starMap[star.name] = palaceName;
    }
  }
  return starMap;
}

function getPalaceByName(palaces, name) {
  const targetName = normName(name);
  return palaces.find((palace) => normName(palace.name) === targetName);
}

function getAllStars(palace) {
  return [...(palace.majorStars || []), ...(palace.minorStars || []), ...(palace.adjectiveStars || [])];
}

function getMutagenStars(palace) {
  return getAllStars(palace).filter((star) => Boolean(star.mutagen));
}

function stemFly(stem, type) {
  return STEM_MUTAGENS[stem]?.[type] ?? null;
}

function flyTo(stem, type, starMap) {
  const star = stemFly(stem, type);
  const palace = star ? starMap[star] : null;
  if (!star || !palace) return null;
  return { star, palace };
}

function collectJiEffects(palaces, starMap) {
  const effects = [];
  for (const palace of palaces) {
    const source = normName(palace.name);
    const dest = flyTo(palace.heavenlyStem, '忌', starMap);
    if (!dest) continue;
    const destIdx = getIdx(dest.palace);
    const clashIdx = oppositeIdx(destIdx);
    effects.push({
      source,
      sourceStem: palace.heavenlyStem,
      jiStar: dest.star,
      destPalace: dest.palace,
      destIdx,
      clashIdx,
      clashPalace: PALACE_ORDER[clashIdx],
      path: `${dest.star}忌→${dest.palace}`,
    });
  }
  return effects;
}

function collectTradeEffects(palaces, starMap) {
  const effects = [];
  for (const palace of palaces) {
    const source = normName(palace.name);
    for (const tradeType of ['禄', '权', '科', '忌']) {
      const dest = flyTo(palace.heavenlyStem, tradeType, starMap);
      if (!dest) continue;
      effects.push({
        source,
        sourceStem: palace.heavenlyStem,
        tradeType,
        tradeStar: dest.star,
        destPalace: dest.palace,
        destIdx: getIdx(dest.palace),
        clashPalace: oppositeName(dest.palace),
        path: `${dest.star}${tradeType}→${dest.palace}`,
      });
    }
  }
  return effects;
}

function parseZodiacInput(raw) {
  const result = {};
  if (!raw) return result;
  for (const pair of raw.split(/[，,]/)) {
    const [role, zodiac] = pair.split(/[:：]/);
    if (!role || !zodiac) continue;
    result[role.trim()] = zodiac.trim();
  }
  return result;
}

function extractYearStem(data) {
  if (data.chineseDate?.trim()) {
    return data.chineseDate.trim()[0];
  }
  const year = String(data.solarDate || '').slice(0, 4);
  const stemOrder = ['庚', '辛', '壬', '癸', '甲', '乙', '丙', '丁', '戊', '己'];
  if (/^\d{4}$/.test(year)) {
    return stemOrder[Number(year) % 10];
  }
  return null;
}

function extractBirthYear(data) {
  const match = String(data.solarDate || '').match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function getCurrentGregorianYear() {
  return new Date().getFullYear();
}

function getYearBranch(year) {
  const idx = ((year - 1984) % 12 + 12) % 12;
  return BRANCH_ORDER[idx];
}

function ageRangeToGregorian(range, birthYear) {
  if (!birthYear || !range || range.length !== 2) return null;
  const [startAge, endAge] = range;
  return {
    startAge,
    endAge,
    startYear: birthYear + startAge - 1,
    endYear: birthYear + endAge - 1,
  };
}

function collectBranchYearsInRange(rangeInfo, branch) {
  if (!rangeInfo || !branch) return [];
  const years = [];
  for (let year = rangeInfo.startYear; year <= rangeInfo.endYear; year += 1) {
    if (getYearBranch(year) === branch) years.push(year);
  }
  return years;
}

function formatYearList(years) {
  return years.length > 0 ? years.join('、') : '无';
}

function formatPalaceYearHits(palace, years) {
  if (!palace) return `未知 ${formatYearList(years)}`;
  const palaceName = normName(palace.name);
  const branch = palace.earthlyBranch || '?';
  const zodiac = BRANCH_ZODIAC[branch] || '?';
  return `${palaceName}（${branch} / ${zodiac}年）${formatYearList(years)}`;
}

function isRangeWithinTimingWindow(rangeInfo, currentYear) {
  if (!rangeInfo) return false;
  if (rangeInfo.startAge > TIMING_WINDOW.maxAge) return false;
  const windowStart = currentYear - TIMING_WINDOW.pastYears;
  const windowEnd = currentYear + TIMING_WINDOW.futureYears;
  return rangeInfo.endYear >= windowStart && rangeInfo.startYear <= windowEnd;
}

function filterYearsByTimingWindow(years, currentYear) {
  const windowStart = currentYear - TIMING_WINDOW.pastYears;
  const windowEnd = currentYear + TIMING_WINDOW.futureYears;
  return years.filter((year) => year >= windowStart && year <= windowEnd);
}

function buildTimingSummary(palaces, riskPalace, birthYear, currentYear) {
  const palace = getPalaceByName(palaces, riskPalace);
  if (!palace) return null;
  const oppositePalace = getPalaceByName(palaces, oppositeName(riskPalace));
  const rawOwnDecade = ageRangeToGregorian(palace.decadal?.range, birthYear);
  const rawOppositeDecade = ageRangeToGregorian(oppositePalace?.decadal?.range, birthYear);
  const ownDecade = isRangeWithinTimingWindow(rawOwnDecade, currentYear) ? rawOwnDecade : null;
  const oppositeDecade = isRangeWithinTimingWindow(rawOppositeDecade, currentYear) ? rawOppositeDecade : null;

  return {
    palace,
    oppositePalace,
    ownDecade,
    oppositeDecade,
    ownDecadeOwnBranchYears: filterYearsByTimingWindow(
      collectBranchYearsInRange(ownDecade, palace.earthlyBranch),
      currentYear,
    ),
    ownDecadeOppositeBranchYears: filterYearsByTimingWindow(
      collectBranchYearsInRange(ownDecade, oppositePalace?.earthlyBranch),
      currentYear,
    ),
    oppositeDecadeOwnBranchYears: filterYearsByTimingWindow(
      collectBranchYearsInRange(oppositeDecade, palace.earthlyBranch),
      currentYear,
    ),
    oppositeDecadeOppositeBranchYears: filterYearsByTimingWindow(
      collectBranchYearsInRange(oppositeDecade, oppositePalace?.earthlyBranch),
      currentYear,
    ),
  };
}

function normalizeDoubleSymbol(typeA, typeB) {
  if (!typeA || !typeB || typeA === typeB) return null;
  const rank = { 禄: 0, 权: 1, 科: 2, 忌: 3 };
  return [typeA, typeB].sort((a, b) => rank[a] - rank[b]).join('');
}

function isSameFamilyMutagen(typeA, typeB) {
  const family = {
    禄: '禄忌',
    忌: '禄忌',
    权: '权科',
    科: '权科',
  };
  return Boolean(typeA && typeB && family[typeA] && family[typeA] === family[typeB]);
}

function describeDoubleSymbol(combo, sourceKind, tradeType, collisionType) {
  if (!combo) return '无';
  const base = DOUBLE_SYMBOL_NOTES[combo] || '双象并见，需要结合人、事、物三面解读';
  if (combo === '禄忌' && sourceKind === '伏象' && tradeType === '忌' && collisionType === '禄') {
    return `${base}；此处为交易忌碰生年禄，以“先折腾后保住”优先，再落到人、事、物细解`;
  }
  return `${base}；细解时仍需落到人、事、物三面`;
}

function buildRepresentativeDate(rangeInfo) {
  if (!rangeInfo) return null;
  return `${rangeInfo.startYear}-06-01`;
}

function buildYearlyReferenceDate(year) {
  return `${year}-06-01`;
}

function collectCarrierTriggerYears(chart, rangeInfo, carrierPalace) {
  const years = [];
  for (let year = rangeInfo.startYear; year <= rangeInfo.endYear; year += 1) {
    let horoscope;
    try {
      horoscope = chart.horoscope(buildYearlyReferenceDate(year));
    } catch {
      continue;
    }

    let yearlyPalace;
    try {
      yearlyPalace = horoscope.palace('命宫', 'yearly');
    } catch {
      continue;
    }

    if (normName(yearlyPalace?.name) === carrierPalace) {
      years.push(year);
    }
  }
  return years;
}

function collectDecadalStrikeFacts(input, palaces, starMap, birthYear) {
  if (!input || !birthYear) return [];

  let chart;
  try {
    chart = buildChart({
      calendar: input.calendar,
      gender: input.gender,
      date: input.date,
      timeIndex: input.timeIndex,
      isLeapMonth: input.isLeapMonth,
      fixLeap: input.fixLeap,
      language: input.language || 'zh-CN',
    });
  } catch {
    return [];
  }

  const rangeInfos = [];
  const seenRanges = new Set();
  for (const palace of palaces) {
    const range = palace.decadal?.range;
    if (!range) continue;
    const key = range.join('-');
    if (seenRanges.has(key)) continue;
    seenRanges.add(key);
    const rangeInfo = ageRangeToGregorian(range, birthYear);
    if (rangeInfo) rangeInfos.push(rangeInfo);
  }

  const facts = [];
  const seenFacts = new Set();
  for (const rangeInfo of rangeInfos.sort((a, b) => a.startAge - b.startAge)) {
    const referenceDate = buildRepresentativeDate(rangeInfo);
    let horoscope;
    try {
      horoscope = chart.horoscope(referenceDate);
    } catch {
      continue;
    }
    for (const role of PALACE_ORDER) {
      const decadalPalace = horoscope.palace(resolveRuntimePalaceName(role), 'decadal');
      if (!decadalPalace) continue;
      const carrierPalace = normName(decadalPalace.name);
      const dest = flyTo(decadalPalace.heavenlyStem, '忌', starMap);
      if (!dest) continue;
      const clashPalace = oppositeName(dest.palace);
      if (clashPalace !== role) continue;

      const key = [
        rangeInfo.startAge,
        rangeInfo.endAge,
        role,
        carrierPalace,
        dest.palace,
      ].join('|');
      if (seenFacts.has(key)) continue;
      seenFacts.add(key);

      facts.push({
        role,
        rangeInfo,
        carrierPalace,
        carrierStem: decadalPalace.heavenlyStem,
        tradeStar: dest.star,
        destPalace: dest.palace,
        clashPalace,
        triggerYears: collectCarrierTriggerYears(chart, rangeInfo, carrierPalace),
        issuePoint: `${PALACE_TOPICS[role] || role}在该大限承压，属于同类宫位的用忌冲体`,
      });
    }
  }

  return facts;
}

function filterDecadalStrikeFactsByTimingWindow(facts, currentYear) {
  return facts.filter((fact) => isRangeWithinTimingWindow(fact.rangeInfo, currentYear));
}

function filterDecadalFactsByMaxAge(facts) {
  return facts.filter((fact) => fact.rangeInfo?.startAge <= TIMING_WINDOW.maxAge);
}

function collectDecadalGeneralClashFacts(input, palaces, starMap, birthYear) {
  if (!input || !birthYear) return [];

  let chart;
  try {
    chart = buildChart({
      calendar: input.calendar,
      gender: input.gender,
      date: input.date,
      timeIndex: input.timeIndex,
      isLeapMonth: input.isLeapMonth,
      fixLeap: input.fixLeap,
      language: input.language || 'zh-CN',
    });
  } catch {
    return [];
  }

  const rangeInfos = [];
  const seenRanges = new Set();
  for (const palace of palaces) {
    const range = palace.decadal?.range;
    if (!range) continue;
    const key = range.join('-');
    if (seenRanges.has(key)) continue;
    seenRanges.add(key);
    const rangeInfo = ageRangeToGregorian(range, birthYear);
    if (rangeInfo) rangeInfos.push(rangeInfo);
  }

  const facts = [];
  const seenFacts = new Set();
  for (const rangeInfo of rangeInfos.sort((a, b) => a.startAge - b.startAge)) {
    const referenceDate = buildRepresentativeDate(rangeInfo);
    let horoscope;
    try {
      horoscope = chart.horoscope(referenceDate);
    } catch {
      continue;
    }

    for (const role of PALACE_ORDER) {
      let decadalPalace;
      try {
        decadalPalace = horoscope.palace(resolveRuntimePalaceName(role), 'decadal');
      } catch {
        continue;
      }
      if (!decadalPalace) continue;

      const carrierPalace = normName(decadalPalace.name);
      const dest = flyTo(decadalPalace.heavenlyStem, '忌', starMap);
      if (!dest) continue;
      const clashPalace = oppositeName(dest.palace);

      const key = [
        rangeInfo.startAge,
        rangeInfo.endAge,
        role,
        carrierPalace,
        dest.palace,
        clashPalace,
      ].join('|');
      if (seenFacts.has(key)) continue;
      seenFacts.add(key);

      facts.push({
        role,
        rangeInfo,
        carrierPalace,
        carrierStem: decadalPalace.heavenlyStem,
        tradeStar: dest.star,
        destPalace: dest.palace,
        clashPalace,
        triggerYears: collectCarrierTriggerYears(chart, rangeInfo, carrierPalace),
        issuePoint: `大限${role}飞忌落${dest.palace}，对冲${clashPalace}`,
      });
    }
  }

  return facts;
}

function isMaleRole(role) {
  return ['父亲', '丈夫', '儿子', '兄弟', '男友'].includes(role);
}

function renderMeta(personId, data, yearStem, zodiacInput) {
  const lines = [];
  lines.push('# 紫微斗数诊断扫描报告');
  lines.push('');
  lines.push('## 元数据');
  lines.push('');
  lines.push(`- **命主**：${personId}`);
  lines.push(`- **性别**：${data.gender || '未知'}`);
  lines.push(`- **阳历**：${data.solarDate || '未知'}`);
  lines.push(`- **农历**：${data.lunarDate || '未知'}`);
  lines.push(`- **时辰**：${data.time || '未知'}（${data.timeRange || ''}）`);
  lines.push(`- **生年天干**：${yearStem || '未知'}`);
  lines.push(`- **生肖**：${data.zodiac || '未知'}`);
  if (Object.keys(zodiacInput).length > 0) {
    lines.push(
      `- **六亲生肖输入**：${Object.entries(zodiacInput)
        .map(([role, zodiac]) => `${role}=${zodiac}`)
        .join('，')}`,
    );
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 术语约定');
  lines.push('');
  lines.push('- `交易象`：任一宫位宫干飞出的禄、权、科、忌。');
  lines.push('- `伏象`：生年四化，是先天定数。');
  lines.push('- `自化象`：宫位天干使宫内星曜自身化出禄、权、科、忌。');
  lines.push('- `双象`：交易象落入某宫后，与该宫既有的伏象或自化象并见。');
  lines.push('- `飞忌落宫`：某宫宫干飞忌直接落到的宫位。');
  lines.push('- `忌冲宫`：飞忌落宫的对宫，也就是被这条飞忌所冲的宫位。');
  lines.push('- `忌转忌落宫`：生年忌所在宫再次飞忌后的落点。');
  lines.push('- `忌转忌冲宫`：生年忌所在宫再次飞忌后所冲的对宫。');
  lines.push('- `自化忌（回本宫）`：某宫飞忌回本宫，表示该宫事务自我拉扯、自我消耗。');
  lines.push('- `大限用忌冲体`：大限某同类宫飞忌，冲回本命同类宫。');
  lines.push('');
  return lines;
}

function generateS1(palaces, starMap, yearStem, gender, zodiacInput) {
  const lines = [];
  lines.push('## S1 · 静态结构层');
  lines.push('');

  lines.push('### S1-A 生年四化定位');
  lines.push('');

  const natalMutagens = {};
  const laiYinPalace = palaces.find((palace) => palace.heavenlyStem === yearStem);
  const laiYinName = laiYinPalace ? normName(laiYinPalace.name) : '未知';
  lines.push(`- **来因宫**：【${laiYinName}】（天干 ${yearStem}）`);

  const ziPalace = palaces.find((palace) => palace.earthlyBranch === '子');
  const chouPalace = palaces.find((palace) => palace.earthlyBranch === '丑');
  if (ziPalace) {
    const shared = palaces
      .filter((palace) => palace.heavenlyStem === ziPalace.heavenlyStem && palace.earthlyBranch !== '子')
      .map((palace) => normName(palace.name));
    if (shared.length > 0) {
      lines.push(
        `- **副来因（子位复用）**：${normName(ziPalace.name)}（${ziPalace.heavenlyStem}）与 ${shared.join('、')} 共用天干`,
      );
    }
  }
  if (chouPalace) {
    const shared = palaces
      .filter((palace) => palace.heavenlyStem === chouPalace.heavenlyStem && palace.earthlyBranch !== '丑')
      .map((palace) => normName(palace.name));
    if (shared.length > 0) {
      lines.push(
        `- **副来因（丑位复用）**：${normName(chouPalace.name)}（${chouPalace.heavenlyStem}）与 ${shared.join('、')} 共用天干`,
      );
    }
  }
  lines.push('');

  for (const type of ['禄', '权', '科', '忌']) {
    const star = STEM_MUTAGENS[yearStem]?.[type];
    const palace = starMap[star] || '未知';
    const zone = INNER_PALACES.has(palace) ? '内宫' : '外宫';
    const genderLabel = starGender(star, type);
    const isSelfYongshen = (gender === '男' && genderLabel === '男星') || (gender === '女' && genderLabel === '女星');
    const isOppositeYongshen =
      (gender === '男' && genderLabel === '女星') || (gender === '女' && genderLabel === '男星');
    const shenLabel = isSelfYongshen ? ' · **命主用神**' : isOppositeYongshen ? ' · **异性用神**' : '';
    lines.push(`- **[${type}]** ${star}（${genderLabel}${shenLabel}）→ 【${palace}】（${zone}）`);
    natalMutagens[type] = { star, palace, gender: genderLabel, mutagen: type };
  }
  lines.push('');

  lines.push('### S1-B 能量容积检测');
  lines.push('');
  const capacityRows = [];
  for (const palace of palaces) {
    const mutagenStars = getMutagenStars(palace);
    if (mutagenStars.length < 2) continue;
    const palaceName = normName(palace.name);
    const zone = INNER_PALACES.has(palaceName) ? '内宫' : '外宫';
    const level = mutagenStars.length >= 3 ? '三象（高负荷过载）' : '双象';
    const detail = mutagenStars.map((star) => `${star.name}${star.mutagen}`).join(' + ');
    capacityRows.push(`| ${palaceName} | ${zone} | ${level} | ${detail} |`);
  }
  if (capacityRows.length > 0) {
    lines.push('| 宫位 | 区域 | 象数 | 四化组合 |');
    lines.push('|------|------|------|----------|');
    capacityRows.forEach((row) => lines.push(row));
  } else {
    lines.push('全盘无双象或三象聚宫。');
  }
  lines.push('');

  lines.push('### S1-C 真禄/假禄判定');
  lines.push('');
  const luPalace = natalMutagens.禄.palace;
  const luIsInner = INNER_PALACES.has(luPalace);
  const othersAllOuter = ['权', '科', '忌'].every((type) => !INNER_PALACES.has(natalMutagens[type].palace));
  const isRealLu = luIsInner && othersAllOuter;
  lines.push(`- 生年禄宫：【${luPalace}】（${natalMutagens.禄.star}禄）— ${luIsInner ? '内宫' : '外宫'}`);
  lines.push(`- 权宫：【${natalMutagens.权.palace}】— ${INNER_PALACES.has(natalMutagens.权.palace) ? '内宫' : '外宫'}`);
  lines.push(`- 科宫：【${natalMutagens.科.palace}】— ${INNER_PALACES.has(natalMutagens.科.palace) ? '内宫' : '外宫'}`);
  lines.push(`- 忌宫：【${natalMutagens.忌.palace}】— ${INNER_PALACES.has(natalMutagens.忌.palace) ? '内宫' : '外宫'}`);
  lines.push(`- 判定：${isRealLu ? '**真禄**（禄独落内宫，其余均在外宫）' : '**假禄**（未满足禄独内宫条件）'}`);
  lines.push('');

  lines.push('### S1-D 聚宫格局');
  lines.push('');
  const patterns = [];
  for (const palace of palaces) {
    const mutagenStars = getMutagenStars(palace);
    if (mutagenStars.length < 2) continue;
    const palaceName = normName(palace.name);
    const types = mutagenStars.map((star) => star.mutagen);
    const detail = mutagenStars.map((star) => `${star.name}${star.mutagen}`).join(' + ');
    if (types.includes('禄') && types.includes('权')) patterns.push(`- 【${palaceName}】禄权同宫（${detail}）`);
    if (types.includes('禄') && types.includes('忌')) patterns.push(`- 【${palaceName}】禄忌同宫（${detail}）`);
    if (types.includes('权') && types.includes('科')) patterns.push(`- 【${palaceName}】权科同宫（${detail}）`);
    if (types.includes('禄') && types.includes('权') && types.includes('忌')) {
      patterns.push(`- 【${palaceName}】禄权忌三象（${detail}）`);
    }
  }
  if (patterns.length > 0) {
    patterns.forEach((pattern) => lines.push(pattern));
  } else {
    lines.push('无特殊聚宫格局。');
  }
  lines.push('');

  lines.push('### S1-E 六亲用神锚定');
  lines.push('');
  const kinshipAnchors = {};
  if (Object.keys(zodiacInput).length > 0) {
    lines.push('| 六亲 | 生肖 | 期望性别 | 用神星 | 用神宫位 | 定位方法 |');
    lines.push('|------|------|---------|--------|----------|---------|');
    for (const [role, zodiac] of Object.entries(zodiacInput)) {
      const branch = ZODIAC_BRANCH[zodiac];
      if (!branch) {
        lines.push(`| ${role} | ${zodiac} | ? | 未定位 | - | 无效生肖 |`);
        continue;
      }

      const wantMale = isMaleRole(role);
      const wantLabel = wantMale ? '男星' : '女星';
      const branchPalace = palaces.find((palace) => palace.earthlyBranch === branch);
      if (!branchPalace) {
        lines.push(`| ${role} | ${zodiac} | ${wantLabel} | ⚠️ 未定位 | - | 未找到地支宫 |`);
        continue;
      }

      const branchIdx = getIdx(branchPalace.name);
      const axisPalaces = [branchIdx, oppositeIdx(branchIdx)];
      let found = null;
      let method = '';

      for (const type of ['禄', '权', '科', '忌']) {
        const mutagen = natalMutagens[type];
        const mutagenIdx = getIdx(mutagen.palace);
        if (!axisPalaces.includes(mutagenIdx)) continue;
        const genderLabel = starGender(mutagen.star, type);
        const genderMatch = (wantMale && genderLabel === '男星') || (!wantMale && genderLabel === '女星');
        if (!genderMatch) continue;
        found = { star: mutagen.star, type, palace: mutagen.palace };
        method = `第一层：生年${type}(${mutagen.star})直接落于${branch}轴线`;
        break;
      }

      if (!found) {
        for (const type of ['禄', '权', '科', '忌']) {
          const sourcePalace = getPalaceByName(palaces, natalMutagens[type].palace);
          const dest = sourcePalace ? flyTo(sourcePalace.heavenlyStem, type, starMap) : null;
          if (!dest) continue;
          const destIdx = getIdx(dest.palace);
          if (!axisPalaces.includes(destIdx)) continue;
          const genderLabel = starGender(dest.star, type);
          const genderMatch = (wantMale && genderLabel === '男星') || (!wantMale && genderLabel === '女星');
          if (!genderMatch) continue;
          found = { star: dest.star, type, palace: dest.palace };
          method = `第二层：${type}转${type}(${natalMutagens[type].star}${type}→${dest.star}${type})落于${branch}轴线`;
          break;
        }
      }

      if (!found) {
        const matches = Object.entries(natalMutagens).filter(([type, mutagen]) => {
          const genderLabel = starGender(mutagen.star, type);
          return (wantMale && genderLabel === '男星') || (!wantMale && genderLabel === '女星');
        });
        if (matches.length === 1) {
          const [type, mutagen] = matches[0];
          found = { star: mutagen.star, type, palace: mutagen.palace };
          method = '第三层：唯一同性星兜底';
        }
      }

      if (found) {
        lines.push(`| ${role} | ${zodiac} | ${wantLabel} | ${found.star}${found.type} | ${found.palace} | ${method} |`);
        kinshipAnchors[role] = {
          palace: found.palace,
          idx: getIdx(found.palace),
          branch,
          star: found.star,
          type: found.type,
        };
      } else {
        lines.push(`| ${role} | ${zodiac} | ${wantLabel} | ⚠️ 未定位 | - | 疑似时辰有误 |`);
      }
    }
  } else {
    lines.push('未提供六亲生肖数据。');
  }
  lines.push('');

  return { lines, natalMutagens, laiYinName, kinshipAnchors };
}

function generateS2(palaces, starMap, natalMutagens, kinshipAnchors) {
  const lines = [];
  lines.push('## S2 · 动态层·由体入用');
  lines.push('');

  lines.push('### S2-A 四化转宫追踪');
  lines.push('');
  const transfers = {};
  for (const type of ['禄', '权', '科', '忌']) {
    const sourcePalaceName = natalMutagens[type].palace;
    const sourcePalace = getPalaceByName(palaces, sourcePalaceName);
    if (!sourcePalace) {
      lines.push(`- **${type}转${type}**：源宫未找到`);
      continue;
    }
    const dest = flyTo(sourcePalace.heavenlyStem, type, starMap);
    if (dest) {
      lines.push(
        `- **${type}转${type}**：${natalMutagens[type].star}${type}【${sourcePalaceName}】(${sourcePalace.heavenlyStem}干) → 飞${dest.star}${type} → 落入【${dest.palace}】`,
      );
      transfers[type] = { from: sourcePalaceName, to: dest.palace, star: dest.star };
    } else {
      lines.push(`- **${type}转${type}**：${natalMutagens[type].star}${type}【${sourcePalaceName}】→ 无法追踪`);
    }
  }
  lines.push('');

  if (transfers.科 && transfers.权) {
    lines.push(`- **科看权校验**：科落【${transfers.科.to}】，权落【${transfers.权.to}】`);
    lines.push('');
  }

  lines.push('### S2-B 忌转忌精细分类');
  lines.push('');
  const jiTransfer = transfers.忌;
  if (jiTransfer) {
    const finalPalace = jiTransfer.to;
    const finalIdx = getIdx(finalPalace);
    const clashPalace = PALACE_ORDER[oppositeIdx(finalIdx)];
    const clashIdx = oppositeIdx(finalIdx);
    const natalJiIdx = getIdx(natalMutagens.忌.palace);
    const involvedPalaces = [natalMutagens.忌.palace, finalPalace, clashPalace];
    const involvedIdxs = involvedPalaces.map((palace) => getIdx(palace));

    lines.push(`- **忌转忌落宫**：【${finalPalace}】（${jiTransfer.star}忌）`);
    lines.push(`- **忌转忌冲宫**：【${clashPalace}】`);
    lines.push('');
    lines.push(`- **生年忌回本检测**：${finalIdx === natalJiIdx ? '⚠️ 是（忌转忌回到生年忌宫本位）' : '否'}`);
    lines.push(`- **忌转忌冲生年忌检测**：${clashIdx === natalJiIdx ? '⚠️ 是（忌转忌冲宫正是生年忌宫）' : '否'}`);
    lines.push(`- **河图体用宫涉及检测**（源宫 / 落宫 / 忌冲宫三宫校验：${involvedPalaces.join('、')}）：`);

    let hetuHit = false;
    for (const pair of HETU_PAIRS) {
      const [p1, p2] = pair.palaces;
      if (involvedIdxs.includes(getIdx(p1)) && involvedIdxs.includes(getIdx(p2))) {
        lines.push(`  - ⚠️ **${pair.pair}（${pair.desc}）**：${p1} vs ${p2} — 三宫中同时包含此河图对的两端`);
        hetuHit = true;
      }
    }
    if (!hetuHit) {
      lines.push('  - 无河图体用共宗关系。');
    }

    const finalIsPeople = PEOPLE_PALACES.has(finalPalace);
    const clashIsPeople = PEOPLE_PALACES.has(clashPalace);
    const natureLabel =
      finalIsPeople && clashIsPeople ? '人宫' : !finalIsPeople && !clashIsPeople ? '物宫' : '混合（人+物）';
    lines.push(
      `- **忌冲宫性质**：${natureLabel}（落宫=${finalPalace}[${finalIsPeople ? '人' : '物'}]，忌冲宫=${clashPalace}[${clashIsPeople ? '人' : '物'}]）`,
    );

    if (Object.keys(kinshipAnchors).length > 0) {
      lines.push('- **六亲用神受作用检测**：');
      let kinshipHits = 0;
      for (const [role, anchor] of Object.entries(kinshipAnchors)) {
        const relation = classifyHitRelation(anchor.idx, finalIdx, clashIdx);
        if (relation === 'direct') {
          lines.push(`  - ⚠️ **${role}**（${anchor.palace}）被忌转忌直接命中`);
          kinshipHits += 1;
        } else if (relation === 'clash') {
          lines.push(`  - ⚠️ **${role}**（${anchor.palace}）被忌转忌所冲`);
          kinshipHits += 1;
        }
      }
      if (kinshipHits === 0) {
        lines.push('  - 未命中六亲用神宫位，也未冲到其对宫。');
      }
    }

    lines.push('- **生年四化同轴检测**：');
    const luIdx = getIdx(natalMutagens.禄.palace);
    const jiIdx = getIdx(natalMutagens.忌.palace);
    const quanIdx = getIdx(natalMutagens.权.palace);
    const keIdx = getIdx(natalMutagens.科.palace);
    let axisHit = 0;
    if (oppositeIdx(luIdx) === jiIdx) {
      lines.push(`  - ⚠️ **禄忌同轴**：${natalMutagens.禄.palace}(禄) 与 ${natalMutagens.忌.palace}(忌) 位于本对宫轴线`);
      axisHit += 1;
    }
    if (oppositeIdx(quanIdx) === keIdx) {
      lines.push(`  - ⚠️ **权科同轴**：${natalMutagens.权.palace}(权) 与 ${natalMutagens.科.palace}(科) 位于本对宫轴线`);
      axisHit += 1;
    }
    if (axisHit === 0) {
      lines.push('  - 无同轴结构。');
    }
  }
  lines.push('');

  lines.push('### S2-C 危险等级标注');
  lines.push('');
  lines.push('> 以下字段供 AI 分析师进行综合评级，代码仅列出事实。');
  lines.push('');

  return { lines, transfers };
}

function generateS3(palaces, natalMutagens, kinshipAnchors, jiEffects, tradeEffects) {
  const lines = [];
  lines.push('## S3 · 动态层·由用归体');
  lines.push('');

  lines.push('### S3-A 反向扫描：飞忌牵动与双象碰撞');
  lines.push('');
  lines.push('先扫描 12 宫飞忌对生年四化的牵动，再扫描交易象落宫后与伏象、自化象的双象碰撞：');
  lines.push('');

  const qualityChanges = [];
  for (const effect of jiEffects) {
    for (const type of ['禄', '权', '科']) {
      if (effect.jiStar !== natalMutagens[type].star) continue;
      qualityChanges.push({
        source: effect.source,
        stem: effect.sourceStem,
        path: effect.path,
        jiStar: effect.jiStar,
        targetType: type,
        targetPalace: effect.destPalace,
        clashPalace: effect.clashPalace,
        targetStar: natalMutagens[type].star,
        combo: normalizeDoubleSymbol('忌', type),
        result: `飞忌命中生年${type}宫，先看忌落${effect.destPalace}，再看忌冲${effect.clashPalace}`,
      });
    }

    if (effect.jiStar === natalMutagens.忌.star && effect.source !== natalMutagens.忌.palace) {
      qualityChanges.push({
        source: effect.source,
        stem: effect.sourceStem,
        path: effect.path,
        jiStar: effect.jiStar,
        targetType: '忌',
        targetPalace: effect.destPalace,
        clashPalace: effect.clashPalace,
        targetStar: natalMutagens.忌.star,
        combo: '忌叠忌',
        result: `飞忌命中生年忌宫，忌气叠压，先看忌落${effect.destPalace}，再看忌冲${effect.clashPalace}`,
      });
    }
  }

  lines.push('**飞忌牵动生年四化：**');
  lines.push('');
  if (qualityChanges.length > 0) {
    lines.push('| 发起宫 | 天干 | 飞忌路径 | 忌冲宫 | 被牵动伏象 | 双象/叠象 | 作用结果 |');
    lines.push('|--------|------|----------|--------|------------|-----------|----------|');
    for (const change of qualityChanges) {
      lines.push(
        `| ${change.source} | ${change.stem} | ${change.path} | ${change.clashPalace} | ${change.targetStar}${change.targetType} | ${change.combo} | ${change.result} |`,
      );
    }
  } else {
    lines.push('未检测到任何宫干飞忌导致生年四化质变。');
  }
  lines.push('');

  const natalByPalace = {};
  for (const type of ['禄', '权', '科', '忌']) {
    const entry = natalMutagens[type];
    if (!entry?.palace) continue;
    natalByPalace[entry.palace] ??= [];
    natalByPalace[entry.palace].push({
      sourceKind: '伏象',
      collisionStar: entry.star,
      collisionType: type,
    });
  }

  const selfByPalace = {};
  for (const effect of tradeEffects) {
    if (effect.source !== effect.destPalace) continue;
    selfByPalace[effect.destPalace] ??= [];
    selfByPalace[effect.destPalace].push({
      sourceKind: '自化象',
      source: effect.source,
      collisionStar: effect.tradeStar,
      collisionType: effect.tradeType,
      path: effect.path,
    });
  }

  const doubleSymbolFacts = [];
  const doubleSymbolKeys = new Set();
  const pushDoubleSymbol = ({
    effect,
    sourceKind,
    collisionStar,
    collisionType,
  }) => {
    const combo = normalizeDoubleSymbol(effect.tradeType, collisionType);
    if (!combo) return;

    const key = [
      effect.source,
      effect.path,
      effect.destPalace,
      sourceKind,
      collisionStar,
      collisionType,
      combo,
    ].join('|');
    if (doubleSymbolKeys.has(key)) return;
    doubleSymbolKeys.add(key);

    doubleSymbolFacts.push({
      source: effect.source,
      path: effect.path,
      destPalace: effect.destPalace,
      sourceKind,
      collisionStar,
      collisionType,
      combo,
      family: isSameFamilyMutagen(effect.tradeType, collisionType) ? '同族' : '异族',
      note: describeDoubleSymbol(combo, sourceKind, effect.tradeType, collisionType),
    });
  };

  for (const effect of tradeEffects) {
    for (const natalEntry of natalByPalace[effect.destPalace] || []) {
      pushDoubleSymbol({
        effect,
        sourceKind: natalEntry.sourceKind,
        collisionStar: natalEntry.collisionStar,
        collisionType: natalEntry.collisionType,
      });
    }

    for (const selfEntry of selfByPalace[effect.destPalace] || []) {
      if (
        effect.source === selfEntry.source &&
        effect.tradeType === selfEntry.collisionType &&
        effect.tradeStar === selfEntry.collisionStar
      ) {
        continue;
      }
      pushDoubleSymbol({
        effect,
        sourceKind: selfEntry.sourceKind,
        collisionStar: selfEntry.collisionStar,
        collisionType: selfEntry.collisionType,
      });
    }
  }

  lines.push('**交易象 × 伏象 / 自化象 双象碰撞：**');
  lines.push('');
  if (doubleSymbolFacts.length > 0) {
    lines.push('| 发起宫 | 交易象 | 落宫(B) | 碰撞来源 | 既有象 | 双象 | 同异族 | 程序说明 |');
    lines.push('|--------|--------|----------|----------|--------|------|--------|----------|');
    for (const fact of doubleSymbolFacts) {
      lines.push(
        `| ${fact.source} | ${fact.path} | ${fact.destPalace} | ${fact.sourceKind} | ${fact.collisionStar}${fact.collisionType} | ${fact.combo} | ${fact.family} | ${fact.note} |`,
      );
    }
  } else {
    lines.push('未检测到交易象与伏象/自化象构成双象碰撞。');
  }
  lines.push('');

  lines.push('### S3-B 河图宫忌冲检测');
  lines.push('');
  lines.push('检测 12 宫飞忌的发起宫与忌冲宫是否构成河图共宗对：');
  lines.push('');
  const hetuClashes = [];
  for (const effect of jiEffects) {
    const sourceIdx = getIdx(effect.source);
    const clashIdx = getIdx(effect.clashPalace);
    for (const pair of HETU_PAIRS) {
      const [p1, p2] = pair.palaces;
      const idx1 = getIdx(p1);
      const idx2 = getIdx(p2);
      if ((sourceIdx === idx1 && clashIdx === idx2) || (sourceIdx === idx2 && clashIdx === idx1)) {
        hetuClashes.push(`| ${effect.source} | ${effect.path} | ${effect.clashPalace} | ${pair.pair} ${pair.desc} |`);
      }
    }
  }
  if (hetuClashes.length > 0) {
    lines.push('| 发起宫 | 飞忌路径 | 忌冲宫 | 河图对 |');
    lines.push('|--------|----------|--------|--------|');
    [...new Set(hetuClashes)].forEach((row) => lines.push(row));
  } else {
    lines.push('未检测到河图宫忌冲落入河图共宗对。');
  }
  lines.push('');

  lines.push('### S3-B2 立太极检测');
  lines.push('');
  lines.push('以人宫为太极原点，仅扫描距离命主最近的核心社会关系：母亲、儿媳/女婿、配偶的身体、配偶的父母。');
  lines.push('逻辑说明：这些关系距离命主近，现实影响直接且强，默认纳入程序化扫描。');
  lines.push('');
  lines.push('**派生宫位映射表：**');
  lines.push('');
  lines.push('| 太极原点 | 推演关系 | 转宫逻辑 | 对应宫位 |');
  lines.push('|----------|----------|----------|----------|');

  const taijiMap = CORE_TAIJI_TOPICS.map((topic) => {
    const baseIdx = getIdx(topic.base);
    const derivedIdx = (baseIdx + topic.offset) % 12;
    return {
      ...topic,
      derivedIdx,
      derived: PALACE_ORDER[derivedIdx],
    };
  });

  for (const topic of taijiMap) {
    lines.push(`| ${topic.base} | ${topic.label} | ${topic.logic} | ${topic.derived} |`);
  }
  lines.push('');
  lines.push('**飞忌作用结果：**');
  lines.push('');

  const taijiFacts = [];
  const taijiFactKeys = new Set();
  const pushTaijiFact = ({ topic, effect, structureType, issuePoints, focusPalace, triggerDetail }) => {
    const key = [
      topic.base,
      topic.label,
      topic.logic,
      effect.source,
      effect.path,
      effect.clashPalace,
      structureType,
      focusPalace,
      triggerDetail,
    ].join('|');
    if (taijiFactKeys.has(key)) return;
    taijiFactKeys.add(key);
    taijiFacts.push({
      base: topic.base,
      label: topic.label,
      logic: topic.logic,
      source: effect.source,
      path: effect.path,
      clashPalace: effect.clashPalace,
      structureType,
      issuePoints,
      focusPalace,
      triggerDetail,
    });
  };

  for (const effect of jiEffects) {
    const sourceIdx = getIdx(effect.source);
    for (const topic of taijiMap) {
      const baseIdx = getIdx(topic.base);

      if (sourceIdx === baseIdx && effect.destIdx === topic.derivedIdx) {
        pushTaijiFact({
          topic,
          effect,
          structureType: '太极原点飞忌直接命中派生位',
          issuePoints: topic.directNotes,
          focusPalace: topic.derived,
          triggerDetail: `直接命中${topic.derived}`,
        });
      }
      if (sourceIdx === baseIdx && effect.clashIdx === topic.derivedIdx) {
        pushTaijiFact({
          topic,
          effect,
          structureType: '太极原点飞忌冲派生位',
          issuePoints: topic.directNotes,
          focusPalace: topic.derived,
          triggerDetail: `飞忌冲${topic.derived}`,
        });
      }
      if (sourceIdx === topic.derivedIdx && effect.destPalace === topic.base) {
        pushTaijiFact({
          topic,
          effect,
          structureType: '派生位飞忌直接回到太极原点',
          issuePoints: topic.returnNotes,
          focusPalace: topic.base,
          triggerDetail: `直接回到${topic.base}`,
        });
      }
      if (sourceIdx === topic.derivedIdx && effect.clashPalace === topic.base) {
        pushTaijiFact({
          topic,
          effect,
          structureType: '派生位飞忌冲回太极原点',
          issuePoints: topic.returnNotes,
          focusPalace: topic.base,
          triggerDetail: `飞忌冲回${topic.base}`,
        });
      }
    }
  }

  if (taijiFacts.length > 0) {
    lines.push('| 太极原点 | 推演关系 | 转宫逻辑 | 发起宫 | 飞忌路径 | 忌冲宫 | 结构类型 | 说明点 |');
    lines.push('|----------|----------|----------|--------|----------|----------|----------|--------|');
    for (const fact of taijiFacts) {
      lines.push(
        `| ${fact.base} | ${fact.label} | ${fact.logic} | ${fact.source} | ${fact.path} | ${fact.clashPalace} | ${fact.structureType} | ${fact.issuePoints.join('；')} |`,
      );
    }
  } else {
    lines.push('未检测到立太极相关飞忌作用结果。');
  }
  lines.push('');

  lines.push('### S3-C 自化分析（离心/有变无）');
  lines.push('');
  const selfHua = [];
  for (const effect of jiEffects) {
    if (effect.destPalace !== effect.source) continue;
    selfHua.push(`- 【${effect.source}】自化忌（${effect.sourceStem}干飞${effect.jiStar}忌回本宫）`);
  }
  if (selfHua.length > 0) {
    selfHua.forEach((line) => lines.push(line));
  } else {
    lines.push('无自化忌宫位。');
  }
  lines.push('');

  lines.push('### S3-D 六亲用神交叉验证');
  lines.push('');
  if (Object.keys(kinshipAnchors).length > 0) {
    const alerts = [];
    for (const change of qualityChanges) {
      for (const [role, anchor] of Object.entries(kinshipAnchors)) {
        if (change.targetPalace === anchor.palace) {
          alerts.push(
            `- ⚠️ **[六亲告警]** ${role}（${anchor.palace}）所在宫位被 ${change.source} 飞忌直接命中，牵动${change.targetStar}${change.targetType}`,
          );
        }
        if (change.clashPalace === anchor.palace) {
          alerts.push(
            `- ⚠️ **[六亲告警]** ${role}（${anchor.palace}）所在宫位被 ${change.source} 飞忌所冲，牵动${change.targetStar}${change.targetType}`,
          );
        }
      }
    }
    for (const line of selfHua) {
      for (const [role, anchor] of Object.entries(kinshipAnchors)) {
        if (line.includes(anchor.palace)) {
          alerts.push(`- ⚠️ **[六亲告警]** ${role}（${anchor.palace}）所在宫位自化忌`);
        }
      }
    }
    if (alerts.length > 0) {
      [...new Set(alerts)].forEach((alert) => lines.push(alert));
    } else {
      lines.push('S3 各子项未触碰六亲用神宫位。');
    }
  } else {
    lines.push('未提供六亲数据，跳过交叉验证。');
  }
  lines.push('');

  return { lines, qualityChanges, doubleSymbolFacts, selfHua, taijiFacts };
}

function generateS4(
  palaces,
  natalMutagens,
  qualityChanges,
  doubleSymbolFacts,
  selfHua,
  kinshipAnchors,
  taijiFacts,
  decadalGeneralClashFacts,
  decadalStrikeFacts,
  birthYear,
  currentYear,
) {
  const lines = [];
  lines.push('## S4 · 触发时空层');
  lines.push('');

  const riskPalaces = new Set();
  const natalJiSource = getPalaceByName(palaces, natalMutagens.忌.palace);
  if (natalJiSource) {
    const natalJiDest = natalJiSource.mutagedPlaces?.忌?.name ? normName(natalJiSource.mutagedPlaces.忌.name) : '';
    const actualDest = natalJiDest || oppositeName(oppositeName(natalMutagens.忌.palace));
    if (actualDest) {
      riskPalaces.add(actualDest);
      riskPalaces.add(oppositeName(actualDest));
    }
  }

  for (const change of qualityChanges) {
    riskPalaces.add(change.targetPalace);
    riskPalaces.add(change.clashPalace);
  }

  for (const line of selfHua) {
    const match = line.match(/【(.+?)】/);
    if (match) riskPalaces.add(match[1]);
  }

  for (const fact of taijiFacts) {
    riskPalaces.add(fact.focusPalace);
  }

  for (const fact of decadalStrikeFacts) {
    riskPalaces.add(fact.role);
  }

  lines.push('### S4-A 核心风险宫位汇总');
  lines.push('');
  lines.push(
    `> 以下应期按出生年 ${birthYear || '未知'} 折算为公历年份；默认只展示 ${currentYear - TIMING_WINDOW.pastYears}-${currentYear + TIMING_WINDOW.futureYears} 年间，且不展示 ${TIMING_WINDOW.maxAge} 岁后的远期大限。`,
  );
  lines.push('');
  if (riskPalaces.size > 0) {
    for (const riskPalace of riskPalaces) {
      const palace = getPalaceByName(palaces, riskPalace);
      const opposite = oppositeName(riskPalace);
      lines.push(`#### 【${riskPalace}】（对宫：${opposite}）`);
      lines.push('');

      const problems = [];
      if (natalJiSource) {
        const natalJiDest = natalJiSource.mutagedPlaces?.忌?.name ? normName(natalJiSource.mutagedPlaces.忌.name) : '';
        const destPalace = natalJiDest;
        const clashPalace = destPalace ? oppositeName(destPalace) : '';
        const destStar = STEM_MUTAGENS[natalJiSource.heavenlyStem]?.忌;
        if (destPalace === riskPalace || clashPalace === riskPalace) {
          problems.push(
            `- S2 ${destPalace === riskPalace ? '忌转忌命中' : '忌转忌冲'}：${natalMutagens.忌.star}忌(${natalMutagens.忌.palace})→${destStar}忌→${destPalace}，${
              destPalace === riskPalace ? '命中此宫' : `冲${riskPalace}`
            }`,
          );
        }
      }

      for (const change of qualityChanges) {
        if (change.targetPalace === riskPalace) {
          problems.push(
            `- S3 飞忌牵动伏象：${change.source}(${change.stem})飞${change.path}，直接落入此宫，牵动${change.targetStar}${change.targetType}`,
          );
        }
        if (change.clashPalace === riskPalace) {
          problems.push(
            `- S3 飞忌牵动伏象：${change.source}(${change.stem})飞${change.path}，其忌冲宫为${riskPalace}，牵动${change.targetStar}${change.targetType}`,
          );
        }
      }

      for (const fact of doubleSymbolFacts) {
        if (!fact.combo.includes('忌')) continue;
        if (fact.destPalace !== riskPalace) continue;
        problems.push(
          `- S3 双象碰撞：${fact.source}飞${fact.path}落入此宫，与${fact.sourceKind}${fact.collisionStar}${fact.collisionType}形成${fact.combo}双象。程序说明：${fact.note}`,
        );
      }

      const selfLine = selfHua.find((line) => line.includes(`【${riskPalace}】`));
      if (selfLine) {
        problems.push(`- S3 自化忌：${selfLine.replace(/^- /, '')}`);
      }

      for (const fact of taijiFacts) {
        if (fact.focusPalace !== riskPalace) continue;
        problems.push(
          `- S3 立太极忌冲：${fact.logic}（${fact.label}）。${fact.source}飞${fact.path}，${fact.triggerDetail}，结构为${fact.structureType}。触发问题点：${fact.issuePoints.join('；')}`,
        );
      }

      for (const fact of decadalStrikeFacts) {
        if (fact.role !== riskPalace) continue;
        problems.push(
          `- S4 大限用忌冲体：按宫位有效归大，以本命${fact.role}为体、大限${fact.role}为用。该大限落在本命${fact.carrierPalace}，${fact.carrierStem}干飞${fact.tradeStar}忌到${fact.destPalace}，冲回本命${fact.role}。触发问题点：${fact.issuePoint}。对应大限：${fact.rangeInfo.startAge}-${fact.rangeInfo.endAge}岁（${fact.rangeInfo.startYear}-${fact.rangeInfo.endYear}）`,
        );
        problems.push(
          `- S4 流年命宫触发：${fact.triggerYears.length > 0 ? fact.triggerYears.join('、') : '未命中'}。触发逻辑：流年命宫踏入发射宫位${fact.carrierPalace}，聚焦“大限${fact.role}飞忌冲本命${fact.role}”这条线。`,
        );
      }

      for (const [role, anchor] of Object.entries(kinshipAnchors)) {
        if (anchor.palace === riskPalace) {
          problems.push(`- 六亲关联：${role}(${anchor.star}${anchor.type})的用神宫位`);
        }
      }

      if (problems.length > 0) {
        problems.forEach((problem) => lines.push(problem));
      } else {
        lines.push('- 无具体问题明细（当前仅作为忌冲宫位收录）');
      }

      const timing = buildTimingSummary(palaces, riskPalace, birthYear, currentYear);
      if (timing?.ownDecade || timing?.oppositeDecade) {
        const decadeParts = [];
        if (timing.ownDecade) {
          decadeParts.push(
            `本宫 ${timing.ownDecade.startAge}-${timing.ownDecade.endAge}岁（${timing.ownDecade.startYear}-${timing.ownDecade.endYear}）`,
          );
        }
        if (timing.oppositeDecade) {
          decadeParts.push(
            `对宫 ${opposite} ${timing.oppositeDecade.startAge}-${timing.oppositeDecade.endAge}岁（${timing.oppositeDecade.startYear}-${timing.oppositeDecade.endYear}）`,
          );
        }
        lines.push(`- 应验大限：${decadeParts.join('；')}`);

        if (timing.ownDecade) {
          lines.push(
            `- 本宫大限内应验流年（公历）：${formatPalaceYearHits(
              timing.palace,
              timing.ownDecadeOwnBranchYears,
            )}；${formatPalaceYearHits(timing.oppositePalace, timing.ownDecadeOppositeBranchYears)}`,
          );
        }
        if (timing.oppositeDecade) {
          lines.push(
            `- 对宫大限内应验流年（公历）：${formatPalaceYearHits(
              timing.palace,
              timing.oppositeDecadeOwnBranchYears,
            )}；${formatPalaceYearHits(timing.oppositePalace, timing.oppositeDecadeOppositeBranchYears)}`,
          );
        }
      }
      lines.push('');
    }
  } else {
    lines.push('未汇总到核心风险宫位。');
    lines.push('');
  }

  lines.push('### S4-B1 大限用忌冲体排查');
  lines.push('');
  lines.push(
    `按“宫位有效，归大碰撞”原则，仅收录同类宫位的大限用忌冲体；时间默认收口到 ${currentYear - TIMING_WINDOW.pastYears}-${currentYear + TIMING_WINDOW.futureYears}，并剔除 ${TIMING_WINDOW.maxAge} 岁后的远期窗口。`,
  );
  lines.push('');
  if (decadalStrikeFacts.length > 0) {
    lines.push('| 本命体宫 | 大限范围 | 发射宫位 | 飞忌路径 | 冲回本命 | 流年命宫触发 | 触发问题点 |');
    lines.push('|----------|----------|----------|----------|----------|--------------|------------|');
    for (const fact of decadalStrikeFacts) {
      lines.push(
        `| ${fact.role} | ${fact.rangeInfo.startAge}-${fact.rangeInfo.endAge}岁（${fact.rangeInfo.startYear}-${fact.rangeInfo.endYear}） | ${fact.carrierPalace} | ${fact.tradeStar}忌→${fact.destPalace} | ${fact.role} | ${fact.triggerYears.length > 0 ? fact.triggerYears.join('、') : '未命中'} | ${fact.issuePoint} |`,
      );
    }
  } else {
    lines.push('未检测到大限同类宫位的用忌冲体。');
  }
  lines.push('');

  lines.push('### S4-B2 大限飞忌对冲总表');
  lines.push('');
  lines.push(`补充展开所有宫位的大限飞忌路径，只保留 ${TIMING_WINDOW.maxAge} 岁前的结构，不再限制当前时间窗口。`);
  lines.push('');
  if (decadalGeneralClashFacts.length > 0) {
    lines.push('| 大限宫职 | 大限范围 | 发射宫位 | 飞忌路径 | 飞忌落宫 | 忌冲宫 | 流年命宫触发 | 说明 |');
    lines.push('|----------|----------|----------|----------|----------|--------|--------------|------|');
    for (const fact of decadalGeneralClashFacts) {
      lines.push(
        `| ${fact.role} | ${fact.rangeInfo.startAge}-${fact.rangeInfo.endAge}岁（${fact.rangeInfo.startYear}-${fact.rangeInfo.endYear}） | ${fact.carrierPalace} | ${fact.tradeStar}忌→${fact.destPalace} | ${fact.destPalace} | ${fact.clashPalace} | ${fact.triggerYears.length > 0 ? fact.triggerYears.join('、') : '未命中'} | ${fact.issuePoint} |`,
      );
    }
  } else {
    lines.push('未检测到可收录的大限飞忌对冲结构。');
  }
  lines.push('');

  lines.push('### S4-C 做实条件');
  lines.push('');
  lines.push('> 以下由 AI 分析师根据宫位星性与具体行为进行解读。');
  lines.push('');
  for (const riskPalace of riskPalaces) {
    const palace = getPalaceByName(palaces, riskPalace);
    if (!palace) continue;
    const mainStars = (palace.majorStars || []).map((star) => star.name).join('、') || '无主星';
    lines.push(`- 【${riskPalace}】主星：${mainStars}。宫性：${PEOPLE_PALACES.has(riskPalace) ? '人宫' : '物宫'}`);
  }
  lines.push('');

  return { lines };
}

function main() {
  const args = process.argv.slice(2);
  const personIdIndex = args.findIndex((arg) => arg === '--person-id');
  const zodiacIndex = args.findIndex((arg) => arg === '--zodiac');

  if (personIdIndex === -1 || !args[personIdIndex + 1]) {
    console.error('Usage: node generate-scan-report.mjs --person-id <ID> [--zodiac 丈夫:鼠,父亲:马,母亲:鸡]');
    process.exit(1);
  }

  const personId = args[personIdIndex + 1];
  const chartPath = path.join(__dirname, '..', 'records', 'people', personId, 'chart.json');
  if (!fs.existsSync(chartPath)) {
    console.error(`Chart not found: ${chartPath}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(chartPath, 'utf8'));
  const data = rawData.chart || rawData;
  const palaces = data.palaces || [];
  if (palaces.length === 0) {
    console.error('Invalid chart.json: no palaces found');
    process.exit(1);
  }

  const yearStem = extractYearStem(data);
  const birthYear = extractBirthYear(data);
  if (!yearStem || !STEM_MUTAGENS[yearStem]) {
    console.error('Cannot extract year stem');
    process.exit(1);
  }

  const zodiacInput = zodiacIndex !== -1 ? parseZodiacInput(args[zodiacIndex + 1]) : {};
  const currentYear = getCurrentGregorianYear();
  const starMap = buildStarMap(palaces);
  const jiEffects = collectJiEffects(palaces, starMap);
  const tradeEffects = collectTradeEffects(palaces, starMap);
  const decadalGeneralClashFacts = filterDecadalFactsByMaxAge(
    collectDecadalGeneralClashFacts(rawData.input, palaces, starMap, birthYear),
  );
  const decadalStrikeFacts = filterDecadalStrikeFactsByTimingWindow(
    collectDecadalStrikeFacts(rawData.input, palaces, starMap, birthYear),
    currentYear,
  );

  const meta = renderMeta(personId, data, yearStem, zodiacInput);
  const s1 = generateS1(palaces, starMap, yearStem, data.gender || '未知', zodiacInput);
  const s2 = generateS2(palaces, starMap, s1.natalMutagens, s1.kinshipAnchors);
  const s3 = generateS3(palaces, s1.natalMutagens, s1.kinshipAnchors, jiEffects, tradeEffects);
  const s4 = generateS4(
    palaces,
    s1.natalMutagens,
    s3.qualityChanges,
    s3.doubleSymbolFacts,
    s3.selfHua,
    s1.kinshipAnchors,
    s3.taijiFacts,
    decadalGeneralClashFacts,
    decadalStrikeFacts,
    birthYear,
    currentYear,
  );

  const report = [...meta, ...s1.lines, ...s2.lines, ...s3.lines, ...s4.lines].join('\n');
  const outPath = path.join(path.dirname(chartPath), 'scan-report.md');
  fs.writeFileSync(outPath, report, 'utf8');
  console.log(`✅ 诊断报告已生成：${outPath}`);
  console.log(`📄 共 ${report.split('\n').length} 行`);
}

main();
