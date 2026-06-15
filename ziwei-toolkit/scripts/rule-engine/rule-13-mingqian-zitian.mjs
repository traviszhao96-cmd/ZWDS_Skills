// Rule 13: 命迁子田 — 意外三宫分析
// 三维度：命宫(己身) + 迁移宫(外出) + 子田线(子女田宅一体两面)
// 命迁一线管外出意外，子田一线管家宅变动
// 忌冲对宫+生年忌+离心忌+飞宫忌 = 越叠越凶
import { getBirthMutagens, getFeigong, getSelfMutagens, getPalace, oppositePalaceIndex, PALACE_NAMES } from './helpers.mjs';

/** Count ji layers in a palace: birth + self + incoming feigong */
function countJiLayers(palace, bm, allPalaces) {
  const bmHere = bm.filter(m => m.palaceIndex === palace.index);
  const sm = getSelfMutagens(palace);
  const fgIn = [];
  for (const src of allPalaces) {
    for (const f of getFeigong(src)) {
      if (f.toIndex === palace.index && f.type === '忌') fgIn.push(f);
    }
  }
  return {
    birthJi: bmHere.filter(m => m.type === '忌').map(m => `${m.star}化忌`),
    selfJi: sm.includes('忌') ? ['离心忌'] : [],
    feigongJi: fgIn.map(f => `${f.fromPalace}化忌入`),
    total: (bmHere.some(m => m.type === '忌') ? 1 : 0) + (sm.includes('忌') ? 1 : 0) + Math.min(fgIn.length, 1),
    rawCount: bmHere.filter(m => m.type === '忌').length + (sm.includes('忌') ? 1 : 0) + fgIn.length,
  };
}

/** Risk label */
function riskLevel(totalJi) {
  if (totalJi >= 3) return '高危';
  if (totalJi >= 2) return '中危';
  if (totalJi >= 1) return '低危';
  return '安全';
}

/**
 * Check 命迁子田
 * 命 = 命宫，迁 = 迁移宫，子田 = 子女田宅线
 */
export function checkMingQianZiTian(chart) {
  const palaces = chart.palaces || [];
  const bm = getBirthMutagens(chart);

  // ━━━ 维度1: 命宫 ━━━
  const mingPalace = palaces.find(p => p.name === '命宫');
  const mingJi = mingPalace ? countJiLayers(mingPalace, bm, palaces) : null;

  // 命宫对宫=迁移，检查迁移冲命
  const mingClashJI = mingPalace ? getFeigong(mingPalace).filter(f => f.type === '忌') : [];
  const mingChongQian = mingClashJI.filter(f => f.toIndex === 6); // 命化忌冲迁移

  // ━━━ 维度2: 迁移宫 ━━━
  const qianPalace = palaces.find(p => p.name === '迁移');
  const qianJi = qianPalace ? countJiLayers(qianPalace, bm, palaces) : null;

  // 迁移宫对宫=命宫，检查迁移冲命
  const qianClashJI = qianPalace ? getFeigong(qianPalace).filter(f => f.type === '忌') : [];
  const qianChongMing = qianClashJI.filter(f => f.toIndex === 0); // 迁移化忌冲命

  // ━━━ 维度3: 子田线（子女+田宅一体）━━━
  const ziPalace = palaces.find(p => p.name === '子女');
  const tianPalace = palaces.find(p => p.name === '田宅');
  const ziJi = ziPalace ? countJiLayers(ziPalace, bm, palaces) : null;
  const tianJi = tianPalace ? countJiLayers(tianPalace, bm, palaces) : null;

  // 子女化忌冲田宅（对宫）
  const ziChongTian = ziPalace ? getFeigong(ziPalace).filter(f => f.type === '忌' && f.toIndex === tianPalace?.index) : [];
  // 田宅化忌冲子女（对宫）
  const tianChongZi = tianPalace ? getFeigong(tianPalace).filter(f => f.type === '忌' && f.toIndex === ziPalace?.index) : [];

  // 子田线综合：取两个宫位忌数之和，再加上互相冲的忌
  const zitianTotalJi = (ziJi?.total || 0) + (tianJi?.total || 0);
  const zitianCrossChong = ziChongTian.length + tianChongZi.length;
  const zitianRisk = riskLevel(zitianTotalJi + zitianCrossChong);

  // ━━━ 命迁交互冲（命冲迁 / 迁冲命）━━━━
  const mingQianCrossChong = mingChongQian.length + qianChongMing.length;

  // ━━━ 三线统合 ━━━
  const dimensions = [
    {
      name: '命宫(己身)',
      ...mingJi,
      risk: riskLevel(mingJi?.total || 0),
      crossChong: mingChongQian.map(f => `命化忌冲迁移`),
      warning: riskLevel(mingJi?.total || 0) === '高危'
        ? '⚠️ 命宫三重忌→自我能量严重受制，需防自身引发的意外'
        : riskLevel(mingJi?.total || 0) === '中危'
        ? '⚡ 命宫双重忌→注意身体与决策失误'
        : mingJi?.total ? '△ 命宫有忌→轻微' : '✓',
    },
    {
      name: '迁移宫(外出)',
      ...qianJi,
      risk: riskLevel(qianJi?.total || 0),
      crossChong: qianChongMing.map(f => `迁移化忌冲命`),
      warning: riskLevel(qianJi?.total || 0) === '高危'
        ? '⚠️ 迁移宫三重忌→外出/交通/远行高风险'
        : riskLevel(qianJi?.total || 0) === '中危'
        ? '⚡ 迁移宫双重忌→出行需格外谨慎'
        : qianJi?.total ? '△ 迁移宫有忌→轻微' : '✓',
    },
    {
      name: '子田线(家宅)',
      ziJi,
      tianJi,
      zitianTotalJi,
      risk: zitianRisk,
      crossChong: [
        ...ziChongTian.map(f => '子女化忌冲田宅'),
        ...tianChongZi.map(f => '田宅化忌冲子女'),
      ],
      warning: zitianRisk === '高危'
        ? '⚠️ 子田线三重忌→家宅变动/搬迁/子女重大事件'
        : zitianRisk === '中危'
        ? '⚡ 子田线双重忌→居家/子女需关注'
        : zitianTotalJi > 0 ? '△ 子田线有忌→轻微' : '✓',
    },
  ];

  const highCount = dimensions.filter(d => d.risk === '高危').length;
  const midCount = dimensions.filter(d => d.risk === '中危').length;
  const lowCount = dimensions.filter(d => d.risk === '低危').length;
  const hasAnyJi = dimensions.some(d => (d.total || 0) > 0);

  // 命迁交叉冲 = 最凶组合
  const crossChongSeverity = mingQianCrossChong >= 2 ? '命迁互相忌冲→双向冲击，外出与己身同时受损'
                            : mingQianCrossChong >= 1 ? '命迁单向忌冲→注意命迁对线冲突'
                            : '';

  return {
    hit: hasAnyJi,
    details: `命迁子田：${highCount}高危，${midCount}中危，${lowCount}低危`
      + (highCount > 0 ? ` ⚠️ 有高危信号！` : '')
      + (crossChongSeverity ? ` | ${crossChongSeverity}` : ''),
    dimensions,
    summary: {
      highRisk: dimensions.filter(d => d.risk === '高危').map(d => d.name),
      midRisk: dimensions.filter(d => d.risk === '中危').map(d => d.name),
      lowRisk: dimensions.filter(d => d.risk === '低危').map(d => d.name),
      mingQianCrossChong,
      crossChongSeverity,
      overallRisk: highCount > 0 ? '高'
                  : midCount > 0 ? '中'
                  : lowCount > 0 ? '低'
                  : '安全',
    },
  };
}
