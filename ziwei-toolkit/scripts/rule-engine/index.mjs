// ZWDS Rule Engine — Master index
// Pure function collection for all 16 rules
// Each rule: checkXxx(chart, ...options) → { hit, details, ... }

export { checkSihuaPersonality } from './rule-01-sihua-personality.mjs';
export { checkExcessIsIllness } from './rule-02-excess-illness.mjs';
export { checkStarNativePalace } from './rule-03-star-native.mjs';
export { checkBodyPalaceDepth } from './rule-04-body-palace.mjs';
export { checkYinYangClassification } from './rule-05-yinyang-pairs.mjs';
export { checkEffectiveFeigong } from './rule-06-effective-feigong.mjs';
export { check159Method } from './rule-07-159-method.mjs';
export { checkHuaChuHuaRu } from './rule-08-huachu-huaru.mjs';
export { checkSquareImagery } from './rule-09-square-imagery.mjs';
export { checkYinYangXiaoZhang } from './rule-10-yinyang-xiaozhang.mjs';
export { checkJiChongDuiGong } from './rule-11-ji-chong-duigong.mjs';
export { checkYiHouShiQian } from './rule-12-yihou-shiqian.mjs';
export { checkMingQianZhiTian } from './rule-13-mingqian-zitian.mjs';
export { checkLiuYueLiuRi } from './rule-14-liuyue-liuri.mjs';
export { checkTaisuiDiegong } from './rule-15-taisui-diegong.mjs';
export { checkShengXiaoMethod } from './rule-16-shengxiao-method.mjs';

// Rule metadata
export const ALL_RULES = [
  { id: 1, name: '四化人格特质', fn: 'checkSihuaPersonality', layer: '命格主轴' },
  { id: 2, name: '过犹不及皆是病', fn: 'checkExcessIsIllness', layer: '命格主轴' },
  { id: 3, name: '星有本宫', fn: 'checkStarNativePalace', layer: '命格主轴' },
  { id: 4, name: '身宫深度判断', fn: 'checkBodyPalaceDepth', layer: '定盘层' },
  { id: 5, name: '六组阴阳宫二分', fn: 'checkYinYangClassification', layer: '定盘层' },
  { id: 6, name: '有效飞宫的判断', fn: 'checkEffectiveFeigong', layer: '体用飞宫' },
  { id: 7, name: '一五九法', fn: 'check159Method', layer: '体用飞宫' },
  { id: 8, name: '化出/化入', fn: 'checkHuaChuHuaRu', layer: '体用飞宫' },
  { id: 9, name: '平方象意取象', fn: 'checkSquareImagery', layer: '自化平方' },
  { id: 10, name: '阴阳消长', fn: 'checkYinYangXiaoZhang', layer: '自化平方' },
  { id: 11, name: '忌冲对宫', fn: 'checkJiChongDuiGong', layer: '自化平方' },
  { id: 12, name: '以后释前', fn: 'checkYiHouShiQian', layer: '时序推运' },
  { id: 13, name: '命签纸田(意外三宫)', fn: 'checkMingQianZhiTian', layer: '时序推运' },
  { id: 14, name: '流月流日推算法', fn: 'checkLiuYueLiuRi', layer: '时序推运' },
  { id: 15, name: '太岁论法+叠宫', fn: 'checkTaisuiDiegong', layer: '时序推运' },
  { id: 16, name: '生肖法', fn: 'checkShengXiaoMethod', layer: '六亲层' },
];

/**
 * Run all rules against a chart
 * @returns {Object} { caseId, name, results: { ruleId: result } }
 */
export async function runAllRules(chart, caseInfo) {
  const results = {};
  const modules = await Promise.all([
    import('./rule-01-sihua-personality.mjs'),
    import('./rule-02-excess-illness.mjs'),
    import('./rule-03-star-native.mjs'),
    import('./rule-04-body-palace.mjs'),
    import('./rule-05-yinyang-pairs.mjs'),
    import('./rule-06-effective-feigong.mjs'),
    import('./rule-07-159-method.mjs'),
    import('./rule-08-huachu-huaru.mjs'),
    import('./rule-09-square-imagery.mjs'),
    import('./rule-10-yinyang-xiaozhang.mjs'),
    import('./rule-11-ji-chong-duigong.mjs'),
    import('./rule-12-yihou-shiqian.mjs'),
    import('./rule-13-mingqian-zitian.mjs'),
    import('./rule-14-liuyue-liuri.mjs'),
    import('./rule-15-taisui-diegong.mjs'),
    import('./rule-16-shengxiao-method.mjs'),
  ]);

  const fns = [
    modules[0].checkSihuaPersonality,
    modules[1].checkExcessIsIllness,
    modules[2].checkStarNativePalace,
    modules[3].checkBodyPalaceDepth,
    modules[4].checkYinYangClassification,
    modules[5].checkEffectiveFeigong,
    modules[6].check159Method,
    modules[7].checkHuaChuHuaRu,
    modules[8].checkSquareImagery,
    modules[9].checkYinYangXiaoZhang,
    modules[10].checkJiChongDuiGong,
    modules[11].checkYiHouShiQian,
    modules[12].checkMingQianZhiTian,
    modules[13].checkLiuYueLiuRi,
    modules[14].checkTaisuiDiegong,
    modules[15].checkShengXiaoMethod,
  ];

  for (let i = 0; i < 16; i++) {
    try {
      results[i + 1] = fns[i](chart);
    } catch (err) {
      results[i + 1] = { hit: false, details: `ERROR: ${err.message}` };
    }
  }

  return {
    caseId: caseInfo?.id || '?',
    name: caseInfo?.name || '?',
    group: caseInfo?.group || '?',
    gender: chart.gender,
    zodiac: chart.zodiac,
    results,
    summary: {
      totalRules: 16,
      hitCount: Object.values(results).filter(r => r.hit).length,
      alerts: Object.entries(results)
        .filter(([, r]) => r.maxSeverity === '严重' || r.warning)
        .map(([id, r]) => ({ rule: ALL_RULES[id - 1]?.name, detail: r.details })),
    },
  };
}
