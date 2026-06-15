// Rule 12: 以后释前 — Later image explains earlier image
// 忌转忌补充生年忌、飞宫平衡应期定位、大限飞宫解释本命
// Core logic: when two related ji events exist, the later one explains/refines the earlier
import { getBirthMutagens, getFeigong, getPalace, MUTAGEN_TYPES, oppositePalaceIndex, PALACE_NAMES } from './helpers.mjs';

/**
 * Check 以后释前
 * For each birth ji, find feigong ji that lands near or relates to it
 * The feigong ji "explains" the birth ji's manifestation channel
 */
export function checkYiHouShiQian(chart) {
  const palaces = chart.palaces || [];
  const bm = getBirthMutagens(chart);
  const explanations = [];

  // Birth ji as "before" (先发象)
  const birthJis = bm.filter(m => m.type === '忌');

  // All feigong ji as "after" (后发象)
  const allFeigong = [];
  for (const p of palaces) {
    const fg = getFeigong(p);
    for (const f of fg) {
      allFeigong.push(f);
    }
  }
  const feigongJis = allFeigong.filter(f => f.type === '忌');

  for (const bj of birthJis) {
    // Find feigong ji that relate:
    // 1. Lands in same palace (most direct)
    // 2. Lands in opposite palace (对立补充)
    // 3. Lands in same triad axis
    const relatedFg = feigongJis.filter(f => {
      if (f.toIndex === bj.palaceIndex) return 'same';
      if (f.toIndex === oppositePalaceIndex(bj.palaceIndex)) return 'opposite';
      // Same triad axis
      const bjTriad = [bj.palaceIndex, (bj.palaceIndex + 4) % 12, (bj.palaceIndex + 8) % 12];
      if (bjTriad.includes(f.toIndex)) return 'triad';
      return false;
    });

    for (const f of relatedFg) {
      const relation = f.toIndex === bj.palaceIndex ? '同位补充(忌转忌→加深)' :
                      f.toIndex === oppositePalaceIndex(bj.palaceIndex) ? '对宫解释(忌冲双向)' :
                      '三合关联(忌在三合轴流转)';

      explanations.push({
        earlier: `生年${bj.star}化忌在${bj.palaceName}`,
        later: `${f.fromPalace}化忌→${f.toPalace}`,
        relation,
        interpretation: relation === '同位补充(忌转忌→加深)'
          ? `${f.fromPalace}飞宫忌转入${f.toPalace}→加重${f.toPalace}忌的困扰，${bj.palaceName}的问题从${f.fromPalace}方向加剧`
          : relation === '对宫解释(忌冲双向)'
          ? `飞宫忌冲对宫→${bj.palaceName}的忌同时冲击${f.toPalace}，冲与被冲双向作用`
          : `${f.fromPalace}在三合轴触发忌流转→间接影响${bj.palaceName}的忌`,
      });
    }
  }

  return {
    hit: explanations.length > 0,
    details: `${explanations.length}处'以后释前'关系：后发飞宫忌解释/补充先发生年忌`,
    explanations,
    summary: {
      total: explanations.length,
      direct: explanations.filter(e => e.relation.startsWith('同位')),
      opposite: explanations.filter(e => e.relation.startsWith('对宫')),
      triad: explanations.filter(e => e.relation.startsWith('三合')),
    },
  };
}
