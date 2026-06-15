// Rule 11: 忌冲对宫 — Ji clashing opposite palace = conflict
// 忌喜坐不喜冲：忌坐本宫=己心执着，冲对宫=对外冲突
// Four-step damage chain: 代沟→误会→争执→吵架→分离
// Three thunder zones: 命宫, 疾厄宫, 田宅宫
import { getBirthMutagens, getSelfMutagens, getFeigong, getPalace, MUTAGEN_TYPES, oppositePalaceIndex, PALACE_NAMES } from './helpers.mjs';

const THUNDER_ZONES = new Set(['命宫', '疾厄', '田宅']);

/**
 * Check 忌冲对宫
 * Find all ji (birth/self/feigong) and analyze their clash effect
 */
export function checkJiChongDuiGong(chart) {
  const palaces = chart.palaces || [];
  const bm = getBirthMutagens(chart);
  const clashes = [];

  // 1. Birth ji: sits in one palace, clashes opposite
  for (const m of bm) {
    if (m.type !== '忌') continue;
    const oppIdx = oppositePalaceIndex(m.palaceIndex);
    const oppName = PALACE_NAMES[oppIdx];
    const sitPalace = PALACE_NAMES[m.palaceIndex];

    clashes.push({
      type: '生年忌',
      source: `生年${m.star}化忌`,
      sitPalace,
      clashPalace: oppName,
      description: `生年忌坐${sitPalace}冲${oppName}`,
      isThunderZone: THUNDER_ZONES.has(sitPalace),
      damageChain: THUNDER_ZONES.has(sitPalace)
        ? `⚠️ 雷区！${sitPalace}生年忌：代沟→误会→争执→吵架→分离风险`
        : `忌冲${oppName}→${oppName}领域有冲突压力`,
    });
  }

  // 2. Self ji (离心忌) per palace
  for (const p of palaces) {
    const sm = getSelfMutagens(p);
    if (!sm.includes('忌')) continue;
    const oppIdx = oppositePalaceIndex(p.index);
    const oppName = PALACE_NAMES[oppIdx];

    clashes.push({
      type: '离心忌(自化忌)',
      source: `${p.name}离心忌`,
      sitPalace: p.name,
      clashPalace: oppName,
      description: `自化忌在${p.name}冲${oppName}`,
      isThunderZone: THUNDER_ZONES.has(p.name),
      damageChain: THUNDER_ZONES.has(p.name)
        ? `⚠️ ${p.name}自化忌→能量自我流失并冲对宫${oppName}`
        : `自化忌冲${oppName}→后天自我消解冲突`,
    });
  }

  // 3. Feigong ji
  for (const p of palaces) {
    const fg = getFeigong(p);
    for (const f of fg) {
      if (f.type !== '忌') continue;
      const oppIdx = oppositePalaceIndex(f.toIndex);
      const oppName = PALACE_NAMES[oppIdx];

      clashes.push({
        type: '飞宫忌',
        source: `${f.fromPalace}化忌`,
        sitPalace: f.toPalace,
        clashPalace: oppName,
        description: `飞宫忌${f.fromPalace}→${f.toPalace}冲${oppName}`,
        isThunderZone: THUNDER_ZONES.has(f.toPalace),
        damageChain: THUNDER_ZONES.has(f.toPalace)
          ? `⚠️ 飞宫忌入${f.toPalace}（雷区）冲${oppName}`
          : `飞宫忌冲${oppName}→${f.fromPalace}引发${oppName}冲突`,
      });
    }
  }

  // Sort: birth ji first (most severe)
  const severityOrder = { '生年忌': 0, '离心忌(自化忌)': 1, '飞宫忌': 2 };
  clashes.sort((a, b) => severityOrder[a.type] - severityOrder[b.type]);

  const thunderHits = clashes.filter(c => c.isThunderZone);
  const birthJiClashes = clashes.filter(c => c.type === '生年忌');

  return {
    hit: clashes.length > 0,
    details: `${clashes.length}处忌冲对宫：${birthJiClashes.length}处生年忌，${thunderHits.length}处命中三大雷区(命/疾厄/田宅)`,
    clashes,
    summary: {
      total: clashes.length,
      birthJi: birthJiClashes.length,
      selfJi: clashes.filter(c => c.type === '离心忌(自化忌)').length,
      feigongJi: clashes.filter(c => c.type === '飞宫忌').length,
      thunderZones: thunderHits.map(c => c.sitPalace),
    },
    maxSeverity: thunderHits.length > 0 ? '严重（命中雷区）'
                : birthJiClashes.length > 0 ? '较严重（有生年忌冲）'
                : clashes.length > 0 ? '存在冲突倾向' : '无忌冲',
  };
}
