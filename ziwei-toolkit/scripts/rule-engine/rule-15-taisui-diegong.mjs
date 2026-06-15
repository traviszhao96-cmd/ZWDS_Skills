// Rule 15: 太岁论法 — Year-overlay (太岁) + palace stacking (宫位重叠)
// 虚岁生肖位公式 (12×n+1) + 大限排法顺逆 + 宫位重叠十二宫重排法
// 流命化忌冲本命 = 犯太岁真义
import { getBirthMutagens, getFeigong, getPalace, oppositePalaceIndex, PALACE_NAMES, zodiacBranchIndex, findPalaceByBranch } from './helpers.mjs';

/**
 * Check 太岁论法 + 大限宫位重叠
 * @param {Object} chart - serialized chart
 * @param {number} [targetAge] - target virtual age (default: chart-based calculation)
 */
export function checkTaisuiDiegong(chart, targetAge) {
  const palaces = chart.palaces || [];
  const bm = getBirthMutagens(chart);
  const zIdx = zodiacBranchIndex(chart.zodiac);
  if (zIdx < 0) return { hit: false, details: '生肖地支未匹配' };

  // Virtual age → palace index: (生肖位 + age - 1) % 12
  const ageToPalace = (age) => (zIdx + age - 1) % 12;

  // 大限排法: depends on gender + yin/yang year
  // Male yang year / Female yin year → forward (clockwise)
  // Male yin year / Female yang year → backward (counter-clockwise)
  const chineseYearStem = extractYearStem(chart.chineseDate);
  const isYangYear = '甲丙戊庚壬'.includes(chineseYearStem);
  const isForward = (chart.gender === 'male' && isYangYear) || (chart.gender === 'female' && !isYangYear);

  // Build decade cycle (大限) mapping
  // Each decade starts at a palace and advances according to direction
  const decadalMap = [];
  let currentPalaceIdx = zIdx; // Start from zodiac palace
  const decades = [
    { name: '第一大限', startAge: 1, endAge: 10, span: 10 },
    { name: '第二大限', startAge: 11, endAge: 20, span: 10 },
    { name: '第三大限', startAge: 21, endAge: 30, span: 10 },
    { name: '第四大限', startAge: 31, endAge: 40, span: 10 },
    { name: '第五大限', startAge: 41, endAge: 50, span: 10 },
    { name: '第六大限', startAge: 51, endAge: 60, span: 10 },
    { name: '第七大限', startAge: 61, endAge: 70, span: 10 },
    { name: '第八大限', startAge: 71, endAge: 80, span: 10 },
  ];

  for (const dec of decades) {
    const p = palaces[currentPalaceIdx];
    decadalMap.push({
      ...dec,
      palaceIndex: currentPalaceIdx,
      palaceName: p?.name || '?',
      heavenlyStem: p?.heavenlyStem || '?',
      earthlyBranch: p?.earthlyBranch || '?',
    });
    // Move to next palace (forward or backward)
    currentPalaceIdx = isForward
      ? (currentPalaceIdx + 1) % 12
      : (currentPalaceIdx - 1 + 12) % 12;
  }

  // For a target age, figure out which 大限 it falls in
  let targetDecadal = null;
  let targetPalaceIdx = null;
  if (targetAge) {
    targetDecadal = decadalMap.find(d => targetAge >= d.startAge && targetAge <= d.endAge);
    targetPalaceIdx = ageToPalace(targetAge);
  }

  // 太岁宫 = 流年命宫 = the palace mapped to the target age (or base method)
  // 流命化忌冲本命 = 犯太岁
  const soulIndex = 0; // 本命命宫
  let taisuiClash = null;
  if (targetDecadal) {
    const decPalace = palaces[targetDecadal.palaceIndex];
    const fg = decPalace ? getFeigong(decPalace) : [];
    const jiToSoul = fg.find(f => f.type === '忌' && f.toIndex === soulIndex);
    const jiToSoulOpposite = fg.find(f => f.type === '忌' && f.toIndex === oppositePalaceIndex(soulIndex));

    if (jiToSoul || jiToSoulOpposite) {
      taisuiClash = {
        age: targetAge,
        decadal: targetDecadal.name,
        decadalPalace: targetDecadal.palaceName,
        clash: jiToSoul ? '流命化忌冲本命(直接冲)→真犯太岁'
               : '流命化忌冲本命对宫(间接冲)→太岁影响',
        severity: jiToSoul ? '严重' : '中度',
      };
    }
  }

  return {
    hit: true,
    details: `大限${isForward ? '顺行' : '逆行'}，生肖${chart.zodiac}起`
      + (taisuiClash ? ` ⚠️ ${taisuiClash.age}岁犯太岁！` : ''),
    gender: chart.gender,
    chineseYear: chart.chineseDate,
    yearStem: chineseYearStem,
    isYangYear,
    direction: isForward ? '顺行(阳男/阴女)' : '逆行(阴男/阳女)',
    zodiacBranch: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'][zIdx],
    decadalMap,
    targetAge: targetAge ? {
      age: targetAge,
      currentPalace: targetPalaceIdx != null ? palaces[targetPalaceIdx]?.name : null,
      currentDecadal: targetDecadal?.name,
      currentDecadalPalace: targetDecadal?.palaceName,
      taisuiClash,
    } : null,
  };
}

function extractYearStem(chineseDate) {
  // chineseDate format like "乙巳年...", first char is stem
  if (!chineseDate) return '';
  return chineseDate.charAt(0) || '';
}
