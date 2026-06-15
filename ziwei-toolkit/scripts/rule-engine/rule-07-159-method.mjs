// Rule 7: 一五九法 — 命财官三合轴向飞宫追踪
// 由体入用沿 1→5→9 轴线逐层推进
import { getFeigong, getBirthMutagens, getPalace, axis159 } from './helpers.mjs';

const SOUL_INDEX = 0; // 命宫

/**
 * Check 一五九法
 * Trace: 命宫飞宫 → 财帛宫(5/idx4) → 官禄宫(9/idx8)
 * Or generically: from any palace along its triad axis
 */
export function check159Method(chart, startIndex = SOUL_INDEX) {
  const palaces = chart.palaces || [];
  const bm = getBirthMutagens(chart);

  // Get triad axis for start palace
  const axis = axis159(startIndex);
  const axisNames = axis.map(i => palaces[i]?.name || '?');

  const layers = [];
  for (const idx of axis) {
    const p = palaces[idx];
    if (!p) continue;
    const fg = getFeigong(p);

    // Check which feigong destinations hit birth mutagens
    const fgHits = [];
    for (const f of fg) {
      const hit = bm.filter(m => m.palaceIndex === f.toIndex);
      if (hit.length > 0) {
        fgHits.push({ from: f.fromPalace, type: f.type, to: f.toPalace, hits: hit.map(h => h.type) });
      }
    }

    layers.push({
      layer: p.name,
      index: idx,
      feigongCount: fg.length,
      hitCount: fgHits.length,
      feigongHits: fgHits,
    });
  }

  const totalHits = layers.reduce((s, l) => s + l.hitCount, 0);

  return {
    hit: totalHits > 0,
    details: `命财官三合轴向：${axisNames.join('→')}，${totalHits}处飞宫遇生年`,
    axis: axisNames,
    layers,
    interpretation: totalHits >= 3 ? '三合轴全线贯通→命财官联动紧密，事业财运有体系支撑'
                    : totalHits === 2 ? '三合轴两处贯通→部分联动，需补缺环'
                    : totalHits === 1 ? '三合轴仅一处贯通→单点支撑，另两角需外力'
                    : '三合轴无飞宫遇生年→命财官脱节，需借力其他宫位',
  };
}
