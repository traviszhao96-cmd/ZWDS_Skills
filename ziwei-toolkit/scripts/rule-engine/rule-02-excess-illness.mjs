// Rule 2: 过犹不及皆是病 — Excess of any type becomes illness
import { getBirthMutagens, getSelfMutagens, getPalace, MUTAGEN_TYPES, getEnergyScore } from './helpers.mjs';

const THRESHOLD = 10; // Energy score above this is "excess"

/**
 * Check 过犹不及皆是病
 * Detects over-concentration of energy in palaces
 * @returns {{ hit: boolean, details: string, excessPalaces: Array }}
 */
export function checkExcessIsIllness(chart) {
  const palaces = chart.palaces || [];
  const excessPalaces = [];
  const bm = getBirthMutagens(chart);

  // Check per-palace energy concentration
  for (const p of palaces) {
    const energy = getEnergyScore(chart, p.index);
    const majorCount = (p.majorStars || []).length;
    const sm = getSelfMutagens(p);
    const bmHere = bm.filter(m => m.palaceIndex === p.index);

    if (energy >= THRESHOLD) {
      const mutTypes = [...bmHere.map(m => m.type), ...sm];
      const hasJi = mutTypes.includes('忌');
      const hasLu = mutTypes.includes('禄');

      excessPalaces.push({
        palace: p.name,
        energy: Math.round(energy * 10) / 10,
        starCount: majorCount,
        birthMutagens: bmHere.map(m => `${m.star}化${m.type}`),
        selfMutagens: sm,
        warning: hasJi ? '忌能量过剩→执念深重、自我折磨' :
                 hasLu ? '禄能量过剩→懒散贪逸、福报透支' :
                 mutTypes.length > 1 ? `多象共聚→${mutTypes.join('+')}复杂交织` :
                 `主星${majorCount}颗密集→过犹不及`,
      });
    }
  }

  // Check same mutagen type concentrated in multiple palaces
  const typeCount = {};
  for (const m of bm) {
    typeCount[m.type] = (typeCount[m.type] || 0) + 1;
  }
  const dominantType = Object.entries(typeCount).find(([, c]) => c >= 3);
  const dominantWarning = dominantType
    ? `${dominantType[0]}遍在${dominantType[1]}宫→${dominantType[0]}为'科' ? '名过其实' : dominantType[0] === '禄' ? '福报分散' : dominantType[0] === '权' ? '到处掌控' : '处处纠结'}`
    : null;

  return {
    hit: excessPalaces.length > 0 || !!dominantWarning,
    details: excessPalaces.length > 0
      ? `${excessPalaces.length}个宫位能量过剩` + (dominantWarning ? `；${dominantWarning}` : '')
      : dominantWarning || '未检测到能量过剩',
    excessPalaces,
    dominantTypeWarning: dominantWarning,
  };
}
