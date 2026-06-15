// Rule 14: 流月流日推算法 — Monthly/daily flow calculation
// 斗君寅宫锚定法: 本命寅宫→流年同宫名=一月→顺时针排全年流月
// 流月宫下一位=初一→顺时针排全月流日
// NOTE: Requires horoscope (运限) data for full computation
// This rule provides the method and validates input data availability
import { getPalace, PALACE_NAMES } from './helpers.mjs';

// Earthly branch order (地支序)
const BRANCH_ORDER = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
const BRANCH_INDEX_MAP = new Map(BRANCH_ORDER.map((b, i) => [b, i]));

// Month names
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

/**
 * Check 流月流日推算法
 * Computes monthly palace rotation from the birth chart foundations
 * Full computation needs horoscope - this gives the method + static mapping
 * @param {Object} chart - serialized chart
 * @param {Object} [horoscope] - optional horoscope data for live computation
 */
export function checkLiuYueLiuRi(chart, yearPillarStem) {
  const palaces = chart.palaces || [];

  // Find 寅宫 (palace with earthly branch 寅)
  const yinPalace = palaces.find(p => p.earthlyBranch === '寅');
  if (!yinPalace) {
    return { hit: false, details: '未找到寅宫，无法计算流月' };
  }

  const yinPalaceName = yinPalace.name;
  const yinIndex = yinPalace.index;

  // 流月: 本命寅宫名 → 流年同宫名 = 一月
  // Then rotate clockwise (increasing index mod 12) for each subsequent month
  const monthlyMapping = [];
  for (let m = 0; m < 12; m++) {
    const palIdx = (yinIndex + m) % 12;
    const p = palaces[palIdx];
    monthlyMapping.push({
      month: MONTH_NAMES[m],
      monthNum: m + 1,
      palaceIndex: palIdx,
      palaceName: p?.name || '?',
      heavenlyStem: p?.heavenlyStem || '?',
      earthlyBranch: p?.earthlyBranch || '?',
    });
  }

  // 流日: 流月宫下一位=初一
  const dailyMapping = [];
  for (let m = 0; m < 12; m++) {
    const monthPalIdx = (yinIndex + m) % 12;
    const firstDayIdx = (monthPalIdx + 1) % 12; // 下一位=初一
    const monthDays = [];
    for (let d = 0; d < 30; d++) {
      const dayIdx = (firstDayIdx + d) % 12;
      monthDays.push({
        day: d + 1,
        palaceIndex: dayIdx,
        palaceName: palaces[dayIdx]?.name || '?',
      });
    }
    dailyMapping.push({ month: MONTH_NAMES[m], days: monthDays });
  }

  // 生肖位快速定位虚岁
  const zodiacBranch = findZodiacBranch(chart.zodiac);
  const zodiacPalIdx = zodiacBranch != null
    ? BRANCH_INDEX_MAP.get(zodiacBranch)
    : -1;

  // Virtual age formula: 12n + 1 (starting year at zodiac palace = age 1)
  const virtualAges = [];
  for (let cycle = 0; cycle < 10; cycle++) {
    for (let i = 0; i < 12; i++) {
      const age = cycle * 12 + i + 1;
      if (age > 120) break;
      const palIdx = ((zodiacPalIdx + i) % 12 + 12) % 12;
      virtualAges.push({ age, palaceIndex: palIdx, palaceName: palaces[palIdx]?.name || '?' });
    }
  }

  return {
    hit: true,
    details: `流月锚定：本命寅宫=${yinPalaceName}，以此为基准旋转排月日`,
    yinPalace: { name: yinPalaceName, index: yinIndex, branch: '寅' },
    monthlyMapping,
    dailySample: dailyMapping[0], // First month as sample
    zodiacBranch,
    zodiacVirtualAge: zodiacPalIdx >= 0
      ? `生肖${chart.zodiac}(${zodiacBranch})位起虚岁1`
      : '生肖地支未匹配',
    virtualAgeSample: virtualAges.slice(0, 24), // First two cycles
  };
}

function findZodiacBranch(zodiac) {
  const map = { '鼠': '子', '牛': '丑', '虎': '寅', '兔': '卯', '龙': '辰', '蛇': '巳', '马': '午', '羊': '未', '猴': '申', '鸡': '酉', '狗': '戌', '猪': '亥' };
  return map[zodiac] || null;
}
